"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { automationDefaultOn, EDITABLE_EMAILS, type AutomationTrigger } from "@/lib/automation-catalog";
import { parseDesignStrict } from "@/lib/email-blocks";
import { sampleAutomaticEmail } from "@/lib/email/automatic-sample";
import { enqueueEmail } from "@/lib/email/outbox";
import { lintDesign } from "@/lib/email-blocks";
import { limitNewsletterTest } from "@/lib/limits";
import { brandName } from "@/lib/newsletter";
import { tenantDb } from "@/lib/tenant";
import { requireNewsletterOwner } from "../../guard";

const triggers = Object.keys(EDITABLE_EMAILS) as [AutomationTrigger, ...AutomationTrigger[]];
const triggerSchema = z.enum(triggers);

export type EmailPayload = { subject: string; design: unknown };

async function context(trigger: string) {
  const { creator, user } = await requireNewsletterOwner();
  const t = triggerSchema.parse(trigger);
  const product = await tenantDb(creator.id).product.findFirst({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "asc" }, select: { title: true } });
  return { creator, user, t, sample: { productTitle: product?.title ?? "Lectura de carta natal", siteName: brandName(creator) } };
}

function read(p: EmailPayload) {
  const subject = String(p.subject ?? "").trim();
  if (subject.length > 150) return { ok: false as const, error: "El asunto: máximo 150 caracteres" };
  const design = parseDesignStrict(p.design);
  if (!design.ok) return design;
  return { ok: true as const, subject: subject || null, design: design.value };
}

export async function previewAutomaticEmail(trigger: string, p: EmailPayload): Promise<{ html: string; subject: string; warnings: string[] } | { error: string }> {
  const { creator, t, sample } = await context(trigger);
  const r = read(p);
  if (!r.ok) return { error: r.error };
  const mail = sampleAutomaticEmail(t, creator, { subject: r.subject, design: r.design }, sample);
  if (!mail) return { error: "Este email no se puede editar" };
  return { ...mail, warnings: r.design.blocks.length ? lintDesign(r.design) : [] };
}

export type Result = { ok: true; message: string } | { ok: false; error: string };

/** Guarda su versión (asunto y texto). Lo demás de la automatización (activada, retraso) no cambia. */
export async function saveAutomaticEmail(trigger: string, p: EmailPayload): Promise<Result> {
  const { creator, t } = await context(trigger);
  const r = read(p);
  if (!r.ok) return { ok: false, error: r.error };
  const db = tenantDb(creator.id);
  await db.automation.upsert({
    where: { creatorId_trigger: { creatorId: creator.id, trigger: t } },
    create: { creatorId: creator.id, trigger: t, subject: r.subject, design: r.design, enabled: automationDefaultOn(t) },
    update: { subject: r.subject, design: r.design },
  });
  revalidatePath("/panel/newsletter/automatizaciones");
  return { ok: true, message: "Guardado: los próximos emails saldrán así." };
}

/** «Restaurar el original»: fuera su texto y su asunto; vuelve el email de siempre. */
export async function restoreOriginalEmail(trigger: string): Promise<Result> {
  const { creator, t } = await context(trigger);
  await tenantDb(creator.id).automation.updateMany({ where: { trigger: t }, data: { design: Prisma.DbNull, subject: null } });
  revalidatePath("/panel/newsletter/automatizaciones");
  return { ok: true, message: "Restaurado: vuelve a salir el email original." };
}

/** Prueba a ella misma, con los datos de ejemplo. */
export async function sendAutomaticTest(trigger: string, p: EmailPayload): Promise<Result> {
  const { creator, user, t, sample } = await context(trigger);
  const gate = await limitNewsletterTest(creator.id);
  if (!gate.ok) return { ok: false, error: gate.message };
  const r = read(p);
  if (!r.ok) return { ok: false, error: r.error };
  const mail = sampleAutomaticEmail(t, creator, { subject: r.subject, design: r.design }, sample);
  if (!mail) return { ok: false, error: "Este email no se puede editar" };
  const to = (creator.contactEmail || user.email).toLowerCase();
  await enqueueEmail({ to, creatorId: creator.id, template: "NEWSLETTER_TEST", replyTo: null, subject: `[Prueba] ${mail.subject}`, html: mail.html });
  return { ok: true, message: `Prueba enviada a ${to}.` };
}
