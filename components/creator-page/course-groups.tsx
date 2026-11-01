"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type CourseGroupView = { key: string; label: string; count: number; image: string | null; cards: ReactNode };

const idOf = (key: string) => key.toLowerCase();

/**
 * Los cursos por método: cada método es una fila con su foto en redondo; al tocarla se despliega
 * con todos sus cursos (y se cierra el que estuviera abierto). Un enlace con ancla (#astrologia,
 * desde las páginas de cada sistema) abre directamente ese método.
 */
export function CourseGroups({ groups }: { groups: CourseGroupView[] }) {
  const [open, setOpen] = useState<string | null>(groups.length === 1 ? groups[0].key : null);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const g = groups.find((x) => idOf(x.key) === hash);
    if (g) {
      setOpen(g.key);
      requestAnimationFrame(() => document.getElementById(idOf(g.key))?.scrollIntoView({ block: "start" }));
    }
  }, [groups]);

  const toggle = (key: string) => {
    const next = open === key ? null : key;
    setOpen(next);
    history.replaceState(null, "", next ? `#${idOf(next)}` : window.location.pathname + window.location.search);
    if (next) requestAnimationFrame(() => document.getElementById(idOf(next))?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="mt-8 space-y-3">
      {groups.map((g) => {
        const isOpen = open === g.key;
        const panelId = `metodo-panel-${idOf(g.key)}`;
        return (
          <section key={g.key} id={idOf(g.key)} aria-labelledby={`metodo-${g.key}`} data-course-group={g.key} className="cp-card scroll-mt-20 overflow-hidden rounded-2xl border">
            <h2 id={`metodo-${g.key}`} className="m-0">
              <button
                type="button"
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left sm:px-5"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(g.key)}
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[color-mix(in_oklab,var(--c-gold)_55%,transparent)] bg-[var(--c-bg2,transparent)]">
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
                  <span className="cp-display block text-[1.5rem] leading-tight sm:text-[1.75rem]">{g.label}</span>
                  <span className="cp-muted block text-sm tabular-nums">
                    {g.count} {g.count === 1 ? "curso" : "cursos"}
                  </span>
                </span>
                <ChevronDown aria-hidden className={`h-5 w-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </h2>
            <div id={panelId} hidden={!isOpen} className="px-4 pb-5 sm:px-5 sm:pb-6">
              <div className="grid gap-4 sm:grid-cols-2">{g.cards}</div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
