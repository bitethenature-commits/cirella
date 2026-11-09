"use client";

import { ANGLE_INFO, BODY_INFO, SIGNS, type AngleKey, type Modality } from "@/components/models/data/astrology";
import { AETT_NAME, RUNES, RUNE_SPREADS, TEXT_VS, type RuneSpreadId } from "@/components/models/data/runes";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, CREAM, GOLD, INK, LINE, MUTED, SAND, VS, degIn, listEs, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { MODALITY_TEXT } from "./texts";
import { AnglesWheel, ModalityWheel } from "./astro-wheels";
import { NIGHT_GOLD, NightDefs, NightPanel, OptionChips, STAR, Stars, usePrefix } from "./night";

/**
 * Más capas: de la carta astral, las 3 cualidades y los 4 ángulos; de las runas, las 24 runas en sus
 * tres aettir y las posiciones de cada tirada.
 */

export type ExtraLayer = Extract<AstroLayer, "modalities" | "angles" | "rune-aettir" | "rune-spreads">;

const MODALITY_HUE: Record<Modality, string> = { cardinal: "#B5544F", fijo: "#8A7A4E", mutable: "#6E8C9B" };
const PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

export function extraKeys(layer: ExtraLayer, { option }: LayerCtx): string[] {
  const all = LAYER_KEYS[layer];
  if (layer === "rune-spreads") return all.filter((k) => k.startsWith(`${option && option in RUNE_SPREADS ? option : "three"}-`));
  return all;
}

/** Cuántos planetas de la alumna hay en cada cualidad. */
function planetsBy(c: LayerCtx["c"], m: Modality) {
  if (!c) return [];
  return PLANETS.filter((id) => {
    const b = c.chart.bodies.find((x) => x.id === id);
    return b && SIGNS[signIndex(b.lon)].modality === m;
  }).map((id) => BODY_INFO[id].name);
}

export function extraMine(layer: ExtraLayer, { c }: LayerCtx): string[] {
  if (layer === "modalities" && c) {
    const best = (["cardinal", "fijo", "mutable"] as Modality[]).map((m) => [m, planetsBy(c, m).length] as const).sort((a, b) => b[1] - a[1])[0];
    return best[1] ? [best[0]] : [];
  }
  return [];
}

