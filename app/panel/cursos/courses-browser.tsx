"use client";

import { BookOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CategoryIcons } from "@/components/creator-page/category-icons";
import type { CourseCategory } from "@/lib/course-categories";

export type BrowserGroup = { key: string; label: string; categories: CourseCategory[]; count: number; cards: ReactNode; newCourse: ReactNode };

/**
 * /panel/cursos: arriba, los iconos de cada temática como en la web (Astrología, Human Design, Gene
 * Keys…), con su nombre y cuántos cursos tiene; al tocar uno, debajo salen sus cursos con las tarjetas
 * de la web. Empieza abierta la primera temática con cursos.
 */
export function CoursesBrowser({ groups }: { groups: BrowserGroup[] }) {
  const [open, setOpen] = useState(groups.find((g) => g.count > 0)?.key ?? groups[0]?.key ?? null);
  const current = groups.find((g) => g.key === open) ?? null;
  return (
    <div data-course-list>
      <div role="tablist" aria-label="Temáticas" className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
        {groups.map((g) => {
          const on = g.key === open;
          const many = g.categories.length > 1;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="cursos-de-la-tematica"
              onClick={() => setOpen(g.key)}
              className={`group flex flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center transition ${on ? "" : "opacity-75 hover:opacity-100"}`}
              data-course-group={g.key}
            >
              <span
                className={`panel-emblem h-[4.5rem] w-[4.5rem] transition sm:h-20 sm:w-20 ${on ? "scale-105 !shadow-[0_0_0_2px_#d9bf8c,0_0_0_7px_rgb(217_191_140/.14),0_0_36px_-4px_rgb(217_191_140/.7)]" : "group-hover:scale-105"}`}
              >
                {g.categories.length ? <CategoryIcons categories={g.categories} size={many ? 1.6 : 2.4} gap={many ? 0.1 : 0} /> : <BookOpen className="h-9 w-9" strokeWidth={1.2} />}
              </span>
              <span className="display text-[1.05rem] leading-tight">{g.label}</span>
              <span className="text-[0.7rem] text-muted tabular-nums">{g.count === 0 ? "Sin cursos" : `${g.count} ${g.count === 1 ? "curso" : "cursos"}`}</span>
            </button>
          );
        })}
      </div>

      {current && (
        <section id="cursos-de-la-tematica" role="tabpanel" aria-label={current.label} className="mt-8 animate-fade-in" key={current.key}>
          <div className="mb-4 flex items-center gap-3 border-b border-line pb-3">
            <h2 className="display text-[1.8rem] leading-none">{current.label}</h2>
            <span className="flex-1" />
            {current.newCourse}
          </div>
          {current.count === 0 ? <p className="text-sm text-muted">Aún no tienes cursos de {current.label}. Pulsa «Nuevo curso de {current.label}» y se crea ya en esta temática.</p> : current.cards}
        </section>
      )}
    </div>
  );
}
