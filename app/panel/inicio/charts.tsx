"use client";

import { useId, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import { Tr } from "@/lib/i18n/client";

/**
 * Las gráficas de Inicio: una sola serie cada una, en el oro del panel (se adaptan a cualquier diseño del panel:
 * usan sus colores). Al pasar por encima (o tocar) sale un recuadro con el día y la cifra.
 */

export type ChartPoint = { label: string; long: string; value: number };
export type ValueFormat = "num" | "money" | "pct";

const GOLD = "var(--color-gold)";
const LINE = "var(--color-line)";

export function fmtValue(v: number, f: ValueFormat = "num") {
  if (f === "money") return formatMoney(Math.round(v));
  if (f === "pct") return `${v.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
  return Math.round(v).toLocaleString("es-ES");
}

/** Un máximo «redondo» para el eje (1, 2, 5 × 10ⁿ), para que las rayas de guía caigan en cifras limpias. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

/** Qué etiquetas del eje de abajo se ven (unas 6, siempre la primera y la última). */
function tickIdx(n: number, want = 6) {
  if (n <= want) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (want - 1);
  return Array.from({ length: want }, (_, i) => Math.round(i * step));
}

/** La línea pequeña de los números de arriba. */
export function Sparkline({ values, className = "h-8 w-full" }: { values: number[]; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (values.length < 2) return null;
  const max = Math.max(...values, 0) || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 26 - (v / max) * 22] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.32" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L100 28L0 28Z`} fill={`url(#${id}f)`} />
      <path d={d} fill="none" stroke={GOLD} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** El recuadro que sale al pasar por encima. */
function Tip({ x, w, title, value }: { x: number; w: number; title: string; value: string }) {
  const left = Math.min(Math.max((x / w) * 100, 12), 88);
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-line bg-paper px-3 py-1.5 text-center shadow-soft"
      style={{ left: `${left}%` }}
      role="status"
    >
      <p className="text-[0.7rem] capitalize text-muted">{title}</p>
      <p className="font-serif text-base leading-tight"><Tr s={value} /></p>
    </div>
  );
}

const W = 640;

/** La evolución (área con línea): una raya y un punto siguen al ratón o al dedo. */
export function TrendChart({ points, format = "num", label, height = 220 }: { points: ChartPoint[]; format?: ValueFormat; label: string; height?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const top = 44;
  const bottom = H - 26;
  const left = 8;
  const right = W - 8;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const x = (i: number) => (points.length < 2 ? (left + right) / 2 : left + (i / (points.length - 1)) * (right - left));
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join("");
  const total = points.reduce((a, p) => a + p.value, 0);

  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !points.length) return;
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((px - left) / (right - left)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <div className="relative">
      {hover != null && <Tip x={x(hover)} w={W} title={points[hover].long} value={fmtValue(points[hover].value, format)} />}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-pan-y select-none"
        role="img"
        aria-label={`${label}: ${fmtValue(total, format)} en total. ${points.map((p) => `${p.long}: ${fmtValue(p.value, format)}`).join(". ")}.`}
        onMouseMove={(e) => move(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => move(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Rayas de guía (0, ½ y el máximo) con su cifra */}
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1={left} x2={right} y1={y(max * k)} y2={y(max * k)} stroke={LINE} strokeWidth="1" strokeDasharray={k ? "3 4" : undefined} />
            {k > 0 && (
              <text x={left} y={y(max * k) - 5} fontSize="11" fill="currentColor" fillOpacity="0.55">
                {fmtValue(max * k, format)}
              </text>
            )}
          </g>
        ))}
        {points.length > 1 && <path d={`${d}L${x(points.length - 1)} ${bottom}L${x(0)} ${bottom}Z`} fill={`url(#${id}f)`} />}
        <path d={d} fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {tickIdx(points.length).map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="11" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fill="currentColor" fillOpacity="0.55">
            <Tr s={points[i].label} />
          </text>
        ))}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={top - 6} y2={bottom} stroke={GOLD} strokeOpacity="0.6" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(points[hover].value)} r="5" fill={GOLD} stroke="var(--color-paper)" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Barras (una por día, semana o mes): cada una con su recuadro al pasar por encima. */
export function BarChart({ points, format = "num", label, height = 190 }: { points: ChartPoint[]; format?: ValueFormat; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const top = 44;
  const bottom = H - 26;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const slot = W / Math.max(points.length, 1);
  const bw = Math.max(2, Math.min(36, slot - 2));
  const y = (v: number) => bottom - (Math.max(v, 0) / max) * (bottom - top);
  const total = points.reduce((a, p) => a + p.value, 0);

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      {hover != null && <Tip x={slot * hover + slot / 2} w={W} title={points[hover].long} value={fmtValue(points[hover].value, format)} />}
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" aria-label={`${label}: ${fmtValue(total, format)} en total. ${points.map((p) => `${p.long}: ${fmtValue(p.value, format)}`).join(". ")}.`}>
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1="0" x2={W} y1={y(max * k)} y2={y(max * k)} stroke={LINE} strokeWidth="1" strokeDasharray={k ? "3 4" : undefined} />
            {k > 0 && (
              <text x="0" y={y(max * k) - 5} fontSize="11" fill="currentColor" fillOpacity="0.55">
                {fmtValue(max * k, format)}
              </text>
            )}
          </g>
        ))}
        {points.map((p, i) => {
          const cx = slot * i + slot / 2;
          const h = bottom - y(p.value);
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover((v) => (v === i ? null : i))}>
              {/* Zona de toque: toda la columna */}
              <rect x={slot * i} y={top - 8} width={slot} height={bottom - top + 8} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${cx - bw / 2} ${bottom}V${bottom - h + r}Q${cx - bw / 2} ${bottom - h} ${cx - bw / 2 + r} ${bottom - h}H${cx + bw / 2 - r}Q${cx + bw / 2} ${bottom - h} ${cx + bw / 2} ${bottom - h + r}V${bottom}Z`}
                  fill={GOLD}
                  fillOpacity={hover == null || hover === i ? 0.9 : 0.4}
                />
              )}
            </g>
          );
        })}
        {tickIdx(points.length, points.length <= 13 ? points.length : 6).map((i) => (
          <text key={i} x={slot * i + slot / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="currentColor" fillOpacity="0.55">
            <Tr s={points[i].label} />
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Una lista con barras horizontales (de dónde llegan, el embudo…): la etiqueta, la barra y la cifra. */
export function HBars({ items, format = "num" }: { items: { label: string; value: number; hint?: string }[]; format?: ValueFormat }) {
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${fmtValue(it.value, format)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate"><Tr s={it.label} /></span>
            <span className="shrink-0 tabular-nums">
              <strong className="font-semibold">{fmtValue(it.value, format)}</strong>
              {it.hint && <span className="ml-1.5 text-xs text-muted"><Tr s={it.hint} /></span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: LINE }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(it.value ? 2 : 0, (it.value / max) * 100)}%`, background: GOLD }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
