import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { newsletterConfirmEmail } from "./email/newsletter-templates";
import { activeAccessWhere } from "./membership-access";
import { readPageConfig } from "./page-config";
import { canSend, type Segment, type SubscriberSource, type SubscriberStatus, type UnsubscribeVia } from "./newsletter-rules";
import { confirmUrl, readConfirmToken, readUnsubscribeToken } from "./newsletter-tokens";

/**
 * Suscriptoras de la newsletter de cada creadora (Subscriber). Este módulo es el único que las
 * escribe y mantiene Customer.marketingOptIn como espejo, así que las pantallas de siempre (Clientes,
 * Inscripciones, el perfil de la alumna) siguen diciendo lo mismo.
 *
 * Estados: PENDING (falta confirmar desde el email: doble opt-in) → CONFIRMED → UNSUBSCRIBED, o
 * BOUNCED / COMPLAINED (lo dice el webhook de Resend: no se vuelve a escribir a esa dirección).
 *   · Desde un formulario (cualquiera puede escribir un email ajeno): PENDING + email de confirmación.
 *   · Con el email ya demostrado (sesión verificada, el clic de «Crear mi cuenta», el pago, el enlace
 *     del acceso gratis): CONFIRMED directamente.
 *   · Quien se dio de baja solo vuelve con un consentimiento nuevo y su propio clic.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type SubscribeInput = {
  email: string;
  name?: string | null;
  source: SubscriberSource;
  sourceRef?: string | null;
  consentText: string;
  consentMeta: Record<string, unknown>;
  /** El email ya está demostrado (lo hace la propia persona con su sesión o desde su email). */
  confirmed: boolean;
  at?: Date;
};

export type SubscribeResult = { subscriberId: string; status: SubscriberStatus; needsConfirmation: boolean };

/** Espejo en la ficha de clienta (si la tiene) de esa creadora. */
async function mirror(db: Db, creatorId: string, email: string, on: boolean, at: Date) {
  await db.customer.updateMany({
    where: { creatorId, email: { equals: email, mode: "insensitive" }, marketingOptIn: !on },
    data: on ? { marketingOptIn: true, marketingOptInAt: at } : { marketingOptIn: false, marketingOptInAt: null },
  });
}

export async function subscribe(creatorId: string, i: SubscribeInput, db: Db = prisma): Promise<SubscribeResult> {
  const email = i.email.trim().toLowerCase();
  const at = i.at ?? new Date();
  const consent = { consentAt: at, consentText: i.consentText, consentMeta: i.consentMeta as Prisma.InputJsonValue };
  const prev = await db.subscriber.findUnique({ where: { creatorId_email: { creatorId, email } } });
  if (!prev) {
    const status: SubscriberStatus = i.confirmed ? "CONFIRMED" : "PENDING";
    const row = await db.subscriber.create({
      data: { creatorId, email, name: i.name?.trim() || null, status, source: i.source, sourceRef: i.sourceRef ?? null, ...consent, confirmedAt: i.confirmed ? at : null },
    });
    if (i.confirmed) await mirror(db, creatorId, email, true, at);
    return { subscriberId: row.id, status, needsConfirmation: !i.confirmed };
  }
  const name = prev.name || i.name?.trim() || null;
  const status = prev.status as SubscriberStatus;
  if (status === "CONFIRMED") {
    // Ya está dentro: nunca se la «baja» a pendiente por apuntarse otra vez.
    if (name !== prev.name) await db.subscriber.update({ where: { id: prev.id }, data: { name } });
    await mirror(db, creatorId, email, true, prev.confirmedAt ?? at);
    return { subscriberId: prev.id, status, needsConfirmation: false };
  }
  // Rebote o queja: solo vuelve si lo hace ella misma con su email demostrado.
  if ((status === "BOUNCED" || status === "COMPLAINED") && !i.confirmed) return { subscriberId: prev.id, status, needsConfirmation: false };
  // PENDING, UNSUBSCRIBED (con un consentimiento nuevo) o BOUNCED/COMPLAINED con su email demostrado.
  const next: SubscriberStatus = i.confirmed ? "CONFIRMED" : "PENDING";
  await db.subscriber.update({
    where: { id: prev.id },
    data: {
      status: next,
      name,
      source: status === "PENDING" ? prev.source : i.source,
      sourceRef: status === "PENDING" ? prev.sourceRef : (i.sourceRef ?? null),
      ...consent,
      ...(i.confirmed ? { confirmedAt: at, unsubscribedAt: null, unsubscribeVia: null } : {}),
    },
  });
  if (i.confirmed) await mirror(db, creatorId, email, true, at);
  return { subscriberId: prev.id, status: next, needsConfirmation: !i.confirmed };
}

