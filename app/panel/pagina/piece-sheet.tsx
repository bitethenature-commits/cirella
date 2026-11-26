"use client";

import { Trash2, Undo2, X } from "lucide-react";
import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { BUTTON_FRAMES, CARD_FRAMES, type ButtonFrameKey, type CardFrameKey } from "@/lib/frames";
import type { GeometryFigure } from "@/lib/page-blocks";
import type { PageConfig } from "@/lib/page-config";
import { pieceHasLook, PIECES_MAX, type Piece, type PieceKind } from "@/lib/pieces";
import { FIGURE_POS, type FigurePos } from "@/lib/sacred-figures";
import { designValue, PANEL_GEOS, PHOTO_SHAPES, type Design, type PhotoShape } from "@/lib/templates";
import { ButtonFrameSwatch, CardFrameSwatch, FramePicker } from "./design-editor";
import { Tr, useT } from "@/lib/i18n/client";

/** La pieza que se ha tocado en la vista en vivo: su dirección (lib/pieces.ts), qué es, su texto y si es una foto suelta. */
export type PickedPiece = { id: string; kind: PieceKind; label: string; img?: boolean };

const TITLE: Record<PieceKind, string> = { card: "Solo esta tarjeta", panel: "Solo este panel dorado", button: "Solo este botón", photo: "Solo esta foto" };
const LINES = { double: "Doble línea", single: "Una línea", none: "Sin línea" } as const;
const GEOS = Object.fromEntries(Object.entries(PANEL_GEOS).filter(([k]) => k !== "keep")) as Record<"none" | GeometryFigure, string>;

