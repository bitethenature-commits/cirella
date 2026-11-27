"use client";

import { useState, type ReactNode } from "react";
import { DIM_CHAKRAS, DIM_COLOR, DIM_FIGURES, DIM_KEYS, DIM_NOTE, DIMENSIONS, SHIFT, SHIFT_KEYS, type DimKey } from "@/components/models/data/dimensions";
import { CHAKRA_INFO, type KChakra } from "@/components/models/data/kundalini";
import { ChakraLotus, FigureDefs, SeatedFigure } from "@/components/models/kundalini-figure";
import type { AstroLayer } from "@/lib/lesson-blocks";
import { C, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { at, circ, line, ngon, poly, starPath, type P } from "./geo";
import { Astrolabe, NIGHT_GOLD, NightChips, NightDefs, NightPanel, STAR, usePrefix } from "./night";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Las dimensiones del ser por partes, de la 3D a la 12D: las diez dimensiones (una figura dentro de otra, como una
 * mandala), el paso de la 3D a la 5D, las dimensiones en los chakras y la figura de cada dimensión.
 */

export type DimLayer = Extract<AstroLayer, `dim-${string}`>;
export const isDimLayer = (l: string): l is DimLayer => l.startsWith("dim-");

const isDim = (k: string): k is DimKey => (DIM_KEYS as readonly string[]).includes(k);

/* ------------------------------------------------------------ piezas */

export function dimKeys(layer: DimLayer): string[] {
  return layer === "dim-shift" ? [...SHIFT_KEYS] : [...DIM_KEYS];
}

export function dimMine(_layer: DimLayer, _ctx: LayerCtx): string[] {
  return [];
}

const CHAKRA_NOTE = "\n\nLos chakras del 8.º al 12.º están por encima de la cabeza (los chakras transpersonales). Las correspondencias cambian según la escuela.";

export function dimPiece(layer: DimLayer, key: string, _ctx: LayerCtx): SystemPiece {
  if (layer === "dim-shift") {
    const t = SHIFT[key as keyof typeof SHIFT] ?? { name: key, kicker: "", meaning: "" };
    return { glyph: "", name: t.name, kicker: t.kicker, meaning: t.meaning, personal: null };
  }
  if (!isDim(key)) return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
  const d = DIMENSIONS[key];
  if (layer === "dim-chakras") {
    const c = DIM_CHAKRAS[key];
    return { glyph: `${key}D`, name: `${key}D · ${c.name}`, kicker: d.short, meaning: c.meaning + CHAKRA_NOTE, personal: null };
  }
  if (layer === "dim-geometry") {
    const f = DIM_FIGURES[key];
    return { glyph: `${key}D`, name: `${key}D · ${f.name}`, kicker: f.kicker, meaning: f.meaning, personal: null };
  }
  return { glyph: `${key}D`, name: d.name, kicker: d.kicker, meaning: `${d.meaning}\n\nSu clave: ${d.key}\n\n${DIM_NOTE}`, personal: null };
}

/** El nombre de cada parte y lo que se cuenta antes de tocar nada (el modelo principal). */
export const DIM_TITLE: Record<DimLayer, string> = {
  "dim-levels": "Las diez dimensiones",
  "dim-shift": "De la 3D a la 5D",
  "dim-chakras": "Las dimensiones en tu cuerpo",
  "dim-geometry": "La forma de cada dimensión",
};
export const DIM_INTRO: Record<DimLayer, string> = {
  "dim-levels":
    "Del cuerpo a la Fuente: diez dimensiones de conciencia, cada una dentro de la siguiente, como las capas de una cebolla de luz. En el centro, la 3D, la materia; en el borde, la 12D, la Fuente. Toca un anillo.",
  "dim-shift":
    "Pasar de la 3D a la 5D no es irse a otro sitio: es cambiar desde dónde vives. Del miedo al amor, del reloj al presente, del control a la confianza, cruzando el puente de la 4D.",
  "dim-chakras":
    "Cada dimensión se abre por un chakra: de la raíz (3D) a la corona (7D) y, por encima de la cabeza, los cinco chakras transpersonales, hasta la Fuente (12D).",
  "dim-geometry":
    "Cada dimensión tiene su forma: el cubo de la materia, el teseracto del tiempo, la merkaba del corazón… hasta el punto en el círculo de la Fuente. Toca una para verla entera.",
};

/* ------------------------------------------------------------ las figuras */

type S = { d: string; w?: number; dash?: string; fill?: boolean; op?: number };

/** Cada dimensión en su anillo de la mandala: una figura dentro de otra, sin cruzarse. */
const RING: Record<DimKey, [number, number]> = {
  "3": [0, 22],
  "4": [22, 38],
  "5": [38, 62],
  "6": [62, 90],
  "7": [90, 106],
  "8": [106, 118],
  "9": [118, 130],
  "10": [130, 141],
  "11": [141, 152],
  "12": [152, 166],
};

const dots = (pts: P[], r = 2.3): S[] => pts.map((q) => ({ d: circ(q[0], q[1], r), fill: true, w: 0.5 }));
/** El cubo visto desde una esquina: el hexágono y la «Y» de sus tres caras. */
const cube = (r: number, cx = C, cy = C): S[] => {
  const h = ngon(6, r, -90, cx, cy);
  return [{ d: poly(h) }, { d: line([cx, cy], h[1]) }, { d: line([cx, cy], h[3]) }, { d: line([cx, cy], h[5]) }];
};
/** El teseracto: un cubo dentro de otro, con las esquinas unidas. */
const tesseract = (r: number, cx = C, cy = C): S[] => {
  const o = ngon(6, r, -90, cx, cy);
  const i = ngon(6, r / 2, -90, cx, cy);
  return [{ d: poly(o) }, ...cube(r / 2, cx, cy), ...o.map((q, k) => ({ d: line(q, i[k]), w: 0.8 }))];
};

function ringShapes(k: DimKey): S[] {
  switch (k) {
    case "3":
      return cube(18);
    case "4": {
      const o = ngon(6, 34);
      const i = ngon(6, 18);
      return [{ d: poly(o) }, ...o.map((q, j) => ({ d: line(q, i[j]), w: 0.8 }))];
    }
    case "5":
      // Su hexágono de dentro es justo el teseracto: la 5D nace de la 4D.
      return [{ d: starPath(6, 2, 34 * Math.sqrt(3), -60) }];
    case "6":
      return Array.from({ length: 24 }, (_, j) => ({ d: circ(...at(76, j * 15), 11), w: 0.7 }));
    case "12":
      return [{ d: circ(C, C, 157) }, ...dots(ngon(12, 157), 2.6), { d: circ(C, C, 2.2), fill: true }];
    default: {
      const n = Number(k);
      const r = (RING[k][0] + RING[k][1]) / 2 + 3;
      return [{ d: poly(ngon(n, r)) }, ...dots(ngon(n, r))];
    }
  }
}

/** La figura grande de cada dimensión (la parte «La forma de cada dimensión»). */
function bigShapes(k: DimKey): S[] {
  const R = 118;
  switch (k) {
    case "3": {
      const h = ngon(6, R);
      return [...cube(R), ...[0, 2, 4].map((j) => ({ d: line([C, C], h[j]), dash: "3 5", op: 0.4, w: 0.8 }))];
    }
    case "4":
      return tesseract(R);
    case "5": {
      const pts = ngon(6, R, -90);
      return [{ d: starPath(6, 2, R, -90), w: 1.2 }, { d: poly(ngon(6, R / Math.sqrt(3), -60)), op: 0.6 }, ...[0, 1, 2].map((j) => ({ d: line(pts[j], pts[j + 3]), op: 0.35, w: 0.7 })), { d: circ(C, C, R), op: 0.3, w: 0.6 }];
    }
    case "6": {
      const r = R / 3;
      const out: S[] = [{ d: circ(C, C, r) }];
      for (let i = 0; i < 6; i++) out.push({ d: circ(...at(r, -90 + i * 60), r) });
      for (let i = 0; i < 6; i++) out.push({ d: circ(...at(2 * r, -90 + i * 60), r) }, { d: circ(...at(r * Math.sqrt(3), -60 + i * 60), r) });
      out.push({ d: circ(C, C, 3 * r), w: 1.3 });
      return out;
    }
    case "7":
      return [{ d: circ(C, C, R), op: 0.35, w: 0.7 }, { d: poly(ngon(7, R)), op: 0.6 }, { d: starPath(7, 3, R), w: 1.2 }, ...dots(ngon(7, R), 3.2)];
    case "8":
      return [{ d: circ(C, C, R), op: 0.35, w: 0.7 }, { d: starPath(8, 2, R, -90), op: 0.6 }, { d: starPath(8, 3, R, -90), w: 1.2 }, ...dots(ngon(8, R), 3)];
    case "9":
      return [{ d: circ(C, C, R), op: 0.35, w: 0.7 }, { d: starPath(9, 2, R), op: 0.5 }, { d: starPath(9, 4, R), w: 1.2 }, ...dots(ngon(9, R), 3)];
    case "10":
      return [{ d: circ(C, C, R), op: 0.35, w: 0.7 }, { d: poly(ngon(10, R)), op: 0.5 }, { d: starPath(10, 3, R), w: 1.2 }, ...dots(ngon(10, R), 3)];
    case "11": {
      const rf = 22;
      const pts: P[] = [[C, C], ...ngon(6, 2 * rf), ...ngon(6, 4 * rf)];
      const out: S[] = pts.map((q) => ({ d: circ(q[0], q[1], rf), w: 0.9 }));
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) out.push({ d: line(pts[i], pts[j]), w: 0.5, op: 0.7 });
      return out;
    }
    case "12":
      return [{ d: circ(C, C, R), w: 1.3 }, { d: circ(C, C, R * 0.62), op: 0.35, w: 0.6 }, { d: circ(C, C, R * 0.3), op: 0.25, w: 0.6 }, ...dots(ngon(12, R), 3), { d: circ(C, C, 5), fill: true }];
  }
}

