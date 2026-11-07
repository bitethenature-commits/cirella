"use client";

import { HOUSES, SIGNS, ELEMENT_HUE } from "@/components/models/data/astrology";
import { EIGHT_PHASES, FULL_MOON_IN_SIGN, MOON_IN_SIGN, NATAL_PHASE, NEW_MOON_IN_SIGN, PHASE_GUIDANCE, ZODIAC_SIGNS, moonPhase, moonSign } from "@/components/models/data/moon";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, CREAM, GOLD, INK, LINE, MUTED, ROMAN, SAND, VS, degIn, moonLit, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { MOON_NATAL_HOUSE, MOON_NATAL_SIGN, NORTH_NODE_SIGN } from "./texts";

/**
 * Las capas de la Luna: las 8 fases, la Luna en los 12 signos (natal, la del día, la nueva y la llena en
 * cada signo), la Luna natal en las 12 casas y los nodos lunares en los 12 signos.
 */

export type MoonLayer = Extract<AstroLayer, `moon-${string}`>;

const PHASE_GLYPH = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"].map((g) => g + VS);
export const phaseIndexToday = () => Math.floor(((moonPhase(new Date()).phase * 8) % 8) + 0.5) % 8;
const todaySign = () => ZODIAC_SIGNS.indexOf(moonSign(new Date()));

const natalMoonSign = (c: LayerCtx["c"]) => {
  const lon = c?.chart.bodies.find((b) => b.id === "moon")?.lon ?? c?.natalMoon.moonLon;
  return lon == null ? null : signIndex(lon);
};
const moonHouse = (c: LayerCtx["c"]) => c?.chart.bodies.find((b) => b.id === "moon")?.house ?? null;
const nodeLon = (c: LayerCtx["c"]) => c?.chart.bodies.find((b) => b.id === "node")?.lon ?? null;

export function moonKeys(layer: MoonLayer): string[] {
  return LAYER_KEYS[layer];
}

export function moonMine(layer: MoonLayer, { c }: LayerCtx): string[] {
  if (!c) return [];
  if (layer === "moon-phases") return [String(c.natalMoon.phase)];
  if (layer === "moon-signs") {
    const s = natalMoonSign(c);
    return s == null ? [] : [String(s)];
  }
  if (layer === "moon-houses") {
    const h = moonHouse(c);
    return h ? [String(h)] : [];
  }
  if (layer === "moon-nodes") {
    const l = nodeLon(c);
    return l == null ? [] : [String(signIndex(l))];
  }
  return [];
}

