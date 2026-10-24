import "server-only";
import { automationSetting } from "./automations";
import { defaultEmailDesign, defaultEmailSubject } from "./automation-catalog";
import { prisma } from "./db";
import { appUrl } from "./env";
import { readDesign, type EmailDesign } from "./email-blocks";
import { campaignEmail, type NewsletterFooter } from "./email/newsletter-templates";
import { BULK_TEMPLATES, enqueueEmail, sendingQuota } from "./email/outbox";
import { formatLegalAddress } from "./legal";
import { brandName, resolveSegment } from "./newsletter";
import { canSend, parseSegment } from "./newsletter-rules";
import { unsubscribeHeaders, unsubscribeUrl } from "./newsletter-tokens";

/**
 * Envío de la newsletter, por la bandeja de salida de siempre (lib/email/outbox.ts).
 *
 *   · startCampaign: «Enviar ahora» fija las destinatarias (CampaignRecipient: la lista no cambia a
 *     mitad) y la pone SENDING; «Programar» la deja SCHEDULED con su hora.
 *   · processCampaigns (cron «newsletter», antes de «emails»): empieza las programadas que tocan y
 *     mete en la bandeja tantas como quepan en el cupo diario (lib/email/outbox.ts sendingQuota: el
 *     límite de Resend menos la reserva para los transaccionales). Lo que no cabe sale en las
 *     siguientes ejecuciones, también al día siguiente, hasta terminar.
 *   · Cada email se prepara para una persona (su nombre, su enlace de baja) justo antes de salir y se
 *     vuelve a mirar que siga confirmada (si se dio de baja después de empezar, se salta).
 *   · dedupeKey nl:{campaña}:{suscriptora}: aunque dos procesos coincidan, nadie recibe dos.
 */

const PER_RUN = 500;

type CreatorForMail = {
  id: string;
  username: string;
  displayName: string;
  pagePublished: unknown;
  pageDraft: unknown;
  legalName: string | null;
  legalAddress: string | null;
  legalPostalCode: string | null;
  legalCity: string | null;
  legalCountry: string;
  legalEmail: string | null;
};

/** Pie legal de las newsletters de una creadora (sus datos de Ajustes › Datos legales). */
export function newsletterFooter(c: CreatorForMail, unsubscribe: string | null): NewsletterFooter {
  return {
    senderName: brandName(c),
    legalName: c.legalName,
    legalAddress: formatLegalAddress(c) || null,
    legalEmail: c.legalEmail,
    legalUrl: `${appUrl()}/${c.username}/legal`,
    unsubscribeUrl: unsubscribe,
  };
}

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null;

/** La newsletter para una persona: sus variables y su enlace de baja. */
export function renderCampaignFor(
  c: { subject: string; preheader: string | null; design: unknown },
  creator: CreatorForMail,
  to: { id: string | null; name: string | null },
  o: { campaignId?: string | null; test?: boolean } = {},
) {
  return campaignEmail({
    brand: brandName(creator),
    subject: c.subject,
    preheader: c.preheader,
    design: readDesign(c.design) ?? { v: 1, blocks: [] },
    baseUrl: appUrl(),
    vars: { nombre: firstName(to.name), mi_nombre: brandName(creator) },
    footer: newsletterFooter(creator, to.id && !o.test ? unsubscribeUrl(to.id, o.campaignId) : null),
    test: o.test,
  });
}

export type StartResult = { ok: true; recipients: number; scheduled?: Date } | { ok: false; error: string };

/** «Enviar ahora» (sin `at` o con una hora pasada) o «Programar» (con `at` futura). */
export async function startCampaign(creatorId: string, campaignId: string, o: { at?: Date | null; now?: Date } = {}): Promise<StartResult> {
  const now = o.now ?? new Date();
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, creatorId } });
  if (!c || (c.status !== "DRAFT" && c.status !== "SCHEDULED")) return { ok: false, error: "Esta newsletter ya se ha enviado o cancelado." };
  if (!c.subject.trim()) return { ok: false, error: "Escribe el asunto antes de enviarla." };
  if (!readDesign(c.design)?.blocks.length) return { ok: false, error: "La newsletter está vacía: añade un texto." };
  const ids = await resolveSegment(creatorId, parseSegment(c.segment), now);
  if (!ids.length) return { ok: false, error: "No hay nadie confirmado en este grupo todavía." };
  if (o.at && o.at > now) {
    await prisma.campaign.updateMany({ where: { id: c.id, creatorId, status: { in: ["DRAFT", "SCHEDULED"] } }, data: { status: "SCHEDULED", scheduledAt: o.at } });
    return { ok: true, recipients: ids.length, scheduled: o.at };
  }
  return materialize(creatorId, c.id, now);
}