/**
 * Los sitios de siempre que guardan el consentimiento en la ficha de clienta (crear la cuenta, el
 * checkout, el perfil, el acceso gratis) también lo apuntan aquí, en la misma transacción.
 */
export async function syncConsent(
  db: Db,
  o: { creatorId: string; email: string; name?: string | null; on: boolean; source: SubscriberSource; sourceRef?: string | null; consentText?: string; form: string },
) {
  if (o.on) {
    await subscribe(
      o.creatorId,
      {
        email: o.email,
        name: o.name,
        source: o.source,
        sourceRef: o.sourceRef,
        confirmed: true,
        consentText: o.consentText ?? "Casilla «Quiero recibir novedades» marcada con su email demostrado",
        consentMeta: { form: o.form },
      },
      db,
    );
    return;
  }
  const s = await db.subscriber.findUnique({ where: { creatorId_email: { creatorId: o.creatorId, email: o.email.trim().toLowerCase() } } });
  if (s && (s.status === "CONFIRMED" || s.status === "PENDING"))
    await db.subscriber.update({ where: { id: s.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date(), unsubscribeVia: "PROFILE" } });
}

/** Nombre que firma sus emails: el de su página. */
export function brandName(c: { displayName: string; pagePublished?: unknown; pageDraft?: unknown }) {
  return readPageConfig((c.pagePublished ?? c.pageDraft) as never, c.displayName).displayName || c.displayName;
}

const HOUR = 3_600_000;

/**
 * Email «Confirma que quieres recibir la newsletter» (doble opt-in). Como mucho uno por hora a cada
 * dirección: el formulario no sirve para inundar el buzón de otra persona ni para gastar el cupo.
 */
export async function sendConfirmation(subscriberId: string, now = new Date()): Promise<boolean> {
  const s = await prisma.subscriber.findUnique({ where: { id: subscriberId }, include: { creator: true } });
  if (!s || s.status !== "PENDING") return false;
  if (s.confirmSentAt && now.getTime() - s.confirmSentAt.getTime() < HOUR) return false;
  const claimed = await prisma.subscriber.updateMany({
    where: { id: s.id, OR: [{ confirmSentAt: null }, { confirmSentAt: { lt: new Date(now.getTime() - HOUR) } }] },
    data: { confirmSentAt: now },
  });
  if (!claimed.count) return false;
  await enqueueEmail({
    to: s.email,
    creatorId: s.creatorId,
    template: "NEWSLETTER_CONFIRM",
    dedupeKey: `nl-confirm:${s.id}:${Math.floor(now.getTime() / HOUR)}`,
    ...newsletterConfirmEmail({ creatorName: brandName(s.creator), url: confirmUrl(s.id), name: s.name }),
  });
  return true;
}

export type ConfirmTarget = { subscriberId: string; email: string; status: SubscriberStatus; creatorId: string; creatorName: string; username: string };

async function target(subscriberId: string | null): Promise<ConfirmTarget | null> {
  if (!subscriberId) return null;
  const s = await prisma.subscriber.findUnique({ where: { id: subscriberId }, include: { creator: true } });
  return s ? { subscriberId: s.id, email: s.email, status: s.status as SubscriberStatus, creatorId: s.creatorId, creatorName: brandName(s.creator), username: s.creator.username } : null;
}

