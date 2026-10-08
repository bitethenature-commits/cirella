"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { uniqueProductSlug } from "@/lib/creator";
import { parseMoneyToCents } from "@/lib/money";
import { canSellType } from "@/lib/plans";
import { tenantDb } from "@/lib/tenant";
import { DEFAULT_CTA, LESSON_KINDS, PRODUCT_TYPES, type ProductType } from "@/lib/types";

export type ActionState = { ok?: string; error?: string } | undefined;

async function ctx() {
  const { creator } = await requireCreator();
  return { creator, db: tenantDb(creator.id) };
}

function refresh(id?: string) {
  revalidatePath("/panel/productos");
  if (id) revalidatePath(`/panel/productos/${id}`);
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
  const product = await db.product.create({
    data: {
      creatorId: creator.id,
      type,
      title: titles[type],
      slug: await uniqueProductSlug(creator.id, titles[type]),
      priceCents: 0,
      status: "DRAFT",
      ctaLabel: DEFAULT_CTA[type],
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
});

export async function updateProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const { creator, db } = await ctx();
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const product = await db.product.findFirst({ where: { id: d.id } });
  if (!product) return { error: "Producto no encontrado" };
  const priceCents = parseMoneyToCents(d.price);
  if (d.status === "PUBLISHED" && priceCents < 100) return { error: "Pon un precio de al menos 1 € para publicarlo" };
  if (d.status === "PUBLISHED" && !canSellType(creator.plan, product.type as ProductType))
    return { error: "Tu plan actual no permite publicar este tipo de producto" };
  const wantedSlug = d.slug ? d.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : product.slug;
  const slug = wantedSlug !== product.slug ? await uniqueProductSlug(creator.id, wantedSlug, product.id) : product.slug;
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
      ctaLabel: d.ctaLabel || DEFAULT_CTA[product.type as ProductType],
      status: d.status,
      featured,
      instructions: d.instructions || null,
      slug,
      ...(product.type === "SESSION"
        ? { durationMin: d.durationMin ?? 60, bufferMin: d.bufferMin ?? 15, minNoticeHours: d.minNoticeHours ?? 24, meetingUrl: d.meetingUrl || null }
        : {}),
      ...(product.type === "MEMBERSHIP" ? { billingInterval: d.billingInterval ?? "month" } : {}),
    },
  });
  refresh(product.id);
  revalidatePath(`/${creator.username}`);
  return { ok: d.status === "PUBLISHED" ? "Guardado y publicado en tu página" : "Guardado como borrador" };
}

export async function moveProduct(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  const list = await db.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
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
  if (status === "PUBLISHED" && (product.priceCents < 100 || !canSellType(creator.plan, product.type as ProductType))) redirect(`/panel/productos/${id}`);
  await db.product.update({ where: { id }, data: { status } });
  refresh(id);
}

export async function deleteProduct(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const orders = await db.order.count({ where: { productId: id } });
  // Con ventas no se borra (las clientas mantienen su acceso): se archiva.
  if (orders > 0) await db.product.update({ where: { id }, data: { status: "ARCHIVED", featured: false } });
  else await db.product.deleteMany({ where: { id } });
  refresh();
  redirect("/panel/productos");
}

// ───────────── Archivos ─────────────

export async function deleteFile(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const file = await db.productFile.findFirst({ where: { id } });
  if (!file) return;
  await db.productFile.deleteMany({ where: { id } });
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
