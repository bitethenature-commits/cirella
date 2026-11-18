"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { lintDesign, parseDesignStrict, readDesign } from "@/lib/email-blocks";
import { lookDesign } from "@/lib/newsletter-looks";
import { sendingQuota } from "@/lib/email/outbox";
import { limitNewsletterTest } from "@/lib/limits";
import { segmentCount } from "@/lib/newsletter";
import { etaDays, parseSegment, peopleCount, type Segment } from "@/lib/newsletter-rules";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { cancelCampaign, pauseCampaign, processCampaigns, renderCampaignFor, resumeCampaign, sendTest, startCampaign } from "@/lib/newsletter-send";
import { tenantDb } from "@/lib/tenant";
import { formatDate, zonedTimeToUtc } from "@/lib/tz";
import { requireNewsletterOwner } from "./guard";

export type CampaignPayload = { subject: string; preheader: string; design: unknown; segment: unknown };

const text = (max: number, what: string) => z.string().trim().max(max, `${what}: máximo ${max} caracteres`);

function readPayload(p: CampaignPayload): { ok: true; subject: string; preheader: string | null; design: ReturnType<typeof readDesign> & object; segment: Segment } | { ok: false; error: string } {
  const subject = text(150, "El asunto").safeParse(p.subject ?? "");
  if (!subject.success) return { ok: false, error: subject.error.issues[0].message };
  const pre = text(150, "El texto de vista previa").safeParse(p.preheader ?? "");
  if (!pre.success) return { ok: false, error: pre.error.issues[0].message };
  const design = parseDesignStrict(p.design);
  if (!design.ok) return design;
  return { ok: true, subject: subject.data, preheader: pre.data || null, design: design.value, segment: parseSegment(p.segment) };
}

/**
 * «Nueva newsletter»: un borrador vacío (sin textos ya escritos) con el aspecto de una plantilla tuya,
 * o el de siempre («En blanco»). Va a todas.
 */
export async function createCampaign(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const tplId = String(form.get("template") ?? "");
  const tpl = tplId ? await db.newsletterTemplate.findFirst({ where: { id: tplId }, select: { id: true, design: true } }) : null;
  const style = tpl ? (tpl.design as { style?: unknown } | null)?.style : undefined;
  const c = await db.campaign.create({ data: { creatorId: creator.id, subject: "", design: lookDesign(style), segment: { kind: "all" }, templateId: tpl?.id ?? null } });
  redirect(`/panel/newsletter/${c.id}`);
}

export type SaveResult = { ok: true; version: number } | { ok: false; conflict?: true; error: string };

/**
 * Guardado (automático y con «Guardar»). Bloqueo optimista: si se ha cambiado desde otro dispositivo
 * (otra versión), no se pisa: el editor avisa para recargar.
 */
export async function saveCampaign(id: string, version: number, payload: CampaignPayload): Promise<SaveResult> {
  const { creator } = await requireNewsletterOwner();
  const p = readPayload(payload);
  if (!p.ok) return { ok: false, error: p.error };
  const db = tenantDb(creator.id);
  const r = await db.campaign.updateMany({
    where: { id, version, status: { in: ["DRAFT", "SCHEDULED"] } },
    data: { subject: p.subject, preheader: p.preheader, design: p.design, segment: p.segment, version: { increment: 1 } },
  });
  if (!r.count) {
    const now = await db.campaign.findFirst({ where: { id }, select: { status: true } });
    if (now && now.status !== "DRAFT" && now.status !== "SCHEDULED") return { ok: false, error: "Esta newsletter ya se ha enviado: no se puede cambiar." };
    return { ok: false, conflict: true, error: "Has cambiado esta newsletter en otro dispositivo. Recarga para ver la última versión." };
  }
  return { ok: true, version: version + 1 };
}

/** Vista previa: el mismo HTML que el envío (con «Laura» como ejemplo de {nombre}) y los avisos. */
export async function previewCampaign(payload: CampaignPayload): Promise<{ html: string; subject: string; warnings: string[] } | { error: string }> {
  const { creator } = await requireNewsletterOwner();
  const p = readPayload(payload);
  if (!p.ok) return { error: p.error };
  const { newsletterFooterText } = await getSettings();
  const mail = renderCampaignFor({ subject: p.subject, preheader: p.preheader, design: p.design }, creator, { id: null, name: "Laura" }, { message: newsletterFooterText });
  return { html: mail.html, subject: mail.subject, warnings: lintDesign(p.design, p.subject) };
}

