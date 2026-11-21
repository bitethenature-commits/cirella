"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { codeState, type CodeState, discountCodeFormSchema, expiryFromDateKey, parseCodePhotos, parseCodeRecommendations, parseShopUrl } from "@/lib/discount-codes";
import type { Prisma } from "@prisma/client";
import { ownImageUrl } from "@/lib/posts";
import { tenantDb } from "@/lib/tenant";
import { createdFlash, savedFlash, savedParam } from "./saved-note";

export type CodeActionState = { ok?: string; error?: string; /** Canva: se acaba de crear. */ created?: boolean } | undefined;

/** La página pública está cacheada (ISR): los cambios deben verse ya. */
function refresh(username: string, id?: string) {
  revalidatePath(`/${username}`);
  revalidatePath("/panel/codigos");
  if (id) revalidatePath(`/panel/codigos/${id}`);
}

/** Crea o guarda un código de descuento (lo que comparten el panel y el Canva). */
async function storeCode(form: FormData): Promise<{ error: string } | { created: boolean; state: CodeState }> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const parsed = discountCodeFormSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const url = parseShopUrl(d.url);
  if (!url.ok) return { error: url.error };
  const photos = parseCodePhotos(d.images, creator.id);
  if (!photos.ok) return { error: photos.error };
  const recs = parseCodeRecommendations(d.recommendations);
  if (!recs.ok) return { error: recs.error };
  const current = d.id ? await db.discountCode.findFirst({ where: { id: d.id } }) : null;
  if (d.id && !current) return { error: "Este código ya no existe" };
  const data = {
    brand: d.brand,
    code: d.code,
    description: d.description,
    url: url.url,
    imageUrl: ownImageUrl(d.imageUrl),
    images: photos.photos as unknown as Prisma.InputJsonArray,
    recommendations: recs.recommendations as unknown as Prisma.InputJsonArray,
    expiresAt: expiryFromDateKey(d.expiresOn, creator.timezone),
    active: d.active === "on" || d.active === "1",
  };
  if (!current) {
    const last = await db.discountCode.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await db.discountCode.create({ data: { creatorId: creator.id, ...data, sortOrder: (last?.sortOrder ?? 0) + 1 } });
    refresh(creator.username);
    return { created: true, state: codeState(data) };
  }
  await db.discountCode.update({ where: { id: current.id }, data });
  refresh(creator.username, current.id);
  return { created: false, state: codeState(data) };
}

/** Crea o guarda un código de descuento. Al crearlo, vuelve a los códigos (en Mi página). */
export async function saveDiscountCode(_: CodeActionState, form: FormData): Promise<CodeActionState> {
  const r = await storeCode(form);
  if ("error" in r) return { error: r.error };
  // El aviso dice si se ve de verdad: oculto o ya caducado, no.
  if (r.created) redirect("/panel/pagina?ver=codigos");
  return { ok: savedFlash(r.state) };
}

/** Lo mismo desde el Canva: sin salir de la web que se está editando. */
export async function saveDiscountCodeInline(_: CodeActionState, form: FormData): Promise<CodeActionState> {
  const r = await storeCode(form);
  if ("error" in r) return { error: r.error };
  return { ok: r.created ? createdFlash(savedParam(r.state)) : savedFlash(r.state), created: r.created };
}

/** Borrar desde el Canva (de verdad, sin salir de la web que se está editando). */
export async function deleteDiscountCodeInline(id: string) {
  const { creator } = await requireCreator();
  const clean = z.string().min(1).max(40).parse(id);
  await tenantDb(creator.id).discountCode.deleteMany({ where: { id: clean } });
  refresh(creator.username);
}

export async function deleteDiscountCode(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  await tenantDb(creator.id).discountCode.deleteMany({ where: { id } });
  refresh(creator.username);
  redirect("/panel/pagina?ver=codigos");
}

/** Mostrar u ocultar desde la lista. */
export async function toggleDiscountCode(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  const db = tenantDb(creator.id);
  const code = await db.discountCode.findFirst({ where: { id }, select: { id: true, active: true } });
  if (!code) return;
  await db.discountCode.update({ where: { id: code.id }, data: { active: !code.active } });
  refresh(creator.username);
}

/** Subir o bajar un código: el orden de la lista es el de la página. */
export async function moveDiscountCode(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  const dir = z.enum(["up", "down"]).parse(form.get("dir"));
  const db = tenantDb(creator.id);
  const codes = await db.discountCode.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = codes.findIndex((c) => c.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= codes.length) return;
  [codes[i], codes[j]] = [codes[j], codes[i]];
  // Se renumera todo (1, 2, 3…): así dos códigos con el mismo orden nunca quedan atascados.
  await Promise.all(codes.map((c, k) => db.discountCode.update({ where: { id: c.id }, data: { sortOrder: k + 1 } })));
  refresh(creator.username);
}
