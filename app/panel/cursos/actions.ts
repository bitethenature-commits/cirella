"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { DRIP_MAX_DAYS, DRIP_MODES } from "@/lib/course-drip";
import { EMPTY_COURSE_LOOK, readCourseLook } from "@/lib/course-design";
import { asCourseCategory } from "@/lib/course-categories";
import { productDeliveryIssue } from "@/lib/delivery";
import { isLastPublishedLesson, LESSON_LAST_PUBLISHED } from "@/lib/lessons";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";

/**
 * Acciones del estudio de cursos (/panel/cursos/<id>). Todas con tenantDb: un id de otra creadora
 * no encuentra nada. Las que cambian varias filas a la vez (reordenar, duplicar) van en una
 * transacción con el cliente base, con el creatorId explícito en CADA where y data.
 */
export type StudioResult = { ok?: string; error?: string };

async function ctx() {
  const { creator } = await requireCreator();
  return { creator, db: tenantDb(creator.id) };
}

function refresh(productId: string) {
  revalidatePath("/panel/cursos");
  revalidatePath(`/panel/cursos/${productId}`, "layout");
  revalidatePath(`/panel/productos/${productId}`);
  revalidatePath(`/cuenta/cursos/${productId}`);
  // La ficha pública lista el programa (ISR).
  revalidatePath("/[username]", "page");
}

const LAST_CONTENT = "Es lo último publicado de un curso publicado: tus alumnas se quedarían sin nada. Publica otra lección antes o pasa el curso a borrador.";

const title = (raw: unknown, fallback: string) => (typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 120) : fallback);

// ───────────── Temática ─────────────

/** La temática del curso («ASTROLOGIA», «ASTROLOGIA+MI_ENERGIA»… o vacía). */
export async function setStudioCourseCategory(productId: string, value: string): Promise<StudioResult> {
  const { db } = await ctx();
  const course = await db.product.findFirst({ where: { id: productId, type: "COURSE" }, select: { id: true } });
  if (!course) return { error: "Curso no encontrado" };
  await db.product.updateMany({ where: { id: productId }, data: { courseCategory: asCourseCategory(value) } });
  refresh(productId);
  revalidatePath("/[username]/cursos", "page");
  return { ok: value ? "Temática guardada" : "Sin temática" };
}

// ───────────── Título ─────────────

/** El título del curso, escrito encima en el editor (como en su ficha: de 2 a 100 letras). */
export async function renameStudioCourse(productId: string, raw: string): Promise<StudioResult> {
  const { creator, db } = await ctx();
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (name.length < 2) return { error: "El título del curso es demasiado corto" };
  if (name.length > 100) return { error: "El título del curso admite 100 letras" };
  const course = await db.product.findFirst({ where: { id: productId, type: "COURSE" }, select: { id: true } });
  if (!course) return { error: "Curso no encontrado" };
  await db.product.updateMany({ where: { id: productId }, data: { title: name } });
  refresh(productId);
  revalidatePath("/cuenta/cursos");
  revalidatePath("/[username]/cursos", "page");
  revalidatePath(`/${creator.username}`);
  return { ok: "Título guardado" };
}

// ───────────── Diseño ─────────────

/** El diseño de todas las lecciones del curso (lib/course-design.ts); vacío = los colores del área de cada alumna. */
export async function saveCourseLook(productId: string, raw: unknown): Promise<StudioResult> {
  const { db } = await ctx();
  const course = await db.product.findFirst({ where: { id: productId, type: "COURSE" }, select: { id: true } });
  if (!course) return { error: "Curso no encontrado" };
  const look = readCourseLook(raw);
  const empty = JSON.stringify(look) === JSON.stringify(EMPTY_COURSE_LOOK);
  await db.product.updateMany({ where: { id: productId }, data: { courseDesign: empty ? Prisma.DbNull : (look as Prisma.InputJsonValue) } });
  revalidatePath(`/cuenta/cursos/${productId}`);
  return { ok: "Diseño guardado" };
}

// ───────────── Módulos ─────────────

