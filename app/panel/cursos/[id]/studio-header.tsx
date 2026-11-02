import Link from "next/link";
import { ArrowLeft, BarChart3, Eye, ListTree, Settings2, UsersRound } from "lucide-react";
import { Badge } from "../../ui";

export type StudioTab = "estructura" | "alumnas" | "datos";

const TABS: { key: StudioTab; label: string; href: (id: string) => string; icon: typeof ListTree }[] = [
  { key: "estructura", label: "Estructura", href: (id) => `/panel/cursos/${id}`, icon: ListTree },
  { key: "alumnas", label: "Alumnas", href: (id) => `/panel/cursos/${id}/alumnas`, icon: UsersRound },
  { key: "datos", label: "Datos", href: (id) => `/panel/cursos/${id}/datos`, icon: BarChart3 },
];

/**
 * Cabecera del estudio de un curso: vuelta a Cursos, título y estado, «Ver como alumna», ajustes del
 * producto (precio, página de venta, acceso) y las pestañas. Puro.
 */
export function StudioHeader({ course, tab }: { course: { id: string; title: string; emoji: string | null; status: string }; tab: StudioTab }) {
  return (
    <div className="mb-6">
      <Link href="/panel/cursos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Cursos
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Estudio del curso</p>
          <h1 className="display mt-1 text-[2.1rem] leading-tight sm:text-[2.4rem]">
            {course.emoji} {course.title}
          </h1>
          <div className="mt-2">{course.status === "PUBLISHED" ? <Badge tone="success">Publicado</Badge> : <Badge tone="warning">Borrador · tus alumnas aún no lo ven</Badge>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/cuenta/cursos/${course.id}`} target="_blank" className="btn btn-outline btn-sm" data-view-as-student>
            <Eye className="h-4 w-4" /> Ver como alumna
          </Link>
          <Link href={`/panel/productos/${course.id}`} className="btn btn-ghost btn-sm" title="Precio, página de venta, acceso y publicación">
            <Settings2 className="h-4 w-4" /> Ajustes del producto
          </Link>
        </div>
      </div>
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Secciones del estudio">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href(course.id)}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition ${t.key === tab ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