/** Pinta unos trazos de un color, que se dibujan solos (y con halo si están elegidos). */
function Strokes({ list, color, p, on, dim, delay = 0, stagger = 0.03 }: { list: S[]; color: string; p: string; on: boolean; dim: boolean; delay?: number; stagger?: number }) {
  const base = dim ? 0.22 : on ? 1 : 0.78;
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {on && (
        <g filter={`url(#${p}soft)`} opacity="0.6">
          {list.map((s, i) => (
            <path key={`g${i}`} d={s.d} stroke={color} strokeWidth={(s.w ?? 1) * 3.4} fill={s.fill ? color : "none"} className="geo-fade" />
          ))}
        </g>
      )}
      {list.map((s, i) => (
        <path
          key={i}
          d={s.d}
          pathLength={1}
          className="geo-draw"
          style={{ animationDelay: `${(delay + i * stagger).toFixed(2)}s` }}
          stroke={color}
          strokeOpacity={base * (s.op ?? 1)}
          strokeWidth={(s.w ?? 1) * (on ? 1.3 : 0.9)}
          strokeDasharray={s.dash}
          fill={s.fill ? color : "none"}
          fillOpacity={s.fill ? base : undefined}
        />
      ))}
    </g>
  );
}

/** La mandala de las diez dimensiones: cada una en su anillo, y cada anillo se puede tocar. */
function Mandala({ p, selected, tap, label }: { p: string; selected: string; tap: Tap; label: (k: DimKey) => string }) {
  const t = useT();
  const sel = isDim(selected) ? selected : null;
  const outer = [...DIM_KEYS].reverse();
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[34rem] select-none" role="group" aria-label={t("Las dimensiones del ser")}>
      <NightDefs p={p} />
      <circle cx={C} cy={C} r="166" fill={`url(#${p}heart)`} />
      {/* Del centro hacia fuera, cada dimensión se dibuja un poco después de la anterior. */}
      {DIM_KEYS.map((k, i) => (
        <Strokes key={`${k}-${sel ?? ""}`} list={ringShapes(k)} color={DIM_COLOR[k]} p={p} on={sel === k} dim={!!sel && sel !== k} delay={sel ? 0 : i * 0.22} stagger={k === "6" ? 0.02 : 0.05} />
      ))}
      {/* Los anillos que se tocan (encima, invisibles). */}
      {outer.map((k) => {
        const [a, b] = RING[k];
        return k === "3" ? (
          <circle key={k} cx={C} cy={C} r={b} fill="transparent" {...tap(k, label(k))} />
        ) : (
          <circle key={k} cx={C} cy={C} r={(a + b) / 2} fill="none" stroke="transparent" strokeWidth={b - a} pointerEvents="stroke" {...tap(k, label(k))} />
        );
      })}
    </svg>
  );
}

