import "server-only";
import { Prisma } from "@prisma/client";
import { addMonthsToKey, lastDayKey, lastDayText } from "./access-end";
import { prisma } from "./db";
import { appUrl } from "./env";
import { esc, p } from "./email/html";
import { enqueueEmail } from "./email/outbox";
import { layout } from "./email/templates";
import { revokeOrderAccess } from "./order-links";
import { addDaysToKey, dateKeyInTz, zonedTimeToUtc } from "./tz";

/**
 * Membresías que se pagan por email (la web no cobra): cada una dura un periodo (mes o año). 5 días
 * antes le llega un email para renovarla (lib/access-expiry.ts); el día que vence se bloquea sola.
 * En Comunidad › Miembros la dueña pulsa el tick verde cuando ha pagado (otro periodo más) o la X
 * para bloquearla ya.
 */
export const periodMonths = (interval: string | null | undefined) => (interval === "year" ? 12 : 1);

/** Fin de un periodo que empieza hoy (en la zona de la dueña). */
export function firstPeriodEnd(interval: string | null | undefined, timeZone: string, now = new Date()): Date {
  const last = addMonthsToKey(dateKeyInTz(now, timeZone), periodMonths(interval));
  return zonedTimeToUtc(addDaysToKey(last, 1), 0, timeZone);
}

async function memberAccess(creatorId: string, accessId: string) {
  const a = await prisma.access.findFirst({
    where: { id: accessId, creatorId, product: { type: "MEMBERSHIP" } },
    include: { product: { select: { title: true, billingInterval: true } }, user: { select: { email: true, name: true } }, creator: { select: { timezone: true, displayName: true } } },
  });
  if (!a) throw new Error("Miembro no encontrado");
  return a;
}

async function setOrderMeta(orderId: string | null, set: Record<string, string>, remove: string[] = []) {
  if (!orderId) return;
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { metadata: true } });
  const meta = { ...((o?.metadata ?? {}) as Record<string, unknown>), ...set };
  for (const k of remove) delete meta[k];
  await prisma.order.update({ where: { id: orderId }, data: { metadata: meta as Prisma.InputJsonObject } });
}

/**
 * Tick verde: ha pagado. Un periodo más desde que vencía (o desde hoy si ya estaba vencida o
 * bloqueada), vuelve a entrar y le llega un email.
 */
export async function renewMembership(creatorId: string, accessId: string, now = new Date()) {
  const a = await memberAccess(creatorId, accessId);
  const tz = a.creator.timezone;
  const live = a.status === "ACTIVE" && !!a.expiresAt && a.expiresAt > now;
  const fromKey = live ? lastDayKey(a.expiresAt!, tz) : addDaysToKey(dateKeyInTz(now, tz), -1);
  const until = zonedTimeToUtc(addDaysToKey(addMonthsToKey(fromKey, periodMonths(a.product.billingInterval)), 1), 0, tz);
  await prisma.access.update({ where: { id: a.id }, data: { status: "ACTIVE", expiresAt: until } });
  await setOrderMeta(a.orderId, { accessUntil: until.toISOString(), renewedAt: now.toISOString() }, ["revokedAt"]);
  const untilText = lastDayText(until, tz, now);
  await enqueueEmail({
    to: a.user.email,
    creatorId,
    userId: a.userId,
    template: "MEMBERSHIP_RENEWED",
    dedupeKey: `membership-renewed:${a.id}:${until.getTime()}`,
    subject: `Tu membresía «${a.product.title}» está renovada`,
    html: layout({
      brand: a.creator.displayName,
      title: "Membresía renovada",
      body: p(`Gracias${a.user.name ? `, ${esc(a.user.name.split(" ")[0])}` : ""}. Tu membresía <strong>${esc(a.product.title)}</strong> sigue abierta hasta el <strong>${esc(untilText)}</strong> (incluido).`),
      cta: { label: "Entrar", url: `${appUrl()}/cuenta` },
    }),
  });
  return untilText;
}

/** X: no ha pagado. Se bloquea ya (con el tick verde vuelve a entrar). */
export async function blockMembership(creatorId: string, accessId: string, now = new Date()) {
  const a = await memberAccess(creatorId, accessId);
  await prisma.access.update({ where: { id: a.id }, data: { status: "REVOKED" } });
  await setOrderMeta(a.orderId, { revokedAt: now.toISOString() });
  if (a.orderId) await revokeOrderAccess(a.orderId);
}
