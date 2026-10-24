import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { newsletterConfirmEmail } from "./email/newsletter-templates";
import { activeAccessWhere } from "./membership-access";
import { readPageConfig } from "./page-config";
import { csvCell } from "./csv";
import {
  canSend,
  normalizeTags,
  SOURCE_LABEL,
  STATUS_LABEL,
  type ImportRow,
  type Segment,
  type SubscriberSource,
  type SubscriberStatus,
  type UnsubscribeVia,
} from "./newsletter-rules";
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
 *   · Una importación nunca resucita a quien se dio de baja, rebotó o se quejó.
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
  tags?: string[];
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
  const tags = normalizeTags(i.tags ?? []);
  const consent = { consentAt: at, consentText: i.consentText, consentMeta: i.consentMeta as Prisma.InputJsonValue };
  const prev = await db.subscriber.findUnique({ where: { creatorId_email: { creatorId, email } } });
  if (!prev) {
    const status: SubscriberStatus = i.confirmed ? "CONFIRMED" : "PENDING";
    const row = await db.subscriber.create({
      data: { creatorId, email, name: i.name?.trim() || null, status, source: i.source, sourceRef: i.sourceRef ?? null, tags, ...consent, confirmedAt: i.confirmed ? at : null },
    });
    if (i.confirmed) await mirror(db, creatorId, email, true, at);
    return { subscriberId: row.id, status, needsConfirmation: !i.confirmed };
  }
  const mergedTags = normalizeTags([...prev.tags, ...tags]);
  const name = prev.name || i.name?.trim() || null;
  const status = prev.status as SubscriberStatus;
  if (status === "CONFIRMED") {
    // Ya está dentro: nunca se la «baja» a pendiente por apuntarse otra vez.
    if (mergedTags.length !== prev.tags.length || name !== prev.name) await db.subscriber.update({ where: { id: prev.id }, data: { tags: mergedTags, name } });
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
      tags: mergedTags,
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
  if (done) {
    const { sendNewsletterWelcome } = await import("./newsletter-send");
    await sendNewsletterWelcome(t.subscriberId).catch(() => {});
  }
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

// ── Segmentos ──

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

function segmentWhere(creatorId: string, s: Segment, emails: string[] | null): Prisma.SubscriberWhereInput {
  return { creatorId, status: "CONFIRMED", ...(s.kind === "tag" ? { tags: { has: s.tag } } : {}), ...(emails ? { email: { in: [...new Set(emails)] } } : {}) };
}

/** Ids de las suscriptoras CONFIRMADAS del segmento (las únicas a las que se envía). */
export async function resolveSegment(creatorId: string, s: Segment, now = new Date()): Promise<string[]> {
  const rows = await prisma.subscriber.findMany({ where: segmentWhere(creatorId, s, await segmentEmails(creatorId, s, now)), select: { id: true }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => r.id);
}

export async function segmentCount(creatorId: string, s: Segment, now = new Date()): Promise<number> {
  return prisma.subscriber.count({ where: segmentWhere(creatorId, s, await segmentEmails(creatorId, s, now)) });
}

/** Etiquetas en uso (para los filtros y el segmento «Etiqueta»). */
export async function subscriberTags(creatorId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tag: string }[]>`SELECT DISTINCT unnest("tags") AS tag FROM "Subscriber" WHERE "creatorId" = ${creatorId} ORDER BY tag`;
  return rows.map((r) => r.tag);
}

// ── Importar y exportar ──

export type ImportSummary = { added: number; updated: number; skipped: { line: number; email: string; reason: string }[]; confirmationsSent: number };

/**
 * Importa las filas ya validadas (parseImportCsv). «confirmed»: entran confirmadas con su fecha de
 * consentimiento y la declaración de la dueña; «ask»: entran pendientes y reciben el email de
 * confirmación. Nunca se tocan las dadas de baja, rebotadas o con queja, ni las ya confirmadas.
 */
export async function importSubscribers(
  creatorId: string,
  rows: ImportRow[],
  o: { mode: "confirmed" | "ask"; file: string; declaredBy: string; declaration: string; tags?: string[] },
): Promise<ImportSummary> {
  const out: ImportSummary = { added: 0, updated: 0, skipped: [], confirmationsSent: 0 };
  const existing = new Map(
    (await prisma.subscriber.findMany({ where: { creatorId, email: { in: rows.map((r) => r.email) } }, select: { email: true, status: true } })).map((s) => [s.email, s.status]),
  );
  const extraTags = normalizeTags(o.tags ?? []);
  const toConfirm: string[] = [];
  for (const r of rows) {
    const prev = existing.get(r.email);
    if (prev && prev !== "PENDING") {
      out.skipped.push({ line: r.line, email: r.email, reason: prev === "CONFIRMED" ? "ya estaba confirmada" : `${STATUS_LABEL[prev as SubscriberStatus].toLowerCase()}: no se vuelve a añadir` });
      continue;
    }
    const res = await subscribe(creatorId, {
      email: r.email,
      name: r.name,
      source: "IMPORT",
      sourceRef: o.file.slice(0, 120),
      tags: [...r.tags, ...extraTags],
      confirmed: o.mode === "confirmed",
      at: r.consentAt,
      consentText: o.declaration,
      consentMeta: { form: "import", file: o.file.slice(0, 120), line: r.line, declaredBy: o.declaredBy, importedAt: new Date().toISOString() },
    });
    if (prev) out.updated++;
    else out.added++;
    if (res.needsConfirmation) toConfirm.push(res.subscriberId);
  }
  for (const id of toConfirm) if (await sendConfirmation(id)) out.confirmationsSent++;
  return out;
}

/** CSV de todas sus suscriptoras (a prueba de fórmulas: csvCell). */
export async function exportSubscribersCsv(creatorId: string): Promise<string> {
  const rows = await prisma.subscriber.findMany({ where: { creatorId }, orderBy: { createdAt: "asc" } });
  const iso = (d: Date | null) => (d ? d.toISOString() : "");
  const lines = [
    ["email", "nombre", "estado", "origen", "etiquetas", "fecha_consentimiento", "texto_consentimiento", "confirmada", "baja"],
    ...rows.map((s) => [
      s.email,
      s.name ?? "",
      STATUS_LABEL[s.status as SubscriberStatus] ?? s.status,
      SOURCE_LABEL[s.source as SubscriberSource] ?? s.source,
      s.tags.join(", "),
      iso(s.consentAt),
      s.consentText ?? "",
      iso(s.confirmedAt),
      iso(s.unsubscribedAt),
    ]),
  ];
  return lines.map((r) => r.map(csvCell).join(",")).join("\n");
}

export { canSend };

/** Página pública de la dueña (para los enlaces de vuelta). */
export function siteHomeUrl(username: string, personal: boolean) {
  return personal ? `${appUrl()}/` : `${appUrl()}/${username}`;
}
