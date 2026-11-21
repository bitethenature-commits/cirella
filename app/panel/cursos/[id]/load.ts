import "server-only";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";

/** El curso del estudio (solo de esta creadora y solo cursos) o 404. */
export async function loadStudioCourse(id: string) {
  const { user, creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const course = await db.product.findFirst({
    where: { id, type: "COURSE" },
    select: { id: true, title: true, emoji: true, status: true, imageUrl: true, dripMode: true, dripEveryDays: true, accessMode: true, courseCategory: true, courseDesign: true },
  });
  if (!course) notFound();
  return { user, creator, db, course };
}