/** Una fila: su nombre, el punto dorado si es propio de la pieza y «Como el resto» para quitarlo. */
function Field({ label, own, onReset, hint, children }: { label: string; own: boolean; onReset: () => void; hint?: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {own && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
          <Tr s={label} />
        </span>
        {own && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <Undo2 className="h-3 w-3" />{" "}<Tr s={"Como el resto"} /></button>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-muted"><Tr s={hint} /></p>}
    </div>
  );
}

/**
 * La ventanita de una pieza suelta (Mi página › Diseño, al tocar en la vista en vivo una tarjeta, un panel dorado o
 * un botón): su forma, sus colores, su marco y, en tarjetas y paneles, la geometría del fondo; solo para esa pieza
 * de esa página. Va abajo a la izquierda y sin tapar la vista en vivo: se puede tocar otra pieza con ella abierta.
 */
export function PieceSheet({
  page,
  picked,
  cfg,
  setCfg,
  design,
  onClose,
}: {
  page: string;
  picked: PickedPiece;
  cfg: PageConfig;
  setCfg: Dispatch<SetStateAction<PageConfig>>;
  /** El diseño de esa página (para los colores de partida). */
  design: Design;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement | null)?.closest?.("input, textarea, select")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = cfg.pieces[page] ?? {};
  const saved = list[picked.id];
  const p: Piece = saved ?? { kind: picked.kind, label: picked.label };
  const kind = p.kind;
  const full = !saved && Object.keys(list).length >= PIECES_MAX;

  /** Guarda la pieza (sin nada propio, se quita de la lista). */
  const write = (next: Piece | null) =>
    setCfg((c) => {
      const mine = { ...(c.pieces[page] ?? {}) };
      if (next && pieceHasLook(next)) mine[picked.id] = next;
      else delete mine[picked.id];
      const all = { ...c.pieces };
      if (Object.keys(mine).length) all[page] = mine;
      else delete all[page];
      return { ...c, pieces: all };
    });
  const set = (patch: Partial<Piece>) => write({ ...p, label: p.label || picked.label, ...patch });
  const clear = (keys: (keyof Piece)[]) => write(Object.fromEntries(Object.entries(p).filter(([k]) => !keys.includes(k as keyof Piece))) as Piece);

  // Desde dónde se empieza: lo que lleva ahora el resto de piezas como ella en esta página.
  const v = <K extends keyof Design>(k: K) => designValue(design, k);
  const gold = v("gold");
  const start = {
    bg: kind === "button" ? v("btnBg") : kind === "panel" ? v("panelBg") : v("cardBg"),
    text: v("btnText"),
    border: kind === "button" ? v("btnBorder") : kind === "panel" ? v("panelBorder") : kind === "photo" ? gold : v("cardBorder"),
    radius: kind === "button" ? Math.min(60, v("btnRadius")) : kind === "panel" ? v("panelRadius") : kind === "photo" ? v("imgRadius") : v("cardRadius"),
  };

  const colorField = (k: "bg" | "text" | "border" | "frameColor" | "geoColor", label: string, fallback: string, hint?: string) => (
    <Field label={t(label)} own={p[k] !== undefined} onReset={() => clear(k === "bg" ? ["bg", "bgOpacity"] : [k])} hint={t(hint)}>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white p-2 pr-3">
        <input type="color" value={p[k] ?? fallback} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })} className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={t(label)} />
        <span className="font-mono text-xs uppercase text-muted"><Tr s={p[k] ?? t("Como el resto")} /></span>
      </label>
    </Field>
  );
  const slider = (k: "bgOpacity" | "borderWidth" | "radius" | "geoOpacity", label: string, min: number, max: number, fallback: number, show: (n: number) => string) => (
    <Field label={t(label)} own={p[k] !== undefined} onReset={() => clear([k])}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} value={p[k] ?? fallback} onChange={(e) => set({ [k]: Number(e.target.value) })} className="flex-1 accent-[#c9a46a]" aria-label={t(label)} />
        <span className="w-16 text-right text-xs tabular-nums text-muted">{show(p[k] ?? fallback)}</span>
      </div>
    </Field>
  );
  /** `shown`: la que se ve marcada si no se ha elegido ninguna (la que lleva de por sí). */
  const pills = <T extends string>(label: string, value: T | undefined, options: Record<T, string>, onPick: (o: T) => void, onReset: () => void, shown?: T) => (
    <Field label={t(label)} own={value !== undefined} onReset={onReset}>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(options) as T[]).map((o) => (
          <button key={o} type="button" onClick={() => onPick(o)} className={`rounded-full border px-3 py-1.5 text-xs transition ${(value ?? shown) === o ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"}`}>
            {options[o]}
          </button>
        ))}
      </div>
    </Field>
  );

  const figure = p.geo && p.geo !== "none" ? p.geo : null;

  return (
    <div
      role="dialog"
      aria-label={t(TITLE[kind])}
      className="fixed inset-x-0 bottom-0 z-[43] flex max-h-[62vh] flex-col rounded-t-2xl border border-line bg-paper/80 text-ink backdrop-blur-xl shadow-[0_30px_80px_-20px_rgb(0_0_0/.75)] animate-fade-up sm:inset-x-auto sm:bottom-[3.6rem] sm:left-12 sm:max-h-[calc(100dvh-8.5rem)] sm:w-[26rem] sm:max-w-[calc(100vw-4.5rem)] sm:rounded-2xl lg:left-16"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <p className="font-semibold"><Tr s={TITLE[kind]} /></p>
          <p className="truncate text-xs text-muted"><Tr s={p.label || picked.label || t("Sin texto")} /></p>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-sand" aria-label={t("Cerrar")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 divide-y divide-line overflow-y-auto px-5 py-2">
        {full ? (
          <p className="py-4 text-sm text-muted"><Tr s={"Ya tienes"} />{" "}{PIECES_MAX}{" "}<Tr s={"piezas sueltas en esta página: quita alguna para cambiar otra."} /></p>
        ) : kind === "photo" ? (
          <>
            {pills("Forma", p.shape, PHOTO_SHAPES, (o: PhotoShape) => set({ shape: o }), () => clear(["shape"]))}
            {(!p.shape || p.shape === "rounded") && slider("radius", "Esquinas", 0, 60, start.radius, (n) => `${n} px`)}
            {pills("Línea del marco", p.line, LINES, (o) => set({ line: o }), () => clear(["line"]))}
            {colorField("border", "Color del borde", start.border)}
            {slider("borderWidth", "Grosor del borde", 0, 6, 1, (n) => `${n} px`)}
            {picked.img ? (
              <p className="py-3 text-xs text-muted"><Tr s={"En esta foto pequeña no caben adornos: su forma, su línea y su borde."} /></p>
            ) : (
              <>
                <Field label={t("Adorno del marco")} own={p.frame !== undefined} onReset={() => clear(["frame", "frameColor"])}>
                  <FramePicker items={CARD_FRAMES} value={p.frame ?? ""} onPick={(k) => set({ frame: k })} preview={(k) => <CardFrameSwatch frame={k as CardFrameKey} />} />
                </Field>
                {p.frame && p.frame !== "none" && colorField("frameColor", "Color del adorno", gold)}
              </>
            )}
          </>
        ) : (
          <>
            {colorField("bg", kind === "button" ? "Color del botón" : "Color de fondo", start.bg)}
            {p.bg && slider("bgOpacity", kind === "button" ? "Cuánto se ve el color" : "Cuánto se ve el fondo", 0, 100, 100, (n) => `${n}%`)}
            {kind === "button" && colorField("text", "Color del texto", start.text)}
            {colorField("border", "Color del borde", start.border)}
            {slider("borderWidth", "Grosor del borde", 0, 6, 1, (n) => `${n} px`)}
            {slider("radius", "Esquinas", 0, 60, start.radius, (n) => (kind === "button" && n >= 60 ? "Píldora" : `${n} px`))}
            <Field label={t("Marco")} own={p.frame !== undefined} onReset={() => clear(["frame", "frameColor"])}>
              {kind === "button" ? (
                <FramePicker items={BUTTON_FRAMES} value={p.frame ?? ""} onPick={(k) => set({ frame: k })} preview={(k) => <ButtonFrameSwatch frame={k as ButtonFrameKey} />} />
              ) : (
                <FramePicker items={CARD_FRAMES} value={p.frame ?? ""} onPick={(k) => set({ frame: k })} preview={(k) => <CardFrameSwatch frame={k as CardFrameKey} />} />
              )}
            </Field>
            {p.frame && p.frame !== "none" && colorField("frameColor", "Color del marco", gold)}
            {kind !== "button" && (
              <>
                {pills("Geometría de fondo", p.geo, GEOS, (o) => set({ geo: o }), () => clear(["geo", "geoPos", "geoOpacity", "geoColor"]))}
                {figure && (
                  <>
                    {pills("Dónde va la figura", p.geoPos, FIGURE_POS, (o: FigurePos) => set({ geoPos: o }), () => clear(["geoPos"]), "corner")}
                    {slider("geoOpacity", "Cuánto se ve", 4, 60, 16, (n) => `${n}%`)}
                    {colorField("geoColor", "Color de la geometría", gold)}
                  </>
                )}
              </>
            )}
            {kind === "panel" && (
              <Field label={t("Estrellitas ✦ en las esquinas")} own={p.stars === false} onReset={() => clear(["stars"])}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.stars !== false}
                  onClick={() => (p.stars === false ? clear(["stars"]) : set({ stars: false }))}
                  className={`relative h-6 w-11 rounded-full transition ${p.stars !== false ? "bg-gold" : "bg-line"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${p.stars !== false ? "left-[1.375rem]" : "left-0.5"}`} />
                </button>
              </Field>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        {saved ? (
          <button type="button" onClick={() => write(null)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-rose">
            <Trash2 className="h-3.5 w-3.5" />{" "}<Tr s={"Quitar lo propio"} /></button>
        ) : (
          <p className="text-xs text-muted"><Tr s={"Lo que cambies, solo en esta pieza."} /></p>
        )}
        <button type="button" onClick={onClose} className="btn btn-primary btn-sm"><Tr s={"Listo"} /></button>
      </div>
    </div>
  );
}
