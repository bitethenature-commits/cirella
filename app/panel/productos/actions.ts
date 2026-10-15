"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ACCESS_MODES,
  asAccessMode,
  defaultAccessMode,
  EXTERNAL_LABEL_MAX,
  parseExternalUrl,
  publishPriceError,
  resolveAccessMode,
  storedPriceCents,
} from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { uniqueProductSlug } from "@/lib/creator";
import { DELIVERY_MODES, deliveryIssueCopy, normalizeDeliveryMode, productDeliveryIssue } from "@/lib/delivery";
import { FreeAccessError, grantManualAccess, revokeManualAccess } from "@/lib/free-access";
import { parseMoneyToCents } from "@/lib/money";
import { canSellType } from "@/lib/plans";
import { siteMode } from "@/lib/site-mode";
import { RESERVED_PRODUCT_SLUGS } from "@/lib/slug";
import { privateKey, storage } from "@/lib/storage";
import { tenantDb, type TenantDb } from "@/lib/tenant";
import { DEFAULT_CTA, LESSON_KINDS, PRODUCT_TYPES, type ProductType } from "@/lib/types";

export type ActionState = { ok?: string; error?: string } | undefined;

async function ctx() {
  const { creator } = await requireCreator();
  return { creator, db: tenantDb(creator.id) };
}

function refresh(id?: string) {
  revalidatePath("/panel/productos");
  if (id) revalidatePath(`/panel/productos/${id}`);
  // La página pública está cacheada (ISR): reordenar, archivar o borrar debe verse ya.
  revalidatePath("/[username]", "page");
}

/** Borra del almacenamiento los archivos de unos ProductFile ya eliminados. Si falla, quedan huérfanos (no rompe nada). */
async function deleteStoredFiles(storageKeys: (string | null)[]) {
  const keys = storageKeys.filter((k): k is string => !!k).map(privateKey);
  if (keys.length) await storage().delete(keys).catch(() => {});
}

// ───────────── Productos ─────────────

export async function createProduct(form: FormData) {
  const { creator, db } = await ctx();
  const type = z.enum(PRODUCT_TYPES).parse(form.get("type"));
  if (!canSellType(creator.plan, type)) redirect("/panel/plan");
  const count = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
  if (creator.plan.maxProducts != null && count >= creator.plan.maxProducts) redirect("/panel/productos?limite=1");
  const titles: Record<ProductType, string> = {
    DIGITAL: "Nuevo producto digital",
    SESSION: "Nueva sesión",
    COURSE: "Nuevo curso",
    MEMBERSHIP: "Nueva membresía",
  };
  // En la web personal nada se cobra aquí: gratis con email (o, una sesión, pago en otra web).
  const accessMode = defaultAccessMode(siteMode(), type);
  const product = await db.product.create({
    data: {
      creatorId: creator.id,
      type,
      title: titles[type],
      slug: await uniqueProductSlug(creator.id, titles[type]),
      priceCents: 0,
      status: "DRAFT",
      accessMode,
      ctaLabel: accessMode === "FREE_EMAIL" ? FREE_CTA : DEFAULT_CTA[type],
      sortOrder: count + 1,
      billingInterval: type === "MEMBERSHIP" ? "month" : null,
      durationMin: type === "SESSION" ? 60 : null,
      bufferMin: type === "SESSION" ? 15 : null,
      minNoticeHours: type === "SESSION" ? 24 : null,
      emoji: { DIGITAL: "✨", SESSION: "🔮", COURSE: "📖", MEMBERSHIP: "💫" }[type],
    },
  });
  if (type === "COURSE") await db.courseModule.create({ data: { creatorId: creator.id, productId: product.id, title: "Módulo 1", sortOrder: 0 } });
  redirect(`/panel/productos/${product.id}?nuevo=1`);
}

/** Botón por defecto de un producto gratis con email. */
const FREE_CTA = "Quiero el acceso gratis";

const productSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(2, "El título es demasiado corto").max(100),
  emoji: z.string().max(8).optional(),
  summary: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(),
  imageUrl: z.string().max(500).optional(),
  price: z.string(),
  ctaLabel: z.string().trim().max(30).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  featured: z.string().optional(),
  instructions: z.string().trim().max(1000).optional(),
  slug: z.string().trim().max(60).optional(),
  durationMin: z.coerce.number().int().min(10).max(480).optional(),
  bufferMin: z.coerce.number().int().min(0).max(240).optional(),
  minNoticeHours: z.coerce.number().int().min(0).max(24 * 30).optional(),
  meetingUrl: z.string().trim().max(300).optional(),
  billingInterval: z.enum(["month", "year"]).optional(),
  deliveryMode: z.enum(DELIVERY_MODES).optional(),
  // Cómo se consigue (lib/access-mode.ts). En la plataforma el formulario no lo envía: se conserva.
  accessMode: z.enum(ACCESS_MODES).optional(),
  externalUrl: z.string().trim().max(600).optional(),
  externalLabel: z.string().trim().max(EXTERNAL_LABEL_MAX, `El texto del botón admite ${EXTERNAL_LABEL_MAX} caracteres`).optional(),
});

export async function updateProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const { creator, db } = await ctx();
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const product = await db.product.findFirst({ where: { id: d.id } });
  if (!product) return { error: "Producto no encontrado" };
  if (product.status === "ARCHIVED" && creator.plan.maxProducts != null) {
    const active = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
    if (active >= creator.plan.maxProducts) return { error: `Has llegado al límite de ${creator.plan.maxProducts} productos de tu plan. Archiva otro o mejora tu plan.` };
  }
  const accessMode = resolveAccessMode(d.accessMode, product.accessMode, siteMode(), product.type);
  const priceCents = storedPriceCents(accessMode, parseMoneyToCents(d.price));
  const priceError = d.status === "PUBLISHED" ? publishPriceError(accessMode, priceCents) : null;
  if (priceError) return { error: priceError };
  // Pago en otra web: el enlace (https) es obligatorio también en borrador, para no guardar uno roto.
  let externalUrl: string | null = product.externalUrl;
  let externalLabel: string | null = product.externalLabel;
  if (accessMode === "EXTERNAL") {
    const url = parseExternalUrl(d.externalUrl ?? product.externalUrl);
    if (!url.ok) return { error: url.error };
    externalUrl = url.url;
    externalLabel = d.externalLabel !== undefined ? d.externalLabel || null : product.externalLabel;
  }
  if (d.status === "PUBLISHED" && !canSellType(creator.plan, product.type as ProductType))
    return { error: "Tu plan actual no permite publicar este tipo de producto" };
  const deliveryMode = normalizeDeliveryMode(product.type, d.deliveryMode ?? product.deliveryMode);
  // Publicar exige algo que entregar (lib/delivery.ts), con el modo y las instrucciones que llegan en el formulario.
  // Un borrador se guarda aunque esté incompleto. Lo que se paga fuera lo entrega la otra web.
  if (d.status === "PUBLISHED") {
    const r = await productDeliveryIssue(db, product.id, { deliveryMode, instructions: d.instructions || null, accessMode });
    if (r?.issue?.blocking) return { error: deliveryIssueCopy(r.issue, d.title).publishError };
  }
  const wantedSlug = d.slug ? d.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : product.slug;
  // Un slug que ha pasado a estar reservado (p. ej. «novedades») se recalcula aunque no cambie.
  const slug =
    wantedSlug !== product.slug || RESERVED_PRODUCT_SLUGS.has(wantedSlug)
      ? await uniqueProductSlug(creator.id, wantedSlug, product.id)
      : product.slug;
  if (d.meetingUrl && !/^https?:\/\//.test(d.meetingUrl)) return { error: "El enlace de videollamada debe empezar por https://" };
  if (d.imageUrl && !d.imageUrl.startsWith("/media/") && !d.imageUrl.startsWith("/demo/")) return { error: "Imagen no válida" };
  const featured = d.featured === "on";
  if (featured && !product.featured) await db.product.updateMany({ where: { featured: true }, data: { featured: false } });
  await db.product.update({
    where: { id: product.id },
    data: {
      title: d.title,
      emoji: d.emoji || null,
      summary: d.summary || null,
      description: d.description || null,
      imageUrl: d.imageUrl || null,
      priceCents,
      ctaLabel: d.ctaLabel || (accessMode === "FREE_EMAIL" ? FREE_CTA : DEFAULT_CTA[product.type as ProductType]),
      accessMode,
      externalUrl,
      externalLabel,
      status: d.status,
      featured,
      instructions: d.instructions || null,
      deliveryMode,
      slug,
      ...(product.type === "SESSION"
        ? { durationMin: d.durationMin ?? 60, bufferMin: d.bufferMin ?? 15, minNoticeHours: d.minNoticeHours ?? 24, meetingUrl: d.meetingUrl || null }
        : {}),
      ...(product.type === "MEMBERSHIP" ? { billingInterval: d.billingInterval ?? "month" } : {}),
    },
  });
  refresh(product.id);
  revalidatePath(`/${creator.username}`);
  // En la web personal lo que se cobraba en la web se guarda tal cual, pero no se ve: se dice.
  if (accessMode === "PAID" && siteMode() === "personal")
    return { ok: "Guardado. No se ve en tu página: en tu web no se cobra nada. Elige «Gratis con email» o «Pago en otra web» para que aparezca." };
  return { ok: d.status === "PUBLISHED" ? "Guardado y publicado en tu página" : "Guardado como borrador" };
}

