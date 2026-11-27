import { productPath } from "@/lib/public-paths";
import "server-only";
import { accessGrantedAt } from "./free-access-rules";
import { lastDayText, REMIND_BEFORE_DAYS, shouldRemindEnding } from "./access-end";
import { automationSetting } from "./automations";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import * as T from "./email/templates";
import { captureError } from "./monitoring";
import { emailAlreadyQueued, revokeOrderAccess } from "./order-links";
import { inMail } from "@/lib/i18n/email";

/**
 * Cron «caducidades»: accesos con fecha de fin que no son de una suscripción (los que dio la dueña a
 * mano con «Duración del acceso»).
 *
 * El acceso NO depende de este cron: cada comprobación mira Access.expiresAt con la hora de ese
 * momento, así que termina a su hora aunque el cron se retrase o falle. Aquí solo:
 *   1. se avisa a la persona 7 días antes (si el acceso duraba al menos 14 días);
 *   2. al llegar la fecha, se marca EXPIRED (UPDATE condicional: dos ejecuciones a la vez no lo
 *      hacen dos veces), se cortan sus enlaces personales y sesiones limitadas, y se avisa a ella y a
 *      la dueña.
 * Los emails llevan dedupeKey con la fecha de fin: si la dueña la cambia, se vuelven a armar.
 * Las suscripciones las cierra processRenewals (lib/subscriptions.ts).
 */
export async function processAccessExpiry(now = new Date()): Promise<number> {
  let done = 0;
  const DAY = 86_400_000;
  const include = { product: { include: { creator: { include: { user: { select: { email: true } } } } } }, user: { select: { email: true, name: true } } } as const;

  const ending = await prisma.access.findMany({
    where: { status: "ACTIVE", subscriptionId: null, expiresAt: { gt: now, lte: new Date(now.getTime() + REMIND_BEFORE_DAYS * DAY) } },
    include,
    take: 200,
  });
  for (const a of ending) {
    try {
      const order = a.orderId ? await prisma.order.findUnique({ where: { id: a.orderId }, select: { metadata: true, paidAt: true, createdAt: true } }) : null;
      const grantedAt = accessGrantedAt(order?.metadata) ?? order?.paidAt ?? order?.createdAt ?? a.createdAt;
      if (!shouldRemindEnding({ expiresAt: a.expiresAt!, grantedAt, now })) continue;
      const s = await automationSetting(a.creatorId, "ACCESS_ENDING");
      if (!s.enabled) continue;
      const c = a.product.creator;
      const dedupeKey = `access-ending:${a.id}:${a.expiresAt!.getTime()}`;
      if (await emailAlreadyQueued(dedupeKey)) continue;
      await enqueueEmail({
        to: a.user.email,
        creatorId: a.creatorId,
        userId: a.userId,
        template: "ACCESS_ENDING",
        dedupeKey,
        ...(await inMail(a.user.email, () => T.accessEndingEmail({
          creatorName: c.displayName,
          productTitle: a.product.title,
          until: lastDayText(a.expiresAt!, c.timezone, now),
          membership: a.product.type === "MEMBERSHIP",
          cta: a.product.type === "MEMBERSHIP" ? null : buyAgain(a.product, c.username),
        }))),
      });
      done++;
    } catch (e) {
      captureError(e, { area: "caducidades", extra: { accessId: a.id } });
    }
  }

  const ended = await prisma.access.findMany({ where: { status: "ACTIVE", subscriptionId: null, expiresAt: { lte: now } }, include, take: 200 });
  for (const a of ended) {
    try {
      const flip = await prisma.access.updateMany({ where: { id: a.id, status: "ACTIVE", subscriptionId: null, expiresAt: a.expiresAt }, data: { status: "EXPIRED" } });
      if (!flip.count) continue;
      done++;
      if (a.orderId) await revokeOrderAccess(a.orderId);
      const c = a.product.creator;
      const key = `${a.id}:${a.expiresAt!.getTime()}`;
      if ((await automationSetting(a.creatorId, "ACCESS_ENDING")).enabled)
        await enqueueEmail({
          to: a.user.email,
          creatorId: a.creatorId,
          userId: a.userId,
          template: "ACCESS_ENDED",
          dedupeKey: `access-ended:${key}`,
          ...(await inMail(a.user.email, () => T.accessEndedEmail({ creatorName: c.displayName, productTitle: a.product.title, cta: a.product.type === "MEMBERSHIP" ? null : buyAgain(a.product, c.username) }))),
        });
      if ((await automationSetting(a.creatorId, "MEMBER_ENDED")).enabled) {
        const customer = await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: a.creatorId, userId: a.userId } }, select: { name: true } });
        await enqueueEmail({
          to: c.contactEmail || c.user.email,
          creatorId: a.creatorId,
          template: "ACCESS_ENDED_OWNER",
          dedupeKey: `access-ended-owner:${key}`,
          ...(await inMail(c.contactEmail || c.user.email, () => T.accessEndedCreatorEmail({
            productTitle: a.product.title,
            person: customer?.name || a.user.name || a.user.email,
            ended: lastDayText(a.expiresAt!, c.timezone, now),
            url: a.product.type === "MEMBERSHIP" ? `${appUrl()}/panel/comunidad?tab=miembros&nivel=${a.productId}` : `${appUrl()}/panel/productos/${a.productId}#accesos`,
          }))),
        });
      }
    } catch (e) {
      captureError(e, { area: "caducidades", extra: { accessId: a.id } });
    }
  }
  return done;
}

/** Botón del aviso: la ficha pública si se puede volver a conseguir ahí; si no, que responda al email. */
function buyAgain(product: { status: string; slug: string; type: string }, username: string) {
  if (product.status !== "PUBLISHED") return null;
  return { label: product.type === "MEMBERSHIP" ? "Volver a unirme" : "Ver cómo seguir", url: `${appUrl()}${productPath(username, product)}` };
}
