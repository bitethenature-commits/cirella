import type { Metadata } from "next";
import { GraduationCap, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireCreator } from "@/lib/auth";
import { courseList } from "@/lib/course-studio";
import { canSellType } from "@/lib/plans";
import { createProduct } from "../productos/actions";
import { PageHeader } from "../ui";
import { CourseCards } from "./course-cards";

export const metadata: Metadata = { title: "Cursos" };

/** «Nuevo curso»: crea un curso en borrador (como Productos › Nuevo) y abre su estudio. */
function NewCourseButton({ label = "Nuevo curso" }: { label?: string }) {
  return (
    <form action={createProduct}>
      <input type="hidden" name="type" value="COURSE" />
      <input type="hidden" name="next" value="cursos" />
      <button className="btn btn-primary">
        <Plus className="h-4 w-4" /> {label}
      </button>
    </form>
  );
}

/**
 * Cursos: la lista de sus cursos con su estado, lecciones y alumnas. Cada uno se prepara en su
 * estudio (/panel/cursos/<id>); precio, página de venta y acceso siguen en Productos («Ajustes»).
 */
export default async function CoursesPage() {
  const { creator } = await requireCreator();
  const courses = await courseList(creator.id);
  const canCreate = canSellType(creator.plan, "COURSE");
  return (
    <div>
      <PageHeader
        title="Cursos"
        subtitle={courses.length ? `${courses.length} ${courses.length === 1 ? "curso" : "cursos"} · prepara sus lecciones, mira quién avanza y ábrelos como una alumna.` : "Prepara tus cursos lección a lección."}
        actions={canCreate ? <NewCourseButton /> : null}
      />
      {courses.length ? (
        <CourseCards courses={courses} />
      ) : (
        <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="Crea tu primer curso" action={canCreate ? <NewCourseButton label="Crear un curso" /> : null}>
          Módulos y lecciones con vídeo, audio, texto, PDF e imágenes. Lo preparas en borrador y lo publicas cuando esté listo.
        </EmptyState>
      )}
    </div>
  );
}