export async function moveProduct(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  const list = await db.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const i = list.findIndex((p) => p.id === id);
  let j = i + dir;
  // Desde el editor solo se ven los productos publicados: saltamos los ocultos.
  if (form.get("visible") === "1") while (j >= 0 && j < list.length && list[j].status !== "PUBLISHED") j += dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((p, idx) => db.product.update({ where: { id: p.id }, data: { sortOrder: idx + 1 } })));
  refresh();
}

export async function setProductStatus(form: FormData) {
  const { creator, db } = await ctx();
  const id = String(form.get("id"));
  const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(form.get("status"));
  const product = await db.product.findFirst({ where: { id } });
  if (!product) return;
  if (product.status === "ARCHIVED" && status !== "ARCHIVED" && creator.plan.maxProducts != null) {
    const active = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
    if (active >= creator.plan.maxProducts) redirect("/panel/productos?limite=1");
  }
  const accessMode = asAccessMode(product.accessMode);
  if (
    status === "PUBLISHED" &&
    (publishPriceError(accessMode, product.priceCents) ||
      (accessMode === "EXTERNAL" && !product.externalUrl) ||
      !canSellType(creator.plan, product.type as ProductType))
  )
    redirect(`/panel/productos/${id}`);
  if (status === "PUBLISHED") {
    const issue = (await productDeliveryIssue(db, id))?.issue;
    if (issue?.blocking) redirect(`/panel/productos/${id}?error=sin-entrega#${issue.anchor}`);
  }
  await db.product.update({ where: { id }, data: { status } });
  refresh(id);
}

export async function deleteProduct(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const orders = await db.order.count({ where: { productId: id } });
  // Con ventas no se borra (las clientas mantienen su acceso): se archiva.
  if (orders > 0) await db.product.update({ where: { id }, data: { status: "ARCHIVED", featured: false } });
  else {
    const files = await db.productFile.findMany({ where: { productId: id, storageKey: { not: null } }, select: { storageKey: true } });
    await db.product.deleteMany({ where: { id } });
    await deleteStoredFiles(files.map((f) => f.storageKey));
  }
  refresh();
  redirect("/panel/productos");
}

/**
 * Un producto publicado no puede quedarse sin nada que entregar: primero se sube el nuevo, luego se
 * borra el viejo. Si el borrado lo dejaría vacío, vuelve al editor con el aviso y no borra nada.
 */