export function extraPiece(layer: ExtraLayer, key: string, { option, c }: LayerCtx): SystemPiece {
  switch (layer) {
    case "modalities": {
      const m = MODALITY_TEXT[key as Modality];
      const signs = SIGNS.filter((s) => s.modality === key);
      const ps = planetsBy(c, key as Modality);
      return {
        glyph: "",
        name: `${m.name} · ${m.verb}`,
        kicker: listEs(signs.map((s) => s.name)),
        meaning: m.meaning,
        personal: c ? (ps.length ? `En tu carta: ${listEs(ps)} ${ps.length === 1 ? "está" : "están"} en signos ${{ cardinal: "cardinales", fijo: "fijos", mutable: "mutables" }[key as Modality]}.` : "Ninguno de tus planetas está en esta cualidad: es una energía que buscas fuera.") : null,
      };
    }
    case "angles": {
      const a = ANGLE_INFO[key as AngleKey];
      const lon = c?.chart.angles?.[key as AngleKey];
      return {
        glyph: a.short,
        name: a.name,
        kicker: `${a.keyword} · cúspide de la casa ${a.house}`,
        meaning: `${a.meaning}\n\nAscendente y Descendente forman el eje del horizonte (yo y el otro); Medio Cielo y Fondo del Cielo, el del meridiano (lo público y lo íntimo).`,
        personal: c ? (lon != null ? `Tu ${a.name} está a ${degIn(lon)} de ${SIGNS[signIndex(lon)].name}: ${SIGNS[signIndex(lon)].keyword.toLowerCase()}.` : "Sin hora de nacimiento no se pueden calcular los ángulos.") : null,
      };
    }
    case "rune-aettir": {
      const r = RUNES.find((x) => x.id === key)!;
      const n = RUNES.indexOf(r) + 1;
      return {
        glyph: r.glyph + TEXT_VS,
        name: r.name,
        kicker: `${AETT_NAME[r.aett]} · runa ${n} · suena «${r.sound}»`,
        meaning: `${r.meaning}.\n\nDerecha: ${r.upright}\n\n${r.reversed ? `Invertida (merkstave): ${r.reversed}` : "Es simétrica: no se invierte. Se lee igual caiga como caiga."}`,
        personal: null,
      };
    }
    case "rune-spreads": {
      const [spread, i] = key.split("-") as [RuneSpreadId, string];
      const s = RUNE_SPREADS[spread];
      const pos = s.positions[Number(i)];
      return {
        glyph: String(Number(i) + 1),
        name: pos.name,
        kicker: `${s.label} · posición ${Number(i) + 1} de ${s.positions.length}`,
        meaning: `${pos.hint}\n\nLa runa que caiga aquí se lee desde esta pregunta. Si sale invertida, la energía está bloqueada o vuelta hacia dentro en este punto de la tirada.`,
        personal: null,
      };
    }
  }
  void option;
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* -------------------------------------------------------------------------- *
 *  Las runas, talladas en hueso: piezas de marfil pulido, con su poro y sus vetas, el borde un poco más
 *  oscuro, un brillo suave y la runa grabada en tinta (con la luz en el labio del surco). La elegida, con
 *  el hueso más cálido, el filo dorado y la runa rellena de oro.
 * -------------------------------------------------------------------------- */

export function StoneDefs({ p }: { p: string }) {
  return (
    <>
      <NightDefs p={p} />
      <defs>
        <radialGradient id={`${p}bone`} cx="36%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#FCF8EE" />
          <stop offset="50%" stopColor="#EBE0C8" />
          <stop offset="100%" stopColor="#BFA983" />
        </radialGradient>
        <radialGradient id={`${p}boneOn`} cx="36%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#FFF8E4" />
          <stop offset="50%" stopColor="#F2DFB4" />
          <stop offset="100%" stopColor="#C7A262" />
        </radialGradient>
        <radialGradient id={`${p}boneEdge`} cx="50%" cy="50%" r="50%">
          <stop offset="62%" stopColor="#5E4325" stopOpacity="0" />
          <stop offset="100%" stopColor="#5E4325" stopOpacity="0.34" />
        </radialGradient>
        <radialGradient id={`${p}boneGloss`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}runeGold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBE7B0" />
          <stop offset="45%" stopColor="#D9AE5C" />
          <stop offset="100%" stopColor="#8E6424" />
        </linearGradient>
        {/* El poro del hueso. */}
        <filter id={`${p}pores`} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.3  0 0 0 0 0.17  0 0 0 1.5 -0.78" result="c" />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id={`${p}drop`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3.5" stdDeviation="3.2" floodColor="#000" floodOpacity="0.6" />
        </filter>
        <filter id={`${p}soft2`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
    </>
  );
}

/** Una runa de hueso: la pieza pulida, algo irregular, con la runa grabada (o un número, en las tiradas). */
export function Stone({ p, x, y, w, h, glyph, on, label }: { p: string; x: number; y: number; w: number; h: number; glyph: string; on: boolean; label?: string }) {
  const rx = w / 2;
  const ry = h / 2;
  const d = `M${x} ${y - ry}C${x + rx * 0.62} ${y - ry * 1.01} ${x + rx} ${y - ry * 0.6} ${x + rx * 0.98} ${y + ry * 0.02}C${x + rx * 0.97} ${y + ry * 0.66} ${x + rx * 0.55} ${y + ry} ${x - rx * 0.04} ${y + ry * 0.99}C${x - rx * 0.62} ${y + ry * 0.98} ${x - rx} ${y + ry * 0.58} ${x - rx * 0.99} ${y - ry * 0.04}C${x - rx * 0.98} ${y - ry * 0.64} ${x - rx * 0.58} ${y - ry} ${x} ${y - ry}Z`;
  const fs = h * 0.5;
  return (
    <>
      {on && <ellipse cx={x} cy={y} rx={w * 0.78} ry={h * 0.8} fill={`url(#${p}goldglow)`} pointerEvents="none" />}
      <path d={d} fill={`url(#${p}${on ? "boneOn" : "bone"})`} filter={`url(#${p}drop)`} />
      <path d={d} fill="#000" filter={`url(#${p}pores)`} opacity="0.55" pointerEvents="none" />
      {/* Una veta fina, como en el hueso de verdad. */}
      <path d={`M${x + rx * 0.2} ${y - ry * 0.88}q${rx * 0.25} ${ry * 0.3} ${rx * 0.55} ${ry * 0.42}`} fill="none" stroke="#9C8058" strokeOpacity="0.28" strokeWidth="0.6" strokeLinecap="round" pointerEvents="none" />
      <path d={d} fill={`url(#${p}boneEdge)`} pointerEvents="none" />
      <ellipse cx={x - rx * 0.3} cy={y - ry * 0.48} rx={rx * 0.42} ry={ry * 0.2} fill={`url(#${p}boneGloss)`} opacity="0.8" transform={`rotate(-14 ${x - rx * 0.3} ${y - ry * 0.48})`} pointerEvents="none" />
      <path d={d} fill="none" stroke={on ? "#D4B57A" : "#7A6142"} strokeOpacity={on ? 1 : 0.45} strokeWidth={on ? 1.6 : 0.6} pointerEvents="none" />
      {/* La runa grabada: la luz en el labio de abajo, la sombra arriba y la tinta (u oro) en el surco. */}
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill="#FFFFFF" opacity="0.75" pointerEvents="none" transform="translate(0.5 0.9)">
        {glyph}
      </text>
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill="#4A321A" opacity="0.45" pointerEvents="none" transform="translate(-0.4 -0.6)">
        {glyph}
      </text>
      {on && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill="#F0C978" opacity="0.7" filter={`url(#${p}soft2)`} pointerEvents="none">
          {glyph}
        </text>
      )}
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill={on ? `url(#${p}runeGold)` : "#3A2615"} stroke={on ? "#6B4A1E" : "none"} strokeWidth={on ? 0.5 : 0} pointerEvents="none">
        {glyph}
      </text>
      {label && (
        <text x={x} y={y + h / 2 + 11} textAnchor="middle" fontSize="9" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR} fillOpacity={on ? 1 : 0.75} pointerEvents="none">
          {label}
        </text>
      )}
    </>
  );
}

