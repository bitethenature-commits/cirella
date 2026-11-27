import "server-only";
import { automationSetting, customEmail } from "./automations";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import * as T from "./email/templates";
import { captureError } from "./monitoring";
import { emailAlreadyQueued } from "./order-links";
import { inMail } from "@/lib/i18n/email";

/**
 * Cron «teEchoDeMenos»: a quien sigue teniendo acceso pero lleva días sin entrar en su área (los que
 * eligió la dueña), un email cariñoso para volver. Una vez por ausencia: la clave lleva su último acceso.
 */
export async function processMissYou(now = new Date()): Promise<number> {
  const creators = await prisma.access.findMany({ where: { status: "ACTIVE" }, distinct: ["creatorId"], select: { creatorId: true } });
  let done = 0;
  for (const { creatorId } of creators) {
    try {
      const s = await automationSetting(creatorId, "MISS_YOU");
      if (!s.enabled) continue;
      const since = new Date(now.getTime() - Math.max(1440, s.delayMinutes) * 60000);
      const accesses = await prisma.access.findMany({
        where: {
          creatorId,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          createdAt: { lte: since },
          user: { OR: [{ lastLoginAt: { lte: since } }, { lastLoginAt: null }] },
        },
        include: { product: { select: { title: true } }, user: { select: { id: true, email: true, name: true, lastLoginAt: true } } },
        take: 500,
      });
      const byUser = new Map<string, { user: (typeof accesses)[number]["user"]; items: string[] }>();
      for (const a of accesses) {
        const u = byUser.get(a.userId) ?? { user: a.user, items: [] };
        u.items.push(a.product.title);
        byUser.set(a.userId, u);
      }
      for (const { user, items } of byUser.values()) {
        const dedupeKey = `miss-you:${creatorId}:${user.id}:${user.lastLoginAt?.toISOString() ?? "nunca"}`;
        if (await emailAlreadyQueued(dedupeKey)) continue;
        const name = user.name?.trim().split(/\s+/)[0] || null;
        const custom = customEmail(s, { nombre: name, mi_nombre: s.creator.displayName });
        const mail = await inMail(user.email, () => T.missYouEmail({ name, creatorName: s.creator.displayName, url: `${appUrl()}/area`, items, introHtml: custom.introHtml }));
        await enqueueEmail({
          to: user.email,
          creatorId,
          userId: user.id,
          template: "MISS_YOU",
          dedupeKey,
          replyTo: s.creator.contactEmail || s.creator.user.email,
          ...(custom.subject ? { ...mail, subject: custom.subject } : mail),
        });
        done++;
      }
    } catch (e) {
      captureError(e, { area: "cron", tags: { job: "teEchoDeMenos" } });
    }
  }
  return done;
}
