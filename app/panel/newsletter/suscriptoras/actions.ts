"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { importSubscribers, sendConfirmation, subscribe, unsubscribe } from "@/lib/newsletter";
import { IMPORT_DECLARATION, IMPORT_ERROR_LABEL, normalizeTags, parseImportCsv, STATUS_LABEL, type SubscriberStatus } from "@/lib/newsletter-rules";
import { tenantDb } from "@/lib/tenant";
import { requireNewsletterOwner } from "../guard";

const PATH = "/panel/newsletter/suscriptoras";

export type FormState = { ok?: string; error?: string } | undefined;

const addSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).email("Revisa el email"),
  name: z.string().trim().max(80).optional(),
  tags: z.string().max(400).optional(),
});

/**
 * «Añadir a mano»: queda pendiente y le llega el email para confirmar (no hay forma de demostrar desde
 * aquí que aceptó: lo confirma ella con un clic).
 */
export async function addSubscriber(_: FormState, form: FormData): Promise<FormState> {
  const { creator, user } = await requireNewsletterOwner();
  const p = addSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const r = await subscribe(creator.id, {
    email: p.data.email,
    name: p.data.name || null,
    source: "MANUAL",
    confirmed: false,
    tags: normalizeTags(p.data.tags ?? ""),
    consentText: "Añadida a mano por la dueña; el consentimiento es el clic del email de confirmación",
    consentMeta: { form: "panel", addedBy: user.email },
  });
  revalidatePath(PATH);
  if (r.status === "CONFIRMED") return { ok: "Ya estaba confirmada. Hemos añadido las etiquetas." };
  if (r.status === "BOUNCED" || r.status === "COMPLAINED") return { error: `No se puede añadir: ${STATUS_LABEL[r.status].toLowerCase()}.` };
  const sent = await sendConfirmation(r.subscriberId);
  return { ok: sent ? `Le hemos enviado el email para confirmar a ${p.data.email}.` : "Ya tiene un email de confirmación reciente: tiene que pulsarlo." };
}

export async function updateTags(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  await tenantDb(creator.id).subscriber.updateMany({ where: { id: String(form.get("id") ?? "") }, data: { tags: normalizeTags(String(form.get("tags") ?? "")) } });
  revalidatePath(PATH);
}

export async function resendConfirmationAction(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const s = await tenantDb(creator.id).subscriber.findFirst({ where: { id: String(form.get("id") ?? ""), status: "PENDING" } });
  if (s) await sendConfirmation(s.id);
  revalidatePath(PATH);
}

export async function ownerUnsubscribe(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  await unsubscribe(creator.id, String(form.get("id") ?? ""), "OWNER");
  revalidatePath(PATH);
}

/** «Borrar definitivamente» (derecho de supresión): sin rastro, tampoco de la baja. */
export async function deleteSubscriber(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const s = await db.subscriber.findFirst({ where: { id: String(form.get("id") ?? "") } });
  if (!s) return;
  await db.customer.updateMany({ where: { email: { equals: s.email, mode: "insensitive" }, marketingOptIn: true }, data: { marketingOptIn: false, marketingOptInAt: null } });
  await db.subscriber.deleteMany({ where: { id: s.id } });
  revalidatePath(PATH);
}

export type ImportPreview = {
  ok: true;
  valid: number;
  newOnes: number;
  pendingAgain: number;
  alreadyConfirmed: number;
  blocked: number;
  errors: { line: number; reason: string }[];
} | { ok: false; error: string };

const MAX_CSV = 2_000_000;

async function readCsv(text: string) {
  const { creator } = await requireNewsletterOwner();
  if (text.length > MAX_CSV) return { creator, error: "El archivo es demasiado grande (máx. 2 MB): divídelo en varios." } as const;
  const parsed = parseImportCsv(text);
  if (parsed.missingColumns.length)
    return {
      creator,
      error: `Falta la columna ${parsed.missingColumns.map((c) => (c === "email" ? "«email»" : "«fecha_consentimiento» (la fecha en que aceptó)")).join(" y la columna ")}.`,
    } as const;
  return { creator, parsed } as const;
}

/** Paso 1: qué pasaría (sin guardar nada). */
export async function importPreview(text: string): Promise<ImportPreview> {
  const r = await readCsv(text);
  if ("error" in r) return { ok: false, error: r.error! };
  const existing = await tenantDb(r.creator.id).subscriber.findMany({ where: { email: { in: r.parsed.rows.map((x) => x.email) } }, select: { email: true, status: true } });
  const by = new Map(existing.map((e) => [e.email, e.status as SubscriberStatus]));
  let newOnes = 0, pendingAgain = 0, alreadyConfirmed = 0, blocked = 0;
  for (const row of r.parsed.rows) {
    const st = by.get(row.email);
    if (!st) newOnes++;
    else if (st === "PENDING") pendingAgain++;
    else if (st === "CONFIRMED") alreadyConfirmed++;
    else blocked++;
  }
  return {
    ok: true,
    valid: r.parsed.rows.length,
    newOnes,
    pendingAgain,
    alreadyConfirmed,
    blocked,
    errors: r.parsed.errors.slice(0, 50).map((e) => ({ line: e.line, reason: IMPORT_ERROR_LABEL[e.reason] })),
  };
}

/** Paso 2: importar (vuelve a leer el mismo archivo: entre un paso y otro no se guarda nada). */
export async function importCommit(text: string, o: { fileName: string; mode: "confirmed" | "ask"; declared: boolean; tags: string }): Promise<FormState> {
  const r = await readCsv(text);
  if ("error" in r) return { error: r.error! };
  if (o.mode === "confirmed" && !o.declared) return { error: "Marca la casilla: solo se pueden importar como confirmadas si aceptaron y puedes demostrarlo." };
  const { user } = await requireNewsletterOwner();
  const res = await importSubscribers(r.creator.id, r.parsed.rows, {
    mode: o.mode === "confirmed" ? "confirmed" : "ask",
    file: o.fileName.slice(0, 120) || "importacion.csv",
    declaredBy: user.email,
    declaration: o.mode === "confirmed" ? IMPORT_DECLARATION : "Importada; el consentimiento es el clic del email de confirmación",
    tags: normalizeTags(o.tags),
  });
  revalidatePath(PATH);
  const parts = [`${res.added} nuevas`, res.updated ? `${res.updated} actualizadas` : "", res.skipped.length ? `${res.skipped.length} sin tocar` : "", res.confirmationsSent ? `${res.confirmationsSent} emails de confirmación enviados` : ""].filter(Boolean);
  return { ok: `Importación hecha: ${parts.join(" · ")}.` };
}