export async function addStudioModule(productId: string, name: string): Promise<StudioResult> {
  const { creator, db } = await ctx();
  if (!(await db.product.findFirst({ where: { id: productId, type: "COURSE" }, select: { id: true } }))) return { error: "Curso no encontrado" };
  const count = await db.courseModule.count({ where: { productId } });
  await db.courseModule.create({ data: { creatorId: creator.id, productId, title: title(name, `Módulo ${count + 1}`), sortOrder: count } });
  refresh(productId);
  return { ok: "Módulo añadido" };
}

export async function renameStudioModule(id: string, name: string): Promise<StudioResult> {
  const { db } = await ctx();
  const m = await db.courseModule.findFirst({ where: { id } });
  if (!m) return { error: "Módulo no encontrado" };
  if (!name.trim()) return { error: "Ponle un nombre al módulo" };
  await db.courseModule.updateMany({ where: { id }, data: { title: title(name, m.title) } });
  refresh(m.productId);
  return { ok: "Módulo renombrado" };
}

export async function deleteStudioModule(id: string): Promise<StudioResult> {
  const { db } = await ctx();
  const m = await db.courseModule.findFirst({ where: { id } });
  if (!m) return { error: "Módulo no encontrado" };
  const published = await db.lesson.count({ where: { moduleId: m.id, published: true } });
  const r = await productDeliveryIssue(db, m.productId, { minus: { lessons: published } });
  if (r?.product.status === "PUBLISHED" && r.issue?.blocking) return { error: LAST_CONTENT };
  await db.courseModule.deleteMany({ where: { id: m.id } });
  // Los que quedan, con su orden seguido.
  const rest = await db.courseModule.findMany({ where: { productId: m.productId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  await Promise.all(rest.map((x, i) => db.courseModule.updateMany({ where: { id: x.id }, data: { sortOrder: i } })));
  refresh(m.productId);
  return { ok: "Módulo eliminado" };
}

// ───────────── Orden (arrastrar o ↑/↓) ─────────────

const layoutSchema = z.array(z.object({ id: z.string().min(1).max(40), lessons: z.array(z.string().min(1).max(40)).max(500) })).max(100);

/**
 * Guarda el orden completo del programa: los módulos en ese orden y, dentro de cada uno, sus
 * lecciones (una lección puede cambiar de módulo). Tiene que nombrar exactamente los módulos y las
 * lecciones del curso: si otra pantalla añadió o borró algo, se pide recargar.
 */
export async function reorderCourse(productId: string, layout: unknown): Promise<StudioResult> {
  const { creator, db } = await ctx();
  const parsed = layoutSchema.safeParse(layout);
  if (!parsed.success) return { error: "No hemos podido leer el nuevo orden. Recarga la página." };
  const [modules, lessons] = await Promise.all([
    db.courseModule.findMany({ where: { productId, product: { type: "COURSE" } }, select: { id: true } }),
    db.lesson.findMany({ where: { productId }, select: { id: true } }),
  ]);
  const wantModules = parsed.data.map((m) => m.id);
  const wantLessons = parsed.data.flatMap((m) => m.lessons);
  const same = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
  if (!modules.length || !same(wantModules, modules.map((m) => m.id)) || !same(wantLessons, lessons.map((l) => l.id)))
    return { error: "El curso ha cambiado en otra pantalla. Recarga la página para ver el último programa." };
  const creatorId = creator.id;
  await prisma.$transaction(async (tx) => {
    for (const [mi, m] of parsed.data.entries()) {
      await tx.courseModule.updateMany({ where: { id: m.id, creatorId, productId }, data: { sortOrder: mi } });
      for (const [li, lessonId] of m.lessons.entries()) await tx.lesson.updateMany({ where: { id: lessonId, creatorId, productId }, data: { moduleId: m.id, sortOrder: li } });
    }
  });
  refresh(productId);
  return { ok: "Orden guardado" };
}

/**
 * Mover un capítulo de una lección (arrastrándolo en el índice): el capítulo entero, con todo lo que tiene dentro
 * hasta el siguiente, pasa de `from` a `to` (contando `to` sin él). Lo de antes del primer capítulo no se mueve. La
 * versión de la lección sube, para que un editor abierto en otra pantalla no pise el orden nuevo sin avisar.
 */
export async function moveLessonChapter(lessonId: string, from: number, to: number): Promise<StudioResult> {
  const { creator } = await ctx();
  const creatorId = creator.id;
  if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < 200)) return { error: "No hemos podido leer el nuevo orden. Recarga la página." };
  const l = await prisma.lesson.findFirst({
    where: { id: lessonId, creatorId },
    select: { productId: true, parts: { orderBy: { sortOrder: "asc" }, select: { id: true, kind: true } } },
  });
  if (!l) return { error: "Lección no encontrada" };
  const starts = l.parts.flatMap((p, i) => (p.kind === "CHAPTER" ? [i] : []));
  if (from >= starts.length || to >= starts.length) return { error: "La lección ha cambiado en otra pantalla. Recarga la página." };
  if (from === to) return { ok: "Orden guardado" };
  const head = l.parts.slice(0, starts[0]);
  const blocks = starts.map((s, k) => l.parts.slice(s, starts[k + 1] ?? l.parts.length));
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved);
  const order = [...head, ...blocks.flat()];
  await prisma.$transaction([
    ...order.map((p, i) => prisma.lessonPart.updateMany({ where: { id: p.id, creatorId, lessonId }, data: { sortOrder: i } })),
    prisma.lesson.updateMany({ where: { id: lessonId, creatorId }, data: { version: { increment: 1 } } }),
  ]);
  refresh(l.productId);
  return { ok: "Orden de los capítulos guardado" };
}

