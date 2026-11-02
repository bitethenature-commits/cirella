"use client";
import { ArrowLeft, Eye } from "lucide-react";
import { useDeferredValue, useEffect, useMemo } from "react";
import { LessonView } from "@/components/course/lesson-view";
import type { PlayerPart } from "@/components/course/lesson-parts";
import { PhoneFrame } from "@/components/panel/phone-frame";
import { PreviewFrame } from "@/components/panel/preview-frame";
import { lessonPartViews, partsLabel, partView } from "@/lib/lesson-parts";
import type { EditorFile, EditorPart } from "@/app/panel/productos/[id]/lecciones/part-card";

export type LessonPreviewContext = {
  courseTitle: string;
  imageUrl: string | null;
  /** Modo del sitio (cómo se entrega el audio): lo decide el servidor. */
  personal: boolean;
  /** Posición entre las lecciones que verá la alumna (si se publica) y cuántas hay. */
  number: number;
  total: number;
};

type Live = { title: string; durationMin: number | null; parts: EditorPart[]; files: Map<string, EditorFile>; published: boolean };

/** Las partes del editor como las pinta el reproductor (lo que aún se está subiendo no sale). */
function toPlayerParts(parts: EditorPart[], files: Map<string, EditorFile>): PlayerPart[] {
  return parts.flatMap((p): PlayerPart[] => {
    if (p.kind === "TEXT") return /\S/.test(p.body) ? [{ id: p.key, view: "TEXT", body: p.body, bodyFormat: p.format, url: null, file: null }] : [];
    if (p.kind === "EMBED") return p.url.trim() ? [{ id: p.key, view: "EMBED", body: null, bodyFormat: null, url: p.url.trim(), file: null }] : [];
    if (p.kind === "FILE") {
      const f = files.get(p.fileId);
      return f ? [{ id: p.key, view: partView("FILE", f.kind), body: null, bodyFormat: null, url: null, file: { ...f, sizeBytes: f.sizeBytes } }] : [];
    }
    return [];
  });
}

function Scene({ ctx, live }: { ctx: LessonPreviewContext; live: Live }) {
  const parts = useMemo(() => toPlayerParts(live.parts, live.files), [live.parts, live.files]);
  const views = lessonPartViews(parts.map((p) => ({ kind: p.view === "TEXT" ? "TEXT" : p.view === "EMBED" ? "EMBED" : "FILE", file: p.file ? { kind: p.file.kind } : null })));
  return (
    <div className="min-h-screen bg-paper px-5 pb-16 pt-6">
      <p className="truncate text-xs font-semibold text-muted">{ctx.courseTitle}</p>
      <div className="mt-4">
        <LessonView
          lesson={{ id: "preview", title: live.title.trim(), durationMin: live.durationMin, number: ctx.number, total: ctx.total, label: partsLabel(views) }}
          parts={parts}
          course={{ title: ctx.courseTitle, imageUrl: ctx.imageUrl }}
          personal={ctx.personal}
          footer={
            <div className="mt-8 border-t border-line pt-6">
              <span className="btn btn-primary pointer-events-none">Marcar como completada</span>
            </div>
          }
        />
      </div>
    </div>
  );
}

/** Columna de escritorio: la lección en un teléfono, al lado del editor, al momento. */
export function LessonPreviewColumn({ ctx, live }: { ctx: LessonPreviewContext; live: Live }) {
  const deferred = useDeferredValue(live);
  return (
    <div className="sticky top-20 hidden lg:block" data-lesson-preview>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Así la verá tu alumna</p>
        {!live.published && <span className="rounded-full bg-[#f8efdc] px-2.5 py-1 text-[0.7rem] font-semibold text-[#8a6420]">Borrador</span>}
      </div>
      <PhoneFrame screenClassName="h-[min(760px,calc(100dvh-170px))] w-[360px] overflow-hidden">
        <PreviewFrame title="Vista previa de la lección" className="block h-full w-full border-0 bg-transparent">
          <Scene ctx={ctx} live={deferred} />
        </PreviewFrame>
      </PhoneFrame>
    </div>
  );
}

/** Teléfono y tableta: la vista previa a pantalla completa. */
export function LessonPreviewSheet({ ctx, live, onClose }: { ctx: LessonPreviewContext; live: Live; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Vista previa de la lección" className="fixed inset-0 z-50 flex flex-col bg-paper animate-fade-in lg:hidden" data-lesson-preview>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" /> Volver al editor
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Eye className="h-3.5 w-3.5" /> Así la verá tu alumna
        </span>
      </div>
      <div className="mx-auto min-h-0 w-full max-w-[430px] flex-1">
        <PreviewFrame title="Vista previa de la lección" className="block h-full w-full border-0 bg-transparent">
          <Scene ctx={ctx} live={live} />
        </PreviewFrame>
      </div>
    </div>
  );
}
