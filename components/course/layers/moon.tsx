"use client";

import { HOUSES, SIGNS, ELEMENT_HUE } from "@/components/models/data/astrology";
import { EIGHT_PHASES, FULL_MOON_IN_SIGN, MOON_IN_SIGN, NATAL_PHASE, NEW_MOON_IN_SIGN, PHASE_GUIDANCE, ZODIAC_SIGNS, moonPhase, moonSign } from "@/components/models/data/moon";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, CREAM, GOLD, INK, LINE, MUTED, ROMAN, SAND, VS, degIn, moonLit, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { MOON_NATAL_HOUSE, MOON_NATAL_SIGN, NORTH_NODE_SIGN, SOUTH_NODE_SIGN } from "./texts";
import { NIGHT, NIGHT_GOLD, NightDefs, NightPanel, STAR, Stars, usePrefix } from "./night";
import { DegreeTicks } from "./wheel-kit";
import { CelestialDefs, MoonGlobe, SunGlobe } from "./celestial";
import { Tr, useT } from "@/lib/i18n/client";

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
        personal: c && natal ? "Naciste en esta fase: es tu Luna natal." : null,
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
        personal: c && natal != null && natal === i ? `Tu Luna natal está aquí, a ${degIn(moonLonNatal!)} de ${s.name}.` : null,
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
        personal: c && mine === n ? "Tu Luna natal está en esta casa." : null,
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
        kicker: `Hacia dónde creces · eje ${s.name}-${south.name}`,
        meaning: `${NORTH_NODE_SIGN[i]}\n\nLos nodos son los dos puntos donde la órbita de la Luna cruza el camino del Sol. El Norte es lo que viniste a aprender; el Sur, lo conocido. Recorren el zodiaco hacia atrás en unos 18,6 años: ahí ocurren los eclipses.`,
        personal: l != null && signIndex(l) === i ? `Tu Nodo Norte está aquí, a ${degIn(l)} de ${s.name}, y tu Nodo Sur en ${south.name}.` : null,
        extra: {
          glyph: "☋" + VS,
          name: `Nodo Sur en ${south.name}`,
          kicker: `Lo que ya traes · tu zona cómoda`,
          meaning: SOUTH_NODE_SIGN[(i + 6) % 12],
        },
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
export { MoonGlobe, SunGlobe, EarthGlobe, SolarEclipse } from "./celestial";

export function MoonDefs({ p }: { p: string }) {
  return (
    <>
      <NightDefs p={p} />
      <CelestialDefs p={p} />
      <defs>
        <radialGradient id={`${p}sunhalo`} cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor="#F0C978" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F0C978" stopOpacity="0" />
        </radialGradient>
      </defs>
    </>
  );
}

/** Un anillo de doce sectores de cristal (signos o casas): el elegido, dorado y levantado. */
/** Un sector de la rueda, como en la carta natal: el color de su elemento muy suave (o noche), filetes finos y, el elegido, en oro translúcido con su filete dorado. */
function GlassSector({ i, r1, r2, on, mine, hue, children, ...rest }: { i: number; r1: number; r2: number; on: boolean; mine: boolean; hue?: string; children?: React.ReactNode } & Record<string, unknown>) {
  return (
    <g {...rest}>
      <path
        d={sector(i * 30, i * 30 + 30, r1, r2)}
        fill={on ? "rgb(212 181 122 / .24)" : mine ? "rgb(212 181 122 / .12)" : hue ? `${hue}${i % 2 ? "1c" : "2a"}` : i % 2 ? "rgb(255 255 255 / .03)" : "rgb(255 255 255 / .06)"}
        stroke={on ? "#D4B57A" : "rgb(255 255 255 / .14)"}
        strokeWidth={on ? 1 : 0.8}
      />
      {on && <path d={sector(i * 30 + 1, i * 30 + 29, r2 - 2, r2)} fill="#D4B57A" />}
      {children}
    </g>
  );
}