/** Fija las destinatarias y la pone en marcha (solo una vez: la condición sobre el estado). */
async function materialize(creatorId: string, campaignId: string, now: Date): Promise<StartResult> {
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, creatorId } });
  if (!c) return { ok: false, error: "No encontrada" };
  const ids = await resolveSegment(creatorId, parseSegment(c.segment), now);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.campaign.updateMany({
      where: { id: c.id, creatorId, status: { in: ["DRAFT", "SCHEDULED"] } },
      data: { status: ids.length ? "SENDING" : "SENT", startedAt: now, recipientsCount: ids.length, ...(ids.length ? {} : { finishedAt: now }) },
    });
    if (!claimed.count) return { ok: false as const, error: "Esta newsletter ya se está enviando." };
    for (let i = 0; i < ids.length; i += 1000)
      await tx.campaignRecipient.createMany({ data: ids.slice(i, i + 1000).map((subscriberId) => ({ creatorId, campaignId: c.id, subscriberId })), skipDuplicates: true });
    return { ok: true as const, recipients: ids.length };
  });
}

/** Cron «newsletter». Devuelve cuántos emails ha metido en la bandeja. */
export async function processCampaigns(now = new Date()): Promise<number> {
  const due = await prisma.campaign.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, select: { id: true, creatorId: true } });
  for (const c of due) await materialize(c.creatorId, c.id, now);

  const quota = await sendingQuota(now);
  // Lo masivo que ya espera en la bandeja también cuenta: no se encola más de lo que cabe hoy.
  const waiting = Number.isFinite(quota.bulk) ? await prisma.emailMessage.count({ where: { status: { in: ["QUEUED", "SENDING"] }, template: { in: [...BULK_TEMPLATES] } } }) : 0;
  let budget = Math.min(PER_RUN, quota.bulk - waiting);
  let created = 0;
  const sending = await prisma.campaign.findMany({ where: { status: "SENDING" }, orderBy: { startedAt: "asc" }, include: { creator: true } });
  for (const c of sending) {
    while (budget > 0) {
      const batch = await prisma.campaignRecipient.findMany({
        where: { campaignId: c.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: Math.min(budget, 100),
        include: { subscriber: true },
      });
      if (!batch.length) break;
      for (const r of batch) {
        const claim = await prisma.campaignRecipient.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: canSend(r.subscriber.status) ? "QUEUED" : "SKIPPED" } });
        if (!claim.count || !canSend(r.subscriber.status)) continue;
        const mail = renderCampaignFor(c, c.creator, { id: r.subscriberId, name: r.subscriber.name }, { campaignId: c.id });
        const msg = await enqueueEmail({
          to: r.subscriber.email,
          creatorId: c.creatorId,
          template: "NEWSLETTER",
          dedupeKey: `nl:${c.id}:${r.subscriberId}`,
          sendNow: false,
          stream: "news",
          campaignId: c.id,
          headers: unsubscribeHeaders(r.subscriberId, c.id),
          ...mail,
        });
        await prisma.campaignRecipient.update({ where: { id: r.id }, data: { emailMessageId: msg.id } });
        created++;
        budget--;
      }
    }
    // Todas en la bandeja (o saltadas): la newsletter está enviada.
    const left = await prisma.campaignRecipient.count({ where: { campaignId: c.id, status: "PENDING" } });
    if (!left) await prisma.campaign.updateMany({ where: { id: c.id, status: "SENDING" }, data: { status: "SENT", finishedAt: now } });
    if (budget <= 0) break;
  }
  return created;
}

