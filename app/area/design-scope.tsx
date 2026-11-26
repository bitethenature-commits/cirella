"use client";

import { Palette, RotateCcw, X, Eye, EyeOff } from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowPair, Dot, ToolPill } from "@/app/panel/canva/order-tools";
import {
  AREA_SECTIONS,
  AREA_TEXTS,
  areaDesignCss,
  cleanAreaText,
  EMPTY_PIECE,
  hasPieceStyle,
  kindPick,
  pickedKind,
  pieceDef,
  readAreaParts,
  sectionOrder,
  type AreaParts,
  type AreaPlace,
  type AreaTextKey,
  type PieceStyle,
} from "@/lib/area-pieces";
import { KIND_PALETTE, KIND_STYLE } from "./membership/kind-style";
import { useT, Tr } from "@/lib/i18n/client";

/** Los mensajes entre el Canva (Mi página › Área de alumna, Cursos y Membresías) y la página del área de al lado. */
export const AREA_DESIGN_MESSAGE = "cirella:area-design";
export const AREA_TEXT_MESSAGE = "cirella:area-text";
export const AREA_PICK_MESSAGE = "cirella:area-pick";
/** Un cambio hecho con los botones de encima de la página: una pieza, el color de un tipo, el orden, o abrir su «Diseño». */
export const AREA_EDIT_MESSAGE = "cirella:area-edit";
export type AreaEdit =
  | { what: "piece"; k: string; patch: Partial<PieceStyle> }
  | { what: "kind"; k: string; hex: string | null }
  | { what: "order"; place: AreaPlace; order: string[] }
  | { what: "design"; k: string };

type Ctx = { parts: AreaParts; edit: boolean };
const DesignCtx = createContext<Ctx | null>(null);

const toParent = (data: unknown) => window.parent.postMessage(data, window.location.origin);
const sendEdit = (e: AreaEdit) => toParent({ type: AREA_EDIT_MESSAGE, ...e });

/**
 * Lo de dentro con el diseño de la creadora (lib/area-pieces.ts): su hoja de estilos (colores de cada tipo, orden de
 * las partes, cada pieza) y sus textos para <AreaText>. Dentro del Canva, como el Canva de la web: se escribe encima
 * de los textos y se toca una pieza (o la etiqueta de un tipo) para cambiarla con sus botones, al lado; las partes
 * llevan sus flechas para subirlas o bajarlas. La de más fuera es la que escucha los clics y pinta los botones.
 */
export function AreaDesignScope({ parts: saved, children }: { parts: AreaParts; children: ReactNode }) {
  const parent = useContext(DesignCtx);
  const top = !parent;
  const [canva, setCanva] = useState<{ parts: AreaParts; edit: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  /** El que se tocó de verdad (hay muchas tarjetas iguales): sus botones salen a su lado. */
  const picked = useRef<Element | null>(null);

  useEffect(() => {
    if (window.parent === window) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; design?: unknown; edit?: unknown } | null;
      if (d?.type !== AREA_DESIGN_MESSAGE) return;
      setCanva({ parts: readAreaParts(d.design), edit: d.edit === true });
    };
    window.addEventListener("message", onMessage);
    // Avisa de que ya escucha (también al ir a otra página dentro): el Canva manda entonces el diseño.
    toParent({ type: `${AREA_DESIGN_MESSAGE}:ready` });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const parts = canva?.parts ?? saved;
  const edit = !!canva?.edit;

  // Los clics dentro del Canva (solo la de más fuera, para no mandarlos dos veces).
  useEffect(() => {
    if (!top || !edit) return;
    const choose = (k: string | null, el: Element | null) => {
      picked.current = el;
      setSelected(k);
      toParent({ type: AREA_PICK_MESSAGE, k });
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t || t.closest("[data-area-ui]") || t.closest("summary")) return;
      // El texto se escribe encima: no abre su enlace.
      if (t.closest("[data-area-text]")) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const kindEl = t.closest("[data-area-kind]");
      const pieceEl = t.closest("[data-area-piece]");
      // Lo de más dentro: la etiqueta de un tipo dentro de una tarjeta es el tipo.
      if (kindEl && (!pieceEl || pieceEl.contains(kindEl))) choose(kindPick(kindEl.getAttribute("data-area-kind") ?? ""), kindEl);
      else if (pieceEl) choose(pieceEl.getAttribute("data-area-piece"), pieceEl);
      else choose(null, null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof Element && e.target.closest("[data-area-text]"))) choose(null, null);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [top, edit]);

  const css = areaDesignCss(parts, { edit, selected: top ? selected : null });
  return (
    <DesignCtx.Provider value={{ parts, edit }}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {children}
      {top && edit && <CanvaTools parts={parts} selected={selected} picked={picked} onClose={() => { picked.current = null; setSelected(null); toParent({ type: AREA_PICK_MESSAGE, k: null }); }} />}
    </DesignCtx.Provider>
  );
}

type Box = { top: number; left: number; right: number; bottom: number };
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom) };
};

