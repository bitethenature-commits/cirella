"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { CourseCategory } from "@/lib/course-categories";
import { CategoryIcons } from "./category-icons";
import { Tr } from "@/lib/i18n/client";

export type CourseGroupView = { key: string; label: string; categories: CourseCategory[]; count: number; cards: ReactNode };

const idOf = (key: string) => key.toLowerCase();

/**
 * Los cursos por tema: cada tema es una fila con su icono dorado (los que combinan varios temas, con
 * sus iconos sumados); al tocarla se despliega con todos sus cursos (o «Próximamente» si aún no
 * tiene). Son <details> nativos con el mismo `name`, así que abrir uno cierra el anterior (y
 * funcionan aunque la página no haya cargado su JavaScript). Un enlace con ancla (#astrologia, desde
 * las páginas de cada sistema) abre directamente ese tema.
 */
/** Los estilos de cada sitio: la página pública (variables de la plantilla) o el área de alumna (tema claro/noche). */
const TONE = {
  page: { card: "cp-card", gold: "cp-gold", display: "cp-display", muted: "cp-muted" },
  account: { card: "card", gold: "text-gold", display: "display", muted: "text-muted" },
} as const;

/** `name`: los desplegables con el mismo nombre se cierran entre sí (uno por grupo de la página). `tone`: dónde se pinta. */
export function CourseGroups({ groups, name = "metodos", tone = "page", empty }: { groups: CourseGroupView[]; name?: string; tone?: keyof typeof TONE; empty?: (label: string) => string }) {
  const t = TONE[tone];
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const el = hash ? document.getElementById(hash) : null;
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    }
  }, []);

  return (
    <div className="mt-8 space-y-3">
      {groups.map((g) => {
        const many = g.categories.length > 1;
        return (
          <details
            key={g.key}
            id={name === "metodos" ? idOf(g.key) : `${name}-${idOf(g.key)}`}
            name={name}
            open={groups.length === 1 || undefined}
            data-course-group={g.key}
            className={`${t.card} group scroll-mt-20 rounded-2xl border`}
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className={`${t.gold} flex h-14 shrink-0 items-center justify-center ${many ? "min-w-14" : "w-14"}`}>
                {g.categories.length ? (
                  // Uno solo, grande; varios, sumados y algo más pequeños.
                  <CategoryIcons categories={g.categories} size={many ? 2.5 : 3.25} gap={many ? 0.15 : 0} />
                ) : (
                  <BookOpen aria-hidden className="h-9 w-9" strokeWidth={1.2} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <h2 id={name === "metodos" ? `metodo-${g.key}` : `${name}-t-${g.key}`} className={`${t.display} m-0 text-[1.5rem] leading-tight sm:text-[1.75rem]`}>
                  <Tr s={g.label} />
                </h2>
                <span className={`${t.muted} block text-sm tabular-nums`}>{g.count === 0 ? <Tr s={"Próximamente"} /> : `${g.count} ${g.count === 1 ? "curso" : "cursos"}`}</span>
              </span>
              <ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="px-4 pb-5 pt-2 sm:px-5 sm:pb-6">
              {g.count === 0 ? (
                <p className={`${t.muted} text-[0.92rem]`}>{empty ? empty(g.label) : `Pronto habrá cursos de ${g.label}.`}</p>
              ) : (
                <div className="mx-auto grid max-w-[16rem] gap-5 sm:max-w-none sm:grid-cols-2 md:grid-cols-3">{g.cards}</div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