// ───────────── Lecciones ─────────────

/**
 * «Añadir lección»: una lección nueva al final del módulo, en borrador y vacía («Lección nueva»), para abrirla al
 * momento en el editor (allí se escribe su título encima y todo se guarda solo).
 */
export async function addStudioLesson(productId: string, moduleId: string): Promise<StudioResult & { lessonId?: string }> {
  const { creator, db } = await ctx();
  const mod = await db.courseModule.findFirst({ where: { id: moduleId, productId, product: { type: "COURSE" } }, select: { id: true } });
  if (!mod) return { error: "Módulo no encontrado. Recarga la página." };
  const count = await db.lesson.count({ where: { moduleId } });
  const lesson = await db.lesson.create({ data: { creatorId: creator.id, productId, moduleId, title: "Lección nueva", kind: "TEXT", sortOrder: count, published: false } });
  refresh(productId);
  return { ok: "Lección añadida", lessonId: lesson.id };
}

export async function setLessonPublished(id: string, published: boolean): Promise<StudioResult> {
  const { db, creator } = await ctx();
  const l = await db.lesson.findFirst({ where: { id }, select: { id: true, productId: true, published: true } });
  if (!l) return { error: "Lección no encontrada" };
  if (!published && (await isLastPublishedLesson(creator.id, l.id))) return { error: LESSON_LAST_PUBLISHED };
  // Cambiar el estado no toca el contenido: la versión del editor sigue valiendo.
  await db.lesson.updateMany({ where: { id }, data: { published } });
  refresh(l.productId);
  return { ok: published ? "Lección publicada: tus alumnas ya la ven" : "Lección en borrador: tus alumnas ya no la ven" };
}

/**
 * Duplica una lección: misma lección justo debajo, en borrador, con «(copia)» y las mismas partes.
 * Los archivos NO se copian en el almacenamiento: las partes nuevas apuntan a los mismos materiales
 * del curso (ProductFile), como cuando un PDF se usa en dos lecciones. Borrar el material lo quita de
 * las dos (Materiales del curso avisa de en cuántas lecciones está).
 */