async function guardLastDeliverable(db: TenantDb, productId: string, minus: { files?: number; lessons?: number }, anchor: string) {
  const r = await productDeliveryIssue(db, productId, { minus });
  if (r?.product.status === "PUBLISHED" && r.issue?.blocking) redirect(`/panel/productos/${productId}?error=ultimo-contenido#${anchor}`);
}

// ───────────── Acceso a mano (gratis o pagado fuera) ─────────────

const grantSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2, "Escribe su nombre").max(80),
  email: z.string().trim().toLowerCase().max(200).email("Revisa el email"),
});

/**
 * «Dar acceso a una persona»: pedido de 0 € (paymentProvider «manual») y el mismo email de acceso
 * que recibe quien se apunta gratis. Si ya lo tenía, se le reenvía el enlace.
 */
export async function grantAccess(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, creator } = await requireCreator();
  const parsed = grantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    const r = await grantManualAccess({ creatorId: creator.id, productId: d.productId, name: d.name, email: d.email, grantedByUserId: user.id });
    refresh(d.productId);
    revalidatePath("/panel/ventas");
    revalidatePath("/panel/clientes");
    return {
      ok: r.status === "granted" ? `Listo: ${d.email} ya tiene acceso y le hemos enviado el enlace.` : `${d.email} ya tenía acceso: le hemos vuelto a enviar el enlace.`,
    };
  } catch (e) {
    if (e instanceof FreeAccessError) return { error: e.message };
    throw e;
  }
}

/** «Quitar acceso»: el acceso de esa persona pasa a retirado y sus enlaces dejan de funcionar. */
export async function revokeAccess(form: FormData) {
  const { creator } = await ctx();
  const orderId = String(form.get("orderId") ?? "");
  const productId = String(form.get("productId") ?? "");
  const done = await revokeManualAccess({ creatorId: creator.id, orderId });
  refresh(productId || undefined);
  revalidatePath("/panel/ventas");
  redirect(`/panel/productos/${encodeURIComponent(productId)}?${done ? "acceso=quitado" : "error=acceso"}#accesos`);
}

// ───────────── Archivos ─────────────

export async function deleteFile(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const file = await db.productFile.findFirst({ where: { id } });
  if (!file) return;
  await guardLastDeliverable(db, file.productId, { files: 1 }, "entrega");
  await db.productFile.deleteMany({ where: { id } });
  await deleteStoredFiles([file.storageKey]);
  refresh(file.productId);
}