/** Mide en cada fotograma dónde está lo tocado y cada parte (la página se mueve, crece, se desliza…). */
function useGeometry(selected: string | null, picked: React.RefObject<Element | null>) {
  const [geo, setGeo] = useState<{ sel: Box | null; sections: { id: string; box: Box }[]; hover: string | null; vw: number; vh: number }>({ sel: null, sections: [], hover: null, vw: 0, vh: 0 });
  const hover = useRef<string | null>(null);
  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      // Se queda la última parte por la que se pasó: así se llega a sus flechas sin que se vayan.
      const s = e.target instanceof Element ? e.target.closest("[data-area-section]") : null;
      if (s) hover.current = s.getAttribute("data-area-section");
    };
    document.addEventListener("mouseover", onOver);
    let raf = 0;
    let last = "";
    const tick = () => {
      let el = picked.current;
      if (selected && (!el || !el.isConnected)) {
        const kind = pickedKind(selected);
        el = document.querySelector(kind ? `[data-area-kind="${kind}"]` : `[data-area-piece="${selected}"]`);
      }
      const sections = [...document.querySelectorAll("[data-area-section]")]
        .map((s) => ({ id: s.getAttribute("data-area-section") ?? "", box: boxOf(s) }))
        .filter((s) => !s.id.endsWith(":notices") && s.box.bottom > s.box.top);
      const next = { sel: selected && el ? boxOf(el) : null, sections, hover: hover.current, vw: window.innerWidth, vh: window.innerHeight };
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setGeo(next);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mouseover", onOver);
    };
  }, [selected, picked]);
  return geo;
}

const TOOLS_W = 168;

