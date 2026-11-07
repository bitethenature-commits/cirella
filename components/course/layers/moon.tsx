"use client";

import { HOUSES, SIGNS, ELEMENT_HUE } from "@/components/models/data/astrology";
import { EIGHT_PHASES, FULL_MOON_IN_SIGN, MOON_IN_SIGN, NATAL_PHASE, NEW_MOON_IN_SIGN, PHASE_GUIDANCE, ZODIAC_SIGNS, moonPhase, moonSign } from "@/components/models/data/moon";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, CREAM, GOLD, INK, LINE, MUTED, ROMAN, SAND, VS, degIn, moonLit, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { MOON_NATAL_HOUSE, MOON_NATAL_SIGN, NORTH_NODE_SIGN } from "./texts";
import { NIGHT, NIGHT_GOLD, NightDefs, NightPanel, STAR, Stars, usePrefix } from "./night";

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

/* -------------------------------------------------------------------------- *
 *  Dibujos — sobre el cielo de noche (layers/night.tsx): lunas de luz, con su parte iluminada como se ve
 *  desde el hemisferio norte, un sol dorado en el centro de las fases y anillos de signos y casas de cristal.
 * -------------------------------------------------------------------------- */

/** Una luna con relieve: la parte en sombra, azul noche; la iluminada, crema con degradado y halo. */
function MoonGlobe({ p, cx, cy, r, phase, glow = false }: { p: string; cx: number; cy: number; r: number; phase: number; glow?: boolean }) {
  const lit = moonLit(cx, cy, r, phase);
  return (
    <g pointerEvents="none">
      {glow && phase > 0 && <circle cx={cx} cy={cy} r={r * 1.7} fill={`url(#${p}moonhalo)`} />}
      <circle cx={cx} cy={cy} r={r} fill="#1D1A3E" stroke="rgb(255 255 255 / .22)" strokeWidth={Math.max(0.6, r / 22)} />
      {lit && <path d={lit} fill={`url(#${p}moonlit)`} />}
      {/* Tres «mares» suaves, para que parezca la Luna y no un círculo. */}
      {phase > 0 && (
        <g fill="#B9AE96" opacity="0.28">
          <circle cx={cx - r * 0.28} cy={cy - r * 0.18} r={r * 0.2} />
          <circle cx={cx + r * 0.22} cy={cy + r * 0.25} r={r * 0.14} />
          <circle cx={cx + r * 0.05} cy={cy - r * 0.42} r={r * 0.09} />
        </g>
      )}
    </g>
  );
}

