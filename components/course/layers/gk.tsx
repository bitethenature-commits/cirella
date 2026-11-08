"use client";

import { useId, useState } from "react";
import { GK_CENTER, GK_VIEWBOX, KEY_BY_N, PATH_EDGES, SEQUENCES, SEQUENCE_BY_ID, SPHERE_BY_ID, SPHERES, inSequence, type SequenceId, type Sphere } from "@/components/models/data/gene-keys";
import { GATE_BY_N, CENTRE_BY_ID } from "@/components/models/data/human-design";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { listEs, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { GK_LINES } from "./texts";
import { KeyGrid } from "./key-grid";

/**
 * Las capas de las Gene Keys: las esferas del Camino Dorado (con los números de la alumna dentro), las tres
 * secuencias por colores (Activación verde, Venus rojo, Perla azul), las 64 llaves, el espectro sombra-don-
 * siddhi de cualquier esfera y las 6 líneas.
 */

export type GkLayer = Extract<AstroLayer, `gk-${string}`>;

/** Las 64 puertas en el orden de la rueda: la compañera de programación de una llave es la de enfrente. */
export const WHEEL = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];
export const partnerOf = (n: number) => WHEEL[(WHEEL.indexOf(n) + 32) % 64];

export const SPECTRUM = {
  shadow: { name: "Sombra", kicker: "La frecuencia del miedo", meaning: "La forma reactiva de la llave: lo que aparece cuando vives desde el miedo o el piloto automático. No es un defecto: es la puerta de entrada." },
  gift: { name: "Don", kicker: "La frecuencia del genio", meaning: "La misma energía, vivida con aceptación: tu talento natural. Aparece cuando contemplas la sombra sin huir de ella." },
  siddhi: { name: "Siddhi", kicker: "La frecuencia de la gracia", meaning: "La expresión más alta, un estado que no se fuerza: llega cuando ya no hay nada que defender." },
} as const;

export const SHORT: Record<SequenceId, string> = { activation: "Activación", venus: "Venus", pearl: "Perla" };

/** El nombre de una esfera dentro de una secuencia (la Obra de vida es la Marca en la Perla…). */
export const nameIn = (s: Sphere, seq: string | null) => (seq && s.sequence !== seq && s.also?.sequence === seq ? s.also.name : s.name);

/** En qué esferas de la alumna está cada llave. */
function spheresWith(c: LayerCtx["c"], n: number) {
  if (!c) return [];
  return SPHERES.filter((s) => c.geneKeys.keys[s.id] === n);
}

/** «21:gift»: la llave 21, su don. */
const FREQS = ["shadow", "gift", "siddhi"] as const;
type Freq = (typeof FREQS)[number];
export const SPECTRUM_KEYS = Array.from({ length: 64 }, (_, i) => i + 1).flatMap((n) => FREQS.map((f) => `${n}:${f}`));
const parseFreq = (key: string, fallback: number) => (key.includes(":") ? { n: Number(key.split(":")[0]), f: key.split(":")[1] as Freq } : { n: fallback, f: key as Freq });
/** Sus llaves, en el orden de las esferas (la Obra de vida primero). */
const myKeys = (c: LayerCtx["c"]) => (c ? [...new Set(SPHERES.map((s) => c.geneKeys.keys[s.id]))] : []);

export function gkKeys(layer: GkLayer, { option, c }: LayerCtx): string[] {
  if (layer === "gk-spectrum") return SPECTRUM_KEYS;
  const all = LAYER_KEYS[layer];
  if (layer === "gk-spheres" && option && option !== "all") {
    // En el orden del recorrido de esa secuencia (la Atracción abre Venus; el Propósito, que cierra la Activación, va antes).
    const step = (s: Sphere) => (s.sequence === option ? s.step : (s.also?.step ?? 0));
    return SPHERES.filter((s) => inSequence(s, option as SequenceId))
      .sort((a, b) => step(a) - step(b))
      .map((s) => s.id);
  }
  if (layer === "gk-keys" && option === "mine" && c) {
    const mine = new Set(Object.values(c.geneKeys.keys));
    return all.filter((k) => mine.has(Number(k)));
  }
  return all;
}

export function gkMine(layer: GkLayer, { c }: LayerCtx): string[] {
  if (!c) return [];
  if (layer === "gk-keys") return [...new Set(Object.values(c.geneKeys.keys))].map(String);
  if (layer === "gk-lines") return [...new Set(Object.values(c.geneKeys.lines))].map(String);
  if (layer === "gk-spectrum") return myKeys(c).map((n) => `${n}:shadow`);
  return [];
}

