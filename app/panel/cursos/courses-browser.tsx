"use client";

import { BookOpen, X } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { CategoryIcons } from "@/components/creator-page/category-icons";
import type { CourseCategory } from "@/lib/course-categories";

export type BrowserGroup = { key: string; label: string; categories: CourseCategory[]; count: number };
export type BrowserCourse = { id: string; group: string; draft: boolean; card: ReactNode };

/**
 * /panel/cursos: las temáticas como en la web (de 5 en 5) para filtrar. Sin ninguna elegida salen todos los cursos;
 * al tocar una, solo los suyos (y al tocarla otra vez, todos). Debajo, los borradores en pequeño y los publicados con
 * las cartas de la página de cursos, con los colores de la web (`theme`).
 */
export function CoursesBrowser({ groups, courses, theme }: { groups: BrowserGroup[]; courses: BrowserCourse[]; theme: { style: CSSProperties; attrs: Record<string, string | undefined> } }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = groups.find((g) => g.key === open) ?? null;
  const shown = current ? courses.filter((c) => c.group === current.key) : courses;
  const drafts = shown.filter((c) => c.draft);
  const live = shown.filter((c) => !c.draft);
  const heading = "mb-2.5 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted";

  return (
    <div data-course-list>
      <div role="group" aria-label="Filtrar por temática" className="mx-auto grid max-w-3xl grid-cols-5 gap-x-2 gap-y-5 sm:gap-x-4">
        {groups.map((g) => {
          const on = g.key === open;
          const many = g.categories.length > 1;
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={on}
              onClick={() => setOpen(on ? null : g.key)}
              className={`group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-0.5 py-1.5 text-center transition sm:gap-2 ${open && !on ? "opacity-60 hover:opacity-100" : ""}`}
              data-course-group={g.key}
            >
              <span
                className={`panel-emblem h-12 w-12 transition sm:h-[4.5rem] sm:w-[4.5rem] ${on ? "scale-105 !shadow-[0_0_0_2px_#d9bf8c,0_0_0_7px_rgb(217_191_140/.14),0_0_36px_-4px_rgb(217_191_140/.7)]" : "group-hover:scale-105"}`}
              >
                {/* En el móvil, el círculo es más pequeño: los iconos, también. */}
                <span className="inline-flex scale-[.68] sm:scale-100">
                  {g.categories.length ? <CategoryIcons categories={g.categories} size={many ? 1.6 : 2.4} gap={many ? 0.1 : 0} /> : <BookOpen className="h-9 w-9" strokeWidth={1.2} />}
                </span>
              </span>
              <span className="display w-full break-words text-[0.8rem] leading-tight sm:text-[1.02rem]">{g.label}</span>
              <span className="text-[0.62rem] text-muted tabular-nums sm:text-[0.7rem]">{g.count === 0 ? "Sin cursos" : `${g.count} ${g.count === 1 ? "curso" : "cursos"}`}</span>
            </button>
          );
        })}
      </div>

      {current && (
        <p className="mt-5 flex justify-center">
          <button type="button" onClick={() => setOpen(null)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-gold hover:text-ink">
            Solo {current.label} · Ver todos <X className="h-3 w-3" />
          </button>
        </p>
      )}

      {current && shown.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">Aún no hay cursos de {current.label}. Crea uno con «Nuevo curso» y elige su temática en su estudio.</p>
      ) : (
        <div key={open ?? "todos"} className="animate-fade-in">
          {drafts.length > 0 && (
            <section aria-labelledby="cursos-borradores" className="mt-8">
              <h2 id="cursos-borradores" className={heading}>
                Borradores <span className="studio-count">{drafts.length}</span>
              </h2>
              <div className="cp !min-h-0 rounded-3xl p-3 sm:p-4" style={theme.style} {...theme.attrs}>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
                  {drafts.map((c) => (
                    <li key={c.id}>{c.card}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <section aria-labelledby="cursos-publicados" className="mt-8">
            <h2 id="cursos-publicados" className={heading}>
              Publicados <span className="studio-count">{live.length}</span>
            </h2>
            {live.length ? (
              <div className="cp !min-h-0 rounded-3xl p-4 sm:p-5" style={theme.style} {...theme.attrs}>
                <ul className="mx-auto grid max-w-[16rem] gap-6 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {live.map((c) => (
                    <li key={c.id}>{c.card}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted">Todavía no hay ninguno publicado{current ? ` de ${current.label}` : ""}. Para publicar uno, abre sus «Ajustes».</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
