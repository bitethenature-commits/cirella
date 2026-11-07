"use client";

import { ANGLE_INFO, BODY_INFO, SIGNS, type AngleKey, type Modality } from "@/components/models/data/astrology";
import { AETT_NAME, RUNES, RUNE_SPREADS, TEXT_VS, type RuneSpreadId } from "@/components/models/data/runes";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, CREAM, GOLD, INK, LINE, MUTED, SAND, VS, degIn, listEs, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { MODALITY_TEXT } from "./texts";
import { AnglesWheel, ModalityWheel } from "./astro-wheels";

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

/* -------------------------------------------------------------------------- */

/** Una piedra rúnica: un óvalo irregular con su runa grabada. */
function Stone({ x, y, w, h, glyph, on, label }: { x: number; y: number; w: number; h: number; glyph: string; on: boolean; label?: string }) {
  return (
    <>
      <path
        d={`M${x - w / 2 + 3} ${y - 2}C${x - w / 2} ${y - h / 2 + 2} ${x + w / 2 - 6} ${y - h / 2 - 2} ${x + w / 2 - 1} ${y - 4}C${x + w / 2 + 2} ${y + h / 2 - 6} ${x - w / 2 + 6} ${y + h / 2 + 1} ${x - w / 2 + 3} ${y - 2}Z`}
        fill={on ? INK : "#EDE6D8"}
        stroke={on ? GOLD : "#C9BEA8"}
        strokeWidth={on ? 2 : 1}
      />
      <text x={x} y={y - 1} textAnchor="middle" dominantBaseline="central" fontSize={h * 0.42} fill={on ? GOLD : "#5B4A3A"} pointerEvents="none">
        {glyph}
      </text>
      {label && (
        <text x={x} y={y + h / 2 + 10} textAnchor="middle" fontSize="9" fill={MUTED} pointerEvents="none">
          {label}
        </text>
      )}
    </>
  );
}

export function ExtraDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: ExtraLayer }) {
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
      const rowH = stoneH + (all ? 34 : 26);
      const rows = Math.ceil(list.length / cols);
      const top = (row: number) => 16 + row * rowH;
      return (
        <svg viewBox={`0 0 340 ${16 + rows * rowH}`} className="mx-auto block h-auto w-full max-w-[22rem] select-none" role="group" aria-label="Las runas">
          {(all ? [0, 1, 2] : [0]).map((row) => (
            <text key={row} x="4" y={all ? top(row) - 2 : 10} fontSize="9" fill={MUTED} fontWeight="600">
              {AETT_NAME[list[row * cols].aett].toUpperCase()}
            </text>
          ))}
          {list.map((r, i) => {
            const row = Math.floor(i / cols);
            const x = w / 2 + (i % cols) * w;
            const y = top(row) + 6 + stoneH / 2;
            return (
              <g key={r.id} {...tap(r.id, r.name)}>
                <Stone x={x} y={y} w={w - (all ? 6 : 14)} h={stoneH} glyph={r.glyph + TEXT_VS} on={selected === r.id} label={r.name} />
              </g>
            );
          })}
        </svg>
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
        <svg viewBox="0 0 340 250" className="mx-auto block h-auto w-full max-w-[22rem] select-none" role="group" aria-label={s.label}>
          {s.positions.map((p, i) => {
            const k = `${spread}-${i}`;
            const { x, y } = at(i);
            return (
              <g key={k} {...tap(k, p.name)}>
                <Stone x={x} y={y} w={spread === "five" ? 62 : 78} h={spread === "five" ? 52 : 70} glyph={String(i + 1)} on={selected === k} />
                <text x={x} y={y + (spread === "five" ? 36 : 48)} textAnchor="middle" fontSize="10" fill={INK} fontWeight={selected === k ? 700 : 400}>
                  {p.name}
                </text>
              </g>
            );
          })}
        </svg>
      );
    }
  }
  return null;
}
