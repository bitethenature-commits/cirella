/**
 * Qué lecciones de un curso puede ver una alumna ahora mismo:
 *   · solo las publicadas (Lesson.published): un borrador no sale en el programa, no cuenta en el
 *     progreso, no se puede completar y sus archivos no se abren;
 *   · si el curso abre las lecciones poco a poco (lib/course-drip.ts), las que ya tocan según la
 *     fecha en que se apuntó (la del acceso directo o la de la membresía que lo incluye).
 *
 * La dueña (y su «Ver como alumna») lo ve todo: sin fecha de alta no hay nada cerrado.
 */
import "server-only";
import { prisma } from "./db";
import { lessonLocks, readDrip, type DripSettings } from "./course-drip";
import { accessSource, type AccessSource } from "./membership-access";

/** Lecciones publicadas de las alumnas (en cualquier consulta de su lado). */
export const PUBLISHED_LESSON = { published: true } as const;

/** Fecha en que se apuntó: la del acceso que le da el curso. */
export async function enrolledAt(source: AccessSource | null): Promise<Date | null> {
  if (!source) return null;
  const a = await prisma.access.findUnique({ where: { id: source.accessId }, select: { createdAt: true } });
  return a?.createdAt ?? null;
}

/** Lecciones publicadas, en el orden del programa (módulo y lección), con lo que pide la apertura poco a poco. */
export async function publishedLessonOrder(productId: string) {
  const rows = await prisma.lesson.findMany({
    where: { productId, ...PUBLISHED_LESSON },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, dripDays: true },
  });
  return rows;
}

/**
 * Lecciones abiertas para una alumna (publicadas y ya disponibles). `null` = sin acceso.
 * Se calcula en cada llamada (la hora cuenta).
 */
export async function openLessonIds(userId: string, productId: string, now = new Date()): Promise<Set<string> | null> {
  const [product, source] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { type: true, dripMode: true, dripEveryDays: true } }),
    accessSource(userId, productId, now),
  ]);
  if (!product || !source) return null;
  const lessons = await publishedLessonOrder(productId);
  const drip: DripSettings = readDrip(product);
  if (!drip.mode) return new Set(lessons.map((l) => l.id));
  const locks = lessonLocks(drip, lessons, await enrolledAt(source), now);
  return new Set(lessons.filter((l) => !locks.get(l.id)).map((l) => l.id));
}

/**
 * ¿Puede una alumna abrir este archivo de un curso? Si el archivo está en alguna lección, al menos
 * una de ellas tiene que estar abierta para ella (publicada y ya disponible). Un material que no
 * está en ninguna lección se ve como siempre (materiales del curso). Fuera de los cursos, sí.
 */
export async function courseFileOpenFor(userId: string, file: { id: string; productId: string }): Promise<boolean> {
  const uses = await prisma.lessonPart.findMany({ where: { fileId: file.id, productId: file.productId }, select: { lessonId: true } });
  if (!uses.length) return true;
  const open = await openLessonIds(userId, file.productId);
  return !!open && uses.some((u) => open.has(u.lessonId));
}

/** Anota que una alumna ha abierto una lección (para «Datos» y la última actividad). Nunca bloquea. */
export async function recordLessonView(v: { userId: string; lessonId: string; productId: string; creatorId: string }) {
  try {
    await prisma.lessonView.upsert({
      where: { userId_lessonId: { userId: v.userId, lessonId: v.lessonId } },
      create: { userId: v.userId, lessonId: v.lessonId, productId: v.productId, creatorId: v.creatorId },
      update: { count: { increment: 1 }, lastAt: new Date() },
    });
  } catch {
    // Dos pestañas a la vez (clave única) o la lección se acaba de borrar: no importa.
  }
}
