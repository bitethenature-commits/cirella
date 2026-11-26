"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useComputedProfile } from "@/components/models/use-birth-profile";
import type { BirthProfile } from "@/lib/birth-profile";
import { isBlockKind, splitChapters } from "@/lib/lesson-blocks";
import { CHAPTER_GO, CHAPTER_NOW } from "./chapter-events";
import { PieceFrame } from "./course-look";
import { LessonBlock, type BlockContext } from "./lesson-blocks";
import { LessonParts, type PlayerPart } from "./lesson-parts";
import { Tr } from "@/lib/i18n/client";

export type ChapterContext = {
  /** Perfil propio de la alumna en «Mi energía» (null si aún no lo ha guardado). */
  profile: BirthProfile | null;
  /** Las demás personas guardadas en «Mi energía» (para la sinastría). */
  others?: BirthProfile[];
  energyHref: string | null;
  /** Capítulo donde se quedó o el que se pide en la dirección (LessonView.chapter). */
  initialChapter: number;
  /** Guarda el capítulo abierto (en el reproductor); sin él, no se guarda (vista previa del editor). */
  saveChapter?: (chapter: number) => Promise<void>;
  /** Marca la lección como completada al llegar al último capítulo (sin él: ya lo está, o es la dueña). */
  completeLesson?: () => Promise<unknown>;
};

/**
 * Una lección larga, capítulo a capítulo: un capítulo cada vez, con «Capítulo 2 de 5» arriba y el anterior y el
 * siguiente abajo. Sus capítulos («Cap. 1», «Cap. 2»…) salen en el índice del curso, a la izquierda (o arriba en el
 * móvil): al elegir uno de esta lección, se abre aquí sin recargar, y el índice marca en cuál está (chapter-events).
 * Se queda donde lo dejó la alumna (lo guarda el servidor) y la carta de la alumna se calcula una sola vez para todas
 * las piezas que la usan. Sin capítulos, la lección entera (con sus piezas interactivas) de una vez.
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
  const chapters = split?.chapters ?? [{ title: "", parts }];
  const intro = split?.intro ?? [];
  const hasIndex = !!split && chapters.length > 0;
  const clamp = (i: number) => Math.min(Math.max(i, 0), chapters.length - 1);
  const [current, setCurrent] = useState(() => clamp(ctx.initialChapter));
  const [, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const { result } = useComputedProfile(ctx.profile ?? undefined);
  const blockCtx: BlockContext = { profile: ctx.profile, computed: result, energyHref: ctx.energyHref, others: ctx.others };

  useEffect(() => {
    // El índice del curso marca en qué capítulo está.
    if (hasIndex) window.dispatchEvent(new CustomEvent(CHAPTER_NOW, { detail: current }));
    if (first.current) {
      first.current = false;
      return;
    }
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (ctx.saveChapter) start(() => void ctx.saveChapter!(current).catch(() => undefined));
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un capítulo elegido en el índice del curso.
  useEffect(() => {
    if (!hasIndex) return;
    const on = (e: Event) => setCurrent(clamp((e as CustomEvent<number>).detail));
    window.addEventListener(CHAPTER_GO, on);
    return () => window.removeEventListener(CHAPTER_GO, on);
  }, [hasIndex, chapters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Llegar al último capítulo completa la lección (una vez).
  const completed = useRef(false);
  useEffect(() => {
    if (completed.current || !ctx.completeLesson || current !== chapters.length - 1) return;
    completed.current = true;
    void ctx.completeLesson().catch(() => undefined);
  }, [current, chapters.length, ctx]);

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
        out.push(
          <PieceFrame key={p.id} look={p.design}>
            <LessonBlock kind={p.kind} data={p.data} ctx={blockCtx} />
          </PieceFrame>,
        );
      } else run.push(p);
    }
    flush();
    return <div className="space-y-8">{out}</div>;
  };

  return (
    <div ref={top} className="scroll-mt-32" data-chapter-lesson={hasIndex ? chapters.length : 0}>
      {intro.length > 0 && current === 0 && <div className="mb-8">{body(intro)}</div>}
      {hasIndex ? (
        <div>
          <p className="eyebrow"><Tr s={"Capítulo"} />{" "}{current + 1}{" "}<Tr s={"de"} />{" "}{chapters.length}
          </p>
          <h3 className="display mt-1 text-[1.9rem] leading-tight"><Tr s={ch.title} /></h3>
          <div className="mt-5" key={current}>
            {ch.parts.length ? body(ch.parts) : <p className="text-muted"><Tr s={"Este capítulo aún no tiene contenido."} /></p>}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            {current > 0 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setCurrent(current - 1)}>
                <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Cap."} />{" "}{current} · <Tr s={chapters[current - 1].title} />
              </button>
            )}
            {current < chapters.length - 1 && (
              <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={() => setCurrent(current + 1)}><Tr s={"Cap."} />{" "}{current + 2} · <Tr s={chapters[current + 1].title} /> <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {current === chapters.length - 1 && <p className="ml-auto text-sm text-muted"><Tr s={"Has llegado al final de la lección ✦"} /></p>}
          </div>
        </div>
      ) : (
        body(ch.parts)
      )}
    </div>
  );
}