function MoonDefs({ p }: { p: string }) {
  return (
    <>
      <NightDefs p={p} />
      <defs>
        <radialGradient id={`${p}moonlit`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFFCF2" />
          <stop offset="70%" stopColor="#EDE3CC" />
          <stop offset="100%" stopColor="#CFC3A6" />
        </radialGradient>
        <radialGradient id={`${p}moonhalo`} cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#F3ECDD" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F3ECDD" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}sun`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFF6D8" />
          <stop offset="55%" stopColor="#F0C978" />
          <stop offset="100%" stopColor="#C8963F" />
        </radialGradient>
        <radialGradient id={`${p}sunhalo`} cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor="#F0C978" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F0C978" stopOpacity="0" />
        </radialGradient>
      </defs>
    </>
  );
}

/** Un anillo de doce sectores de cristal (signos o casas): el elegido, dorado y levantado. */
function GlassSector({ i, r1, r2, on, mine, children, ...rest }: { i: number; r1: number; r2: number; on: boolean; mine: boolean; children?: React.ReactNode } & Record<string, unknown>) {
  return (
    <g {...rest}>
      {on && <path d={sector(i * 30, i * 30 + 30, r1 - 4, r2 + 4)} fill={NIGHT_GOLD} opacity="0.35" />}
      <path
        d={sector(i * 30, i * 30 + 30, on ? r1 - 2 : r1, on ? r2 + 2 : r2)}
        fill={on ? "rgb(233 204 142 / .9)" : mine ? "rgb(233 204 142 / .2)" : i % 2 ? "rgb(255 255 255 / .05)" : "rgb(255 255 255 / .09)"}
        stroke={on ? "#FFF3D4" : "rgb(255 255 255 / .16)"}
        strokeWidth={on ? 1.6 : 0.8}
      />
      {children}
    </g>
  );
}

export function MoonDiagram({ layer, selected, mine, tap, ctx }: DiagramProps & { layer: MoonLayer }) {
  const p = usePrefix();
  const own = new Set(mine);
  switch (layer) {
    case "moon-phases": {
      const today = phaseIndexToday();
      return (
        <NightPanel>
          <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label="Las 8 fases de la Luna">
            <MoonDefs p={p} />
            <Stars w={340} h={340} n={46} />
            <circle cx={C} cy={C} r="122" fill="none" stroke="rgb(233 204 142 / .35)" strokeWidth="0.8" strokeDasharray="1 5" />
            {/* El Sol en el centro: la luz que reciben todas. */}
            <circle cx={C} cy={C} r="52" fill={`url(#${p}sunhalo)`} />
            <circle cx={C} cy={C} r="22" fill={`url(#${p}sun)`} />
            <text x={C} y={C + 36} textAnchor="middle" fontSize="7" letterSpacing="1.6" fill={NIGHT_GOLD}>
              SOL
            </text>
            {EIGHT_PHASES.map((name, i) => {
              const k = String(i);
              const a = (-90 + i * 45) * (Math.PI / 180);
              const x = C + 122 * Math.cos(a);
              const y = C + 122 * Math.sin(a);
              const on = selected === k;
              const m = own.has(k);
              return (
                <g key={k} {...tap(k, name)}>
                  <circle cx={x} cy={y} r="27" fill="transparent" />
                  {on && <circle cx={x} cy={y} r="32" fill={`url(#${p}goldglow)`} />}
                  {on && <circle cx={x} cy={y} r="24" fill="none" stroke="#F0D9A4" strokeWidth="1.6" />}
                  <MoonGlobe p={p} cx={x} cy={y} r={on ? 19 : 16} phase={i / 8} glow={on} />
                  {today === i && (
                    <g pointerEvents="none">
                      <circle cx={x + 19} cy={y - 19} r="5" fill={NIGHT_GOLD} stroke={NIGHT} strokeWidth="1.2" />
                    </g>
                  )}
                  {m && (
                    <text x={x - 19} y={y - 19} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={NIGHT_GOLD} pointerEvents="none">
                      ★
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap justify-center gap-x-3 pb-1 text-[0.66rem]" style={{ color: "rgb(251 246 236 / .72)" }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: NIGHT_GOLD }} /> La Luna de hoy
            </span>
            <span className="inline-flex items-center gap-1" style={{ color: NIGHT_GOLD }}>
              ★ <span style={{ color: "rgb(251 246 236 / .72)" }}>Tu Luna al nacer</span>
            </span>
          </div>
        </NightPanel>
      );
    }
    case "moon-signs":
    case "moon-nodes": {
      const mode = layer === "moon-nodes" ? "nodes" : (ctx.option ?? "natal");
      const today = todaySign();
      const sel = Number(selected);
      const ph = mode === "new" ? 0 : mode === "full" ? 0.5 : 0.2;
      return (
        <NightPanel>
          <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={layer === "moon-nodes" ? "Los nodos lunares" : "La Luna en los 12 signos"}>
            <MoonDefs p={p} />
            <Stars w={340} h={340} n={40} />
            <circle cx={C} cy={C} r="160" fill="none" stroke="rgb(233 204 142 / .4)" strokeWidth="0.8" />
            {SIGNS.map((s, i) => {
              const k = String(i);
              const on = sel === i;
              const isSouth = mode === "nodes" && (sel + 6) % 12 === i;
              const m = own.has(k);
              const g = pt(i * 30 + 15, 138);
              const mo = pt(i * 30 + 15, 106);
              return (
                <GlassSector key={i} i={i} r1={88} r2={157} on={on} mine={m || isSouth} {...tap(k, s.name)}>
                  <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="19" fill={on ? NIGHT : ELEMENT_HUE[s.element]} style={on ? undefined : { filter: "brightness(1.6)" }} pointerEvents="none">
                    {s.glyph + VS}
                  </text>
                  {mode !== "nodes" && <MoonGlobe p={p} cx={mo.x} cy={mo.y} r={on ? 10 : 8.5} phase={ph} />}
                  {m && (
                    <text x={pt(i * 30 + 15, 153).x} y={pt(i * 30 + 15, 153).y - 0} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={on ? NIGHT : NIGHT_GOLD} pointerEvents="none">
                      ★
                    </text>
                  )}
                  {mode === "sky" && today === i && <circle cx={pt(i * 30 + 15, 92).x} cy={pt(i * 30 + 15, 92).y} r="4" fill={NIGHT_GOLD} stroke={NIGHT} pointerEvents="none" />}
                </GlassSector>
              );
            })}
            {mode === "nodes" ? (
              <g pointerEvents="none">
                {/* El eje de los nodos: del Sur (lo conocido) al Norte (hacia dónde creces). */}
                <line x1={pt(sel * 30 + 195, 84).x} y1={pt(sel * 30 + 195, 84).y} x2={pt(sel * 30 + 15, 84).x} y2={pt(sel * 30 + 15, 84).y} stroke={NIGHT_GOLD} strokeWidth="5" strokeOpacity="0.3" filter={`url(#${p}blur)`} />
                <line x1={pt(sel * 30 + 195, 84).x} y1={pt(sel * 30 + 195, 84).y} x2={pt(sel * 30 + 15, 84).x} y2={pt(sel * 30 + 15, 84).y} stroke={`url(#${p}gold)`} strokeWidth="2" />
                <circle cx={C} cy={C} r="34" fill={NIGHT} stroke="rgb(233 204 142 / .4)" />
                <MoonGlobe p={p} cx={C} cy={C} r={20} phase={0.3} />
                <circle cx={pt(sel * 30 + 15, 70).x} cy={pt(sel * 30 + 15, 70).y} r="15" fill={`url(#${p}gold)`} stroke="#FFF3D4" strokeWidth="1.4" />
                <text x={pt(sel * 30 + 15, 70).x} y={pt(sel * 30 + 15, 70).y} textAnchor="middle" dominantBaseline="central" fontSize="16" fill={NIGHT}>
                  ☊︎
                </text>
                <circle cx={pt(sel * 30 + 195, 70).x} cy={pt(sel * 30 + 195, 70).y} r="15" fill={NIGHT} stroke={NIGHT_GOLD} strokeWidth="1.4" />
                <text x={pt(sel * 30 + 195, 70).x} y={pt(sel * 30 + 195, 70).y} textAnchor="middle" dominantBaseline="central" fontSize="16" fill={NIGHT_GOLD}>
                  ☋︎
                </text>
              </g>
            ) : (
              <g pointerEvents="none">
                <circle cx={C} cy={C} r="86" fill="rgb(16 14 38 / .85)" stroke="rgb(233 204 142 / .45)" />
                {/* En luna llena, el Sol está enfrente: su luz llega desde el signo opuesto. */}
                {mode === "full" && (
                  <g>
                    <circle cx={pt(sel * 30 + 195, 64).x} cy={pt(sel * 30 + 195, 64).y} r="14" fill={`url(#${p}sunhalo)`} />
                    <circle cx={pt(sel * 30 + 195, 64).x} cy={pt(sel * 30 + 195, 64).y} r="7" fill={`url(#${p}sun)`} />
                  </g>
                )}
                {mode === "new" && <circle cx={C} cy={C} r="40" fill={`url(#${p}sunhalo)`} />}
                <MoonGlobe p={p} cx={C} cy={C} r={30} phase={ph} glow />
                <text x={C} y={C + 47} textAnchor="middle" fontSize="7.5" letterSpacing="1.6" fill={NIGHT_GOLD}>
                  {SIGNS[sel].name.toUpperCase()}
                </text>
              </g>
            )}
          </svg>
        </NightPanel>
      );
    }
    case "moon-houses":
      return (
        <NightPanel>
          <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label="La Luna en las 12 casas">
            <MoonDefs p={p} />
            <Stars w={340} h={340} n={40} />
            <circle cx={C} cy={C} r="160" fill="none" stroke="rgb(233 204 142 / .4)" strokeWidth="0.8" />
            {HOUSES.map((h, i) => {
              const k = String(h.n);
              const on = selected === k;
              const m = own.has(k);
              const mid = pt(i * 30 + 15, 130);
              const kw = pt(i * 30 + 15, 104);
              return (
                <GlassSector key={h.n} i={i} r1={74} r2={157} on={on} mine={m} {...tap(k, h.name)}>
                  <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="16" fontFamily="Georgia, serif" fill={on ? NIGHT : STAR} pointerEvents="none">
                    {ROMAN[i]}
                  </text>
                  <text x={kw.x} y={kw.y} textAnchor="middle" dominantBaseline="central" fontSize="5.4" letterSpacing="0.8" fill={on ? NIGHT : STAR} fillOpacity={on ? 0.8 : 0.55} pointerEvents="none">
                    {h.keyword.toUpperCase()}
                  </text>
                  {m && <MoonGlobe p={p} cx={pt(i * 30 + 15, 84).x} cy={pt(i * 30 + 15, 84).y} r={7} phase={0.3} />}
                </GlassSector>
              );
            })}
            {/* Los ejes del horizonte y del meridiano. */}
            <g pointerEvents="none" stroke="rgb(233 204 142 / .55)" strokeWidth="1">
              <line x1={C - 160} y1={C} x2={C - 72} y2={C} />
              <line x1={C + 72} y1={C} x2={C + 160} y2={C} />
              <line x1={C} y1={C - 160} x2={C} y2={C - 72} />
              <line x1={C} y1={C + 72} x2={C} y2={C + 160} />
            </g>
            <circle cx={C} cy={C} r="72" fill="rgb(16 14 38 / .85)" stroke="rgb(233 204 142 / .45)" pointerEvents="none" />
            <MoonGlobe p={p} cx={C} cy={C} r={30} phase={0.3} glow />
          </svg>
        </NightPanel>
      );
  }
  return null;
}
