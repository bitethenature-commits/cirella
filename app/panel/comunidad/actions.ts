"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCreator } from "@/lib/auth";
import { addComment, deleteMemberPost, removeComment, saveMemberPost, setCommenterBlocked, setCommentHidden } from "@/lib/community";
import { processPostNotifications } from "@/lib/community-notify";
import { memberPostState, parseMemberPostForm, resolveMemberPostTiming, scheduleSentence } from "@/lib/community-rules";
import { captureError } from "@/lib/monitoring";
import { tenantDb } from "@/lib/tenant";
import { blockMembership, renewMembership } from "@/lib/membership-renewal";
import { parseMoneyToCents } from "@/lib/money";
import { parseTierCard, readTierEmblem } from "@/lib/tier-card";
import type { Prisma } from "@prisma/client";

/** Tick verde en Miembros: ha pagado, otro periodo más (lib/membership-renewal.ts). */
export async function renewMember(form: FormData) {
  const { creator } = await requireCreator();
  const until = await renewMembership(creator.id, String(form.get("accessId") ?? ""));
  revalidatePath("/panel/comunidad");
  redirect(`/panel/comunidad?${new URLSearchParams({ tab: "miembros", nivel: String(form.get("nivel") ?? ""), ok: `Renovada hasta el ${until}. Le hemos enviado un email.` })}`);
}

/** X en Miembros: no ha pagado, se bloquea ya. */
export async function blockMember(form: FormData) {
  const { creator } = await requireCreator();
  await blockMembership(creator.id, String(form.get("accessId") ?? ""));
  revalidatePath("/panel/comunidad");
  redirect(`/panel/comunidad?${new URLSearchParams({ tab: "miembros", nivel: String(form.get("nivel") ?? ""), ok: "Membresía bloqueada. Con el tick verde vuelve a entrar." })}`);
}

/**
 * Acciones del estudio Comunidad (/panel/comunidad). Todo va por tenantDb(creator.id) o por las
 * funciones de lib/community.ts que lo usan: un id de otra creadora no encuentra nada.
 */

export type ComposerState = { error?: string } | undefined;
export type ReplyState = { ok?: boolean; error?: string; at?: number } | undefined;

/** Lo que cambia al tocar una publicación: el estudio, el área de miembros y la ficha pública. */
function refresh(productIds: (string | null | undefined)[], postId?: string) {
  revalidatePath("/panel/comunidad");
  for (const id of new Set(productIds.filter((x): x is string => !!x))) {
    revalidatePath(`/panel/productos/${id}`);
    revalidatePath(`/cuenta/membresias/${id}`);
    if (postId) revalidatePath(`/cuenta/membresias/${id}/${postId}`);
  }
  // «Lo último en la comunidad» de la ficha pública (cacheada).
  revalidatePath("/[username]", "page");
}

/** Avisa por email justo después de responder (si ya se ve); las programadas, el cron cuando llega su hora. */
function notifySoon(postId: string) {
  after(async () => {
    try {
      await processPostNotifications({ postId });
    } catch (e) {
      captureError(e, { area: "comunidad", extra: { postId } });
    }
  });
}

const back = (tab: string, ok: string, extra = "") => redirect(`/panel/comunidad?tab=${tab}&ok=${encodeURIComponent(ok)}&t=${Date.now()}${extra}`);

/**
 * «Publicar» / «Programar» / «Guardar borrador» / «Guardar cambios» del compositor. El nivel es la
 * membresía de la publicación (los niveles de arriba la heredan). Al terminar vuelve al Muro (si ya
 * se ve) o a Programadas.
 */
export async function saveStudioPost(_: ComposerState, form: FormData): Promise<ComposerState> {
  const { creator } = await requireCreator();
  const parsed = parseMemberPostForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Los círculos de la luna se crean en «Círculos de la luna» y se publican solos en la membresía.
  if (parsed.data.kind === "CIRCULO_LUNAR") return { error: "Los círculos de la luna se crean y se editan en «Círculos de la luna»." };
  const before = parsed.data.id ? await tenantDb(creator.id).membershipPost.findFirst({ where: { id: parsed.data.id }, select: { productId: true } }) : null;
  const r = await saveMemberPost(creator.id, creator.timezone, parsed.data);
  if (!r.ok) return { error: r.error };
  if (r.live) notifySoon(r.postId);
  refresh([r.productId, before?.productId], r.postId);
  back(r.live ? "muro" : "publicar", r.message, r.live ? "" : `&carpeta=${parsed.data.when === "draft" ? "borradores" : "programadas"}`);
}