/** La figura de una dimensión, grande. */
function BigFigure({ p, k }: { p: string; k: DimKey }) {
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[34rem] select-none" role="img" aria-label={DIM_FIGURES[k].name}>
      <NightDefs p={p} />
      <Astrolabe p={p} />
      <Strokes key={k} list={bigShapes(k)} color={DIM_COLOR[k]} p={p} on dim={false} stagger={k === "11" ? 0.012 : 0.06} />
      <text x={C} y={318} textAnchor="middle" fontSize="12" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={STAR} fillOpacity="0.8" className="geo-fade" stroke="#0B0B0D" strokeWidth="3" paintOrder="stroke">
        <Tr s={DIM_FIGURES[k].name} />
      </text>
    </svg>
  );
}

/** El paso de la 3D a la 5D: tres esferas, la 4D en medio como puente, y la flecha de lo uno a lo otro. */
function Shift({ p, selected, tap }: { p: string; selected: string; tap: Tap }) {
  const t = SHIFT[selected as keyof typeof SHIFT];
  const pair = !!t?.from;
  const spheres: { k: DimKey; x: number; r: number; fig: S[] }[] = [
    { k: "3", x: 66, r: 44, fig: cube(22, 66, 110) },
    { k: "4", x: 170, r: 36, fig: tesseract(22, 170, 110) },
    { k: "5", x: 274, r: 44, fig: [{ d: starPath(6, 2, 26, -90, 274, 110), w: 1.1 }, { d: poly(ngon(6, 26 / Math.sqrt(3), -60, 274, 110)), op: 0.5 }] },
  ];
  const lit = (k: DimKey) => (selected === "bridge" ? k === "4" : selected === "signs" ? k === "5" : pair ? k !== "4" : false);
  const dim = (k: DimKey) => !!selected && !lit(k);
  return (
    <svg viewBox="0 0 340 260" className="mx-auto block h-auto w-full max-w-[34rem] select-none" role="group" aria-label="De la 3D a la 5D">
      <NightDefs p={p} />
      <radialGradient id={`${p}orb`} cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#2A2830" />
        <stop offset="100%" stopColor="#0F0F11" />
      </radialGradient>
      {/* El hilo que une las tres. */}
      <path d={`M110 110H134M206 110H230`} stroke={NIGHT_GOLD} strokeOpacity="0.35" strokeDasharray="1.5 4" strokeLinecap="round" />
      {spheres.map((s) => {
        const on = lit(s.k);
        return (
          <g key={s.k} {...(s.k === "4" ? tap("bridge", SHIFT.bridge.name) : {})}>
            {on && <circle cx={s.x} cy={110} r={s.r + 10} fill={DIM_COLOR[s.k]} opacity="0.28" filter={`url(#${p}blur)`} />}
            <circle cx={s.x} cy={110} r={s.r} fill={`url(#${p}orb)`} stroke={DIM_COLOR[s.k]} strokeOpacity={dim(s.k) ? 0.25 : 0.8} strokeWidth={on ? 1.4 : 0.9} />
            <circle cx={s.x} cy={110} r={s.r} fill={`url(#${p}gloss)`} opacity="0.18" pointerEvents="none" />
            <Strokes key={`${s.k}-${selected}`} list={s.fig} color={DIM_COLOR[s.k]} p={p} on={on} dim={dim(s.k)} stagger={0.05} />
            <text x={s.x} y={52} textAnchor="middle" fontSize="13" fontFamily="Georgia, 'Times New Roman', serif" fill={DIM_COLOR[s.k]} fillOpacity={dim(s.k) ? 0.4 : 1} pointerEvents="none">
              <Tr s={s.k} />D
            </text>
          </g>
        );
      })}
      {selected === "signs" &&
        [
          [232, 70],
          [318, 82],
          [312, 150],
          [240, 156],
          [274, 56],
        ].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y - 6}L${x + 1.5} ${y - 1.5}L${x + 6} ${y}L${x + 1.5} ${y + 1.5}L${x} ${y + 6}L${x - 1.5} ${y + 1.5}L${x - 6} ${y}L${x - 1.5} ${y - 1.5}Z`} fill="#F7E2AE" className="geo-fade" style={{ animationDelay: `${i * 0.15}s` }} pointerEvents="none" />
        ))}
      {pair ? (
        <g key={selected} pointerEvents="none">
          <text x={66} y={182} textAnchor="middle" fontSize="15" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={STAR} fillOpacity="0.75" className="geo-fade">
            <Tr s={t.from} />
          </text>
          <text x={274} y={182} textAnchor="middle" fontSize="15" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill="#F7E2AE" className="geo-fade" style={{ animationDelay: ".6s" }}>
            <Tr s={t.to} />
          </text>
          <path d="M70 204Q170 244 270 204" fill="none" stroke="#F7E2AE" strokeWidth="1.2" pathLength={1} className="geo-draw" />
          <path d="M262.1 198.9L270 204L264.6 211" fill="none" stroke="#F7E2AE" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="geo-fade" style={{ animationDelay: ".9s" }} />
        </g>
      ) : (
        <text x={C} y={196} textAnchor="middle" fontSize="12" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={STAR} fillOpacity="0.6" pointerEvents="none">
          {selected === "bridge" ? <Tr s={"el puente"} /> : selected === "signs" ? <Tr s={"lo que se nota"} /> : <Tr s={"de la materia al amor, cruzando el puente"} />}
        </text>
      )}
    </svg>
  );
}

/** Las dimensiones en el cuerpo: los siete chakras en la columna y, sobre la cabeza, del 8.º al 12.º. */
const Y0 = 110;
const SC = 0.85;
const yOf = (y: number) => Y0 + SC * y;
const TRANS: Record<string, number> = { t8: 118, t9: 96, t10: 74, t11: 52, t12: 30 };
const chakraY = (c: string) => (c in TRANS ? TRANS[c] : yOf(CHAKRA_INFO[c as KChakra].y));

function ChakraColumn({ p, selected, tap, label }: { p: string; selected: string; tap: Tap; label: (k: DimKey) => string }) {
  const sel = isDim(selected) ? selected : null;
  const litChakras = new Set(sel ? DIM_CHAKRAS[sel].chakras : []);
  return (
    <svg viewBox="0 0 340 392" className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label="Las dimensiones en los chakras">
      <NightDefs p={p} />
      <defs>
        <FigureDefs p={p} />
      </defs>
      <g transform={`translate(${C} ${Y0}) scale(${SC}) translate(${-C} 0)`}>
        <SeatedFigure p={p} />
      </g>
      {/* La columna de luz y, sobre la cabeza, el hilo hasta la Fuente. */}
      <line x1={C} y1={yOf(262)} x2={C} y2={yOf(36)} stroke={`url(#${p}spine)`} strokeWidth="6" opacity="0.22" filter={`url(#${p}hair)`} />
      <line x1={C} y1={yOf(262)} x2={C} y2={yOf(36)} stroke={NIGHT_GOLD} strokeOpacity="0.6" strokeWidth="0.9" />
      <line x1={C} y1={yOf(36) - 10} x2={C} y2={TRANS.t12} stroke="#F4F1EA" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="1.5 4" strokeLinecap="round" />
      {(["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"] as const).map((k) => (
        <ChakraLotus key={k} k={k} y={yOf(CHAKRA_INFO[k].y)} on={litChakras.has(k)} big={litChakras.has(k)} p={p} />
      ))}
      {Object.entries(TRANS).map(([t, y], i) => {
        const k = String(8 + i) as DimKey;
        const on = litChakras.has(t);
        return (
          <g key={t} pointerEvents="none">
            {on && <circle cx={C} cy={y} r="14" fill={DIM_COLOR[k]} opacity="0.5" filter={`url(#${p}glow)`} />}
            <path d={`M${C} ${y - 7}L${C + 1.8} ${y - 1.8}L${C + 7} ${y}L${C + 1.8} ${y + 1.8}L${C} ${y + 7}L${C - 1.8} ${y + 1.8}L${C - 7} ${y}L${C - 1.8} ${y - 1.8}Z`} fill={DIM_COLOR[k]} fillOpacity={on ? 1 : 0.6} />
            <circle cx={C} cy={y} r="1.6" fill="#FFFFFF" opacity={on ? 0.9 : 0.5} />
          </g>
        );
      })}
      {/* Las etiquetas de la izquierda: cada dimensión, a la altura de su chakra. */}
      {DIM_KEYS.map((k) => {
        const ys = DIM_CHAKRAS[k].chakras.map(chakraY);
        const y = ys.reduce((a, b) => a + b, 0) / ys.length;
        const on = sel === k;
        return (
          <g key={k} {...tap(k, label(k))}>
            <rect x="4" y={y - 11} width="44" height="22" rx="11" fill={on ? "rgb(233 204 142 / .12)" : "transparent"} stroke={on ? DIM_COLOR[k] : "none"} strokeOpacity="0.6" />
            <text x="26" y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={on ? 12.5 : 11} fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={on ? DIM_COLOR[k] : STAR} fillOpacity={on ? 1 : 0.65} pointerEvents="none">
              <Tr s={k} />D
            </text>
            {on && ys.map((cy, j) => <path key={j} d={`M48 ${y}C${(48 + C) / 2} ${y} ${(48 + C) / 2} ${cy} ${C - 16} ${cy}`} fill="none" stroke={DIM_COLOR[k]} strokeOpacity="0.55" strokeWidth="0.8" pathLength={1} className="geo-draw" pointerEvents="none" />)}
            {DIM_CHAKRAS[k].chakras.map((c) => (
              <circle key={c} cx={C} cy={chakraY(c)} r="13" fill="transparent" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ el dibujo */

export function DimDiagram({ layer, selected, keys, tap }: DiagramProps & { layer: DimLayer }) {
  const p = usePrefix();
  const [run, setRun] = useState(0);
  const label = (k: DimKey) => `${k}D · ${DIMENSIONS[k].short}`;
  let body: ReactNode = null;
  switch (layer) {
    case "dim-levels":
      body = <Mandala p={p} selected={selected} tap={tap} label={label} />;
      break;
    case "dim-geometry":
      body = isDim(selected) ? <BigFigure p={p} k={selected} /> : <Mandala p={p} selected="" tap={tap} label={(k) => `${k}D · ${DIM_FIGURES[k].name}`} />;
      break;
    case "dim-shift":
      body = <Shift p={p} selected={selected} tap={tap} />;
      break;
    case "dim-chakras":
      body = <ChakraColumn p={p} selected={selected} tap={tap} label={(k) => `${k}D · ${DIM_CHAKRAS[k].name}`} />;
      break;
  }
  const chips =
    layer === "dim-shift"
      ? keys.map((k) => ({ key: k, label: SHIFT[k as keyof typeof SHIFT]?.name ?? k }))
      : layer === "dim-chakras"
        ? null
        : keys.map((k) => ({ key: k, label: layer === "dim-geometry" && isDim(k) ? `${k}D · ${DIM_FIGURES[k].name}` : `${k}D` }));
  return (
    <NightPanel>
      <div key={run}>{body}</div>
      {chips && <NightChips items={chips} selected={selected} mine={new Set()} tap={tap} />}
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          data-model-keep=""
          onClick={() => setRun((r) => r + 1)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-4 text-[0.66rem] uppercase tracking-[0.18em] transition hover:opacity-100"
          style={{ borderColor: "rgb(233 204 142 / .3)", color: NIGHT_GOLD, opacity: 0.85 }}
        ><Tr s={"↻ Volver a dibujar"} /></button>
      </div>
    </NightPanel>
  );
}