export function ExtraDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: ExtraLayer }) {
  const p = usePrefix();
  const own = new Set(mine);
  switch (layer) {
    case "modalities":
      return <ModalityWheel selected={selected} own={own} tap={tap} />;
    case "angles":
      return <AnglesWheel selected={selected} tap={tap} chart={ctx.c?.chart ?? null} />;
    case "rune-aettir": {
      // Las 24 en tres filas de ocho (una por aett, con su nombre encima); un aett solo, en dos filas de cuatro, más grandes.
      const list = keys.map((k) => RUNES.find((r) => r.id === k)!);
      const all = list.length > 8;
      const cols = all ? 8 : 4;
      const w = 340 / cols;
      const stoneH = all ? 40 : 60;
      const rowH = stoneH + (all ? 50 : 34);
      const rows = Math.ceil(list.length / cols);
      const top = (row: number) => 22 + row * rowH;
      const H = 22 + rows * rowH;
      return (
        <NightPanel>
          <svg viewBox={`0 0 340 ${H}`} className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label="Las runas">
            <StoneDefs p={p} />
            <Stars w={340} h={H} n={36} />
            {(all ? [0, 1, 2] : [0]).map((row) => (
              <g key={row} pointerEvents="none">
                <line x1="6" y1={top(row) - 6} x2="334" y2={top(row) - 6} stroke="rgb(233 204 142 / .18)" />
                <text x="170" y={top(row) - 6} textAnchor="middle" dominantBaseline="central" fontSize="8.5" letterSpacing="2" fontWeight="700" fill={NIGHT_GOLD} stroke="#17153A" strokeWidth="6" paintOrder="stroke">
                  {AETT_NAME[list[row * cols].aett].toUpperCase()}
                </text>
              </g>
            ))}
            {list.map((r, i) => {
              const row = Math.floor(i / cols);
              const x = w / 2 + (i % cols) * w;
              const y = top(row) + 8 + stoneH / 2;
              return (
                <g key={r.id} {...tap(r.id, r.name)}>
                  <Stone p={p} x={x} y={y} w={w - (all ? 8 : 16)} h={stoneH} glyph={r.glyph + TEXT_VS} on={selected === r.id} label={r.name} />
                </g>
              );
            })}
          </svg>
        </NightPanel>
      );
    }
    case "rune-spreads": {
      const spread = (ctx.option && ctx.option in RUNE_SPREADS ? ctx.option : "three") as RuneSpreadId;
      const s = RUNE_SPREADS[spread];
      const at = (i: number) => {
        if (spread === "one") return { x: 170, y: 120 };
        if (spread === "three") return { x: 70 + i * 100, y: 120 };
        const [r, c] = (s.positions[i].area ?? "2 / 2").split("/").map((v) => Number(v.trim()));
        return { x: 70 + (c - 1) * 100, y: 46 + (r - 1) * 76 };
      };
      return (
        <NightPanel>
          <OptionChips options={(["one", "three", "five"] as const).map((v) => ({ value: v, label: RUNE_SPREADS[v].label }))} value={spread} onPick={ctx.setOption} />
          <svg viewBox="0 0 340 250" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={s.label}>
            <StoneDefs p={p} />
            <Stars w={340} h={250} n={30} />
            {/* El paño de la tirada: un círculo dorado donde caen las piedras. */}
            <circle cx="170" cy="122" r="112" fill="rgb(233 204 142 / .05)" stroke="rgb(233 204 142 / .35)" strokeWidth="0.8" />
            <circle cx="170" cy="122" r="104" fill="none" stroke="rgb(233 204 142 / .18)" strokeWidth="0.6" strokeDasharray="2 4" />
            {s.positions.map((pos, i) => {
              const k = `${spread}-${i}`;
              const { x, y } = at(i);
              const on = selected === k;
              return (
                <g key={k} {...tap(k, pos.name)}>
                  <Stone p={p} x={x} y={y} w={spread === "five" ? 62 : 78} h={spread === "five" ? 52 : 70} glyph={String(i + 1)} on={on} />
                  <text x={x} y={y + (spread === "five" ? 37 : 50)} textAnchor="middle" fontSize="10" fill={on ? NIGHT_GOLD : STAR} fillOpacity={on ? 1 : 0.8} fontWeight={on ? 700 : 500} stroke="#17153A" strokeWidth="4" paintOrder="stroke">
                    {pos.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </NightPanel>
      );
    }
  }
  return null;
}
