"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enqueueEmail } from "@/lib/email/outbox";
import { esc, layout } from "@/lib/email/templates";
import { limitNewsletterTest } from "@/lib/limits";
import { blockAddress, unblockSubscriber } from "@/lib/newsletter";
import { connectSendingDomain, getSendingDomain, newsSender, refreshSendingDomain, removeSendingDomain, saveNewsSender } from "@/lib/sending-domain";
import { addressOnDomain, EMAIL_RE, normalizeDomain } from "@/lib/sending-rules";
import { setSetting } from "@/lib/settings";
import { requireNewsletterOwner } from "../guard";

const PATH = "/panel/newsletter/ajustes";

export type SendingResult = { ok: true; message: string } | { ok: false; error: string };

/** Lo de esta pestaña es de toda la web: solo quien la administra (en la web personal, ella). */
async function requireAdmin() {
  const r = await requireNewsletterOwner();
  if (!r.user.isAdmin) throw new Error("Solo quien administra la web puede cambiar el envío.");
  return r;
}

const schema = z.object({ cap: z.coerce.number().int().min(0).max(100_000), reserve: z.coerce.number().int().min(0).max(10_000) });

/** Límite diario y reserva. */
export async function saveSendingLimits(form: FormData) {
  const { user } = await requireNewsletterOwner();
  if (!user.isAdmin) return;
  const p = schema.safeParse({ cap: form.get("cap"), reserve: form.get("reserve") });
  if (!p.success) return;
  await setSetting("emailDailyCap", p.data.cap);
  await setSetting("emailTransactionalReserve", Math.min(p.data.reserve, p.data.cap || p.data.reserve));
  revalidatePath(PATH);
}

/** El mensaje del pie de todas las newsletters. Vacío o igual que el de siempre = el de siempre. */
export async function saveFooterText(form: FormData) {
  const { user } = await requireNewsletterOwner();
  if (!user.isAdmin) return;
  const text = String(form.get("text") ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 400);
  const def = String(form.get("default") ?? "").trim();
  await setSetting("newsletterFooterText", text === def ? "" : text);
  revalidatePath(PATH);
}

// ── Dominio ──

export async function connectDomain(input: string): Promise<SendingResult> {
  await requireAdmin();
  const name = normalizeDomain(input);
  if (!name) return { ok: false, error: "Escribe solo el dominio, por ejemplo cirella.es" };
  const r = await connectSendingDomain(name);
  revalidatePath(PATH);
  return r.ok ? { ok: true, message: "Dominio conectado. Ahora copia los registros en tu DNS." } : { ok: false, error: r.error };
}

export async function checkDomain(): Promise<SendingResult> {
  await requireAdmin();
  const r = await refreshSendingDomain(true);
  revalidatePath(PATH);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.data.error) return { ok: false, error: r.data.error };
  if (r.data.status === "verified") return { ok: true, message: "¡Verificado! Tu newsletter ya puede salir desde tu dominio." };
  return { ok: true, message: "Comprobado. Los cambios en el DNS pueden tardar de unos minutos a unas horas: se vuelve a mirar solo cada 10 minutos." };
}

export async function removeDomain(): Promise<SendingResult> {
  await requireAdmin();
  const r = await removeSendingDomain();
  revalidatePath(PATH);
  return r.ok ? { ok: true, message: "Dominio quitado." } : { ok: false, error: r.error };
}

// ── Remitente ──

export async function saveSender(input: { name: string; address: string; replyTo: string }): Promise<SendingResult> {
  await requireAdmin();
  const name = input.name.replace(/["<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const address = input.address.trim().toLowerCase();
  const replyTo = input.replyTo.trim().toLowerCase();
  if (address && !EMAIL_RE.test(address)) return { ok: false, error: "La dirección del remitente no es válida." };
  if (replyTo && !EMAIL_RE.test(replyTo)) return { ok: false, error: "El email para las respuestas no es válido." };
  const domain = await getSendingDomain();
  if (address && (!domain || !addressOnDomain(address, domain.name)))
    return { ok: false, error: domain ? `La dirección tiene que ser de ${domain.name}.` : "Primero conecta tu dominio: la dirección tiene que ser suya." };
  await saveNewsSender({ name, address, replyTo });
  revalidatePath(PATH);
  return { ok: true, message: "Remitente guardado." };
}

// ── Email de prueba ──

export async function sendSendingTest(to: string): Promise<SendingResult> {
  const { creator, user } = await requireNewsletterOwner();
  const dest = (to.trim() || creator.contactEmail || user.email).toLowerCase();
  if (!EMAIL_RE.test(dest)) return { ok: false, error: "Escribe un email válido." };
  const gate = await limitNewsletterTest(creator.id);
  if (!gate.ok) return { ok: false, error: gate.message };
  const s = await newsSender();
  const body = `<p style="margin:0 0 14px">Si estás leyendo esto, tu newsletter sale bien.</p>
<p style="margin:0 0 14px">Mira en tu buzón quién lo envía y, si puedes, pulsa «Mostrar original» (en Gmail, los tres puntos): SPF, DKIM y DMARC deberían decir <strong>PASS</strong>.</p>
<p style="margin:0">Si respondes a este email, la respuesta llega a ${esc(s.replyTo ?? creator.contactEmail ?? user.email)}.</p>`;
  await enqueueEmail({
    to: dest,
    creatorId: creator.id,
    template: "NEWSLETTER_SENDING_TEST",
    stream: "news",
    sendNow: true,
    subject: "Prueba de envío de tu newsletter",
    html: layout({ title: "Todo funciona", body, areaLink: false }),
  });
  return { ok: true, message: `Enviado a ${dest}. Llega en unos segundos (mira también en spam).` };
}

// ── Bloqueados ──

export async function blockEmail(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return;
  await blockAddress(creator.id, email);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/bloqueados`);
}

export async function unblock(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const id = String(form.get("id") ?? "");
  if (id) await unblockSubscriber(creator.id, id);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/bloqueados`);
}