/** «Se enviará a N personas» del selector «A quién». */
export async function segmentPreview(segment: unknown): Promise<number> {
  const { creator } = await requireNewsletterOwner();
  return segmentCount(creator.id, parseSegment(segment));
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function sendTestCampaign(id: string): Promise<ActionResult> {
  const { creator, user } = await requireNewsletterOwner();
  const gate = await limitNewsletterTest(creator.id);
  if (!gate.ok) return { ok: false, error: gate.message };
  const to = (creator.contactEmail || user.email).toLowerCase();
  if (!(await sendTest(creator.id, id, to))) return { ok: false, error: "No encontrada" };
  return { ok: true, message: `Prueba enviada a ${to}. Llega en unos segundos.` };
}

/** Cuándo terminará con el cupo diario: «hoy» o «el jueves 29 de octubre». */
async function etaText(n: number, tz: string): Promise<string> {
  const q = await sendingQuota();
  const perDay = q.cap > 0 ? Math.max(1, q.cap - q.reserve) : Infinity;
  const days = etaDays(n, Math.min(perDay, Math.max(q.bulk, 0) || perDay));
  if (days <= 1) return "Saldrá hoy, en los próximos minutos.";
  const end = new Date(Date.now() + (days - 1) * 86_400_000);
  return `Con tu límite de ${q.cap} emails al día, terminará el ${formatDate(end, { weekday: "long", day: "numeric", month: "long" }, tz)}.`;
}

/** Lo que dice la confirmación antes de enviar: a cuántas y cuándo terminará. */
export async function sendSummary(id: string): Promise<{ count: number; text: string }> {
  const { creator } = await requireNewsletterOwner();
  const c = await tenantDb(creator.id).campaign.findFirst({ where: { id } });
  const count = c ? await segmentCount(creator.id, parseSegment(c.segment)) : 0;
  return { count, text: `Se enviará a ${peopleCount(count)}. ${await etaText(count, creator.timezone)}` };
}

export async function sendNow(id: string): Promise<ActionResult> {
  const { creator } = await requireNewsletterOwner();
  const r = await startCampaign(creator.id, id);
  if (!r.ok) return r;
  // Las primeras entran ya en la bandeja; el resto, en cada ejecución de las tareas programadas.
  await processCampaigns(new Date()).catch(() => 0);
  revalidatePath("/panel/newsletter");
  return { ok: true, message: `Enviando a ${peopleCount(r.recipients)}.` };
}

const scheduleSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige el día"), time: z.string().regex(/^\d{2}:\d{2}$/, "Elige la hora") });

export async function scheduleCampaign(id: string, date: string, time: string): Promise<ActionResult> {
  const { creator } = await requireNewsletterOwner();
  const s = scheduleSchema.safeParse({ date, time });
  if (!s.success) return { ok: false, error: s.error.issues[0].message };
  const [h, m] = s.data.time.split(":").map(Number);
  const at = zonedTimeToUtc(s.data.date, h * 60 + m, creator.timezone);
  if (at.getTime() < Date.now() + 60_000) return { ok: false, error: "Elige una hora futura (o pulsa «Enviar ahora»)." };
  const r = await startCampaign(creator.id, id, { at });
  if (!r.ok) return r;
  revalidatePath("/panel/newsletter");
  return { ok: true, message: `Programada para el ${formatDate(at, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, creator.timezone)}.` };
}

/** Programada → vuelve a borrador (para cambiarla o enviarla ya). */
export async function unscheduleCampaign(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const id = String(form.get("id") ?? "");
  await tenantDb(creator.id).campaign.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "DRAFT", scheduledAt: null, version: { increment: 1 } } });
  revalidatePath(`/panel/newsletter/${id}`);
}

export async function pauseCampaignAction(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  await pauseCampaign(creator.id, String(form.get("id") ?? ""));
  revalidatePath(`/panel/newsletter/${form.get("id")}`);
}

export async function resumeCampaignAction(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  await resumeCampaign(creator.id, String(form.get("id") ?? ""));
  revalidatePath(`/panel/newsletter/${form.get("id")}`);
}

export async function cancelCampaignAction(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  await cancelCampaign(creator.id, String(form.get("id") ?? ""));
  revalidatePath(`/panel/newsletter/${form.get("id")}`);
}

/** «Duplicar»: un borrador nuevo con el mismo contenido (para la del mes que viene). */
export async function duplicateCampaign(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const c = await db.campaign.findFirst({ where: { id: String(form.get("id") ?? "") } });
  if (!c) return;
  const copy = await db.campaign.create({
    data: { creatorId: creator.id, subject: c.subject ? `${c.subject} (copia)`.slice(0, 150) : "", preheader: c.preheader, design: c.design ?? {}, segment: c.segment ?? { kind: "all" } },
  });
  redirect(`/panel/newsletter/${copy.id}`);
}

/**
 * Borrar una newsletter, en cualquier estado (también enviada o enviándose): se va con sus
 * destinatarias y sus clics, y lo que aún esperaba en la bandeja ya no sale. Los emails ya enviados
 * quedan en la bandeja sin newsletter (cuentan para el límite diario y los rebotes).
 */
export async function deleteDraft(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const id = String(form.get("id") ?? "");
  const c = await tenantDb(creator.id).campaign.findFirst({ where: { id }, select: { id: true } });
  if (c) {
    await prisma.$transaction([
      prisma.emailMessage.deleteMany({ where: { creatorId: creator.id, campaignId: c.id, status: { in: ["QUEUED", "FAILED", "CANCELED"] } } }),
      prisma.emailMessage.updateMany({ where: { creatorId: creator.id, campaignId: c.id }, data: { campaignId: null } }),
      prisma.emailClick.deleteMany({ where: { campaignId: c.id } }),
      prisma.campaign.deleteMany({ where: { id: c.id, creatorId: creator.id } }),
    ]);
  }
  revalidatePath("/panel/newsletter");
  revalidatePath("/panel/newsletter/estadisticas");
  redirect("/panel/newsletter?borrada=1");
}
