"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

export type WheelMetric = "visitas" | "inscripciones" | "clics" | "newsletter";

/** Un signo de la rueda: su temporada del último año y lo que pasó en ella. */
export type WheelSector = {
  sign: number;
  name: string;
  glyph: string;
  /** Color de su elemento. */
  hue: string;
  dates: string;
  value: number;
  /** La temporada de ahora (a medias). */
  current: boolean;
  /** Por dónde va (0–1); 1 en las que ya pasaron. */
  progress: number;
};

type Option = { value: string; label: string };

const UNIT: Record<WheelMetric, [string, string]> = {
  visitas: ["visitante", "visitantes"],
  inscripciones: ["inscripción", "inscripciones"],
  clics: ["clic", "clics"],
  newsletter: ["alta", "altas"],
};

// La rueda: 400 × 400, centro en 200. De fuera adentro: el anillo de los signos, el de las cifras, las barras y el centro.
const C = 200;
const R_OUT = 194;
const R_SIGN = 162;
const R_NUM = 151;
const R_MAX = 140;
const R_IN = 66;
const GOLD = "#D4B57A";

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Como en la carta natal: Aries empieza a la izquierda y los signos van en contra de las agujas del reloj. */
const pt = (deg: number, r: number) => ({ x: C + r * Math.cos(rad(deg)), y: C - r * Math.sin(rad(deg)) });
const f = (p: { x: number; y: number }) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
const startDeg = (sign: number) => 180 + sign * 30;
function wedge(a0: number, a1: number, r0: number, r1: number) {
  return `M${f(pt(a0, r1))}A${r1} ${r1} 0 0 0 ${f(pt(a1, r1))}L${f(pt(a1, r0))}A${r0} ${r0} 0 0 1 ${f(pt(a0, r0))}Z`;
}
/** Los glifos como texto (sin esto, iOS los pinta como emoji). */
const glyph = (g: string) => `${g}︎`;
const num = (n: number) => n.toLocaleString("es-ES");

/**
 * Inicio: la rueda del zodiaco con sus estadísticas, como un modelo astrológico. Cada signo es su temporada del
 * último año; la barra (su área) es lo que pasó en ella. Al pasar por encima o tocar un signo, el centro dice su
 * cifra. Debajo, los filtros (cambian la dirección: se puede guardar o compartir).
 */
