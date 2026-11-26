"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { CHAPTER_GO, CHAPTER_NOW } from "@/components/course/chapter-events";
import { useHoverTip } from "@/components/ui/hover-tip";
import { Tr, useT } from "@/lib/i18n/client";

export type IndexLesson = {
  id: string;
  title: string;
  /** Los títulos de sus capítulos (vacío: se lee de una vez). */
  chapters: string[];
  /** Aún cerrada (apertura poco a poco): «Se abre el 12 nov.». */
  lockedLabel?: string | null;
  /** Solo en «Ver como alumna»: la dueña ve la marca del borrador que está mirando. */
  draft?: boolean;
};
export type IndexModule = { id: string; title: string; lessons: IndexLesson[] };

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

/**
 * El índice del curso, en escalera como el del editor: el número romano de cada módulo; colgando de él, el número de
 * cada lección (el mismo de «Lección 3 de 12»); y, debajo de cada lección con capítulos, «Cap. 1», «Cap. 2»… Lo
 * completado lleva ✓, lo cerrado su candado, y la lección y el capítulo donde está la alumna salen resaltados. Un
 * capítulo de la lección que se ve se abre sin recargar (chapter-events).
 * - `compact` (en el ordenador, a la izquierda): solo los números, estrecho; el título sale al pasar el ratón.
 * - Sin él (en el móvil, en el desplegable de arriba, donde no se puede pasar el ratón): con los títulos de los
 *   módulos y las lecciones. Al elegir, el desplegable se cierra.
 */
export function CourseIndex({
  modules,
  base,
  done,
  currentId,
  chapter,
  compact = false,
}: {
  modules: IndexModule[];
  base: string;
  done: string[];
  currentId: string | null;
  chapter: number;
  compact?: boolean;
}) {
  const t = useT();
  const doneSet = new Set(done);
  const [now, setNow] = useState(chapter);
  const tip = useHoverTip();

  // La lección dice en qué capítulo está. Si se llegó con «&capitulo=», se quita de la dirección al moverse
  // (al recargar, sigue donde se quedó y no vuelve a ese capítulo).
  useEffect(() => {
    const on = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      setNow(i);
      const url = new URL(window.location.href);
      if (url.searchParams.has("capitulo") && url.searchParams.get("capitulo") !== String(i)) {
        url.searchParams.delete("capitulo");
        window.history.replaceState(window.history.state, "", url);
      }
    };
    window.addEventListener(CHAPTER_NOW, on);
    return () => window.removeEventListener(CHAPTER_NOW, on);
  }, []);
  useEffect(() => setNow(chapter), [chapter, currentId]);

  const here = "bg-gold/15 shadow-[inset_2px_0_0_var(--color-gold)]";
  let n = 0;
  return (
    <nav
      aria-label={t("Contenido del curso")}
      // En el móvil, al elegir, el desplegable se cierra (la lección queda a la vista).
      onClick={(e) => (e.target as Element).closest("a") && e.currentTarget.closest("details")?.removeAttribute("open")}
    >
      <ol className={compact ? "space-y-3" : "space-y-4"}>
        {modules.map((m, mi) => (
          <li key={m.id}>
            <p className="flex items-center gap-2.5">
              <span
                className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full border border-gold/70 px-1 font-[Georgia,serif] text-[0.8rem] text-gold"
                tabIndex={compact ? 0 : undefined}
                aria-label={compact ? `Módulo ${mi + 1}: ${m.title}` : undefined}
                aria-hidden={compact ? undefined : true}
                {...(compact ? tip.on({ sub: `Módulo ${ROMAN[mi] ?? mi + 1}`, title: m.title }) : {})}
              >
                <Tr s={ROMAN[mi] ?? mi + 1} />
              </span>
              {!compact && (
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                  <span className="sr-only"><Tr s={"Módulo"} />{" "}{mi + 1}: </span>
                  {m.title}
                </span>
              )}
            </p>
            {/* Sus lecciones, un poco a la derecha, colgando de una línea que baja desde su número. */}
            <ol className="ml-4 mt-1 space-y-0.5 border-l border-gold/30 pl-1.5" aria-label={`Lecciones de «${m.title}»`}>
              {m.lessons.map((l) => {
                n++;
                const num = n;
                const open = l.id === currentId;
                const isDone = doneSet.has(l.id);
                const href = `${base}?leccion=${l.id}`;
                const state = l.lockedLabel ?? (open ? "Estás aquí" : isDone ? "Completada" : l.draft ? "Borrador · solo la ves tú" : null);
                return (
                  <li key={l.id}>
                    <Link
                      href={href}
                      aria-current={open ? "page" : undefined}
                      aria-label={`Lección ${num}: ${l.title}${isDone ? ", completada" : ""}${l.lockedLabel ? `, ${l.lockedLabel}` : ""}`}
                      className={`flex items-center gap-2 rounded-xl px-1.5 text-sm transition ${compact ? "min-h-9 py-1" : "min-h-10 py-1.5"} ${open ? here : "hover:bg-sand/60"} ${l.lockedLabel && !open ? "text-muted" : ""}`}
                      data-locked={l.lockedLabel ? "" : undefined}
                      {...(compact ? tip.on({ sub: [`Lección ${num}`, state].filter(Boolean).join(" · "), title: l.title }) : {})}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[0.7rem] tabular-nums ${
                          isDone ? "border-gold bg-gold text-ink" : l.lockedLabel ? "border-line text-muted" : l.draft ? "border-dashed border-gold/60 text-gold" : "border-gold/50 text-gold"
                        }`}
                        aria-hidden
                      >
                        {num}
                      </span>
                      {!compact && (
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="line-clamp-2">{l.title}</span>
                          {l.lockedLabel && <span className="block text-[0.7rem] text-faint"><Tr s={l.lockedLabel} /></span>}
                          {l.draft && <span className="block text-[0.7rem] font-semibold text-[#8a6420]"><Tr s={"Borrador · solo la ves tú"} /></span>}
                        </span>
                      )}
                      {l.lockedLabel ? <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden /> : isDone ? <Check className="h-3 w-3 shrink-0 text-gold" aria-hidden /> : null}
                    </Link>
                    {/* Sus capítulos, solo con su número, colgando del número de la lección. */}
                    {l.chapters.length > 0 && !l.lockedLabel && (
                      <ol className="mb-1 ml-[1.125rem] border-l border-gold/30 pl-1.5" aria-label={`Capítulos de «${l.title}»`}>
                        {l.chapters.map((title, ci) => {
                          const on = open && now === ci;
                          return (
                            <li key={ci}>
                              <Link
                                href={`${href}&capitulo=${ci}`}
                                aria-current={on ? "step" : undefined}
                                aria-label={`Capítulo ${ci + 1}: ${title}`}
                                onClick={(e) => {
                                  // El de la lección que se ve: se abre sin recargar.
                                  if (!open || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                                  e.preventDefault();
                                  setNow(ci);
                                  window.dispatchEvent(new CustomEvent(CHAPTER_GO, { detail: ci }));
                                }}
                                className={`flex items-center whitespace-nowrap rounded-lg px-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] transition ${compact ? "min-h-7 py-0.5" : "min-h-8 py-1"} ${on ? `${here} text-ink` : "text-gold hover:bg-sand/60"}`}
                                {...(compact ? tip.on({ sub: `Capítulo ${ci + 1}${on ? " · Estás aquí" : ""}`, title }) : {})}
                              ><Tr s={"Cap."} />{" "}{ci + 1}
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {tip.node}
    </nav>
  );
}
