import Link from "next/link";
import { ArrowRight, Eye, Settings2, UsersRound } from "lucide-react";
import { ProductImage } from "@/components/creator-page/product-art";
import { Badge } from "../ui";

export type CourseCard = {
  id: string;
  title: string;
  emoji: string | null;
  imageUrl: string | null;
  status: string;
  modules: number;
  lessons: number;
  drafts: number;
  students: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Colores de la portada sin imagen (los de la página por defecto). */
const ART = { ["--c-accent" as string]: "#C9BBF2", ["--c-gold" as string]: "#D9BF8C", ["--c-bg2" as string]: "#1A1D3D" };

/**
 * Tarjetas de /panel/cursos: portada, estado, lecciones (y cuántas en borrador), alumnas con acceso
 * y accesos al estudio, a «Ver como alumna» y a los ajustes del producto (precio, página, acceso).
 * Puro: datos planos.
 */
export function CourseCards({ courses }: { courses: CourseCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-course-list>
      {courses.map((c) => (
        <article key={c.id} className="card group flex flex-col overflow-hidden transition hover:shadow-lift" data-course-card>
          <Link href={`/panel/cursos/${c.id}`} className="block" aria-label={`Abrir el estudio de «${c.title}»`}>
            <div className="relative aspect-[16/9] overflow-hidden bg-sand" style={ART}>
              <ProductImage src={c.imageUrl} emoji={c.emoji} title={c.title} sizes="(min-width: 1280px) 360px, (min-width: 640px) 45vw, 92vw" />
              <span className="absolute left-3 top-3">{c.status === "PUBLISHED" ? <Badge tone="success">Publicado</Badge> : <Badge tone="warning">Borrador</Badge>}</span>
            </div>
          </Link>
          <div className="flex flex-1 flex-col p-4">
            <Link href={`/panel/cursos/${c.id}`} className="display text-[1.45rem] leading-tight hover:underline">
              {c.title}
            </Link>
            <p className="mt-1 text-xs text-muted">
              {plural(c.modules, "módulo", "módulos")} · {plural(c.lessons, "lección", "lecciones")}
              {c.drafts > 0 && <span className="font-semibold text-[#8a6420]"> · {plural(c.drafts, "borrador", "borradores")}</span>}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
              <UsersRound className="h-3.5 w-3.5" /> {plural(c.students, "alumna con acceso", "alumnas con acceso")}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
              <Link href={`/panel/cursos/${c.id}`} className="btn btn-primary btn-sm">
                Abrir estudio <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`/cuenta/cursos/${c.id}`} target="_blank" className="btn btn-ghost btn-sm" aria-label={`Ver «${c.title}» como alumna`} title="Ver como alumna">
                <Eye className="h-4 w-4" />
              </Link>
              <Link href={`/panel/productos/${c.id}`} className="btn btn-ghost btn-sm ml-auto" title="Precio, página de venta y acceso">
                <Settings2 className="h-4 w-4" /> Ajustes
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