/** «Publicar ahora» de una programada o un borrador (desde Programadas). */
export async function publishNow(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const post = await db.membershipPost.findFirst({ where: { id: String(form.get("postId") ?? "") } });
  if (!post) return;
  if (memberPostState(post) !== "PUBLISHED") {
    await db.membershipPost.updateMany({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    notifySoon(post.id);
  }
  refresh([post.productId], post.id);
  back("muro", post.notify && !post.notifiedAt ? "Publicado. Avisaremos a tus miembros por email en unos minutos." : "Publicado.");
}

/**
 * «Cambiar día» / «Programar» en Programados: mueve una programada (o programa un borrador) a otro día y
 * hora sin abrir el editor. No vale para una ya publicada.
 */
export async function reschedulePost(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const post = await db.membershipPost.findFirst({ where: { id: String(form.get("postId") ?? "") }, select: { id: true, productId: true, status: true, publishedAt: true } });
  if (!post) return;
  const r = resolveMemberPostTiming({ when: "schedule", at: String(form.get("at") ?? ""), current: post, timeZone: creator.timezone });
  if (!r.ok) redirect(`/panel/comunidad?tab=publicar&carpeta=programadas&error=${encodeURIComponent(r.error)}&t=${Date.now()}`);
  await db.membershipPost.updateMany({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: r.publishedAt } });
  refresh([post.productId], post.id);
  back("publicar", `Saldrá el ${scheduleSentence(r.publishedAt, creator.timezone)}.`, "&carpeta=programadas");
}

/** «Fijar arriba» / «Quitar de arriba». */
export async function togglePin(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const post = await db.membershipPost.findFirst({ where: { id: String(form.get("postId") ?? "") }, select: { id: true, productId: true, pinnedAt: true } });
  if (!post) return;
  await db.membershipPost.updateMany({ where: { id: post.id }, data: { pinnedAt: post.pinnedAt ? null : new Date() } });
  refresh([post.productId], post.id);
}

export async function deleteStudioPost(form: FormData) {
  const { creator } = await requireCreator();
  const productId = await deleteMemberPost(creator.id, String(form.get("postId") ?? ""));
  refresh([productId]);
  const tab = String(form.get("tab") ?? "muro");
  back(["muro", "publicar"].includes(tab) ? tab : "muro", "Publicación eliminada.");
}

// ── Moderación desde el propio feed ──

/** Responder a un comentario (o comentar) como autora. A la miembro le llega el aviso de respuesta. */
export async function ownerReply(_: ReplyState, form: FormData): Promise<ReplyState> {
  const { user, creator } = await requireCreator();
  const post = await tenantDb(creator.id).membershipPost.findFirst({ where: { id: String(form.get("postId") ?? "") }, select: { id: true, productId: true } });
  if (!post) return { error: "Esta publicación ya no está." };
  const r = await addComment({ postId: post.id, userId: user.id, isOwner: true, body: String(form.get("body") ?? ""), parentId: String(form.get("parentId") ?? "") || null });
  if (!r.ok) return { error: r.error };
  refresh([post.productId], post.id);
  return { ok: true, at: Date.now() };
}

/** «Ocultar» / «Volver a mostrar» un comentario. */
export async function hideComment(form: FormData) {
  const { creator } = await requireCreator();
  const r = await setCommentHidden(creator.id, String(form.get("commentId") ?? ""), form.get("hidden") === "1");
  if (r) refresh([r.productId], r.postId);
}

/** «Borrar» un comentario (queda «Comentario eliminado» si tiene respuestas). */
export async function deleteCommentAsOwner(form: FormData) {
  const { user, creator } = await requireCreator();
  const c = await tenantDb(creator.id).membershipComment.findFirst({ where: { id: String(form.get("commentId") ?? "") }, select: { id: true, productId: true, postId: true } });
  if (!c) return;
  await removeComment(c.id, { userId: user.id, ownerOfCreatorId: creator.id });
  refresh([c.productId], c.postId);
}

/** «No dejar comentar» / «Volver a dejar comentar» a una persona (sigue leyendo y dando «me gusta»). */
export async function blockCommenter(form: FormData) {
  const { creator } = await requireCreator();
  await setCommenterBlocked(creator.id, String(form.get("userId") ?? ""), form.get("blocked") === "1");
  revalidatePath("/panel/comunidad");
}

export type TierCardState = { ok?: string; error?: string } | undefined;

/**
 * «Cartas» de Comunidad: guarda la carta de un nivel tal como la ve la clienta en /comunidad (foto,
 * emoji, nombre, frase, precio, lo que incluye y el texto del botón).
 */
export async function saveTierCard(_: TierCardState, form: FormData): Promise<TierCardState> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const id = String(form.get("id") ?? "");
  const product = await db.product.findFirst({ where: { id, type: "MEMBERSHIP" }, select: { id: true, slug: true, pageTexts: true } });
  if (!product) return { error: "No encontramos esta membresía" };
  const title = String(form.get("title") ?? "").trim().slice(0, 100);
  if (!title) return { error: "Ponle un nombre" };
  const imageUrl = String(form.get("imageUrl") ?? "").trim();
  if (imageUrl && !imageUrl.startsWith("/media/") && !imageUrl.startsWith("/demo/")) return { error: "Imagen no válida" };
  const priceRaw = String(form.get("price") ?? "").trim();
  const priceCents = parseMoneyToCents(priceRaw);
  if (!priceRaw || priceCents < 0 || priceCents > 10_000_000) return { error: "Escribe un precio válido (por ejemplo 33)" };
  const card = parseTierCard(form.get("card"));
  if (!card) return { error: "No se ha podido leer la carta" };
  const prev = product.pageTexts && typeof product.pageTexts === "object" && !Array.isArray(product.pageTexts) ? (product.pageTexts as Record<string, unknown>) : {};
  // El icono del nivel se elige en Mi página: si aquí no viene, se queda el que tenía.
  const prevEmblem = readTierEmblem(prev);
  if (!card.tier.emblem && prevEmblem) card.tier.emblem = prevEmblem;
  await db.product.update({
    where: { id: product.id },
    data: {
      title,
      emoji: String(form.get("emoji") ?? "").trim().slice(0, 8) || null,
      imageUrl: imageUrl || null,
      priceCents,
      pageTexts: { ...prev, ...card } as unknown as Prisma.InputJsonObject,
    },
  });
  revalidatePath("/panel/comunidad");
  revalidatePath(`/${creator.username}`, "layout");
  revalidatePath("/cuenta/membresias");
  return { ok: `«${title}» guardada` };
}