/** Suscriptora del enlace de confirmación (para la página), o null si no vale. */
export function confirmTarget(token: string | null | undefined) {
  return target(readConfirmToken(token));
}

/**
 * «Sí, quiero recibirla» (POST de /novedades/confirmar). Solo una pendiente pasa a confirmada:
 * repetirlo no hace nada y un enlace antiguo no resucita a quien se dio de baja después.
 */
export async function confirmByToken(token: string, now = new Date()): Promise<ConfirmTarget | null> {
  const t = await confirmTarget(token);
  if (!t) return null;
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.subscriber.updateMany({ where: { id: t.subscriberId, status: "PENDING" }, data: { status: "CONFIRMED", confirmedAt: now, unsubscribedAt: null, unsubscribeVia: null } });
    if (r.count) await mirror(tx, t.creatorId, t.email, true, now);
    return r.count > 0;
  });
  return { ...t, status: done ? "CONFIRMED" : t.status };
}

export type UnsubscribeTarget = ConfirmTarget & { campaignId: string | null };

/** Suscriptora del enlace de baja (con la newsletter de la que viene), o null. */
export async function unsubscribeTarget(token: string | null | undefined): Promise<UnsubscribeTarget | null> {
  const t = readUnsubscribeToken(token);
  const s = await target(t?.s ?? null);
  return s ? { ...s, campaignId: t?.c ?? null } : null;
}

/** Baja (idempotente). La newsletter de la que vino cuenta la baja en sus estadísticas. */
export async function unsubscribe(creatorId: string, subscriberId: string, via: UnsubscribeVia, campaignId?: string | null, now = new Date()) {
  await prisma.$transaction(async (tx) => {
    const s = await tx.subscriber.findFirst({ where: { id: subscriberId, creatorId } });
    if (!s || s.status === "UNSUBSCRIBED") return;
    await tx.subscriber.update({
      where: { id: s.id },
      data: {
        status: via === "BOUNCE" ? "BOUNCED" : via === "COMPLAINT" ? "COMPLAINED" : "UNSUBSCRIBED",
        unsubscribedAt: now,
        unsubscribeVia: via,
        unsubscribeCampaignId: campaignId ?? null,
      },
    });
    await mirror(tx, creatorId, s.email, false, now);
  });
}

export async function unsubscribeByToken(token: string | null | undefined, via: "LINK" | "ONE_CLICK") {
  const t = await unsubscribeTarget(token);
  if (!t) return null;
  // Una campaña de otra creadora en el enlace (imposible sin la clave) no se apunta la baja.
  const campaign = t.campaignId ? await prisma.campaign.findFirst({ where: { id: t.campaignId, creatorId: t.creatorId }, select: { id: true } }) : null;
  await unsubscribe(t.creatorId, t.subscriberId, via, campaign?.id ?? null);
  return t;
}

/**
 * Rebote permanente o queja (webhook de Resend): esa dirección no vuelve a recibir la newsletter.
 * Se busca por el email, en la creadora del mensaje.
 */
export async function suppressAddress(creatorId: string, email: string, kind: "BOUNCED" | "COMPLAINED", campaignId?: string | null) {
  const s = await prisma.subscriber.findUnique({ where: { creatorId_email: { creatorId, email: email.toLowerCase() } } });
  if (!s || s.status === kind) return;
  await prisma.$transaction(async (tx) => {
    await tx.subscriber.update({ where: { id: s.id }, data: { status: kind, unsubscribedAt: new Date(), unsubscribeVia: kind === "BOUNCED" ? "BOUNCE" : "COMPLAINT", unsubscribeCampaignId: campaignId ?? s.unsubscribeCampaignId } });
    await mirror(tx, creatorId, s.email, false, new Date());
  });
}

/**
 * Bloquear a mano (Newsletter › Envío › Bloqueados): no vuelve a recibir la newsletter. Si no estaba
 * en la lista, se apunta solo como bloqueada (sin consentimiento: nunca recibe nada).
 */