export function gkPiece(layer: GkLayer, key: string, { option, c, notes }: LayerCtx): SystemPiece {
  switch (layer) {
    case "gk-spheres": {
      const s = SPHERE_BY_ID[key];
      const seqId = option && option !== "all" ? (option as SequenceId) : s.sequence;
      const role = s.sequence !== seqId && s.also?.sequence === seqId ? s.also : null;
      const k = c ? KEY_BY_N.get(c.geneKeys.keys[key]) : null;
      return {
        glyph: k ? String(k.n) : "",
        name: role ? `${role.name} (${s.name})` : s.name,
        kicker: `${SEQUENCE_BY_ID[seqId].name} · ${s.source}`,
        meaning: `${role?.meaning ?? s.meaning}\n\nContempla: ${role?.contemplation ?? s.contemplation}`,
        personal: k ? `Tu llave ${k.n}.${c!.geneKeys.lines[key]}: de ${k.shadow} (sombra) a ${k.gift} (don) y ${k.siddhi} (siddhi). Línea ${c!.geneKeys.lines[key]}: ${GK_LINES[c!.geneKeys.lines[key] - 1].name.toLowerCase()}.` : null,
      };
    }
    case "gk-sequences": {
      const seq = SEQUENCE_BY_ID[key as SequenceId];
      const spheres = SPHERES.filter((s) => inSequence(s, seq.id));
      return {
        glyph: "",
        name: seq.name,
        kicker: `${seq.subtitle} · ${seq.question}`,
        meaning: `${seq.description}\n\nSus esferas: ${listEs(spheres.map((s) => nameIn(s, seq.id)))}.`,
        personal: c ? `Tus llaves aquí: ${spheres.map((s) => `${nameIn(s, seq.id)} ${c.geneKeys.keys[s.id]}.${c.geneKeys.lines[s.id]}`).join(" · ")}.` : null,
      };
    }
    case "gk-keys": {
      const n = Number(key);
      const k = KEY_BY_N.get(n)!;
      const p = KEY_BY_N.get(partnerOf(n))!;
      const gate = GATE_BY_N.get(n);
      const where = spheresWith(c, n);
      return {
        glyph: String(n),
        name: `Llave ${n} · ${k.gift}`,
        kicker: `${k.shadow} → ${k.gift} → ${k.siddhi}`,
        meaning: `Sombra: ${k.shadow}. Don: ${k.gift}. Siddhi: ${k.siddhi}.\n\nSu compañera de programación es la llave ${p.n} (de ${p.shadow} a ${p.gift} y ${p.siddhi}): están enfrente en la rueda y se equilibran. Contemplar una ayuda a abrir la otra.${gate ? `\n\nEn Human Design es la puerta ${n}, ${gate.name}, en el centro ${CENTRE_BY_ID[gate.centre].name}.` : ""}`,
        personal: c ? (where.length ? `Está en tu ${listEs(where.map((s) => `${s.name} (línea ${c.geneKeys.lines[s.id]})`))}.` : "No está en tu perfil hologenético.") : null,
      };
    }
    case "gk-spectrum": {
      const { n, f } = parseFreq(key, myKeys(c)[0] ?? 1);
      const sp = SPECTRUM[f];
      const k = KEY_BY_N.get(n)!;
      const where = spheresWith(c, n);
      const note = notes?.[f]?.trim();
      return {
        glyph: String(n),
        name: `${sp.name} de la llave ${n}: ${k[f]}`,
        kicker: sp.kicker,
        meaning: `${sp.meaning}\n\nEn la llave ${n}, la escalera sube así: de ${k.shadow} (sombra) a ${k.gift} (don) y a ${k.siddhi} (siddhi). ${f === "shadow" ? `Aquí la energía es ${k.shadow.toLowerCase()}: no es un error, es el punto de partida.` : f === "gift" ? `Cuando contemplas tu ${k.shadow.toLowerCase()} sin huir, aparece ${k.gift.toLowerCase()}.` : `Más allá del esfuerzo, ${k.gift.toLowerCase()} se vuelve ${k.siddhi.toLowerCase()}.`}${note ? `\n\n${note}` : ""}`,
        personal: c ? (where.length ? `Es tu llave de ${listEs(where.map((s) => s.name))}.` : "No está en tu perfil hologenético.") : null,
      };
    }
    case "gk-lines": {
      const n = Number(key);
      const l = GK_LINES[n - 1];
      const where = c ? SPHERES.filter((s) => c.geneKeys.lines[s.id] === n) : [];
      return {
        glyph: String(n),
        name: `Línea ${n} · ${l.name}`,
        kicker: "Cómo vives la llave en esa esfera",
        meaning: l.meaning,
        personal: c ? (where.length ? `La tienen tu ${listEs(where.map((s) => `${s.name} (${c.geneKeys.keys[s.id]}.${n})`))}.` : "Ninguna de tus esferas tiene esta línea.") : null,
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* -------------------------------------------------------------------------- *
 *  Dibujos — como el modelo de la web: cielo de noche, la flor de la vida muy tenue y esferas de cristal
 *  del color de su secuencia (las de dos secuencias, con los dos colores), con brillo y halo.
 * -------------------------------------------------------------------------- */

/** Los tres colores de la carta: «line» para caminos; light/base/deep para el cristal de la esfera. */
export const TONE: Record<SequenceId, { line: string; light: string; base: string; deep: string; glow: string }> = {
  activation: { line: "#7DB08A", light: "#93C79E", base: "#5A9566", deep: "#284D31", glow: "#C3E6CA" },
  venus: { line: "#CF6F66", light: "#E08A82", base: "#B54E49", deep: "#561E1F", glow: "#F2C2BB" },
  pearl: { line: "#6F98D0", light: "#93B6EC", base: "#5482C8", deep: "#213A6E", glow: "#C3D6F2" },
};
/** Las esferas de dos secuencias pasan de un color al otro, como en la carta. */
const BLEND: Record<string, { from: SequenceId; to: SequenceId; x1: number; y1: number; x2: number; y2: number }> = {
  lifework: { from: "activation", to: "pearl", x1: 0.3, y1: 0, x2: 0.7, y2: 1 },
  core: { from: "pearl", to: "venus", x1: 1, y1: 0, x2: 0, y2: 1 },
  purpose: { from: "activation", to: "venus", x1: 0, y1: 0, x2: 1, y2: 1 },
};
const NIGHT = "#100E26";
const STAR = "#FBF6EC";

/** Los degradados comunes (con el prefijo de cada dibujo: puede haber varios en una lección). */
function GkDefs({ p }: { p: string }) {
  return (
    <defs>
      {SPHERES.map((s) => {
        const b = BLEND[s.id] ?? { from: s.sequence, to: s.sequence, x1: 0.3, y1: 0, x2: 0.7, y2: 1 };
        return (
          <linearGradient key={s.id} id={`${p}f-${s.id}`} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}>
            <stop offset="0%" stopColor={TONE[b.from].light} />
            <stop offset="35%" stopColor={TONE[b.from].base} />
            <stop offset="65%" stopColor={TONE[b.to].base} />
            <stop offset="100%" stopColor={TONE[b.to].deep} />
          </linearGradient>
        );
      })}
      {SEQUENCES.map((s) => (
        <linearGradient key={s.id} id={`${p}q-${s.id}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={TONE[s.id].light} />
          <stop offset="50%" stopColor={TONE[s.id].base} />
          <stop offset="100%" stopColor={TONE[s.id].deep} />
        </linearGradient>
      ))}
      {SEQUENCES.map((s) => (
        <radialGradient key={s.id} id={`${p}h-${s.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor={TONE[s.id].light} stopOpacity="0.55" />
          <stop offset="100%" stopColor={TONE[s.id].light} stopOpacity="0" />
        </radialGradient>
      ))}
      <radialGradient id={`${p}gloss`} cx="36%" cy="26%" r="62%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.62" />
        <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}shade`} cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
      </radialGradient>
      <radialGradient id={`${p}sky`} cx="50%" cy="42%" r="70%">
        <stop offset="0%" stopColor="#2A2552" />
        <stop offset="55%" stopColor="#17153A" />
        <stop offset="100%" stopColor={NIGHT} />
      </radialGradient>
      <radialGradient id={`${p}goldglow`} cx="50%" cy="50%" r="50%">
        <stop offset="35%" stopColor="#E9CC8E" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#E9CC8E" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${p}gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F0D9A4" />
        <stop offset="50%" stopColor="#C8A86E" />
        <stop offset="100%" stopColor="#8E6D35" />
      </linearGradient>
      <filter id={`${p}blur`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>
  );
}

const usePrefix = () => useId().replace(/[^a-zA-Z0-9]/g, "");

/** La flor de la vida, muy tenue, sobre el cielo. */
function Flower({ cx, cy, r, reach, opacity = 0.1 }: { cx: number; cy: number; r: number; reach: number; opacity?: number }) {
  const pts: { x: number; y: number }[] = [];
  const rows = Math.ceil(reach / (r * 0.866)) + 1;
  for (let j = -rows; j <= rows; j++)
    for (let i = -rows; i <= rows; i++) {
      const x = cx + (i + (j % 2 ? 0.5 : 0)) * r;
      const y = cy + j * r * 0.866;
      if (Math.hypot(x - cx, y - cy) <= reach) pts.push({ x, y });
    }
  return (
    <g fill="none" stroke={STAR} strokeWidth="1" opacity={opacity} pointerEvents="none">
      {pts.map((q, i) => (
        <circle key={i} cx={q.x} cy={q.y} r={r} />
      ))}
    </g>
  );
}

/** Estrellas fijas (siempre las mismas) para el fondo de los dibujos. */
function Stars({ w, h, n, x0 = 0, y0 = 0 }: { w: number; h: number; n: number; x0?: number; y0?: number }) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12345.6789;
    return { x: x0 + (a - Math.floor(a)) * w, y: y0 + (b - Math.floor(b)) * h, r: 0.5 + ((i * 7) % 5) * 0.22 };
  });
  return (
    <g fill={STAR} pointerEvents="none">
      {pts.map((q, i) => (
        <circle key={i} cx={q.x} cy={q.y} r={q.r} opacity={0.25 + ((i * 13) % 7) * 0.08} />
      ))}
    </g>
  );
}

/** Las esferas, con las tres secuencias para elegir dentro del modelo: todas o solo una (las demás, apagadas). */
function SpheresBySequence({ c, selected, tap }: { c: LayerCtx["c"]; selected: string; tap: DiagramProps["tap"] }) {
  const [seq, setSeq] = useState<SequenceId | null>(null);
  const lit = (s: Sphere) => !seq || inSequence(s, seq);
  const chip = (on: boolean) => ({ borderColor: on ? "#F0D9A4" : "rgb(255 255 255 / .16)", background: on ? "rgb(233 204 142 / .2)" : "rgb(255 255 255 / .05)", color: STAR });
  return (
    <NightPanel>
      <div className="mb-1 flex flex-wrap justify-center gap-1.5 pt-1">
        <button type="button" onClick={() => setSeq(null)} className="rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold" style={chip(!seq)}>
          Todas
        </button>
        {SEQUENCES.map((q) => (
          <button key={q.id} type="button" onClick={() => setSeq(q.id)} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold" style={chip(seq === q.id)}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[q.id].base }} />
            {SHORT[q.id]}
          </button>
        ))}
      </div>
      <GoldenPath c={c} lit={lit} selected={(s) => s.id === selected} onSphere={(s) => tap(s.id, nameIn(s, seq))} />
    </NightPanel>
  );
}

/** El Camino Dorado: los caminos en el color de su secuencia y cada esfera de cristal con su llave dentro. */
export function GoldenPath({ c, lit, selected, onSphere }: { c: LayerCtx["c"]; lit: (s: Sphere) => boolean; selected: (s: Sphere) => boolean; onSphere: (s: Sphere) => Record<string, unknown> }) {
  const p = usePrefix();
  const pos = (id: string) => SPHERE_BY_ID[id];
  const R = 38;
  return (
    <svg viewBox={`${GK_VIEWBOX.x} ${GK_VIEWBOX.y - 10} ${GK_VIEWBOX.w} ${GK_VIEWBOX.h + 20}`} className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label="El Camino Dorado">
      <GkDefs p={p} />
      <Flower cx={GK_CENTER.x} cy={GK_CENTER.y} r={58} reach={330} opacity={0.08} />
      <g strokeLinecap="round">
        {PATH_EDGES.map((e, i) => {
          const on = lit(pos(e.from)) && lit(pos(e.to));
          const touched = selected(pos(e.from)) || selected(pos(e.to));
          const common = { x1: pos(e.from).x, y1: pos(e.from).y, x2: pos(e.to).x, y2: pos(e.to).y, stroke: TONE[e.sequence].line };
          return (
            <g key={i} opacity={on ? 1 : 0.14}>
              {on && <line {...common} strokeWidth={touched ? 12 : 9} strokeOpacity="0.18" filter={`url(#${p}blur)`} />}
              <line {...common} strokeWidth={touched ? 4 : 2.6} strokeDasharray={e.dashed ? "9 8" : undefined} />
            </g>
          );
        })}
      </g>
      {SPHERES.map((s) => {
        const on = selected(s);
        const isLit = lit(s);
        const r = on ? R + 5 : R;
        const k = c?.geneKeys.keys[s.id];
        return (
          <g key={s.id} {...onSphere(s)} opacity={isLit ? 1 : 0.28} style={{ transition: "opacity 400ms", ...(onSphere(s).style as object) }}>
            <circle cx={s.x} cy={s.y} r={R + 6} fill={NIGHT} />
            {on && <circle cx={s.x} cy={s.y} r={R * 2.1} fill={`url(#${p}h-${s.sequence})`} />}
            <circle cx={s.x} cy={s.y} r={r} fill={`url(#${p}f-${s.id})`} />
            <circle cx={s.x} cy={s.y} r={r} fill={`url(#${p}shade)`} />
            <circle cx={s.x} cy={s.y} r={r} fill={`url(#${p}gloss)`} stroke={on ? TONE[s.sequence].glow : "rgba(255,255,255,0.22)"} strokeWidth={on ? 3 : 1} />
            {k ? (
              <>
                <text x={s.x} y={s.y - 13} textAnchor="middle" dominantBaseline="central" fontSize={s.name.length > 9 ? 9.5 : 10.5} fill={STAR} opacity="0.85" pointerEvents="none">
                  {s.name}
                </text>
                <text x={s.x} y={s.y + 8} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="500" fill={STAR} pointerEvents="none" style={{ textShadow: "0 1px 2px rgba(0,0,0,.5)" }}>
                  {k}.{c!.geneKeys.lines[s.id]}
                </text>
              </>
            ) : (
              <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" fontSize={s.name.length > 9 ? 10 : 11.5} fill={STAR} pointerEvents="none">
                {s.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** El cielo de noche de los dibujos de Gene Keys (un panel propio: no van sobre la lámina clara). */
export function NightPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[1.5rem] p-2 sm:p-3"
      style={{
        background: "radial-gradient(circle at 50% 35%, #2A2552 0%, #17153A 55%, #100E26 100%)",
        boxShadow: "0 0 0 1px rgb(200 168 110 / .28), 0 0 50px -14px rgb(150 120 220 / .45)",
      }}
    >
      {children}
    </div>
  );
}

export function SequenceLegend({ active, onPick }: { active: string | null; onPick?: (id: SequenceId) => Record<string, unknown> }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-1.5 pb-1">
      {SEQUENCES.map((s) => {
        const on = active === s.id;
        return (
          <span
            key={s.id}
            {...(onPick ? onPick(s.id) : {})}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition"
            style={{ borderColor: on ? TONE[s.id].glow : "rgb(255 255 255 / .16)", background: on ? `${TONE[s.id].base}55` : "rgb(255 255 255 / .05)", color: STAR, cursor: onPick ? "pointer" : undefined }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${TONE[s.id].glow}, ${TONE[s.id].base})`, boxShadow: on ? `0 0 8px ${TONE[s.id].light}` : undefined }} />
            {SHORT[s.id]}
          </span>
        );
      })}
    </div>
  );
}

/** El símbolo de cada frecuencia: ▽ sombra, △ don, ✡ siddhi. */
function FrequencyMark({ f, x, y, s, color }: { f: "shadow" | "gift" | "siddhi"; x: number; y: number; s: number; color: string }) {
  const up = `${x},${y - s} ${x + s * 0.92},${y + s * 0.6} ${x - s * 0.92},${y + s * 0.6}`;
  const down = `${x},${y + s} ${x + s * 0.92},${y - s * 0.6} ${x - s * 0.92},${y - s * 0.6}`;
  return (
    <g fill="none" stroke={color} strokeWidth={s / 5} strokeLinejoin="round" pointerEvents="none">
      {f !== "shadow" && <polygon points={up} />}
      {f !== "gift" && <polygon points={down} />}
    </g>
  );
}

export function GkDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: GkLayer }) {
  const own = new Set(mine);
  const c = ctx.c;
  switch (layer) {
    case "gk-spheres":
      return <SpheresBySequence c={c} selected={selected} tap={tap} />;
    case "gk-sequences":
      return (
        <NightPanel>
          <GoldenPath c={c} lit={(s) => inSequence(s, selected as SequenceId)} selected={() => false} onSphere={(s) => tap(inSequence(s, selected as SequenceId) && s.also && s.sequence !== selected ? s.also.sequence : s.sequence, SEQUENCE_BY_ID[s.sequence].name)} />
          <SequenceLegend active={selected} onPick={(id) => tap(id, SEQUENCE_BY_ID[id].name)} />
        </NightPanel>
      );
    case "gk-keys":
      return <KeysGrid selected={selected} keys={keys} tap={tap} c={c} />;
    case "gk-spectrum": {
      const { n, f } = parseFreq(selected, myKeys(c)[0] ?? 1);
      const colors = new Map<number, string>();
      if (c) for (const s of SPHERES) if (!colors.has(c.geneKeys.keys[s.id])) colors.set(c.geneKeys.keys[s.id], TONE[s.sequence].base);
      return (
        <NightPanel>
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <KeyGrid selected={n} colorOf={(x) => colors.get(x) ?? null} tapKey={(x) => tap(`${x}:${f}`, `Llave ${x}`)} legend="En color, tus llaves (por secuencia)" />
            <SpectrumLadder n={n} selected={f} tap={(fr, l) => tap(`${n}:${fr}`, l)} />
          </div>
        </NightPanel>
      );
    }
    case "gk-lines":
      return <LinesHexagram selected={selected} own={own} tap={tap} c={c} />;
  }
  return null;
}

/** Las 64 llaves en una retícula de 8 × 8: las de la alumna, de cristal en el color de su secuencia; la elegida, con halo dorado, y su compañera de programación, con un filete dorado. */
function KeysGrid({ selected, keys, tap, c }: { selected: string; keys: string[]; tap: DiagramProps["tap"]; c: LayerCtx["c"] }) {
  const p = usePrefix();
  const inKeys = new Set(keys);
  const seqOf = new Map<number, SequenceId>();
  if (c) for (const s of SPHERES) if (!seqOf.has(c.geneKeys.keys[s.id])) seqOf.set(c.geneKeys.keys[s.id], s.sequence);
  const partner = partnerOf(Number(selected));
  const cell = 41;
  return (
    <NightPanel>
      <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label="Las 64 llaves">
        <GkDefs p={p} />
        <Stars w={340} h={340} n={40} />
        {Array.from({ length: 64 }, (_, i) => {
          const n = i + 1;
          const k = String(n);
          const cx = 6 + (i % 8) * cell + cell / 2;
          const cy = 6 + Math.floor(i / 8) * cell + cell / 2;
          const on = selected === k;
          const seq = seqOf.get(n);
          const usable = inKeys.has(k);
          const r = on ? 19 : 15.5;
          return (
            <g key={n} {...(usable ? tap(k, `Llave ${n}`) : {})} opacity={usable ? 1 : 0.22}>
              {on && <circle cx={cx} cy={cy} r={30} fill={`url(#${p}goldglow)`} />}
              {seq ? (
                <>
                  <circle cx={cx} cy={cy} r={r} fill={`url(#${p}q-${seq})`} />
                  <circle cx={cx} cy={cy} r={r} fill={`url(#${p}shade)`} />
                  <circle cx={cx} cy={cy} r={r} fill={`url(#${p}gloss)`} stroke={on ? "#F0D9A4" : "rgba(255,255,255,0.3)"} strokeWidth={on ? 2.2 : 0.8} />
                </>
              ) : (
                <circle cx={cx} cy={cy} r={r} fill={on ? `url(#${p}gold)` : "rgb(255 255 255 / .05)"} stroke={on ? "#F0D9A4" : "rgb(255 255 255 / .2)"} strokeWidth={on ? 1.6 : 0.7} />
              )}
              {n === partner && !on && <circle cx={cx} cy={cy} r={r + 3.5} fill="none" stroke="#E9CC8E" strokeWidth="1.2" strokeDasharray="2 2.5" />}
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={on ? 15 : 12.5} fontFamily="Georgia, serif" fill={on && !seq ? NIGHT : STAR} fillOpacity={seq || on ? 1 : 0.75} pointerEvents="none">
                {n}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-1 text-[0.68rem]" style={{ color: "rgb(251 246 236 / .7)" }}>
        {c && <SequenceLegend active={null} />}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-dashed" style={{ borderColor: "#E9CC8E" }} /> compañera de programación
        </span>
      </div>
    </NightPanel>
  );
}

/** Sombra, don y siddhi como una escalera de tres peldaños: abajo la sombra, en medio el don y arriba el siddhi. */
function SpectrumLadder({ n, selected, tap }: { n: number; selected: Freq; tap: (f: Freq, label: string) => Record<string, unknown> }) {
  const p = usePrefix();
  const k = KEY_BY_N.get(n)!;
  const STEPS: { f: Freq; x: number; y: number; fill: string; text: string; sub: string }[] = [
    { f: "shadow", x: 18, y: 226, fill: `url(#${p}lshadow)`, text: STAR, sub: "#C9B8A6" },
    { f: "gift", x: 74, y: 140, fill: `url(#${p}lgift)`, text: NIGHT, sub: "#4D3B18" },
    { f: "siddhi", x: 130, y: 54, fill: `url(#${p}lsiddhi)`, text: NIGHT, sub: "#6B5A33" },
  ];
  return (
    <svg viewBox="0 0 320 320" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={`Sombra, don y siddhi de la llave ${n}`}>
      <GkDefs p={p} />
      <defs>
        <linearGradient id={`${p}lsiddhi`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF8E6" />
          <stop offset="100%" stopColor="#F0DDB0" />
        </linearGradient>
        <linearGradient id={`${p}lgift`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E9CC8E" />
          <stop offset="100%" stopColor="#B8914F" />
        </linearGradient>
        <linearGradient id={`${p}lshadow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4A3F4E" />
          <stop offset="100%" stopColor="#241E2E" />
        </linearGradient>
      </defs>
      <ellipse cx="250" cy="44" rx="80" ry="30" fill={`url(#${p}goldglow)`} />
      <text x="20" y="30" fontSize="11" fontWeight="700" letterSpacing="1.4" fill="#E9CC8E">
        LLAVE {n}
      </text>
      {/* La escalera: cada peldaño, más arriba y más a la derecha. */}
      {STEPS.map((st) => {
        const on = selected === st.f;
        const w = 172;
        const h = 74;
        return (
          <g key={st.f} {...tap(st.f, SPECTRUM[st.f].name)}>
            {on && <rect x={st.x - 3} y={st.y - 3} width={w + 6} height={h + 6} rx="16" fill="#E9CC8E" opacity="0.45" filter={`url(#${p}blur)`} />}
            <rect x={st.x} y={st.y} width={w} height={h} rx="14" fill={st.fill} stroke={on ? "#F0D9A4" : "rgb(255 255 255 / .18)"} strokeWidth={on ? 2.2 : 0.8} />
            <FrequencyMark f={st.f} x={st.x + 20} y={st.y + h / 2} s={7} color={st.sub} />
            <text x={st.x + 38} y={st.y + 24} fontSize="9" letterSpacing="1.4" fontWeight="700" fill={st.sub}>
              {SPECTRUM[st.f].name.toUpperCase()}
            </text>
            <text x={st.x + 38} y={st.y + 48} fontSize="18" fontFamily="Georgia, serif" fill={st.text}>
              {k[st.f]}
            </text>
          </g>
        );
      })}
      <text x="20" y="312" fontSize="8.5" fill="rgb(251 246 236 / .6)">
        De la sombra al siddhi: la misma energía, a otra frecuencia.
      </text>
    </svg>
  );
}

/** Sombra, don y siddhi como una pirámide de luz: de la sombra densa abajo a la luz del siddhi arriba. */
function SpectrumPyramid({ selected, tap, c, option }: { selected: string; tap: DiagramProps["tap"]; c: LayerCtx["c"]; option: string | null }) {
  const p = usePrefix();
  const sphereId = option && SPHERE_BY_ID[option] ? option : "lifework";
  const k = c ? KEY_BY_N.get(c.geneKeys.keys[sphereId]) : null;
  const seq = SPHERE_BY_ID[sphereId].sequence;
  const BANDS = [
    { key: "siddhi" as const, y: 54, h: 74, top: 46, bottom: 88, fill: `url(#${p}siddhi)`, text: NIGHT, sub: "#6B5A33", mark: "#8E6D35" },
    { key: "gift" as const, y: 136, h: 74, top: 94, bottom: 124, fill: `url(#${p}gift)`, text: NIGHT, sub: "#4D3B18", mark: "#5E4718" },
    { key: "shadow" as const, y: 218, h: 74, top: 130, bottom: 150, fill: `url(#${p}shadow)`, text: STAR, sub: "#C9B8A6", mark: "#C9B8A6" },
  ];
  return (
    <NightPanel>
      <svg viewBox="0 0 320 320" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label="Sombra, don y siddhi">
        <GkDefs p={p} />
        <defs>
          <linearGradient id={`${p}siddhi`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF8E6" />
            <stop offset="100%" stopColor="#F0DDB0" />
          </linearGradient>
          <linearGradient id={`${p}gift`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E9CC8E" />
            <stop offset="100%" stopColor="#B8914F" />
          </linearGradient>
          <linearGradient id={`${p}shadow`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A3F4E" />
            <stop offset="100%" stopColor="#241E2E" />
          </linearGradient>
        </defs>
        <Stars w={320} h={320} n={30} />
        {/* La luz que cae desde arriba. */}
        <ellipse cx="160" cy="40" rx="90" ry="34" fill={`url(#${p}goldglow)`} />
        <text x="160" y="24" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="1.4" fill={TONE[seq].glow}>
          {(SPHERE_BY_ID[sphereId].name + (k ? ` · llave ${k.n}` : "")).toUpperCase()}
        </text>
        {BANDS.map((b) => {
          const on = selected === b.key;
          const word = k ? k[b.key] : null;
          // Un trapecio: más ancho abajo (la sombra es la base de todo).
          const d = `M${160 - b.top} ${b.y}H${160 + b.top}L${160 + b.bottom} ${b.y + b.h}H${160 - b.bottom}Z`;
          return (
            <g key={b.key} {...tap(b.key, SPECTRUM[b.key].name)}>
              {on && <path d={d} fill="#E9CC8E" opacity="0.5" filter={`url(#${p}blur)`} />}
              <path d={d} fill={b.fill} stroke={on ? "#F0D9A4" : "rgb(255 255 255 / .18)"} strokeWidth={on ? 2.2 : 0.8} strokeLinejoin="round" />
              <FrequencyMark f={b.key} x={160 - (b.top + b.bottom) / 2 + 22} y={b.y + b.h / 2} s={7} color={b.mark} />
              <text x="164" y={word ? b.y + b.h / 2 - 9 : b.y + b.h / 2} textAnchor="middle" dominantBaseline="central" fontSize="19" fontFamily="Georgia, serif" fill={b.text}>
                {SPECTRUM[b.key].name}
              </text>
              {word && (
                <text x="164" y={b.y + b.h / 2 + 13} textAnchor="middle" dominantBaseline="central" fontSize="12" fill={b.sub}>
                  {word}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </NightPanel>
  );
}

/** Las seis líneas como un hexagrama del I Ching (la 1 abajo): a la derecha, las esferas de la alumna que la tienen. */
function LinesHexagram({ selected, own, tap, c }: { selected: string; own: Set<string>; tap: DiagramProps["tap"]; c: LayerCtx["c"] }) {
  const p = usePrefix();
  return (
    <NightPanel>
      <svg viewBox="0 0 320 340" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label="Las 6 líneas">
        <GkDefs p={p} />
        <Stars w={320} h={340} n={30} />
        {[6, 5, 4, 3, 2, 1].map((n, i) => {
          const k = String(n);
          const on = selected === k;
          const m = own.has(k);
          const y = 26 + i * 50;
          const holders = c ? SPHERES.filter((s) => c.geneKeys.lines[s.id] === n) : [];
          return (
            <g key={n} {...tap(k, `Línea ${n}`)}>
              <rect x="20" y={y - 4} width="280" height="42" rx="12" fill={on ? "rgb(233 204 142 / .12)" : "transparent"} />
              {on && <rect x="62" y={y + 6} width="134" height="22" rx="6" fill="#E9CC8E" opacity="0.45" filter={`url(#${p}blur)`} />}
              <text x="40" y={y + 17} textAnchor="middle" dominantBaseline="central" fontSize="22" fontFamily="Georgia, serif" fill={on || m ? "#E9CC8E" : STAR} fillOpacity={on || m ? 1 : 0.7}>
                {n}
              </text>
              {/* La barra del hexagrama, entera (yang). */}
              <rect x="62" y={y + 9} width="134" height="16" rx="4" fill={on ? `url(#${p}gold)` : m ? "rgb(233 204 142 / .55)" : "rgb(255 255 255 / .14)"} stroke={on ? "#F0D9A4" : "none"} />
              <text x="129" y={y + 17.5} textAnchor="middle" dominantBaseline="central" fontSize="9.5" letterSpacing="0.8" fontWeight="600" fill={on ? NIGHT : STAR} fillOpacity={on ? 1 : 0.85}>
                {GK_LINES[n - 1].name.toUpperCase()}
              </text>
              {/* Las llaves de la alumna con esta línea: una esfera de cristal en el color de su secuencia, con el número
                  dentro (hasta 4 por fila; si hay más, en dos filas). */}
              {holders.map((s, j) => {
                const two = holders.length > 4;
                const cx = 214 + (j % 4) * 25;
                const cy = two ? y + 6 + Math.floor(j / 4) * 23 : y + 17;
                const r = two ? 10.5 : 11.5;
                return (
                  <g key={s.id} pointerEvents="none">
                    <circle cx={cx} cy={cy} r={r} fill={`url(#${p}q-${s.sequence})`} />
                    <circle cx={cx} cy={cy} r={r} fill={`url(#${p}gloss)`} stroke="rgba(255,255,255,.45)" strokeWidth="0.8" />
                    <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={r > 11 ? 10.5 : 9.5} fontWeight="700" fill={STAR} style={{ textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>
                      {c!.geneKeys.keys[s.id]}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </NightPanel>
  );
}
