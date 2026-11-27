import Link from "next/link";
import { ArrowLeft, BarChart3, Eye, ListTree, Pencil, Settings2, UsersRound } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { deleteProduct } from "../../productos/actions";
import { Badge } from "../../ui";
import { SectionEmblem } from "../../section-emblem";
import { Tr } from "@/lib/i18n/client";

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
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Cursos"} /></Link>
      <div className="panel-hero mt-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="starfield absolute inset-0 -z-10 rounded-[inherit] opacity-40" aria-hidden />
        <div className="flex min-w-0 items-center gap-4">
        <SectionEmblem className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <h1 className="display text-[1.9rem] leading-tight sm:text-[2.2rem]">
            <Tr s={course.emoji} /> {course.title}
          </h1>
          <div className="mt-1.5">{course.status === "PUBLISHED" ? <Badge tone="success"><Tr s={"Publicado"} /></Badge> : <Badge tone="warning"><Tr s={"Borrador · aún no lo ven"} /></Badge>}</div>
        </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/panel/cursos/${course.id}/lecciones`} className="btn btn-primary btn-sm" title="Las lecciones sobre la vista de alumna">
            <Pencil className="h-4 w-4" />{" "}<Tr s={"Editar lecciones"} /></Link>
          <Link href={`/area/courses/${course.id}`} target="_blank" className="btn btn-outline btn-sm" data-view-as-student>
            <Eye className="h-4 w-4" />{" "}<Tr s={"Ver como alumna"} /></Link>
          <Link href={`/panel/productos/${course.id}`} className="btn btn-ghost btn-sm" title="Precio, página de venta, acceso y publicación">
            <Settings2 className="h-4 w-4" />{" "}<Tr s={"Precio y venta"} /></Link>
          <DeleteButton action={deleteProduct} id={course.id} variant="button" label="Borrar el curso" message={`¿Borrar el curso «${course.title}» con todas sus lecciones? Si tiene alumnas, también se borran sus inscripciones y pierden el acceso. No se puede deshacer.`} />
        </div>
        </div>
        {/* Las pestañas, dentro de la cabecera: en cápsula, la abierta con doble línea dorada. */}
        <nav className="mt-4 flex gap-1.5 overflow-x-auto" aria-label="Secciones del estudio">
          {TABS.map((t) => (
            <Link key={t.key} href={t.href(course.id)} aria-current={t.key === tab ? "page" : undefined} className="studio-tab inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm">
              <t.icon className="h-4 w-4" /> <Tr s={t.label} />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