export async function blockAddress(creatorId: string, email: string, now = new Date()) {
  const e = email.trim().toLowerCase();
  await prisma.$transaction(async (tx) => {
    const s = await tx.subscriber.findUnique({ where: { creatorId_email: { creatorId, email: e } } });
    if (s && (s.status === "BOUNCED" || s.status === "COMPLAINED")) return;
    if (s) await tx.subscriber.update({ where: { id: s.id }, data: { status: "BOUNCED", unsubscribedAt: now, unsubscribeVia: "BLOCK" } });
    else await tx.subscriber.create({ data: { creatorId, email: e, status: "BOUNCED", source: "MANUAL", unsubscribedAt: now, unsubscribeVia: "BLOCK" } });
    await mirror(tx, creatorId, e, false, now);
  });
}

/**
 * Desbloquear: si rebotó tras confirmar, vuelve a recibir (el rebote pudo ser pasajero). Si marcó
 * spam, queda dada de baja (puede volver a apuntarse ella). Si solo estaba bloqueada a mano, se borra.
 */
export async function unblockSubscriber(creatorId: string, id: string, now = new Date()): Promise<"restored" | "unsubscribed" | "deleted" | null> {
  return prisma.$transaction(async (tx) => {
    const s = await tx.subscriber.findFirst({ where: { id, creatorId, status: { in: ["BOUNCED", "COMPLAINED"] } } });
    if (!s) return null;
    if (!s.consentAt && !s.confirmedAt) {
      await tx.subscriber.delete({ where: { id: s.id } });
      return "deleted";
    }
    if (s.status === "BOUNCED" && s.confirmedAt) {
      await tx.subscriber.update({ where: { id: s.id }, data: { status: "CONFIRMED", unsubscribedAt: null, unsubscribeVia: null } });
      await mirror(tx, creatorId, s.email, true, now);
      return "restored";
    }
    await tx.subscriber.update({ where: { id: s.id }, data: { status: "UNSUBSCRIBED", unsubscribeVia: "OWNER", unsubscribedAt: s.unsubscribedAt ?? now } });
    return "unsubscribed";
  });
}

// ── A quién va una newsletter ──

/** Emails (minúsculas) de quien cumple el segmento, sin mirar todavía si está suscrita. */
async function segmentEmails(creatorId: string, s: Segment, now: Date): Promise<string[] | null> {
  if (s.kind === "product") {
    const orders = await prisma.order.findMany({ where: { creatorId, productId: s.productId, status: "PAID" }, select: { buyerEmail: true } });
    return orders.map((o) => o.buyerEmail.toLowerCase());
  }
  if (s.kind === "member") {
    const rows = await prisma.access.findMany({
      where: { creatorId, product: { type: "MEMBERSHIP", creatorId }, ...activeAccessWhere(now) },
      select: { user: { select: { email: true } } },
    });
    return rows.map((r) => r.user.email.toLowerCase());
  }
  return null;
}

/** El filtro de un segmento (sin el estado): todas, compradoras de un producto o miembros. */
async function segmentFilter(creatorId: string, s: Segment, now: Date): Promise<Prisma.SubscriberWhereInput> {
  const emails = await segmentEmails(creatorId, s, now);
  return emails ? { email: { in: [...new Set(emails)] } } : {};
}

/** Ids de las suscriptoras CONFIRMADAS del segmento (las únicas a las que se envía). */
export async function resolveSegment(creatorId: string, s: Segment, now = new Date()): Promise<string[]> {
  const w = await segmentFilter(creatorId, s, now);
  const rows = await prisma.subscriber.findMany({ where: { AND: [{ creatorId, status: "CONFIRMED" }, w] }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => r.id);
}

export async function segmentCount(creatorId: string, s: Segment, now = new Date()): Promise<number> {
  const w = await segmentFilter(creatorId, s, now);
  return prisma.subscriber.count({ where: { AND: [{ creatorId, status: "CONFIRMED" }, w] } });
}

export { canSend };

/** Página pública de la dueña (para los enlaces de vuelta). */
export function siteHomeUrl(username: string, personal: boolean) {
  return personal ? `${appUrl()}/` : `${appUrl()}/${username}`;
}
