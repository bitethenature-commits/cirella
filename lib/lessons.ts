/**
 * Guardar y abrir una lección por partes (panel). Ver lib/lesson-parts.ts para el modelo.
 *
 *   saveLessonWithParts → valida módulo, lección y archivos con tenantDb (todo de la misma creadora
 *     y del mismo curso), limpia los textos y guarda en una transacción: comprueba la versión (no se
 *     pisan cambios hechos desde otro dispositivo), mueve de módulo si hace falta, sustituye las
 *     partes y reescribe la copia de compatibilidad (Lesson.kind/body/…).
 *   loadLessonEditor → lo que necesita el editor (módulos, materiales y la lección).
 *
 * La transacción va con el cliente base (como lib/refunds.ts): por eso CADA where y data de dentro
 * lleva el creatorId explícito. scripts/lessons-test.ts lo prueba con los ids de otra creadora.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { legacyLessonColumns, suggestedLessonMinutes, type LessonPartInput } from "./lesson-parts";
import { cleanRichInput, formatToStore, normalizeNewlines } from "./rich-text";
import { tenantDb } from "./tenant";
import { videoEmbed } from "./video-embed";

export const LESSON_CONFLICT =
  "Esta lección se ha cambiado desde otro dispositivo. Copia lo que necesites y recarga la página para ver la última versión.";
export const LESSON_FILE_GONE = "Uno de los archivos ya no está en los materiales del curso. Quítalo de la lección y vuelve a guardar.";
export const LESSON_EMBED_WARNING = "No reconocemos el enlace del vídeo: tus alumnas verán un botón para abrirlo.";

/** Error que se enseña tal cual en el editor. */
export class LessonSaveError extends Error {}

export const LESSON_PART_FILE_SELECT = {
  id: true,
  name: true,
  kind: true,
  mimeType: true,
  sizeBytes: true,
  durationSec: true,
  videoCodec: true,
  width: true,
  height: true,
} as const;

export type SaveLessonInput = {
  id?: string;
  moduleId: string;
  title: string;
  durationMin: number | null;
  version?: number | null;
  parts: LessonPartInput[];
  /** Borrador (false) o publicada (true). Sin él: se conserva (una lección nueva, publicada, como siempre). */
  published?: boolean;
  /** «Disponible a los N días» (apertura poco a poco por lección). Sin él: se conserva. */
  dripDays?: number | null;
};

export const LESSON_LAST_PUBLISHED =
  "Es la única lección publicada de un curso publicado: tus alumnas se quedarían sin nada. Publica otra antes o pasa el curso a borrador.";

type StoredPart = { kind: string; body: string | null; bodyFormat: string | null; fileId: string | null; url: string | null; fileKind?: string | null; data?: Prisma.InputJsonValue };

