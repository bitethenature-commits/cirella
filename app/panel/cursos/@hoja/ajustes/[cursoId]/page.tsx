import { ProductSettings } from "@/app/panel/productos/[id]/product-settings";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { CourseSheet } from "../../../course-sheet";

/** «Ajustes» de un curso (precio, venta y acceso), en la hoja de la derecha de Cursos: /panel/cursos/ajustes/<id>. */
export default async function CourseSettingsSheet({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params;
  const { creator } = await requireCreator();
  const course = await tenantDb(creator.id).product.findFirst({ where: { id: cursoId, type: "COURSE" }, select: { id: true, title: true } });
  // Un curso que no es suyo o que ya no existe: sin hoja (la lista sigue detrás).
  if (!course) return null;
  return (
    <CourseSheet key={`ajustes-${course.id}`} title={`Ajustes · ${course.title}`} wide>
      <ProductSettings id={course.id} inSheet />
    </CourseSheet>
  );
}
