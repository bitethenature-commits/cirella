"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Tr } from "@/lib/i18n/client";

/**
 * Piezas comunes de los modelos interactivos (bloque «Modelo interactivo» de las páginas, lib/page-blocks.ts).
 * Todo con los tokens de la plantilla (--c-text, --c-gold, --c-line… y las clases cp-*): se ven bien en las
 * 5 plantillas, oscuras y claras. Pensados para la columna de las páginas (44rem) y el móvil: el diagrama
 * arriba y, debajo, la explicación de lo último que se tocó.
 */

export const GOLD = "var(--c-gold)";
export const INK = "var(--c-text)";
export const BG = "var(--c-bg)";
/** Relleno suave de un hueco «vacío» (centro abierto, etc.). */
export const SOFT = "color-mix(in oklab, var(--c-text) 7%, var(--c-bg))";

/** Polar → cartesiano, 0° a las 12 y en el sentido de las agujas del reloj. */
export function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Atributos para que una figura del SVG se pueda tocar y también usar con el teclado. */
export function tap(label: string, fn: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: fn,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn();
      }
    },
  };
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** true en cuanto el elemento entra en pantalla (una sola vez): dispara el dibujado de .cp-model-draw. */
export function useShown<T extends Element>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return [ref, shown] as const;
}

/**
 * Marco de todos los modelos: botonera (deslizable en el móvil), diagrama, leyenda, la explicación y, si
 * hace falta, un pie (tablas de consulta, como las de la carta natal).
 * Siempre en una columna: la página es estrecha y así se lee igual en el teléfono.
 */
export function ModelFrame({
  toolbar,
  diagram,
  legend,
  panel,
  footer,
  compact,
  summary,
  onClear,
}: {
  toolbar?: ReactNode;
  diagram: ReactNode;
  legend?: ReactNode;
  panel: ReactNode;
  footer?: ReactNode;
  /**
   * Versión rápida (páginas de los métodos): solo el dibujo, la leyenda y una o dos líneas sobre lo
   * último que se tocó (`summary`). Sin botonera, sin panel largo y sin tablas.
   */
  compact?: boolean;
  summary?: ReactNode;
  /**
   * Con algo tocado: quitarlo y volver a la explicación del principio. Sale «Volver a la explicación» y también
   * vale tocar el dibujo fuera de lo que se puede tocar.
   */
  onClear?: (() => void) | null;
}) {
  const back = onClear ? (
    <button type="button" onClick={onClear} className="cp-muted mb-3 inline-flex min-h-9 items-center gap-1.5 text-[0.8rem] font-semibold transition hover:opacity-100" data-model-back>
      <span aria-hidden>←</span>{" "}<Tr s={"Volver a la explicación"} /></button>
  ) : null;
  // Tocar el dibujo fuera de una figura que se pueda tocar quita lo tocado.
  const clearOutside = (e: React.MouseEvent) => {
    if (!onClear) return;
    const t = e.target as Element | null;
    if (t?.closest?.("[role=\"button\"], button, a, input, select, textarea, label, [data-model-keep]")) return;
    onClear();
  };
  const shownDiagram = <div onClick={clearOutside}>{diagram}</div>;
  if (compact)
    return (
      <div data-compact="">
        {shownDiagram}
        {legend && <div className="mt-4 flex justify-center text-center">{legend}</div>}
        {summary && (
          <div className="cp-line mx-auto mt-4 max-w-md border-t pt-4 text-center text-[0.88rem] leading-snug" aria-live="polite">
            {summary}
            {back && <div className="mt-1">{back}</div>}
          </div>
        )}
      </div>
    );
  return (
    <div>
      {toolbar && <div className="-mx-5 overflow-x-auto px-5 pb-1 scrollbar-none sm:-mx-7 sm:px-7">{toolbar}</div>}
      <div className={toolbar ? "mt-5" : ""}>{shownDiagram}</div>
      {legend && <div className="cp-line mt-5 border-t pt-4">{legend}</div>}
      <div className="cp-line mt-6 border-t pt-6" aria-live="polite">
        {back}
        {panel}
      </div>
      {footer && <div className="cp-line mt-8 border-t pt-6">{footer}</div>}
    </div>
  );
}

