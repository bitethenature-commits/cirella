"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_EMAIL_STYLE, readStyle } from "@/lib/email-blocks";
import { lookDesign, styleOnly } from "@/lib/newsletter-looks";
import { tenantDb } from "@/lib/tenant";
import { requireNewsletterOwner } from "../guard";

/**
 * Plantillas de la newsletter: solo el aspecto (fondo con geometría, colores, burbujas, letras y
 * esquinas). Nunca guardan textos: al usarlas, la newsletter empieza vacía con ese aspecto.
 */

// El creador de cada plantilla está en /panel/newsletter/plantillas/[id]; la lista, abajo de la pestaña Newsletter.
const PATH = "/panel/newsletter/plantillas";
const HOME = "/panel/newsletter";

const nameSchema = z.string().trim().min(1, "Ponle un nombre a la plantilla.").max(80, "El nombre: máximo 80 caracteres");

/** «Nueva plantilla»: una con el estilo de siempre, y se abre el creador para cambiarla a tu gusto. */
export async function createTemplate() {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const n = await db.newsletterTemplate.count();
  const t = await db.newsletterTemplate.create({ data: { creatorId: creator.id, name: `Mi plantilla ${n + 1}`, subject: "", design: { v: 1, style: DEFAULT_EMAIL_STYLE, blocks: [] } } });
  redirect(`${PATH}/${t.id}`);
}

/** Guardar los cambios de una plantilla (nunca toca las newsletters hechas con ella). */
export async function saveTemplate(id: string, p: { name: string; style: unknown }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { creator } = await requireNewsletterOwner();
  const name = nameSchema.safeParse(p.name);
  if (!name.success) return { ok: false, error: name.error.issues[0].message };
  const r = await tenantDb(creator.id).newsletterTemplate.updateMany({ where: { id }, data: { name: name.data, design: { v: 1, style: readStyle(p.style), blocks: [] } } });
  if (!r.count) return { ok: false, error: "Esta plantilla ya no existe." };
  revalidatePath(HOME);
  return { ok: true };
}

export async function duplicateTemplate(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const t = await db.newsletterTemplate.findFirst({ where: { id: String(form.get("id") ?? "") } });
  if (!t) redirect(`${HOME}#plantillas`);
  const copy = await db.newsletterTemplate.create({ data: { creatorId: creator.id, name: `${t.name} (copia)`.slice(0, 80), subject: "", design: styleOnly(t.design) } });
  revalidatePath(HOME);
  redirect(`${PATH}/${copy.id}`);
}

/** Borrar una plantilla: las newsletters hechas con ella se quedan como están. */
export async function deleteTemplate(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  await tenantDb(creator.id).newsletterTemplate.deleteMany({ where: { id: String(form.get("id") ?? "") } });
  revalidatePath(HOME);
  redirect(`${HOME}?aviso=${encodeURIComponent("Plantilla borrada. Las newsletters hechas con ella no cambian.")}#plantillas`);
}

/** «Usar en una newsletter»: un borrador vacío con el aspecto de la plantilla. */
export async function startFromTemplate(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const t = await db.newsletterTemplate.findFirst({ where: { id: String(form.get("id") ?? "") } });
  if (!t) redirect(`${HOME}#plantillas`);
  const c = await db.campaign.create({
    data: { creatorId: creator.id, subject: "", design: lookDesign((t.design as { style?: unknown } | null)?.style), segment: { kind: "all" }, templateId: t.id },
  });
  redirect(`/panel/newsletter/${c.id}`);
}

/** «Guardar como plantilla» desde una newsletter: su aspecto (no sus textos) pasa a ser una plantilla nueva. */
export async function saveCampaignAsTemplate(campaignId: string, name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { creator } = await requireNewsletterOwner();
  const clean = nameSchema.safeParse(name);
  if (!clean.success) return { ok: false, error: clean.error.issues[0].message };
  const db = tenantDb(creator.id);
  const c = await db.campaign.findFirst({ where: { id: campaignId } });
  if (!c) return { ok: false, error: "No encontrada." };
  const t = await db.newsletterTemplate.create({ data: { creatorId: creator.id, name: clean.data, subject: "", design: styleOnly(c.design) } });
  revalidatePath(HOME);
  return { ok: true, id: t.id };
}