/** Los botones encima de la página: los de la pieza tocada (a su lado) y las flechas de cada parte (a su izquierda). */
function CanvaTools({ parts, selected, picked, onClose }: { parts: AreaParts; selected: string | null; picked: React.RefObject<Element | null>; onClose: () => void }) {
  const geo = useGeometry(selected, picked);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Las partes de cada página que hay ahora a la vista, en su orden: para subir o bajar entre ellas.
  const present = (place: AreaPlace) => geo.sections.filter((s) => s.id.startsWith(`${place}:`)).map((s) => s.id.slice(place.length + 1));
  const move = (place: AreaPlace, key: string, by: -1 | 1) => {
    const here = present(place);
    const i = here.indexOf(key);
    const other = here[i + by];
    if (!other) return;
    const order = sectionOrder(place, parts);
    const a = order.indexOf(key);
    const b = order.indexOf(other);
    [order[a], order[b]] = [order[b], order[a]];
    sendEdit({ what: "order", place, order });
  };
  const selSection = geo.sel ? geo.sections.find((s) => s.box.top <= geo.sel!.top && s.box.bottom >= geo.sel!.bottom)?.id : null;

  const kind = pickedKind(selected);
  const def = selected && !kind ? pieceDef(selected) : null;
  const sel = geo.sel;
  // Los botones de la pieza: a su derecha si caben; si no, dentro, arriba a la derecha.
  const outside = sel ? sel.right + 12 + TOOLS_W <= geo.vw : false;
  const toolsTop = sel ? Math.max(8, Math.min(sel.top + 4, sel.bottom - 40, geo.vh - 60)) : 0;
  const toolsStyle = sel ? (outside ? { top: toolsTop, left: sel.right + 12 } : { top: toolsTop, right: Math.max(8, geo.vw - sel.right + 8) }) : undefined;

  return createPortal(
    <div data-area-ui className="pointer-events-none fixed inset-0 z-[80]">
      {geo.sections.map(({ id, box }) => {
        const [place, key] = id.split(":") as [AreaPlace, string];
        if (!AREA_SECTIONS[place]?.some((s) => s.key === key)) return null;
        if (id !== geo.hover && id !== selSection) return null;
        const here = present(place);
        if (here.length < 2) return null;
        const i = here.indexOf(key);
        const label = AREA_SECTIONS[place].find((s) => s.key === key)?.label ?? "";
        const roomLeft = box.left >= 100;
        return (
          <div key={id} className="pointer-events-auto absolute" style={{ top: Math.max(8, box.top + 4), left: roomLeft ? box.left - 40 : box.left + 6 }}>
            <ArrowPair axis="y" prevLabel={`Subir «${label}»`} nextLabel={`Bajar «${label}»`} onPrev={i > 0 ? () => move(place, key, -1) : null} onNext={i < here.length - 1 ? () => move(place, key, 1) : null} />
          </div>
        );
      })}

      {sel && (def || kind) && (
        <div className="pointer-events-auto absolute flex flex-col items-start gap-1" style={{ ...toolsStyle, width: TOOLS_W, alignItems: outside ? "flex-start" : "flex-end" }}>
          <span className="max-w-full truncate rounded-full border border-[#e9cc8e]/45 bg-[#0e0e10]/90 px-2.5 py-1 text-[0.66rem] font-semibold text-[#f3e2b3] shadow">
            {kind ? `Color · ${KIND_STYLE[kind].label}` : def!.label}
          </span>
          {def && <PieceTools k={def.key} figure={!!def.figure} p={parts.pieces[def.key] ?? EMPTY_PIECE} onClose={onClose} />}
          {kind && <KindTools k={kind} hex={parts.kinds[kind] ?? null} onClose={onClose} />}
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Los botones de una pieza: ocultarla, dejarla, volver a como siempre, su «Diseño» y sus estilos rápidos. */
function PieceTools({ k, figure, p, onClose }: { k: string; figure: boolean; p: PieceStyle; onClose: () => void }) {
  const t = useT();
  const patch = (x: Partial<PieceStyle>) => sendEdit({ what: "piece", k, patch: x });
  return (
    <>
      <div className="flex gap-1">
        <Dot label={p.hidden ? t("Enseñarla a tus alumnas") : t("Esconderla a tus alumnas")} onClick={() => patch({ hidden: !p.hidden })}>
          {p.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Dot>
        {hasPieceStyle(p) && (
          <Dot label={t("Como siempre")} onClick={() => patch({ ...EMPTY_PIECE })}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Dot>
        )}
        <Dot label={t("Dejar de tocarla")} onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Dot>
      </div>
      <ToolPill icon={Palette} label={t("Diseño")} title={t("Su fondo, su luz, sus letras, sus detalles y su borde")} onClick={() => sendEdit({ what: "design", k })} />
      <span aria-hidden className="my-0.5 h-px w-full bg-[#e9cc8e]/40" />
      {figure && <ToolPill label={t("Sin dibujo")} on={p.noFigure} onClick={() => patch({ noFigure: !p.noFigure })} />}
      <ToolPill label={t("Que brille")} on={p.shadow === "glow"} onClick={() => patch({ shadow: p.shadow === "glow" ? null : "glow" })} />
      <ToolPill label={t("Sin sombra")} on={p.shadow === "none"} onClick={() => patch({ shadow: p.shadow === "none" ? null : "none" })} />
      <ToolPill label={t("Esquinas rectas")} on={p.radius === "square"} onClick={() => patch({ radius: p.radius === "square" ? null : "square" })} />
      <ToolPill label={t("Muy redondas")} on={p.radius === "round"} onClick={() => patch({ radius: p.radius === "round" ? null : "round" })} />
    </>
  );
}

/** El color de un tipo de publicación, elegido ahí mismo: sus etiquetas, filtros, botones y tarjetas cambian a la vez. */
function KindTools({ k, hex, onClose }: { k: string; hex: string | null; onClose: () => void }) {
  const t = useT();
  const set = (v: string | null) => sendEdit({ what: "kind", k, hex: v });
  const shown = hex ?? KIND_STYLE[k].hex;
  return (
    <>
      <div className="flex gap-1">
        {hex && (
          <Dot label={t("El de siempre")} onClick={() => set(null)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Dot>
        )}
        <Dot label={t("Dejar de tocarlo")} onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Dot>
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[#e9cc8e]/45 bg-[#0e0e10]/90 p-2 shadow">
        {KIND_PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.name}
            aria-label={c.name}
            aria-pressed={shown === c.hex}
            onClick={() => set(c.hex === KIND_STYLE[k].hex ? null : c.hex)}
            className={`h-6 w-6 rounded-full border border-white/20 transition hover:scale-110 ${shown === c.hex ? "ring-2 ring-[#e9cc8e] ring-offset-1 ring-offset-[#0e0e10]" : ""}`}
            style={{ background: c.hex }}
          />
        ))}
        <label title={t("Otro color")} className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-white/20" style={{ background: "conic-gradient(#f87171, #facc15, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)" }}>
          <input type="color" value={shown} onChange={(e) => set(e.target.value.toUpperCase())} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={t("Otro color")} />
        </label>
      </div>
    </>
  );
}

/** Un texto de lo de dentro que la creadora puede cambiar: el suyo o el de siempre. En el Canva, se escribe encima. */
export function AreaText({ k, children }: { k: AreaTextKey; children?: string }) {
  const ctx = useContext(DesignCtx);
  const text = ctx?.parts.texts[k] ?? children ?? AREA_TEXTS[k].def;
  if (ctx?.edit) return <EditableText k={k} text={text} />;
  return <><Tr s={text} /></>;
}

function EditableText({ k, text }: { k: AreaTextKey; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // El texto se pone a mano (no como hijo de React): así lo que se escribe no choca con lo que pinta React.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== text) el.textContent = text;
  }, [text]);
  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = cleanAreaText(el.textContent ?? "");
    if (next !== text) toParent({ type: AREA_TEXT_MESSAGE, k, text: next });
  };
  return (
    <span
      ref={ref}
      data-area-text={k}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.currentTarget.textContent = text;
          e.currentTarget.blur();
        }
      }}
      title={`${AREA_TEXTS[k].label}: escribe encima`}
    />
  );
}