export async function addLinkFile(form: FormData) {
  const { creator, db } = await ctx();
  const productId = String(form.get("productId"));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const url = String(form.get("url") ?? "").trim();
  if (!name || !/^https?:\/\//.test(url)) return;
  if (!(await db.product.findFirst({ where: { id: productId } }))) return;
  const count = await db.productFile.count({ where: { productId } });
  await db.productFile.create({ data: { creatorId: creator.id, productId, name, kind: "LINK", url, sortOrder: count } });
  refresh(productId);
}

// ───────────── Curso ─────────────

export async function addModule(form: FormData) {
  const { creator, db } = await ctx();
  const productId = String(form.get("productId"));
  if (!(await db.product.findFirst({ where: { id: productId, type: "COURSE" } }))) return;
  const count = await db.courseModule.count({ where: { productId } });
  await db.courseModule.create({ data: { creatorId: creator.id, productId, title: String(form.get("title") || `Módulo ${count + 1}`).slice(0, 120), sortOrder: count } });
  refresh(productId);
}

export async function renameModule(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const m = await db.courseModule.findFirst({ where: { id } });
  if (!m) return;
  await db.courseModule.update({ where: { id }, data: { title: String(form.get("title") || m.title).slice(0, 120) } });
  refresh(m.productId);
}

export async function deleteModule(form: FormData) {
  const { db } = await ctx();
  const m = await db.courseModule.findFirst({ where: { id: String(form.get("id")) } });
  if (!m) return;
  await guardLastDeliverable(db, m.productId, { lessons: await db.lesson.count({ where: { moduleId: m.id } }) }, "lecciones");
  await db.courseModule.deleteMany({ where: { id: m.id } });
  refresh(m.productId);
}

const lessonSchema = z.object({
  id: z.string().optional(),
  moduleId: z.string(),
  title: z.string().trim().min(1, "Ponle un título a la lección").max(140),
  kind: z.enum(LESSON_KINDS),
  body: z.string().max(20000).optional(),
  mediaUrl: z.string().trim().max(500).optional(),
  fileId: z.string().optional(),
  durationMin: z.coerce.number().int().min(0).max(600).optional(),
});

export async function saveLesson(_: ActionState, form: FormData): Promise<ActionState> {
  const { creator, db } = await ctx();
  const parsed = lessonSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const mod = await db.courseModule.findFirst({ where: { id: d.moduleId } });
  if (!mod) return { error: "Módulo no encontrado" };
  if (d.fileId && !(await db.productFile.findFirst({ where: { id: d.fileId, productId: mod.productId } }))) return { error: "Archivo no válido" };
  if (d.mediaUrl && !/^https?:\/\//.test(d.mediaUrl)) return { error: "El enlace debe empezar por https://" };
  const data = { title: d.title, kind: d.kind, body: d.body || null, mediaUrl: d.mediaUrl || null, fileId: d.fileId || null, durationMin: d.durationMin || null };
  if (d.id) {
    const lesson = await db.lesson.findFirst({ where: { id: d.id } });
    if (!lesson) return { error: "Lección no encontrada" };
    await db.lesson.update({ where: { id: lesson.id }, data });
  } else {
    const count = await db.lesson.count({ where: { moduleId: mod.id } });
    await db.lesson.create({ data: { ...data, creatorId: creator.id, productId: mod.productId, moduleId: mod.id, sortOrder: count } });
  }
  refresh(mod.productId);
  return { ok: "Lección guardada" };
}

export async function deleteLesson(form: FormData) {
  const { db } = await ctx();
  const l = await db.lesson.findFirst({ where: { id: String(form.get("id")) } });
  if (!l) return;
  await guardLastDeliverable(db, l.productId, { lessons: 1 }, "lecciones");
  await db.lesson.deleteMany({ where: { id: l.id } });
  refresh(l.productId);
}

export async function moveLesson(form: FormData) {
  const { db } = await ctx();
  const l = await db.lesson.findFirst({ where: { id: String(form.get("id")) } });
  if (!l) return;
  const list = await db.lesson.findMany({ where: { moduleId: l.moduleId }, orderBy: { sortOrder: "asc" } });
  const i = list.findIndex((x) => x.id === l.id);
  const j = i + (form.get("dir") === "up" ? -1 : 1);
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, idx) => db.lesson.update({ where: { id: x.id }, data: { sortOrder: idx } })));
  refresh(l.productId);
}

// ───────────── Membresía ─────────────

export async function addPost(_: ActionState, form: FormData): Promise<ActionState> {
  const { creator, db } = await ctx();
  const productId = String(form.get("productId"));
  const title = String(form.get("title") ?? "").trim().slice(0, 160);
  const body = String(form.get("body") ?? "").trim().slice(0, 10000);
  const kind = z.enum(["TEXT", "AUDIO", "VIDEO", "EVENT"]).catch("TEXT").parse(form.get("kind"));
  const mediaUrl = String(form.get("mediaUrl") ?? "").trim();
  if (!title || !body) return { error: "Escribe un título y un texto" };
  if (mediaUrl && !/^https?:\/\//.test(mediaUrl)) return { error: "El enlace debe empezar por https://" };
  if (!(await db.product.findFirst({ where: { id: productId, type: "MEMBERSHIP" } }))) return { error: "Membresía no encontrada" };
  await db.membershipPost.create({ data: { creatorId: creator.id, productId, title, body, kind, mediaUrl: mediaUrl || null } });
  refresh(productId);
  return { ok: "Publicado para tus miembros" };
}

export async function deletePost(form: FormData) {
  const { db } = await ctx();
  const p = await db.membershipPost.findFirst({ where: { id: String(form.get("id")) } });
  if (!p) return;
  await db.membershipPost.deleteMany({ where: { id: p.id } });
  refresh(p.productId);
}
