"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type CourseGroupView = { key: string; label: string; count: number; cards: ReactNode };

const idOf = (key: string) => key.toLowerCase();

/**
 * Los cursos por método como desplegables, con un selector de píldoras arriba: «Todos» abre todos;
 * un método abre solo el suyo (y lleva hasta él). Un enlace con ancla (#astrologia, desde las páginas
 * de cada sistema) abre directamente ese método.
 */
export function CourseGroups({ groups }: { groups: CourseGroupView[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.map((g) => g.key)));
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const g = groups.find((x) => idOf(x.key) === hash);
    if (g) {
      setActive(g.key);
      setOpen(new Set([g.key]));
      requestAnimationFrame(() => document.getElementById(idOf(g.key))?.scrollIntoView({ block: "start" }));
    }
  }, [groups]);

  const choose = (key: string | null) => {
    setActive(key);
    setOpen(new Set(key ? [key] : groups.map((g) => g.key)));
    if (key) {
      history.replaceState(null, "", `#${idOf(key)}`);
      requestAnimationFrame(() => document.getElementById(idOf(key))?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const total = groups.reduce((n, g) => n + g.count, 0);
  const pill = (on: boolean) =>
    [
      "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
      on ? "cp-btn !min-h-11 !px-4" : "cp-card hover:opacity-90",
    ].join(" ");

  return (
    <>
      {groups.length > 1 && (
        <nav aria-label="Métodos" className="mt-6 -mx-4 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            <button type="button" className={pill(active === null)} aria-pressed={active === null} onClick={() => choose(null)}>
              Todos <span className="cp-muted text-xs tabular-nums">{total}</span>
            </button>
            {groups.map((g) => (
              <button key={g.key} type="button" className={pill(active === g.key)} aria-pressed={active === g.key} onClick={() => choose(g.key)}>
                {g.label} <span className={active === g.key ? "text-xs tabular-nums opacity-80" : "cp-muted text-xs tabular-nums"}>{g.count}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
      <div className="mt-6 space-y-4">
        {groups.map((g) => {
          const isOpen = open.has(g.key);
          const panelId = `metodo-panel-${idOf(g.key)}`;
          return (
            <section key={g.key} id={idOf(g.key)} aria-labelledby={`metodo-${g.key}`} data-course-group={g.key} className="cp-card scroll-mt-20 overflow-hidden rounded-2xl border">
              <h2 id={`metodo-${g.key}`} className="m-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(g.key)}
                >
                  <span className="cp-display text-[1.7rem] leading-tight sm:text-[2rem]">{g.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="cp-muted text-sm tabular-nums">
                      {g.count} {g.count === 1 ? "curso" : "cursos"}
                    </span>
                    <ChevronDown aria-hidden className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
              </h2>
              <div id={panelId} hidden={!isOpen} className="px-5 pb-5 sm:px-6 sm:pb-6">
                <div className="grid gap-4 sm:grid-cols-2">{g.cards}</div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