/** Cambiar la clave vuelve a montar el contenido, que entra con una animación corta (sin esperas). */
export function PanelBody({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div key={id} className="cp-model-in">
      {children}
    </div>
  );
}

export function PanelHeading({ kicker, title, tone }: { kicker: string; title: string; tone?: string }) {
  return (
    <>
      <p className="cp-eyebrow" style={tone ? { color: tone } : undefined}>
        <Tr s={kicker} />
      </p>
      <h4 className="cp-display mt-3 text-[1.6rem] leading-tight sm:text-[1.85rem]"><Tr s={title} /></h4>
    </>
  );
}

export function PanelRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="cp-line flex items-baseline justify-between gap-5 border-t py-3">
      <dt className="cp-eyebrow shrink-0 !text-[0.6rem]"><Tr s={label} /></dt>
      <dd className="text-right text-[0.86rem] leading-relaxed opacity-85">{value}</dd>
    </div>
  );
}

/** Resumen de una o dos líneas de la versión rápida: lo tocado en negrita y una frase. */
export function CompactSummary({ title, text, tone }: { title: ReactNode; text?: ReactNode; tone?: string }) {
  return (
    <div className="cp-model-in">
      <p className="cp-display text-[1.15rem] leading-snug" style={tone ? { color: tone } : undefined}>
        {title}
      </p>
      {text && <p className="cp-muted mt-1 line-clamp-2 text-[0.84rem] leading-snug">{text}</p>}
    </div>
  );
}

/** Estado inicial: dice qué hacer en lugar de enseñar una caja vacía. */
export function PanelIdle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="cp-display text-[1.3rem] italic leading-snug opacity-80"><Tr s={title} /></p>
      <div className="cp-muted mt-4 space-y-2.5 text-[0.88rem] leading-relaxed">{children}</div>
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="cp-muted text-[0.62rem] uppercase tracking-[0.16em]"><Tr s={label} /></span>
    </span>
  );
}

/** Botón píldora de las botoneras, como en la web antigua (versalitas espaciadas); 40 px de alto: cómodo con el dedo. */
export function ToolButton({ children, active, onClick, title }: { children: ReactNode; active?: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[0.64rem] uppercase tracking-[0.16em] transition-colors duration-500",
        active
          ? "border-[color-mix(in_oklab,var(--c-gold)_55%,transparent)] bg-[color-mix(in_oklab,var(--c-gold)_10%,transparent)] text-[var(--c-gold)]"
          : "border-[color-mix(in_oklab,var(--c-text)_15%,transparent)] text-[color-mix(in_oklab,var(--c-text)_60%,transparent)] hover:border-[color-mix(in_oklab,var(--c-gold)_35%,transparent)] hover:text-[var(--c-text)]",
      )}
    >
      {children}
    </button>
  );
}

/** Enlace dentro de la explicación que salta a otra pieza del modelo. */
export function PanelLink({ children, onClick, color }: { children: ReactNode; onClick: () => void; color?: string }) {
  return (
    <button type="button" onClick={onClick} className="cp-gold underline decoration-dotted underline-offset-4" style={color ? { color } : undefined}>
      {children}
    </button>
  );
}

/** Deslizador con el color dorado de la plantilla y altura cómoda para el dedo. */
export function RangeField({
  id,
  label,
  value,
  valueText,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  valueText: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="cp-eyebrow flex items-baseline justify-between gap-4 !text-[0.6rem]">
        <span><Tr s={label} /></span>
        <span className="cp-gold normal-case tracking-normal"><Tr s={valueText} /></span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-9 w-full cursor-pointer accent-[var(--c-gold)]"
      />
    </div>
  );
}

/**
 * Azar de verdad para las tiradas (runas, oráculo): crypto.getRandomValues, sin el sesgo del módulo
 * (se descartan los valores del último tramo incompleto). Nada se guarda ni se envía.
 */
export function randomInt(n: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** k índices distintos de 0…n-1, en orden aleatorio (Fisher–Yates parcial). */
export function drawDistinct(n: number, k: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(n - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}