/** «Enviarme una prueba»: a ella, con «[Prueba]» y la baja desactivada. No cuenta en las estadísticas. */
export async function sendTest(creatorId: string, campaignId: string, to: string) {
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, creatorId }, include: { creator: true } });
  if (!c) return false;
  await enqueueEmail({
    to,
    creatorId,
    template: "NEWSLETTER_TEST",
    // Transaccional: la prueba llega aunque el cupo de la newsletter de hoy esté gastado.
    stream: "tx",
    replyTo: null,
    ...renderCampaignFor(c, c.creator, { id: null, name: c.creator.displayName }, { test: true }),
  });
  return true;
}

export async function pauseCampaign(creatorId: string, id: string) {
  await prisma.campaign.updateMany({ where: { id, creatorId, status: "SENDING" }, data: { status: "PAUSED" } });
}

export async function resumeCampaign(creatorId: string, id: string) {
  await prisma.campaign.updateMany({ where: { id, creatorId, status: "PAUSED" }, data: { status: "SENDING" } });
}

/** Cancelar: lo que falta no sale (ni lo que espera en la bandeja). Lo ya enviado, enviado está. */
export async function cancelCampaign(creatorId: string, id: string) {
  const r = await prisma.campaign.updateMany({ where: { id, creatorId, status: { in: ["SCHEDULED", "SENDING", "PAUSED"] } }, data: { status: "CANCELED", finishedAt: new Date() } });
  if (!r.count) return false;
  await prisma.campaignRecipient.updateMany({ where: { campaignId: id, creatorId, status: "PENDING" }, data: { status: "SKIPPED" } });
  await prisma.emailMessage.updateMany({ where: { campaignId: id, creatorId, status: "QUEUED" }, data: { status: "CANCELED" } });
  return true;
}

export type CampaignStats = {
  recipients: number;
  pending: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  skipped: number;
};

export async function campaignStats(creatorId: string, id: string): Promise<CampaignStats> {
  const base = { campaignId: id, creatorId };
  const [recipients, pending, skipped, queued, sent, delivered, failed, bounced, complained, opened, clicked, unsubscribed] = await Promise.all([
    prisma.campaignRecipient.count({ where: base }),
    prisma.campaignRecipient.count({ where: { ...base, status: "PENDING" } }),
    prisma.campaignRecipient.count({ where: { ...base, status: "SKIPPED" } }),
    prisma.emailMessage.count({ where: { ...base, status: { in: ["QUEUED", "SENDING"] } } }),
    prisma.emailMessage.count({ where: { ...base, status: "SENT" } }),
    prisma.emailMessage.count({ where: { ...base, deliveredAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...base, status: "FAILED" } }),
    prisma.emailMessage.count({ where: { ...base, bouncedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...base, complainedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...base, openedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...base, clickedAt: { not: null } } }),
    prisma.subscriber.count({ where: { creatorId, unsubscribeCampaignId: id } }),
  ]);
  return { recipients, pending, queued, sent, delivered, failed, bounced, complained, opened, clicked, unsubscribed, skipped };
}

/**
 * Email de bienvenida a la newsletter (automatización NEWSLETTER_WELCOME, apagada por defecto): al
 * confirmar el alta. Un email esperado y único, pero lleva la baja como cualquier newsletter.
 */
export async function sendNewsletterWelcome(subscriberId: string) {
  const s = await prisma.subscriber.findUnique({ where: { id: subscriberId }, include: { creator: true } });
  if (!s || s.status !== "CONFIRMED") return;
  const a = await automationSetting(s.creatorId, "NEWSLETTER_WELCOME");
  if (!a.enabled) return;
  const design: EmailDesign = a.design ?? defaultEmailDesign("NEWSLETTER_WELCOME");
  await enqueueEmail({
    to: s.email,
    creatorId: s.creatorId,
    template: "NEWSLETTER_WELCOME",
    dedupeKey: `nl-welcome:${s.id}`,
    stream: "news",
    sendAt: new Date(Date.now() + a.delayMinutes * 60_000),
    headers: unsubscribeHeaders(s.id),
    ...renderCampaignFor({ subject: a.subject || defaultEmailSubject("NEWSLETTER_WELCOME"), preheader: null, design }, s.creator, { id: s.id, name: s.name }),
  });
}
