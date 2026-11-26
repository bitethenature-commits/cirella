import { AccessManager } from "@/app/panel/productos/[id]/access-manager";
import { managesAccessOf, productAccess } from "@/app/panel/productos/[id]/access-rows";
import { asAccessMode } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { CourseSheet } from "../../../course-sheet";

/** «Dar acceso» a un curso, en la hoja de la derecha de Cursos: /panel/cursos/acceso/<id>. */
export default async function CourseAccessSheet({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params;
  const { creator } = await requireCreator();
  const course = await tenantDb(creator.id).product.findFirst({
    where: { id: cursoId, type: "COURSE" },
    select: { id: true, title: true, type: true, accessMode: true },
  });
  // Sin curso (o uno cuyo acceso no se da a mano): sin hoja (la lista sigue detrás).
  if (!course || !managesAccessOf(course)) return null;
  const a = await productAccess(creator, course, 0);
  const mode = asAccessMode(course.accessMode);
  return (
    <CourseSheet key={`acceso-${course.id}`} title={`Dar acceso · ${course.title}`}>
      <AccessManager productId={course.id} rows={a.rows} total={a.total} external={mode === "EXTERNAL"} paid={mode === "PAID"} timeZone={creator.timezone} />
    </CourseSheet>
  );
}