export async function duplicateLesson(id: string): Promise<StudioResult & { lessonId?: string }> {
  const { creator } = await ctx();
  const creatorId = creator.id;
  const created = await prisma.$transaction(async (tx) => {
    const l = await tx.lesson.findFirst({ where: { id, creatorId }, include: { parts: { orderBy: { sortOrder: "asc" } } } });
    if (!l) return null;
    await tx.lesson.updateMany({ where: { creatorId, moduleId: l.moduleId, sortOrder: { gt: l.sortOrder } }, data: { sortOrder: { increment: 1 } } });
    const copy = await tx.lesson.create({
      data: {
        creatorId,
        productId: l.productId,
        moduleId: l.moduleId,
        title: `${l.title} (copia)`.slice(0, 140),
        kind: l.kind,
        body: l.body,
        bodyFormat: l.bodyFormat,
        mediaUrl: l.mediaUrl,
        fileId: l.fileId,
        durationMin: l.durationMin,
        sortOrder: l.sortOrder + 1,
        published: false,
        dripDays: l.dripDays,
        design: l.design === null ? Prisma.DbNull : (l.design as Prisma.InputJsonValue),
      },
    });
    const json = (v: Prisma.JsonValue) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));
    if (l.parts.length)
      await tx.lessonPart.createMany({
        // También el contenido de los capítulos y las piezas interactivas (data) y el diseño de cada pieza.
        data: l.parts.map((p) => ({
          creatorId,
          productId: l.productId,
          lessonId: copy.id,
          sortOrder: p.sortOrder,
          kind: p.kind,
          body: p.body,
          bodyFormat: p.bodyFormat,
          fileId: p.fileId,
          url: p.url,
          data: json(p.data),
          design: json(p.design),
        })),
      });
    return { id: copy.id, productId: l.productId };
  });
  if (!created) return { error: "Lección no encontrada" };
  refresh(created.productId);
  return { ok: "Lección duplicada en borrador", lessonId: created.id };
}

export async function deleteStudioLesson(id: string): Promise<StudioResult> {
  const { db, creator } = await ctx();
  const l = await db.lesson.findFirst({ where: { id }, select: { id: true, productId: true, moduleId: true } });
  if (!l) return { error: "Lección no encontrada" };
  if (await isLastPublishedLesson(creator.id, l.id)) return { error: LAST_CONTENT };
  await db.lesson.deleteMany({ where: { id } });
  const rest = await db.lesson.findMany({ where: { moduleId: l.moduleId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  await Promise.all(rest.map((x, i) => db.lesson.updateMany({ where: { id: x.id }, data: { sortOrder: i } })));
  refresh(l.productId);
  return { ok: "Lección eliminada" };
}

// ───────────── Apertura poco a poco ─────────────

const dripSchema = z.object({
  mode: z.enum(["ALL", ...DRIP_MODES]),
  everyDays: z.coerce.number({ message: "Escribe cada cuántos días" }).int("Escribe un número de días").min(1, "Como mínimo, cada día").max(DRIP_MAX_DAYS, `Como máximo, cada ${DRIP_MAX_DAYS} días`).optional(),
});

export async function saveDrip(productId: string, input: { mode: string; everyDays?: string }): Promise<StudioResult> {
  const { db } = await ctx();
  const parsed = dripSchema.safeParse({ mode: input.mode, everyDays: input.mode === "INTERVAL" ? input.everyDays : undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.mode === "INTERVAL" && !parsed.data.everyDays) return { error: "Escribe cada cuántos días se abre una lección" };
  const r = await db.product.updateMany({
    where: { id: productId, type: "COURSE" },
    data: { dripMode: parsed.data.mode === "ALL" ? null : parsed.data.mode, dripEveryDays: parsed.data.mode === "INTERVAL" ? parsed.data.everyDays! : null },
  });
  if (!r.count) return { error: "Curso no encontrado" };
  refresh(productId);
  return { ok: parsed.data.mode === "ALL" ? "Todas las lecciones se abren a la vez" : "Guardado: las lecciones se abrirán poco a poco" };
}

/** «Disponible a los N días» de una lección (con la apertura por lección). null = desde el primer día. */
export async function setLessonDripDays(id: string, days: number | null): Promise<StudioResult> {
  const { db } = await ctx();
  const value = days && days > 0 ? Math.min(DRIP_MAX_DAYS, Math.floor(days)) : null;
  const l = await db.lesson.findFirst({ where: { id }, select: { productId: true } });
  if (!l) return { error: "Lección no encontrada" };
  await db.lesson.updateMany({ where: { id }, data: { dripDays: value } });
  refresh(l.productId);
  return { ok: "Guardado" };
}
