"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock } from "lucide-react";
import { useComputedProfile } from "@/components/models/use-birth-profile";
import type { BirthProfile } from "@/lib/birth-profile";
import { isBlockKind, splitChapters } from "@/lib/lesson-blocks";
import { LessonBlock, type BlockContext } from "./lesson-blocks";
import { LessonParts, type PlayerPart } from "./lesson-parts";

export type ChapterContext = {
  /** Perfil propio de la alumna en «Mi energía» (null si aún no lo ha guardado). */
  profile: BirthProfile | null;
  /** Las demás personas guardadas en «Mi energía» (para la sinastría). */
  others?: BirthProfile[];
  energyHref: string | null;
  /** Capítulo donde se quedó (LessonView.chapter). */
  initialChapter: number;
  /** Guarda el capítulo abierto (en el reproductor); sin él, no se guarda (vista previa del editor). */
  saveChapter?: (chapter: number) => Promise<void>;
  /** Marca la lección como completada al llegar al último capítulo (sin él: ya lo está, o es la dueña). */
  completeLesson?: () => Promise<unknown>;
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);
const minutesLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/**
 * Una lección larga, capítulo a capítulo: el índice (con lo leído marcado y el tiempo de cada uno), un
 * capítulo cada vez y «Capítulo siguiente». Se queda donde lo dejó la alumna (lo guarda el servidor) y
 * la carta de la alumna se calcula una sola vez para todas las piezas que la usan. Sin capítulos, la
 * lección entera (con sus piezas interactivas) de una vez.
 */
