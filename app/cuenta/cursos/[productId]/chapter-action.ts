"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Lecciones por capítulos: guarda el capítulo que la alumna tiene abierto, para seguir ahí la próxima
 * vez (LessonView.chapter). Solo toca su propia fila de visitas (la crea recordLessonView al abrir la
 * lección): con otra lección o sin sesión, nada.
 */
export async function saveLessonChapter(lessonId: string, chapter: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user || typeof lessonId !== "string" || !Number.isInteger(chapter) || chapter < 0 || chapter > 200) return;
  await prisma.lessonView.updateMany({ where: { userId: user.id, lessonId }, data: { chapter } });
}
