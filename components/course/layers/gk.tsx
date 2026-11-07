"use client";

import { GK_VIEWBOX, KEY_BY_N, PATH_EDGES, SEQUENCES, SEQUENCE_BY_ID, SPHERE_BY_ID, SPHERES, inSequence, type SequenceId, type Sphere } from "@/components/models/data/gene-keys";
import { GATE_BY_N, CENTRE_BY_ID } from "@/components/models/data/human-design";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { CREAM, GOLD, INK, LINE, MUTED, listEs, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { GK_LINES } from "./texts";

/**
 * Las capas de las Gene Keys: las esferas del Camino Dorado (con los números de la alumna dentro), las tres
 * secuencias por colores (Activación verde, Venus rojo, Perla azul), las 64 llaves, el espectro sombra-don-
 * siddhi de cualquier esfera y las 6 líneas.
 */

export type GkLayer = Extract<AstroLayer, `gk-${string}`>;

/** Las 64 puertas en el orden de la rueda: la compañera de programación de una llave es la de enfrente. */
const WHEEL = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];
const partnerOf = (n: number) => WHEEL[(WHEEL.indexOf(n) + 32) % 64];

const SPECTRUM = {
  shadow: { name: "Sombra", kicker: "La frecuencia del miedo", meaning: "La forma reactiva de la llave: lo que aparece cuando vives desde el miedo o el piloto automático. No es un defecto: es la puerta de entrada." },
  gift: { name: "Don", kicker: "La frecuencia del genio", meaning: "La misma energía, vivida con aceptación: tu talento natural. Aparece cuando contemplas la sombra sin huir de ella." },
  siddhi: { name: "Siddhi", kicker: "La frecuencia de la gracia", meaning: "La expresión más alta, un estado que no se fuerza: llega cuando ya no hay nada que defender." },
} as const;

const SHORT: Record<SequenceId, string> = { activation: "Activación", venus: "Venus", pearl: "Perla" };

/** El nombre de una esfera dentro de una secuencia (la Obra de vida es la Marca en la Perla…). */
const nameIn = (s: Sphere, seq: string | null) => (seq && s.sequence !== seq && s.also?.sequence === seq ? s.also.name : s.name);

/** En qué esferas de la alumna está cada llave. */
function spheresWith(c: LayerCtx["c"], n: number) {
  if (!c) return [];
  return SPHERES.filter((s) => c.geneKeys.keys[s.id] === n);
}

export function gkKeys(layer: GkLayer, { option, c }: LayerCtx): string[] {
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
  return [];
}