export function ChapterLesson({
  parts,
  lessonTitle,
  courseTitle,
  poster,
  personal,
  ctx,
}: {
  parts: PlayerPart[];
  lessonTitle: string;
  courseTitle: string;
  poster: string | null;
  personal: boolean;
  ctx: ChapterContext;
}) {
  const split = splitChapters(parts);
  const chapters = split?.chapters ?? [{ title: "", minutes: null, parts }];
  const intro = split?.intro ?? [];
  const hasIndex = !!split && chapters.length > 0;
  const [current, setCurrent] = useState(() => Math.min(Math.max(ctx.initialChapter, 0), chapters.length - 1));
  const [seen, setSeen] = useState(() => new Set(Array.from({ length: current + 1 }, (_, i) => i)));
  const [, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const { result } = useComputedProfile(ctx.profile ?? undefined);
  const blockCtx: BlockContext = { profile: ctx.profile, computed: result, energyHref: ctx.energyHref, others: ctx.others };
  const total = chapters.reduce((a, c) => a + (c.minutes ?? 0), 0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (ctx.saveChapter) start(() => void ctx.saveChapter!(current).catch(() => undefined));
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Llegar al último capítulo completa la lección (una vez).
  const completed = useRef(false);
  useEffect(() => {
    if (completed.current || !ctx.completeLesson || current !== chapters.length - 1) return;
    completed.current = true;
    void ctx.completeLesson().catch(() => undefined);
  }, [current, chapters.length, ctx]);

  const go = (i: number) => {
    setCurrent(i);
    setSeen((s) => new Set(s).add(i));
  };
  const ch = chapters[current];

  const body = (list: PlayerPart[]) => {
    // Las partes de siempre, juntas; las interactivas, cada una en su sitio.
    const out: React.ReactNode[] = [];
    let run: PlayerPart[] = [];
    const flush = () => {
      if (run.length) out.push(<LessonParts key={`r${out.length}`} parts={run} lessonTitle={lessonTitle} courseTitle={courseTitle} poster={poster} personal={personal} />);
      run = [];
    };
    for (const p of list) {
      if (p.kind && isBlockKind(p.kind)) {
        flush();
        out.push(<LessonBlock key={p.id} kind={p.kind} data={p.data} ctx={blockCtx} />);
      } else run.push(p);
    }
    flush();
    return <div className="space-y-8">{out}</div>;
  };

  // En pantalla ancha: una columna estrecha con solo los números; al pasar el ratón (o al entrar con el
  // teclado) se despliega por encima del contenido con los títulos. Así el capítulo, y su modelo, son más anchos.
  const rail = (
    <ol className="space-y-1" aria-label="Capítulos de la lección">
      {chapters.map((c, i) => {
        const on = i === current;
        const done = seen.has(i) && i < current;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={on ? "step" : undefined}
              aria-label={`Capítulo ${i + 1}: ${c.title}`}
              className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left text-sm transition ${on ? "bg-ink text-cream" : "hover:bg-sand"}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold ${on ? "bg-gold text-ink" : done ? "bg-gold/25 text-ink" : "border border-line bg-paper text-muted"}`}>
                {done ? <Check className="h-3 w-3" /> : roman(i + 1)}
              </span>
              <span className="w-40 shrink-0 leading-snug opacity-0 transition-opacity duration-150 group-hover/idx:opacity-100 group-focus-within/idx:opacity-100">{c.title}</span>
              {c.minutes ? <span className={`shrink-0 text-[0.7rem] tabular-nums opacity-0 transition-opacity group-hover/idx:opacity-100 group-focus-within/idx:opacity-100 ${on ? "text-cream/70" : "text-muted"}`}>{c.minutes}′</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );

  const index = (
    <ol className="space-y-1" aria-label="Capítulos de la lección">
      {chapters.map((c, i) => {
        const on = i === current;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={on ? "step" : undefined}
              className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${on ? "bg-ink text-cream" : "hover:bg-sand"}`}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold ${on ? "bg-gold text-ink" : seen.has(i) && i < current ? "bg-gold/25 text-ink" : "border border-line text-muted"}`}>
                {seen.has(i) && i < current ? <Check className="h-3 w-3" /> : roman(i + 1)}
              </span>
              <span className="min-w-0 flex-1 leading-snug">{c.title}</span>
              {c.minutes ? <span className={`shrink-0 text-[0.7rem] tabular-nums ${on ? "text-cream/70" : "text-muted"}`}>{c.minutes}′</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div ref={top} className="scroll-mt-32" data-chapter-lesson={hasIndex ? chapters.length : 0}>
      {intro.length > 0 && current === 0 && <div className="mb-8">{body(intro)}</div>}
      {hasIndex ? (
        <div className="grid gap-6 md:grid-cols-[2.5rem_minmax(0,1fr)] md:gap-5">
          <aside className="relative z-30 md:sticky md:top-32 md:self-start">
            <details className="group rounded-2xl border border-line bg-paper md:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
                <span>
                  Capítulo {roman(current + 1)} de {chapters.length}
                  {total ? <span className="font-normal text-muted"> · {minutesLabel(total)} en total</span> : null}
                </span>
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-line p-2">{index}</div>
            </details>
            <div className="group/idx -ml-1 hidden max-h-[calc(100dvh-9rem)] w-12 overflow-y-auto overflow-x-hidden rounded-2xl p-1 transition-[width,background-color,box-shadow] duration-200 [scrollbar-width:none] hover:w-[17rem] hover:bg-paper hover:shadow-soft focus-within:w-[17rem] focus-within:bg-paper focus-within:shadow-soft md:block">
              <div className="mb-2 flex h-6 items-center gap-1.5 whitespace-nowrap px-2 text-xs text-muted" title={total ? `${minutesLabel(total)} · ${chapters.length} capítulos` : undefined}>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="opacity-0 transition-opacity group-hover/idx:opacity-100 group-focus-within/idx:opacity-100">
                  {total ? `${minutesLabel(total)} · ` : ""}
                  {chapters.length} capítulos
                </span>
              </div>
              {rail}
            </div>
          </aside>
          <div className="min-w-0">
            <p className="eyebrow">
              Capítulo {roman(current + 1)} de {chapters.length}
              {ch.minutes ? ` · ${ch.minutes} min` : ""}
            </p>
            <h3 className="display mt-1 text-[1.9rem] leading-tight">{ch.title}</h3>
            <div className="mt-5" key={current}>
              {ch.parts.length ? body(ch.parts) : <p className="text-muted">Este capítulo aún no tiene contenido.</p>}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5">
              {current > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(current - 1)}>
                  <ArrowLeft className="h-4 w-4" /> {roman(current)} · {chapters[current - 1].title}
                </button>
              )}
              {current < chapters.length - 1 && (
                <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={() => go(current + 1)}>
                  {roman(current + 2)} · {chapters[current + 1].title} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {current === chapters.length - 1 && <p className="ml-auto text-sm text-muted">Has llegado al final de la lección ✦</p>}
            </div>
          </div>
        </div>
      ) : (
        body(ch.parts)
      )}
    </div>
  );
}