export function MoonDiagram({ layer, selected, mine, tap, ctx }: DiagramProps & { layer: MoonLayer }) {
  const t = useT();
  const p = usePrefix();
  /** Tu Luna natal, con la fase en la que naciste (sin carta, una creciente cualquiera). */
  const natalPh = ctx.c ? ctx.c.natalMoon.elong / 360 : 0.3;
  const own = new Set(mine);
  switch (layer) {
    case "moon-phases": {
      const today = phaseIndexToday();
      return (
        <NightPanel>
          <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[46rem] select-none" role="group" aria-label={t("Las 8 fases de la Luna")}>
            <MoonDefs p={p} />
            <Stars w={340} h={340} n={46} />
            <circle cx={C} cy={C} r="122" fill="none" stroke="rgb(233 204 142 / .35)" strokeWidth="0.8" strokeDasharray="1 5" />
            {/* El Sol en el centro: la luz que reciben todas. */}
            <SunGlobe p={p} cx={C} cy={C} r={19} rays={false} />
            <text x={C} y={C + 36} textAnchor="middle" fontSize="7" letterSpacing="1.6" fill={NIGHT_GOLD}><Tr s={"SOL"} /></text>
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
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: NIGHT_GOLD }} />{" "}<Tr s={"La Luna de hoy"} /></span>
            <span className="inline-flex items-center gap-1" style={{ color: NIGHT_GOLD }}>
              ★ <span style={{ color: "rgb(251 246 236 / .72)" }}><Tr s={"Tu Luna al nacer"} /></span>
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
          <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[46rem] select-none" role="group" aria-label={layer === "moon-nodes" ? t("Los nodos lunares") : t("La Luna en los 12 signos")}>
            <MoonDefs p={p} />
            <Stars w={340} h={340} n={40} />
            <circle cx={C} cy={C} r="157" fill="rgb(212 181 122 / .04)" stroke="#D4B57A" strokeOpacity="0.6" strokeWidth="0.8" />
            {SIGNS.map((s, i) => {
              const k = String(i);
              const on = sel === i;
              const isSouth = mode === "nodes" && (sel + 6) % 12 === i;
              const m = own.has(k);
              const g = pt(i * 30 + 15, 138);
              const mo = pt(i * 30 + 15, 106);
              return (
                <GlassSector key={i} i={i} r1={88} r2={157} on={on} mine={m || isSouth} hue={ELEMENT_HUE[s.element]} {...tap(k, s.name)}>
                  <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="19" fill={on ? NIGHT_GOLD : ELEMENT_HUE[s.element]} pointerEvents="none">
                    {s.glyph + VS}
                  </text>
                  {mode !== "nodes" && <MoonGlobe p={p} cx={mo.x} cy={mo.y} r={on ? 10 : 8.5} phase={ph} />}
                  {m && (
                    <text x={pt(i * 30 + 15, 153).x} y={pt(i * 30 + 15, 153).y - 0} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={NIGHT_GOLD} pointerEvents="none">
                      ★
                    </text>
                  )}
                  {mode === "sky" && today === i && <circle cx={pt(i * 30 + 15, 92).x} cy={pt(i * 30 + 15, 92).y} r="4" fill={NIGHT_GOLD} stroke={NIGHT} pointerEvents="none" />}
                </GlassSector>
              );
            })}
            <DegreeTicks r={88} />
            {mode === "nodes" ? (
              <g pointerEvents="none">
                {/* El eje de los nodos: del Sur (lo conocido) al Norte (hacia dónde creces). */}
                <line x1={pt(sel * 30 + 195, 84).x} y1={pt(sel * 30 + 195, 84).y} x2={pt(sel * 30 + 15, 84).x} y2={pt(sel * 30 + 15, 84).y} stroke={NIGHT_GOLD} strokeWidth="5" strokeOpacity="0.3" filter={`url(#${p}blur)`} />
                <line x1={pt(sel * 30 + 195, 84).x} y1={pt(sel * 30 + 195, 84).y} x2={pt(sel * 30 + 15, 84).x} y2={pt(sel * 30 + 15, 84).y} stroke={NIGHT_GOLD} strokeWidth="2" />
                <circle cx={C} cy={C} r="34" fill={NIGHT} stroke="rgb(233 204 142 / .4)" />
                <MoonGlobe p={p} cx={C} cy={C} r={20} phase={natalPh} />
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
                <circle cx={C} cy={C} r="86" fill="rgb(11 11 13 / .85)" stroke="rgb(233 204 142 / .45)" />
                {/* En luna llena, el Sol está enfrente: su luz llega desde el signo opuesto. */}
                {mode === "full" && (
                  <g>
                    <SunGlobe p={p} cx={pt(sel * 30 + 195, 64).x} cy={pt(sel * 30 + 195, 64).y} r={6.5} rays={false} />
                  </g>
                )}
                {mode === "new" && <circle cx={C} cy={C} r="40" fill={`url(#${p}sunhalo)`} />}
                <MoonGlobe p={p} cx={C} cy={C} r={30} phase={mode === "natal" ? natalPh : ph} glow />
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
          <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[46rem] select-none" role="group" aria-label={t("La Luna en las 12 casas")}>
            <MoonDefs p={p} />
            <Stars w={340} h={340} n={40} />
            <circle cx={C} cy={C} r="157" fill="rgb(212 181 122 / .04)" stroke="#D4B57A" strokeOpacity="0.6" strokeWidth="0.8" />
            {HOUSES.map((h, i) => {
              const k = String(h.n);
              const on = selected === k;
              const m = own.has(k);
              const mid = pt(i * 30 + 15, 130);
              const kw = pt(i * 30 + 15, 104);
              return (
                <GlassSector key={h.n} i={i} r1={74} r2={157} on={on} mine={m} {...tap(k, h.name)}>
                  <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="16" fontFamily="Georgia, serif" fill={on ? NIGHT_GOLD : STAR} pointerEvents="none">
                    <Tr s={ROMAN[i]} />
                  </text>
                  <text x={kw.x} y={kw.y} textAnchor="middle" dominantBaseline="central" fontSize="5.4" letterSpacing="0.8" fill={on ? NIGHT_GOLD : STAR} fillOpacity={on ? 0.9 : 0.55} pointerEvents="none">
                    {h.keyword.toUpperCase()}
                  </text>
                  {m && <MoonGlobe p={p} cx={pt(i * 30 + 15, 84).x} cy={pt(i * 30 + 15, 84).y} r={7} phase={natalPh} />}
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
            <circle cx={C} cy={C} r="72" fill="rgb(11 11 13 / .85)" stroke="rgb(233 204 142 / .45)" pointerEvents="none" />
            <MoonGlobe p={p} cx={C} cy={C} r={30} phase={natalPh} glow />
          </svg>
        </NightPanel>
      );
  }
  return null;
}