export function gkPiece(layer: GkLayer, key: string, { option, c }: LayerCtx): SystemPiece {
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
      const s = SPECTRUM[key as keyof typeof SPECTRUM];
      const sphereId = option && SPHERE_BY_ID[option] ? option : "lifework";
      const sphere = SPHERE_BY_ID[sphereId];
      const k = c ? KEY_BY_N.get(c.geneKeys.keys[sphereId]) : null;
      return {
        glyph: "",
        name: s.name,
        kicker: s.kicker,
        meaning: s.meaning,
        personal: k ? `En tu ${sphere.name} (llave ${k.n}), tu ${s.name.toLowerCase()} es «${key === "shadow" ? k.shadow : key === "gift" ? k.gift : k.siddhi}».` : null,
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
 *  Dibujos
 * -------------------------------------------------------------------------- */

/** El Camino Dorado: los caminos en el color de su secuencia y, con la carta, el número de cada esfera dentro. */
function GoldenPath({ c, lit, selected, onSphere }: { c: LayerCtx["c"]; lit: (s: Sphere) => boolean; selected: (s: Sphere) => boolean; onSphere: (s: Sphere) => Record<string, unknown> }) {
  const pos = (id: string) => SPHERE_BY_ID[id];
  return (
    <svg viewBox={`${GK_VIEWBOX.x} ${GK_VIEWBOX.y} ${GK_VIEWBOX.w} ${GK_VIEWBOX.h}`} className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label="El Camino Dorado">
      {PATH_EDGES.map((e, i) => {
        const on = lit(pos(e.from)) && lit(pos(e.to));
        return <line key={i} x1={pos(e.from).x} y1={pos(e.from).y} x2={pos(e.to).x} y2={pos(e.to).y} stroke={SEQUENCE_BY_ID[e.sequence].hue} strokeWidth={on ? 5 : 3} strokeOpacity={on ? 0.85 : 0.2} strokeDasharray={e.dashed ? "8 8" : undefined} />;
      })}
      {SPHERES.map((s) => {
        const on = selected(s);
        const hue = SEQUENCE_BY_ID[s.sequence].hue;
        const alsoHue = s.also ? SEQUENCE_BY_ID[s.also.sequence].hue : null;
        const isLit = lit(s);
        const k = c?.geneKeys.keys[s.id];
        return (
          <g key={s.id} {...onSphere(s)} opacity={isLit ? 1 : 0.3}>
            {alsoHue && <circle cx={s.x} cy={s.y} r={on ? 48 : 42} fill="none" stroke={alsoHue} strokeWidth="4" />}
            <circle cx={s.x} cy={s.y} r={on ? 40 : 34} fill={on ? INK : isLit ? `${hue}26` : "#fff"} stroke={hue} strokeWidth={5} />
            {k && (
              <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" fontSize="26" fontFamily="Georgia, serif" fill={on ? GOLD : INK} pointerEvents="none">
                {k}
                <tspan fontSize="15" dx="1" fill={on ? CREAM : MUTED}>
                  .{c!.geneKeys.lines[s.id]}
                </tspan>
              </text>
            )}
            <text x={s.x} y={s.y + 62} textAnchor="middle" fontSize="20" fill={INK} pointerEvents="none">
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SequenceLegend({ active, onPick }: { active: string | null; onPick?: (id: SequenceId) => Record<string, unknown> }) {
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-1.5">
      {SEQUENCES.map((s) => {
        const on = active === s.id;
        return (
          <span
            key={s.id}
            {...(onPick ? onPick(s.id) : {})}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold"
            style={{ borderColor: on ? s.hue : LINE, background: on ? `${s.hue}22` : "#fff", color: INK, cursor: onPick ? "pointer" : undefined }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hue }} />
            {SHORT[s.id]}
          </span>
        );
      })}
    </div>
  );
}

export function GkDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: GkLayer }) {
  const own = new Set(mine);
  const c = ctx.c;
  switch (layer) {
    case "gk-spheres": {
      const inKeys = new Set(keys);
      const seq = ctx.option && ctx.option !== "all" ? ctx.option : null;
      return (
        <div>
          <GoldenPath c={c} lit={(s) => inKeys.has(s.id)} selected={(s) => s.id === selected} onSphere={(s) => (inKeys.has(s.id) ? tap(s.id, nameIn(s, seq)) : {})} />
          <SequenceLegend active={seq ?? SPHERE_BY_ID[selected]?.sequence ?? null} />
        </div>
      );
    }
    case "gk-sequences":
      return (
        <div>
          <GoldenPath c={c} lit={(s) => inSequence(s, selected as SequenceId)} selected={() => false} onSphere={(s) => tap(inSequence(s, selected as SequenceId) && s.also && s.sequence !== selected ? s.also.sequence : s.sequence, SEQUENCE_BY_ID[s.sequence].name)} />
          <SequenceLegend active={selected} onPick={(id) => tap(id, SEQUENCE_BY_ID[id].name)} />
        </div>
      );
    case "gk-keys": {
      const inKeys = new Set(keys);
      // Cada llave de la alumna, en el color de la secuencia de su (primera) esfera.
      const hueOf = new Map<number, string>();
      if (c) for (const s of SPHERES) if (!hueOf.has(c.geneKeys.keys[s.id])) hueOf.set(c.geneKeys.keys[s.id], SEQUENCE_BY_ID[s.sequence].hue);
      return (
        <div>
          <svg viewBox="0 0 336 336" className="mx-auto block h-auto w-full max-w-[21rem] select-none" role="group" aria-label="Las 64 llaves">
            {Array.from({ length: 64 }, (_, i) => {
              const n = i + 1;
              const k = String(n);
              const x = 4 + (i % 8) * 41;
              const y = 4 + Math.floor(i / 8) * 41;
              const on = selected === k;
              const hue = hueOf.get(n);
              const usable = inKeys.has(k);
              return (
                <g key={n} {...(usable ? tap(k, `Llave ${n}`) : {})} opacity={usable ? 1 : 0.25}>
                  <rect x={x} y={y} width="37" height="37" rx="8" fill={on ? INK : hue ? `${hue}38` : "#FBF8F1"} stroke={on ? GOLD : hue ?? LINE} strokeWidth={on ? 2.5 : hue ? 2 : 1} />
                  <text x={x + 18.5} y={y + 19} textAnchor="middle" dominantBaseline="central" fontSize="14" fontFamily="Georgia, serif" fontWeight={hue ? 700 : 400} fill={on ? GOLD : INK} pointerEvents="none">
                    {n}
                  </text>
                </g>
              );
            })}
          </svg>
          {c && <SequenceLegend active={null} />}
        </div>
      );
    }
    case "gk-spectrum": {
      const sphereId = ctx.option && SPHERE_BY_ID[ctx.option] ? ctx.option : "lifework";
      const k = c ? KEY_BY_N.get(c.geneKeys.keys[sphereId]) : null;
      const hue = SEQUENCE_BY_ID[SPHERE_BY_ID[sphereId].sequence].hue;
      return (
        <svg viewBox="0 0 320 330" className="mx-auto block h-auto w-full max-w-[20rem] select-none" role="group" aria-label="Sombra, don y siddhi">
          {k && (
            <text x="160" y="20" textAnchor="middle" fontSize="13" fill={hue} fontWeight="700">
              {SPHERE_BY_ID[sphereId].name} · llave {k.n}
            </text>
          )}
          {(["siddhi", "gift", "shadow"] as const).map((key, i) => {
            const on = selected === key;
            const fill = ["#F3ECDD", "#E9DDBF", "#3A3650"][i];
            const word = k ? (key === "shadow" ? k.shadow : key === "gift" ? k.gift : k.siddhi) : null;
            const light = on || key === "shadow";
            return (
              <g key={key} {...tap(key, SPECTRUM[key].name)}>
                <path d={`M${60 - i * 18} ${40 + i * 90}h${200 + i * 36}l-14 78h${-(172 + i * 36)}z`} fill={on ? INK : fill} stroke={on ? GOLD : "#D9CFBC"} strokeWidth={on ? 2 : 1} />
                <text x="160" y={(word ? 70 : 79) + i * 90} textAnchor="middle" dominantBaseline="central" fontSize="20" fontFamily="Georgia, serif" fill={light ? CREAM : INK}>
                  {SPECTRUM[key].name}
                </text>
                {word && (
                  <text x="160" y={93 + i * 90} textAnchor="middle" dominantBaseline="central" fontSize="13" fill={light ? GOLD : "#6E6A7E"}>
                    {word}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      );
    }
    case "gk-lines":
      return (
        <svg viewBox="0 0 320 340" className="mx-auto block h-auto w-full max-w-[20rem] select-none" role="group" aria-label="Las 6 líneas">
          {[6, 5, 4, 3, 2, 1].map((n, i) => {
            const k = String(n);
            const on = selected === k;
            const m = own.has(k);
            const y = 22 + i * 52;
            const count = c ? SPHERES.filter((s) => c.geneKeys.lines[s.id] === n) : [];
            return (
              <g key={n} {...tap(k, `Línea ${n}`)}>
                <rect x="70" y={y} width="220" height="34" rx="8" fill={on ? INK : m ? "#EFE4CC" : "#FBF8F1"} stroke={m || on ? GOLD : LINE} strokeWidth={m ? 1.6 : 1} />
                <text x="40" y={y + 17} textAnchor="middle" dominantBaseline="central" fontSize="22" fontFamily="Georgia, serif" fill={m ? GOLD : INK}>
                  {n}
                </text>
                <text x="160" y={y + 17} textAnchor="middle" dominantBaseline="central" fontSize="14" fill={on ? CREAM : INK}>
                  {GK_LINES[n - 1].name}
                </text>
                {count.map((s, j) => (
                  <circle key={s.id} cx={276 - j * 11} cy={y + 17} r="4" fill={SEQUENCE_BY_ID[s.sequence].hue} />
                ))}
              </g>
            );
          })}
        </svg>
      );
  }
  return null;
}