export async function saveLessonWithParts(
  creatorId: string,
  input: SaveLessonInput,
): Promise<{ lessonId: string; productId: string; version: number; created: boolean; warning: string | null }> {
  const db = tenantDb(creatorId);
  const mod = await db.courseModule.findFirst({ where: { id: input.moduleId }, include: { product: { select: { type: true } } } });
  if (!mod || mod.product.type !== "COURSE") throw new LessonSaveError("Módulo no encontrado");
  const productId = mod.productId;
  // La lección debe ser de este mismo curso: no se puede «mover» a otro curso ni a otra creadora.
  const existing = input.id ? await db.lesson.findFirst({ where: { id: input.id, productId } }) : null;
  if (input.id && !existing) throw new LessonSaveError("Esta lección ya no existe");
  if (existing?.published && input.published === false && (await isLastPublishedLesson(creatorId, existing.id))) throw new LessonSaveError(LESSON_LAST_PUBLISHED);
  const status = {
    ...(input.published !== undefined ? { published: input.published } : {}),
    ...(input.dripDays !== undefined ? { dripDays: input.dripDays } : {}),
  };

  const fileIds = [...new Set(input.parts.flatMap((p) => (p.kind === "FILE" ? [p.fileId] : [])))];
  const files = fileIds.length
    ? await db.productFile.findMany({ where: { id: { in: fileIds }, productId }, select: { id: true, kind: true, durationSec: true } })
    : [];
  if (files.length !== fileIds.length) throw new LessonSaveError(LESSON_FILE_GONE);
  const fileById = new Map(files.map((f) => [f.id, f]));

  let warning: string | null = null;
  const parts: StoredPart[] = input.parts.map((p) => {
    if (p.kind === "TEXT") {
      const body = normalizeNewlines(p.body);
      const bodyFormat = formatToStore(body, p.format, null);
      // Las imágenes propias (/media/<creadora>/…) que ya hubiera en un texto se conservan; las ajenas, no.
      return { kind: "TEXT", body: bodyFormat ? cleanRichInput(body, { creatorId, images: true }) : body, bodyFormat, fileId: null, url: null };
    }
    if (p.kind === "FILE") return { kind: "FILE", body: null, bodyFormat: null, fileId: p.fileId, url: null, fileKind: fileById.get(p.fileId)!.kind };
    // Capítulos, modelo, «en tu carta», «hoy», repaso y glosario: su contenido, ya validado (lib/lesson-blocks.ts).
    if (p.kind !== "EMBED") return { kind: p.kind, body: null, bodyFormat: null, fileId: null, url: null, data: p.data as unknown as Prisma.InputJsonValue };
    if (!videoEmbed(p.url)) warning = LESSON_EMBED_WARNING;
    return { kind: "EMBED", body: null, bodyFormat: null, fileId: null, url: p.url };
  });
  const legacy = legacyLessonColumns(parts);
  const durationMin = input.durationMin || suggestedLessonMinutes(fileIds.map((id) => fileById.get(id)!.durationSec)) || null;
  const title = input.title;

  try {
    return await prisma.$transaction(async (tx) => {
      let lessonId: string;
      if (existing) {
        lessonId = existing.id;
        const moved = existing.moduleId !== mod.id;
        const sortOrder = moved ? await tx.lesson.count({ where: { creatorId, moduleId: mod.id } }) : existing.sortOrder;
        const updated = await tx.lesson.updateMany({
          where: { id: existing.id, creatorId, ...(input.version != null ? { version: input.version } : {}) },
          data: { title, durationMin, moduleId: mod.id, sortOrder, ...legacy, ...status, version: { increment: 1 } },
        });
        if (updated.count === 0) throw new LessonSaveError(LESSON_CONFLICT);
        if (moved) {
          // El módulo de origen queda con su orden seguido (0..n-1).
          const rest = await tx.lesson.findMany({ where: { creatorId, moduleId: existing.moduleId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
          for (const [i, l] of rest.entries()) await tx.lesson.updateMany({ where: { id: l.id, creatorId }, data: { sortOrder: i } });
        }
        await tx.lessonPart.deleteMany({ where: { lessonId, creatorId } });
      } else {
        const sortOrder = await tx.lesson.count({ where: { creatorId, moduleId: mod.id } });
        const lesson = await tx.lesson.create({ data: { creatorId, productId, moduleId: mod.id, title, durationMin, sortOrder, ...legacy, ...status } });
        lessonId = lesson.id;
      }
      if (parts.length)
        await tx.lessonPart.createMany({
          data: parts.map((p, i) => ({ creatorId, productId, lessonId, sortOrder: i, kind: p.kind, body: p.body, bodyFormat: p.bodyFormat, fileId: p.fileId, url: p.url, data: p.data ?? Prisma.DbNull })),
        });
      const saved = await tx.lesson.findFirstOrThrow({ where: { id: lessonId, creatorId }, select: { version: true } });
      return { lessonId, productId, version: saved.version, created: !existing, warning };
    });
  } catch (e) {
    // Un archivo borrado entre la comprobación y el guardado (clave foránea).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") throw new LessonSaveError(LESSON_FILE_GONE);
    throw e;
  }
}

export type LessonEditorData = NonNullable<Awaited<ReturnType<typeof loadLessonEditor>>>;

/** Lo que necesita el editor de una lección; null si el curso no es de esta creadora (o no es un curso). */
export async function loadLessonEditor(creatorId: string, productId: string, lessonId: string | null) {
  const db = tenantDb(creatorId);
  const product = await db.product.findFirst({
    where: { id: productId, type: "COURSE" },
    select: { id: true, title: true, imageUrl: true, status: true, dripMode: true, dripEveryDays: true },
  });
  if (!product) return null;
  const [modules, files, lesson] = await Promise.all([
    db.courseModule.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { id: true, title: true } }),
    db.productFile.findMany({ where: { productId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { ...LESSON_PART_FILE_SELECT, url: true } }),
    lessonId
      ? db.lesson.findFirst({
          where: { id: lessonId, productId },
          select: {
            id: true,
            moduleId: true,
            title: true,
            durationMin: true,
            version: true,
            published: true,
            dripDays: true,
            parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, body: true, bodyFormat: true, fileId: true, url: true, data: true } },
          },
        })
      : Promise.resolve(null),
  ]);
  if (lessonId && !lesson) return null;
  return { product, modules, files, lesson };
}

/**
 * ¿Quitarla dejaría un curso publicado sin ninguna lección publicada? (lo mismo que impide borrar
 * lo último que se entrega: lib/delivery.ts).
 */
export async function isLastPublishedLesson(creatorId: string, lessonId: string): Promise<boolean> {
  const db = tenantDb(creatorId);
  const l = await db.lesson.findFirst({ where: { id: lessonId }, select: { productId: true, published: true, product: { select: { status: true, accessMode: true } } } });
  if (!l || !l.published || l.product.status !== "PUBLISHED" || l.product.accessMode === "EXTERNAL") return false;
  return (await db.lesson.count({ where: { productId: l.productId, published: true, NOT: { id: lessonId } } })) === 0;
}
