"use client";
import { Move, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { ImageUpload } from "@/components/ui/image-upload";
import { cardFrameStyle, cardFrameText, DEFAULT_CARD_FRAME, parseCardFrame, type CardFrame } from "@/components/models/data/oracle";

/**
 * Una cara de una carta de oráculo (anverso o reverso): subir la imagen y ajustarla a la carta (5 × 8)
 * viéndola en una carta de muestra. «Rellenar» la llena recortando lo que sobre; «Entera» la enseña
 * completa. Se arrastra para elegir qué parte queda en el centro y el zoom la acerca. El ajuste viaja en
 * un campo oculto (`frameName`) como «cover 50 50 100».
 */
export function CardImageFramer({
  label,
  hint,
  uploadLabel,
  image,
  onImage,
  frame: initialFrame,
  frameName,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  uploadLabel: string;
  image: string | null;
  onImage: (url: string | null) => void;
  frame: string | null;
  frameName: string;
}) {
  const [frame, setFrame] = useState<CardFrame>(() => parseCardFrame(initialFrame));
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const text = cardFrameText(frame);
  const put = (patch: Partial<CardFrame>) => setFrame((f) => ({ ...f, ...patch }));

  const onDown = (e: React.PointerEvent) => {
    if (!image) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: frame.x, fy: frame.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    // Arrastrar a la derecha enseña lo de la izquierda (como mover una foto con el dedo).
    const k = 100 / (frame.zoom / 100);
    put({
      x: Math.round(Math.min(100, Math.max(0, d.fx - ((e.clientX - d.x) / r.width) * k))),
      y: Math.round(Math.min(100, Math.max(0, d.fy - ((e.clientY - d.y) / r.height) * k))),
    });
  };
  const onUp = () => (drag.current = null);

  return (
    <div>
      <p className="field-label">{label}</p>
      <input type="hidden" name={frameName} value={image ? text : ""} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,13rem)_auto] sm:items-start">
        <div>
          <ImageUpload value={image} onChange={(v) => (onImage(v), setFrame(DEFAULT_CARD_FRAME))} label={uploadLabel} fit="contain" graphic />
          {hint && <p className="field-hint">{hint}</p>}
        </div>
        {image && (
          <div className="flex flex-col items-center gap-2.5">
            <div
              ref={box}
              className="relative aspect-[5/8] w-40 cursor-grab touch-none overflow-hidden rounded-[0.7rem] border border-[#c8a86e]/60 bg-[#14122c] shadow-lift active:cursor-grabbing"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              aria-label="Arrastra para mover la imagen dentro de la carta"
              data-card-framer
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" style={cardFrameStyle(text)} />
              <span className="pointer-events-none absolute bottom-1.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[0.62rem] text-white">
                <Move className="h-3 w-3" /> Arrastra
              </span>
            </div>
            <div className="inline-flex rounded-full bg-sand p-0.5 text-xs" role="group" aria-label="Cómo se ajusta">
              {(
                [
                  ["cover", "Rellenar"],
                  ["contain", "Entera"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => put({ fit: k })} aria-pressed={frame.fit === k} className={`rounded-full px-3 py-1 font-semibold transition ${frame.fit === k ? "bg-ink text-cream" : "text-muted hover:text-ink"}`}>
                  {l}
                </button>
              ))}
            </div>
            <label className="flex w-40 items-center gap-2 text-xs text-muted">
              Zoom
              <input type="range" min={100} max={300} step={5} value={frame.zoom} onChange={(e) => put({ zoom: Number(e.target.value) })} className="min-w-0 flex-1 accent-[#c8a86e]" aria-label="Zoom de la imagen" />
            </label>
            <button type="button" onClick={() => setFrame(DEFAULT_CARD_FRAME)} className="inline-flex items-center gap-1 text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
              <RotateCcw className="h-3 w-3" /> Centrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
