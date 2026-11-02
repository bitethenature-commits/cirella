import Link from "next/link";
import { ArrowRight, Eye, GraduationCap } from "lucide-react";

/**
 * «Programa del curso» en la ficha del producto: un resumen (módulos, lecciones publicadas y en
 * borrador) y el acceso al estudio de cursos, donde se preparan las lecciones.
 */
export function CourseSummary({ productId, modules }: { productId: string; modules: { id: string; title: string; lessons: { published: boolean }[] }[] }) {
  const total = modules.reduce((a, m) => a + m.lessons.length, 0);
  const drafts = modules.reduce((a, m) => a + m.lessons.filter((l) => !l.published).length, 0);
  return (
    <section className="card p-5 sm:p-6" data-course-summary>
      <div className="flex items-start gap-3">
        <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-lavender-deep" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Programa del curso</h3>
          <p className="text-xs text-muted">
            {modules.length} {modules.length === 1 ? "módulo" : "módulos"} · {total - drafts} {total - drafts === 1 ? "lección publicada" : "lecciones publicadas"}
            {drafts > 0 && ` · ${drafts} en borrador`}. Las lecciones, su orden, la apertura poco a poco, las alumnas y los datos están en Cursos.
          </p>
        </div>
      </div>
      {modules.length > 0 && (
        <ol className="mt-4 space-y-1 text-sm">
          {modules.slice(0, 6).map((m, i) => (
            <li key={m.id} className="flex items-baseline gap-2">
              <span className="w-7 shrink-0 text-xs font-semibold text-muted">M{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{m.title}</span>
              <span className="shrink-0 text-xs text-faint">
                {m.lessons.length} {m.lessons.length === 1 ? "lección" : "lecciones"}
              </span>
            </li>
          ))}
          {modules.length > 6 && <li className="pl-9 text-xs text-muted">y {modules.length - 6} más</li>}
        </ol>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/panel/cursos/${productId}`} className="btn btn-primary btn-sm">
          Abrir en Cursos <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href={`/cuenta/cursos/${productId}`} target="_blank" className="btn btn-ghost btn-sm">
          <Eye className="h-4 w-4" /> Ver como alumna
        </Link>
      </div>
    </section>
  );
}