export function moonPiece(layer: MoonLayer, key: string, { option, c }: LayerCtx): SystemPiece {
  switch (layer) {
    case "moon-phases": {
      const i = Number(key);
      const name = EIGHT_PHASES[i];
      const g = PHASE_GUIDANCE[name];
      const natal = c?.natalMoon.phase === i;
      return {
        glyph: PHASE_GLYPH[i],
        name,
        kicker: `${g.intent}${phaseIndexToday() === i ? " · la Luna de hoy" : ""}`,
        meaning: `${g.practice}\n\n${NATAL_PHASE[name]}`,
        personal: c ? (natal ? "Naciste en esta fase: es tu Luna natal." : `Naciste en ${EIGHT_PHASES[c.natalMoon.phase].toLowerCase()}.`) : null,
      };
    }
    case "moon-signs": {
      const i = Number(key);
      const s = SIGNS[i];
      const opp = SIGNS[(i + 6) % 12];
      const mode = option ?? "natal";
      const natal = natalMoonSign(c);
      const moonLonNatal = c?.chart.bodies.find((b) => b.id === "moon")?.lon ?? c?.natalMoon.moonLon ?? null;
      const today = todaySign() === i;
      const text = { natal: MOON_NATAL_SIGN, sky: MOON_IN_SIGN, new: NEW_MOON_IN_SIGN, full: FULL_MOON_IN_SIGN }[mode as "natal"] ?? MOON_NATAL_SIGN;
      const name = mode === "new" ? `Luna nueva en ${s.name}` : mode === "full" ? `Luna llena en ${s.name}` : `Luna en ${s.name}`;
      const kicker =
        mode === "full"
          ? `Con el Sol enfrente, en ${opp.name} · eje ${s.name}-${opp.name}`
          : mode === "new"
            ? `El Sol y la Luna juntos en ${s.name} · qué sembrar`
            : `${s.element} · ${s.modality}${today ? " · la Luna de hoy" : ""}`;
      return {
        glyph: s.glyph + VS,
        name,
        kicker,
        meaning: text[i],
        personal: c && natal != null ? (natal === i ? `Tu Luna natal está aquí, a ${degIn(moonLonNatal!)} de ${s.name}.` : `Tu Luna natal está en ${SIGNS[natal].name}.`) : null,
      };
    }
    case "moon-houses": {
      const n = Number(key);
      const h = HOUSES[n - 1];
      const mine = moonHouse(c);
      return {
        glyph: ROMAN[n - 1],
        name: `Luna en ${h.name}`,
        kicker: `${h.keyword} · eje ${h.axis}`,
        meaning: `${MOON_NATAL_HOUSE[n - 1]}\n\nLa casa: ${h.meaning}`,
        personal: c ? (mine ? (mine === n ? "Tu Luna natal está en esta casa." : `Tu Luna natal está en la ${HOUSES[mine - 1].name}.`) : "Sin hora de nacimiento no se sabe en qué casa está tu Luna.") : null,
      };
    }
    case "moon-nodes": {
      const i = Number(key);
      const s = SIGNS[i];
      const south = SIGNS[(i + 6) % 12];
      const l = nodeLon(c);
      return {
        glyph: "☊" + VS,
        name: `Nodo Norte en ${s.name}`,
        kicker: `Nodo Sur en ${south.name} · eje ${s.name}-${south.name}`,
        meaning: `${NORTH_NODE_SIGN[i]}\n\nLos nodos son los dos puntos donde la órbita de la Luna cruza el camino del Sol. El Sur es lo conocido, el talento que traes; el Norte, lo que viniste a aprender. Recorren el zodiaco hacia atrás en unos 18,6 años: ahí ocurren los eclipses.`,
        personal: l != null ? (signIndex(l) === i ? `Tu Nodo Norte está aquí, a ${degIn(l)} de ${s.name}.` : `Tu Nodo Norte está en ${SIGNS[signIndex(l)].name}.`) : null,
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* -------------------------------------------------------------------------- */

export function MoonDiagram({ layer, selected, mine, tap, ctx }: DiagramProps & { layer: MoonLayer }) {
  const own = new Set(mine);
  switch (layer) {
    case "moon-phases": {
      const today = phaseIndexToday();
      return (
        <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[22rem] select-none" role="group" aria-label="Las 8 fases de la Luna">
          <circle cx="170" cy="170" r="122" fill="none" stroke={LINE} strokeDasharray="2 5" />
          <circle cx="170" cy="170" r="30" fill={SAND} stroke={GOLD} />
          <text x="170" y="170" textAnchor="middle" dominantBaseline="central" fontSize="11" fill={GOLD}>
            ☉︎ Sol
          </text>
          {EIGHT_PHASES.map((name, i) => {
            const k = String(i);
            const a = (-90 + i * 45) * (Math.PI / 180);
            const x = 170 + 122 * Math.cos(a);
            const y = 170 + 122 * Math.sin(a);
            const on = selected === k;
            return (
              <g key={k} {...tap(k, name)}>
                <circle cx={x} cy={y} r={on ? 27 : 23} fill={on ? INK : "#fff"} stroke={own.has(k) ? GOLD : LINE} strokeWidth={own.has(k) ? 2.2 : 1} />
                <circle cx={x} cy={y} r={14} fill="#2A2745" />
                <path d={moonLit(x, y, 14, i / 8)} fill={SAND} />
                {today === i && <circle cx={x + 18} cy={y - 18} r="4.5" fill={GOLD} />}
              </g>
            );
          })}
        </svg>
      );
    }
    case "moon-signs":
    case "moon-nodes": {
      const mode = layer === "moon-nodes" ? "nodes" : (ctx.option ?? "natal");
      const today = todaySign();
      const sel = Number(selected);
      // La fase que se dibuja en cada signo: nueva, llena o creciente (natal y la del día).
      const p = mode === "new" ? 0 : mode === "full" ? 0.5 : 0.18;
      return (
        <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[22rem] select-none" role="group" aria-label={layer === "moon-nodes" ? "Los nodos lunares" : "La Luna en los 12 signos"}>
          <circle cx={C} cy={C} r={158} fill="#fff" stroke={LINE} />
          {SIGNS.map((s, i) => {
            const k = String(i);
            const on = sel === i;
            const isSouth = mode === "nodes" && (sel + 6) % 12 === i;
            const m = own.has(k);
            const mid = pt(i * 30 + 15, 136);
            const moon = pt(i * 30 + 15, 104);
            return (
              <g key={i} {...tap(k, s.name)}>
                <path d={sector(i * 30, i * 30 + 30, 84, 158)} fill={on ? INK : isSouth ? "#E9DDBF" : m ? "#EFE4CC" : i % 2 ? "#FBF8F1" : "#F4EEE2"} stroke={LINE} />
                <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="18" fill={on ? CREAM : m ? GOLD : ELEMENT_HUE[s.element]}>
                  {s.glyph + VS}
                </text>
                {mode !== "nodes" && (
                  <>
                    <circle cx={moon.x} cy={moon.y} r="9" fill="#2A2745" />
                    <path d={moonLit(moon.x, moon.y, 9, p)} fill={SAND} />
                  </>
                )}
                {m && <circle cx={pt(i * 30 + 15, mode === "nodes" ? 100 : 89).x} cy={pt(i * 30 + 15, mode === "nodes" ? 100 : 89).y} r="3.2" fill={GOLD} />}
                {mode === "sky" && today === i && <circle cx={pt(i * 30 + 15, 154).x} cy={pt(i * 30 + 15, 154).y} r="4" fill={GOLD} />}
              </g>
            );
          })}
          {mode === "nodes" && (
            <>
              <line x1={pt(sel * 30 + 15, 84).x} y1={pt(sel * 30 + 15, 84).y} x2={pt(sel * 30 + 195, 84).x} y2={pt(sel * 30 + 195, 84).y} stroke={GOLD} strokeWidth="2" />
              <circle cx={pt(sel * 30 + 15, 68).x} cy={pt(sel * 30 + 15, 68).y} r="13" fill={INK} />
              <text x={pt(sel * 30 + 15, 68).x} y={pt(sel * 30 + 15, 68).y} textAnchor="middle" dominantBaseline="central" fontSize="15" fill={GOLD}>
                ☊︎
              </text>
              <circle cx={pt(sel * 30 + 195, 68).x} cy={pt(sel * 30 + 195, 68).y} r="13" fill="#fff" stroke={GOLD} />
              <text x={pt(sel * 30 + 195, 68).x} y={pt(sel * 30 + 195, 68).y} textAnchor="middle" dominantBaseline="central" fontSize="15" fill={INK}>
                ☋︎
              </text>
            </>
          )}
          {mode !== "nodes" && (
            <g pointerEvents="none">
              <circle cx={C} cy={C} r="46" fill="#FBF8F1" stroke={LINE} />
              <circle cx={C} cy={C} r="26" fill="#2A2745" />
              <path d={moonLit(C, C, 26, p)} fill={SAND} />
              <text x={C} y={C + 37} textAnchor="middle" fontSize="9" fill={MUTED}>
                {SIGNS[sel].name}
              </text>
            </g>
          )}
          {mode === "full" && <text x={pt(sel * 30 + 195, 140).x} y={pt(sel * 30 + 195, 140).y} textAnchor="middle" dominantBaseline="central" fontSize="16" fill={GOLD} pointerEvents="none">☉︎</text>}
        </svg>
      );
    }
    case "moon-houses":
      return (
        <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[22rem] select-none" role="group" aria-label="La Luna en las 12 casas">
          <circle cx={C} cy={C} r={158} fill="#fff" stroke={LINE} />
          {HOUSES.map((h, i) => {
            const k = String(h.n);
            const on = selected === k;
            const m = own.has(k);
            const mid = pt(i * 30 + 15, 124);
            return (
              <g key={h.n} {...tap(k, h.name)}>
                <path d={sector(i * 30, i * 30 + 30, 70, 158)} fill={on ? INK : m ? "#EFE4CC" : i % 2 ? "#FBF8F1" : "#F4EEE2"} stroke={LINE} />
                <text x={mid.x} y={mid.y - 6} textAnchor="middle" dominantBaseline="central" fontSize="16" fontFamily="Georgia, serif" fill={on ? CREAM : m ? GOLD : INK}>
                  {ROMAN[i]}
                </text>
                <text x={mid.x} y={mid.y + 10} textAnchor="middle" dominantBaseline="central" fontSize="7.5" fill={on ? "#E9DDBF" : MUTED}>
                  {h.keyword.toLowerCase()}
                </text>
                {m && (
                  <g>
                    <circle cx={pt(i * 30 + 15, 86).x} cy={pt(i * 30 + 15, 86).y} r="7" fill="#2A2745" />
                    <path d={moonLit(pt(i * 30 + 15, 86).x, pt(i * 30 + 15, 86).y, 7, 0.3)} fill={SAND} />
                  </g>
                )}
              </g>
            );
          })}
          <circle cx={C} cy={C} r="70" fill="#FBF8F1" stroke={LINE} pointerEvents="none" />
          <circle cx={C} cy={C} r="24" fill="#2A2745" pointerEvents="none" />
          <path d={moonLit(C, C, 24, 0.3)} fill={SAND} pointerEvents="none" />
        </svg>
      );
  }
  return null;
}
