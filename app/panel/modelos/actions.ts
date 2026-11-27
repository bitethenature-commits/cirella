"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { parseBlock } from "@/lib/lesson-blocks";
import { tenantDb } from "@/lib/tenant";

/**
 * Añade al final de una lección una parte ya preparada en «Modelos» (de momento, la «Carta a mano»).
 * Se valida como cualquier parte del editor de lecciones (lib/lesson-blocks.ts).
 */
export async function addPartToLesson(lessonId: string, kind: "CHART", data: unknown): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const parsed = parseBlock(kind, data);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const lesson = await db.lesson.findFirst({ where: { id: lessonId }, select: { id: true, productId: true } });
  if (!lesson) return { ok: false, error: "No encuentro esa lección." };
  const last = await db.lessonPart.findFirst({ where: { lessonId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.lessonPart.create({
    data: { creatorId: creator.id, productId: lesson.productId, lessonId, kind, data: parsed.part.data as object, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  // Otro dispositivo con la lección abierta no debe pisar la parte nueva al guardar.
  await db.lesson.update({ where: { id: lessonId }, data: { version: { increment: 1 } } });
  const href = `/panel/productos/${lesson.productId}/lecciones/${lessonId}`;
  revalidatePath(href);
  return { ok: true, href };
}
