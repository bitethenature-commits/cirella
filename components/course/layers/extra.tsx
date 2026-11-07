"use client";

import { ANGLE_INFO, BODY_INFO, SIGNS, type AngleKey, type Modality } from "@/components/models/data/astrology";
import { AETT_NAME, RUNES, RUNE_SPREADS, TEXT_VS, type RuneSpreadId } from "@/components/models/data/runes";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, CREAM, GOLD, INK, LINE, MUTED, SAND, VS, degIn, listEs, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { MODALITY_TEXT } from "./texts";
import { AnglesWheel, ModalityWheel } from "./astro-wheels";
import { NIGHT_GOLD, NightDefs, NightPanel, STAR, Stars, usePrefix } from "./night";

/**
 * Más capas: de la carta astral, las 3 cualidades y los 4 ángulos; de las runas, las 24 runas en sus
 * tres aettir y las posiciones de cada tirada.
 */

export type ExtraLayer = Extract<AstroLayer, "modalities" | "angles" | "rune-aettir" | "rune-spreads">;

const MODALITY_HUE: Record<Modality, string> = { cardinal: "#B5544F", fijo: "#8A7A4E", mutable: "#6E8C9B" };
const PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

export function extraKeys(layer: ExtraLayer, { option }: LayerCtx): string[] {
  const all = LAYER_KEYS[layer];
  if (layer === "rune-aettir" && option && option !== "all") return RUNES.filter((r) => String(r.aett) === option).map((r) => r.id);
  if (layer === "rune-spreads") return all.filter((k) => k.startsWith(`${option ?? "three"}-`));
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
 *  Las runas, sobre el cielo de noche: piedras de río con relieve y la runa tallada; la elegida, con la
 *  talla encendida en oro.
 * -------------------------------------------------------------------------- */

function StoneDefs({ p }: { p: string }) {
  return (
    <>
      <NightDefs p={p} />
      <defs>
        <radialGradient id={`${p}stone`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#B4AEBF" />
          <stop offset="55%" stopColor="#7A7488" />
          <stop offset="100%" stopColor="#4A4659" />
        </radialGradient>
        <radialGradient id={`${p}stoneOn`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#5C5470" />
          <stop offset="60%" stopColor="#332E4A" />
          <stop offset="100%" stopColor="#1C1930" />
        </radialGradient>
        <filter id={`${p}drop`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>
    </>
  );
}

/** Una piedra rúnica: un canto rodado irregular con su runa tallada (luz y sombra en el surco). */
function Stone({ p, x, y, w, h, glyph, on, label }: { p: string; x: number; y: number; w: number; h: number; glyph: string; on: boolean; label?: string }) {
  const d = `M${x - w / 2 + 3} ${y - 2}C${x - w / 2} ${y - h / 2 + 2} ${x + w / 2 - 6} ${y - h / 2 - 2} ${x + w / 2 - 1} ${y - 4}C${x + w / 2 + 2} ${y + h / 2 - 6} ${x - w / 2 + 6} ${y + h / 2 + 1} ${x - w / 2 + 3} ${y - 2}Z`;
  const fs = h * 0.46;
  return (
    <>
      {on && <ellipse cx={x} cy={y} rx={w * 0.7} ry={h * 0.75} fill={`url(#${p}goldglow)`} pointerEvents="none" />}
      <path d={d} fill={`url(#${p}${on ? "stoneOn" : "stone"})`} stroke={on ? "#F0D9A4" : "rgb(255 255 255 / .25)"} strokeWidth={on ? 1.8 : 0.8} filter={`url(#${p}drop)`} />
      <ellipse cx={x - w * 0.12} cy={y - h * 0.22} rx={w * 0.22} ry={h * 0.12} fill="#fff" opacity={on ? 0.08 : 0.18} pointerEvents="none" />
      {!on && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill="#D8D2E0" opacity="0.55" pointerEvents="none" transform="translate(0.6 0.9)">
          {glyph}
        </text>
      )}
      {on && (
        <text x={x} y={y - 0.5} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill={NIGHT_GOLD} opacity="0.6" filter={`url(#${p}blur)`} pointerEvents="none">
          {glyph}
        </text>
      )}
      <text x={x} y={y - 0.5} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fill={on ? "#FFE7AE" : "#2B2738"} pointerEvents="none">
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
      const spread = (ctx.option ?? "three") as RuneSpreadId;
      const s = RUNE_SPREADS[spread];
      const at = (i: number) => {
        if (spread === "one") return { x: 170, y: 120 };
        if (spread === "three") return { x: 70 + i * 100, y: 120 };
        const [r, c] = (s.positions[i].area ?? "2 / 2").split("/").map((v) => Number(v.trim()));
        return { x: 70 + (c - 1) * 100, y: 46 + (r - 1) * 76 };
      };
      return (
        <NightPanel>
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
