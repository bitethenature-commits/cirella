"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export type CourseGroupView = { key: string; label: string; count: number; image: string | null; cards: ReactNode };

const idOf = (key: string) => key.toLowerCase();

/**
 * Los cursos por método: cada método es una fila con su foto en redondo; al tocarla se despliega
 * con todos sus cursos. Son <details> nativos con el mismo `name`, así que abrir uno cierra el
 * anterior (y funcionan aunque la página no haya cargado su JavaScript). Un enlace con ancla
 * (#astrologia, desde las páginas de cada sistema) abre directamente ese método.
 */
export function CourseGroups({ groups }: { groups: CourseGroupView[] }) {
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
      {groups.map((g) => (
        <details
          key={g.key}
          id={idOf(g.key)}
          name="metodos"
          open={groups.length === 1 || undefined}
          data-course-group={g.key}
          className="cp-card group scroll-mt-20 rounded-2xl border"
        >
          <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[color-mix(in_oklab,var(--c-gold)_55%,transparent)]">
              {g.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span aria-hidden className="cp-display flex h-full w-full items-center justify-center text-xl">
                  {g.label.charAt(0)}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <h2 id={`metodo-${g.key}`} className="cp-display m-0 text-[1.5rem] leading-tight sm:text-[1.75rem]">
                {g.label}
              </h2>
              <span className="cp-muted block text-sm tabular-nums">
                {g.count} {g.count === 1 ? "curso" : "cursos"}
              </span>
            </span>
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="px-4 pb-5 pt-2 sm:px-5 sm:pb-6">
            <div className="grid gap-4 sm:grid-cols-2">{g.cards}</div>
          </div>
        </details>
      ))}
    </div>
  );
}