export function StatsWheel({
  sectors,
  metric,
  labels,
  source,
  product,
  sources,
  products,
}: {
  sectors: WheelSector[];
  metric: WheelMetric;
  labels: Record<WheelMetric, string>;
  source: string;
  product: string;
  sources: Option[];
  products: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  const go = (patch: Partial<Record<"m" | "origen" | "producto", string>>) => {
    const next = { m: metric, origen: source, producto: product, ...patch };
    const p = new URLSearchParams();
    if (next.m && next.m !== "visitas") p.set("m", next.m);
    if (next.origen) p.set("origen", next.origen);
    if (next.producto) p.set("producto", next.producto);
    const q = p.toString();
    start(() => router.push(q ? `/panel?${q}` : "/panel", { scroll: false }));
  };

  const total = sectors.reduce((a, s) => a + s.value, 0);
  const max = Math.max(1, ...sectors.map((s) => s.value));
  // Área justa (como la rosa de Nightingale): el área de la barra crece como la cifra.
  const radius = (v: number) => Math.sqrt(R_IN * R_IN + ((R_MAX * R_MAX - R_IN * R_IN) * v) / max);
  const shown = hover ?? picked;
  const focus = shown == null ? null : sectors.find((s) => s.sign === shown) ?? null;
  const current = sectors.find((s) => s.current);
  const [one, many] = UNIT[metric];
  const big = focus ? focus.value : total;

  return (
    <section aria-label="Tus estadísticas en la rueda del zodiaco" className="mx-auto max-w-3xl">
      <div className={`relative transition-opacity ${pending ? "opacity-60" : ""}`}>
        <svg
          viewBox="0 0 400 400"
          className="mx-auto block w-full max-w-[min(36rem,calc(100dvh-15rem))] text-ink"
          role="img"
          aria-label={`${labels[metric]} en el último año: ${num(total)}. ${sectors.map((s) => `${s.name} (${s.dates}): ${num(s.value)}`).join(". ")}.`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <radialGradient id={`${id}halo`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={GOLD} stopOpacity="0.14" />
              <stop offset="72%" stopColor={GOLD} stopOpacity="0.04" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}bar`} gradientUnits="userSpaceOnUse" cx={C} cy={C} r={R_MAX}>
              <stop offset="40%" stopColor="#A9874A" />
              <stop offset="75%" stopColor={GOLD} />
              <stop offset="100%" stopColor="#F0D9A4" />
            </radialGradient>
            <filter id={`${id}glow`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={GOLD} floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Halo y filetes */}
          <circle cx={C} cy={C} r={R_OUT} fill={`url(#${id}halo)`} />
          {[R_OUT, R_SIGN].map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke={GOLD} strokeOpacity="0.55" strokeWidth="0.8" />
          ))}
          {/* Anillos guía de las barras (¼, ½, ¾ y el máximo) */}
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <circle key={k} cx={C} cy={C} r={radius(max * k)} fill="none" stroke="currentColor" strokeOpacity={k === 1 ? 0.18 : 0.09} strokeWidth="0.6" strokeDasharray={k === 1 ? undefined : "2 3"} />
          ))}
          <DegreeTicks />

          {sectors.map((s) => {
            const a0 = startDeg(s.sign);
            const a1 = a0 + 30;
            const mid = a0 + 15;
            const on = shown === s.sign;
            const g = pt(mid, (R_OUT + R_SIGN) / 2);
            const n = pt(mid, R_NUM);
            const r = radius(s.value);
            return (
              <g
                key={s.sign}
                role="button"
                tabIndex={0}
                aria-label={`${s.name}, ${s.dates}: ${num(s.value)} ${s.value === 1 ? one : many}`}
                aria-pressed={picked === s.sign}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setHover(s.sign)}
                onFocus={() => setHover(s.sign)}
                onBlur={() => setHover(null)}
                onClick={() => setPicked((p) => (p === s.sign ? null : s.sign))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPicked((p) => (p === s.sign ? null : s.sign));
                  }
                }}
              >
                <title>{`${s.name} · ${s.dates}${s.current ? " (en curso)" : ""}: ${num(s.value)} ${s.value === 1 ? one : many}`}</title>
                {/* El signo, con el color de su elemento */}
                <path d={wedge(a0, a1, R_SIGN, R_OUT)} fill={s.hue} fillOpacity={on ? 0.42 : s.current ? 0.3 : 0.16} stroke={GOLD} strokeOpacity="0.35" strokeWidth="0.6" />
                <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="17" fill="currentColor" className={on || s.current ? "wheel-strong" : undefined} fillOpacity={on || s.current ? 1 : 0.85}>
                  {glyph(s.glyph)}
                </text>
                {/* Zona que se puede tocar (todo el gajo) */}
                <path d={wedge(a0, a1, R_IN, R_SIGN)} fill="currentColor" fillOpacity={on ? 0.06 : 0} />
                {/* La barra */}
                {s.value > 0 && (
                  <path
                    d={wedge(a0 + 2.4, a1 - 2.4, R_IN + 2, r)}
                    fill={`url(#${id}bar)`}
                    fillOpacity={on ? 1 : s.current ? 0.92 : 0.72}
                    stroke={s.current ? "#F0D9A4" : "none"}
                    strokeWidth="0.8"
                    filter={on ? `url(#${id}glow)` : undefined}
                  />
                )}
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="currentColor" fillOpacity={on ? 1 : s.value ? 0.75 : 0.35} fontWeight={on ? 700 : 500}>
                  {num(s.value)}
                </text>
              </g>
            );
          })}

          {/* Separaciones entre signos */}
          {sectors.map((s) => {
            const a = pt(startDeg(s.sign), R_IN);
            const b = pt(startDeg(s.sign), R_OUT);
            return <line key={s.sign} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GOLD} strokeOpacity="0.28" strokeWidth="0.6" pointerEvents="none" />;
          })}

          {/* Hoy: una marca dorada en el borde, donde va la temporada de ahora */}
          {current && <TodayMark deg={startDeg(current.sign) + 30 * current.progress} />}

          {/* El centro: el total del año o el signo elegido */}
          <circle cx={C} cy={C} r={R_IN - 4} fill="currentColor" fillOpacity="0.04" stroke={GOLD} strokeOpacity="0.6" strokeWidth="0.8" pointerEvents="none" />
          <g pointerEvents="none" textAnchor="middle" fill="currentColor">
            <text x={C} y={C - 22} fontSize="8.5" letterSpacing="1.4" fillOpacity="0.7">
              {focus ? `${glyph(focus.glyph)} ${focus.name.toUpperCase()}` : "ÚLTIMO AÑO"}
            </text>
            <text x={C} y={C + 6} fontSize={big >= 100000 ? 20 : big >= 10000 ? 24 : 30} className="wheel-strong font-serif">
              {num(big)}
            </text>
            <text x={C} y={C + 22} fontSize="8.5" fillOpacity="0.8">
              {big === 1 ? one : many}
            </text>
            <text x={C} y={C + 35} fontSize="7.5" fillOpacity="0.6">
              {focus ? `${focus.dates}${focus.current ? " · en curso" : ""}` : labels[metric]}
            </text>
          </g>
        </svg>
      </div>

      <p className="mt-2 text-center text-xs text-muted">Cada signo es su temporada del último año. Toca uno para ver su cifra en el centro.</p>

      {/* Filtros: qué se cuenta, de dónde llegan y de qué producto */}
      <div className="mt-5 space-y-3">
        <div className="flex justify-center">
          <div role="radiogroup" aria-label="Qué se cuenta" className="inline-flex flex-wrap justify-center gap-1 rounded-[1.4rem] bg-sand p-1 text-sm">
            {(["visitas", "inscripciones", "clics", "newsletter"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metric === m}
                onClick={() => metric !== m && go(m === "newsletter" ? { m, origen: "" } : { m })}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 font-medium transition ${metric === m ? "bg-white shadow-soft" : "text-muted hover:text-ink"}`}
              >
                {labels[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <label className="sr-only" htmlFor={`${id}src`}>De dónde vienen</label>
          <select
            id={`${id}src`}
            className="input !h-10 !w-auto !py-0 text-sm disabled:opacity-50"
            value={source}
            disabled={metric === "newsletter"}
            title={metric === "newsletter" ? "La newsletter no sabe de dónde llegan" : undefined}
            onChange={(e) => go({ origen: e.target.value })}
          >
            <option value="">De todas partes</option>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${id}prod`}>Producto</label>
          <select id={`${id}prod`} className="input !h-10 !w-auto max-w-[16rem] !py-0 text-sm" value={product} onChange={(e) => go({ producto: e.target.value })}>
            <option value="">Todos los productos</option>
            {products.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {metric === "newsletter" && (
          <p className="text-center text-xs text-muted">
            Cuenta a quien confirmó su alta en cada temporada. Con un producto: quien se apuntó al pedirlo gratis o al comprarlo.
          </p>
        )}
      </div>
    </section>
  );
}

/** Las marcas de grado por dentro del anillo de los signos, como en la carta natal. */
function DegreeTicks() {
  let d = "";
  for (let deg = 0; deg < 360; deg += 2) {
    const len = deg % 10 === 0 ? 4 : 2;
    d += `M${f(pt(deg, R_SIGN))}L${f(pt(deg, R_SIGN - len))}`;
  }
  return <path d={d} stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.5" pointerEvents="none" />;
}

/** «Hoy»: un punto dorado en el borde de fuera, con su rayita hasta el anillo. */
function TodayMark({ deg }: { deg: number }) {
  const a = pt(deg, R_SIGN);
  const b = pt(deg, R_OUT + 2);
  return (
    <g pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#F0D9A4" strokeWidth="1.2" />
      <circle cx={b.x} cy={b.y} r="3.2" fill="#F0D9A4" stroke="#A9874A" strokeWidth="0.8">
        <title>Hoy</title>
      </circle>
    </g>
  );
}
