"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { ownImageUrl, postFormSchema, postSlugBase, readPostMedia, resolvePublishedAt } from "@/lib/posts";
import { Prisma } from "@prisma/client";
import { cleanRichInput, formatToStore, normalizeNewlines } from "@/lib/rich-text";
import { randomCode } from "@/lib/slug";
import { tenantDb, type TenantDb } from "@/lib/tenant";
import { slugTakenNotice } from "./slug-notice";

/** `slug`: la dirección guardada de verdad (puede no ser la escrita si ya la usaba otra publicación). */
export type PostActionState = { ok?: string; error?: string; slug?: string } | undefined;

/** Slug libre entre las publicaciones de la creadora (eclipse, eclipse-2, eclipse-3…). */
async function uniquePostSlug(db: TenantDb, base: string, exceptId?: string) {
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.post.findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base.slice(0, 56)}-${i}`;
  }
  return `${base.slice(0, 50)}-${randomCode(4).toLowerCase()}`;
}

/** La página pública y las actualidades están cacheadas (ISR): lo publicado debe verse ya. */
function refreshPublic(username: string, slugs: string[]) {
  revalidatePath(`/${username}`);
  revalidatePath("/");
  revalidatePath(`/${username}/actualidades`);
  for (const s of new Set(slugs)) revalidatePath(`/${username}/actualidades/${s}`);
  revalidatePath("/panel/publicaciones");
  revalidatePath("/panel/actualidades");
}

/** Crea o guarda una publicación (formulario del panel). Al crearla, lleva a su ficha. */
export async function savePost(_: PostActionState, form: FormData): Promise<PostActionState> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const parsed = postFormSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  // Vídeo o audio: solo archivos subidos aquí por ella o un enlace de YouTube/Vimeo (lo demás no se guarda).
  const media = d.media ? readPostMedia(null, d.media, creator.id) : null;
  if (d.media && d.media !== "null" && !media) return { error: "El vídeo o el audio no es válido: súbelo de nuevo o pega un enlace de YouTube o Vimeo" };
  if ((d.ctaLabel && !d.ctaUrl) || (!d.ctaLabel && d.ctaUrl)) return { error: "El botón necesita un texto y un enlace" };
  const current = d.id ? await db.post.findFirst({ where: { id: d.id } }) : null;
  if (d.id && !current) return { error: "Esta publicación ya no existe" };

  const slug = await uniquePostSlug(db, postSlugBase(d.title, d.slug || current?.slug), current?.id);
  const publishedAt = resolvePublishedAt({ status: d.status, publishedOn: d.publishedOn, current: current?.publishedAt ?? null, timeZone: creator.timezone });
  // Formato del texto: sin tocar el texto llega el que tenía (un texto antiguo se guarda igual).
  const bodyFormat = formatToStore(d.body, d.bodyFormat, current?.bodyFormat ?? null);
  const data = {
    title: d.title,
    slug,
    excerpt: d.excerpt,
    body: bodyFormat ? cleanRichInput(d.body, { creatorId: creator.id, images: true }) : normalizeNewlines(d.body),
    bodyFormat,
    imageUrl: ownImageUrl(d.imageUrl),
    status: d.status,
    publishedAt,
    mediaKind: media?.kind ?? null,
    media: media ? (media as unknown as Prisma.InputJsonObject) : Prisma.DbNull,
    ctaLabel: d.ctaLabel,
    ctaUrl: d.ctaUrl,
    // Las publicaciones no llevan códigos de descuento (Actualidades no es sitio para ellos).
    ctaCode: null,
  };

  if (!current) {
    const post = await db.post.create({ data: { creatorId: creator.id, ...data } });
    refreshPublic(creator.username, [slug]);
    redirect(`/panel/publicaciones/${post.id}?guardada=${d.status === "PUBLISHED" ? "publicada" : "borrador"}`);
  }
  await db.post.update({ where: { id: current.id }, data });
  refreshPublic(creator.username, [slug, current.slug]);
  revalidatePath(`/panel/publicaciones/${current.id}`);
  const ok =
    d.status === "DRAFT"
      ? "Borrador guardado. No se ve en tu página hasta que la publiques."
      : publishedAt && publishedAt > new Date()
        ? "Guardada: se publicará sola en la fecha que has elegido."
        : "Publicada: ya se ve en tu página.";
  const notice = slugTakenNotice(d.slug, slug);
  return { ok: notice ? `${ok} ${notice}` : ok, slug };
}

export async function deletePost(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  const db = tenantDb(creator.id);
  const post = await db.post.findFirst({ where: { id }, select: { id: true, slug: true } });
  if (post) {
    await db.post.delete({ where: { id: post.id } });
    refreshPublic(creator.username, [post.slug]);
  }
  redirect("/panel/actualidades?borrada=1");
}

/** Publicar o pasar a borrador desde la lista, sin abrir la ficha. */
export async function togglePostStatus(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  const db = tenantDb(creator.id);
  const post = await db.post.findFirst({ where: { id } });
  if (!post) redirect("/panel/actualidades");
  const status = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  const publishedAt = resolvePublishedAt({ status, current: post.publishedAt, timeZone: creator.timezone });
  await db.post.update({ where: { id: post.id }, data: { status, publishedAt } });
  refreshPublic(creator.username, [post.slug]);
}
