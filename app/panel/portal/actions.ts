"use server";

import { translateSoon } from "@/lib/i18n/content";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ownImageUrl } from "@/lib/posts";
import { asPortalKind, mediaKindFor, PORTAL_PHOTOS_MAX, portalFormSchema, readPortalMedia, type PortalMedia } from "@/lib/portal-rules";
import { privateKey, storage } from "@/lib/storage";
import { purgeOldPortalItems } from "@/lib/portal-purge";
import { NEWS_DAY_OPTIONS } from "../actualidades/options";
import { tenantDb } from "@/lib/tenant";
import { labelToMinutes, zonedTimeToUtc } from "@/lib/tz";
import { readPortalMediaToken } from "@/lib/uploads";
import type { Prisma } from "@prisma/client";

export type PortalActionState = { ok?: string; error?: string } | undefined;

/** La portada y el portal están cacheados: lo publicado debe verse ya. */
function refresh(username: string, id?: string) {
  revalidatePath("/");
  revalidatePath(`/${username}`);
  revalidatePath("/[username]/portal/[id]", "page");
  revalidatePath("/panel/portal");
  if (id) revalidatePath(`/panel/portal/${id}`);
}

/**
 * Archivos del elemento al guardar: el formulario manda una lista con «keep:<n>» (los que ya tenía, por
 * su posición: la clave nunca viaja al navegador ni se acepta de él) y los billetes firmados de lo recién
 * subido (lib/uploads.ts → readPortalMediaToken). Solo del tipo que admite el elemento.
 */
function resolveMedia(creatorId: string, raw: string, current: PortalMedia[], kind: ReturnType<typeof mediaKindFor>): { ok: true; media: PortalMedia[] } | { ok: false; error: string } {
  let list: unknown;
  try {
    list = JSON.parse(raw || "[]");
  } catch {
    return { ok: false, error: "No se entienden los archivos. Vuelve a subirlos." };
  }
  if (!Array.isArray(list)) return { ok: false, error: "No se entienden los archivos. Vuelve a subirlos." };
  const out: PortalMedia[] = [];
  for (const entry of list.slice(0, PORTAL_PHOTOS_MAX)) {
    if (typeof entry !== "string") continue;
    const keep = /^keep:(\d{1,2})$/.exec(entry);
    const m = keep ? current[Number(keep[1])] : readPortalMediaToken(creatorId, entry);
    if (!m) return { ok: false, error: "Un archivo ha caducado. Vuelve a subirlo." };
    if (m.kind !== kind) continue;
    out.push(m);
  }
  return { ok: true, media: kind === "IMAGE" ? out : out.slice(0, 1) };
}

export async function savePortalItem(_: PortalActionState, form: FormData): Promise<PortalActionState> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const parsed = portalFormSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const current = d.id ? await db.portalItem.findFirst({ where: { id: d.id } }) : null;
  if (d.id && !current) return { error: "Este elemento ya no existe" };
  const kind = mediaKindFor(d.kind);
  const before = readPortalMedia(current?.media);
  let media: PortalMedia[] = [];
  if (kind) {
    const r = resolveMedia(creator.id, d.media, before, kind);
    if (!r.ok) return { error: r.error };
    media = r.media;
    if (d.status === "PUBLISHED" && !media.length) return { error: d.kind === "PHOTOS" ? "Sube al menos una foto para publicarlo" : `Sube el ${d.kind === "VIDEO" ? "vídeo" : "audio"} para publicarlo` };
  }
  const eventAt = d.kind === "LIVE" && d.eventDate && d.eventTime ? zonedTimeToUtc(d.eventDate, labelToMinutes(d.eventTime), creator.timezone) : null;
  const data = {
    kind: d.kind,
    title: d.title,
    summary: d.summary || null,
    body: d.body || null,
    coverUrl: ownImageUrl(d.coverUrl),
    media: media as unknown as Prisma.InputJsonArray,
    linkUrl: d.kind === "LIVE" || d.kind === "EARLY_BIRD" ? d.linkUrl || null : null,
    linkLabel: d.kind === "LIVE" || d.kind === "EARLY_BIRD" ? d.linkLabel || null : null,
    eventAt,
    featured: d.featured,
    status: d.status,
    // El aviso de novedades de la portada cuenta desde que se publica (o se vuelve a publicar).
    publishedAt: d.status === "PUBLISHED" ? (current?.status === "PUBLISHED" ? (current.publishedAt ?? current.createdAt) : new Date()) : null,
  };
  // Un solo destacado: el grande de arriba en la portada.
  if (d.featured) await db.portalItem.updateMany({ where: { featured: true, ...(current ? { NOT: { id: current.id } } : {}) }, data: { featured: false } });
  if (!current) {
    const count = await db.portalItem.count();
    const item = await db.portalItem.create({ data: { creatorId: creator.id, sortOrder: count, ...data } });
    refresh(creator.username);
    translateSoon(creator.id, true);
    redirect(`/panel/portal/${item.id}?guardado=${d.status === "PUBLISHED" ? "publicado" : "borrador"}`);
  }
  await db.portalItem.update({ where: { id: current.id }, data });
  // Los archivos que se han quitado se borran del almacenamiento (si falla, quedan huérfanos: no rompe nada).
  const gone = before.filter((b) => !media.some((m) => m.key === b.key)).map((b) => privateKey(b.key));
  if (gone.length) await storage().delete(gone).catch(() => {});
  refresh(creator.username, current.id);
  translateSoon(creator.id, true);
  return { ok: d.status === "PUBLISHED" ? "Guardado y publicado en tu portal." : "Guardado como borrador: no se ve en tu web." };
}

export async function deletePortalItem(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  const db = tenantDb(creator.id);
  const item = await db.portalItem.findFirst({ where: { id } });
  if (item) {
    await db.portalItem.delete({ where: { id: item.id } });
    const keys = readPortalMedia(item.media).map((m) => privateKey(m.key));
    if (keys.length) await storage().delete(keys).catch(() => {});
    refresh(creator.username);
  }
  redirect("/panel/portal?borrado=1");
}

/** «Los portales se borran a los…»: guarda los días y borra ya los que pasan de ahí. */
export async function setPortalDays(form: FormData) {
  const { creator } = await requireCreator();
  const n = Number(form.get("days"));
  if (!NEWS_DAY_OPTIONS.includes(n as (typeof NEWS_DAY_OPTIONS)[number])) redirect("/panel/portal");
  await prisma.creator.update({ where: { id: creator.id }, data: { portalDays: n === 0 ? null : n } });
  const gone = n ? await purgeOldPortalItems(new Date(), creator.id) : 0;
  refresh(creator.username);
  redirect(`/panel/portal?dias=${gone}`);
}

/** Subir o bajar en el orden del portal. */
export async function movePortalItem(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const id = String(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  const list = await db.portalItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } });
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, n) => db.portalItem.update({ where: { id: x.id }, data: { sortOrder: n } })));
  refresh(creator.username);
}

/** Publicar o pasar a borrador desde la lista (publicar un vídeo, audio o fotos exige su archivo). */
export async function togglePortalItem(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const item = await db.portalItem.findFirst({ where: { id: String(form.get("id")) } });
  if (!item) return;
  const publish = item.status !== "PUBLISHED";
  if (publish && mediaKindFor(asPortalKind(item.kind)) && !readPortalMedia(item.media).length) redirect(`/panel/portal/${item.id}?falta=archivo`);
  await db.portalItem.update({ where: { id: item.id }, data: { status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? new Date() : null } });
  refresh(creator.username, item.id);
  translateSoon(creator.id, true);
}
