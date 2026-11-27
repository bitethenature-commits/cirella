"use client";

import type { AstroLayer } from "@/lib/lesson-blocks";
import type { DiagramProps, LayerCtx, SystemPiece } from "./layers/common";
import { ASTRO3_LAYERS, Astro3Diagram, astro3Keys, astro3Mine, astro3Piece, type Astro3Layer } from "./layers/astro3";
import { Astro2Diagram, astro2Keys, astro2Mine, astro2Piece, type Astro2Layer } from "./layers/astro2";
import { ExtraDiagram, extraKeys, extraMine, extraPiece, type ExtraLayer } from "./layers/extra";
import { GK2_LAYERS, Gk2Diagram, gk2Keys, gk2Mine, gk2Piece, type Gk2Layer } from "./layers/gk2";
import { GkDiagram, gkKeys, gkMine, gkPiece, type GkLayer } from "./layers/gk";
import { HD2_LAYERS, Hd2Diagram, hd2Keys, hd2Mine, hd2Piece, type Hd2Layer } from "./layers/hd2";
import { HdDiagram, hdKeys, hdMine, hdPiece, type HdLayer } from "./layers/hd";
import { RUNES2_LAYERS, Runes2Diagram, runes2Keys, runes2Mine, runes2Piece, type Runes2Layer } from "./layers/runes2";
import { MOON2_LAYERS, Moon2Diagram, moon2Keys, moon2Mine, moon2Piece, type Moon2Layer } from "./layers/moon2";
import { KunDiagram, isKunLayer, kunKeys, kunMine, kunPiece } from "./layers/kundalini";
import { DayDiagram, dayKeys, dayMine, dayPiece, isDayLayer } from "./layers/day";
import { GeoDiagram, geoKeys, geoMine, geoPiece, isGeoLayer } from "./layers/geo";
import { DimDiagram, dimKeys, dimMine, dimPiece, isDimLayer } from "./layers/dimensions";
import { OracleDiagram, isOracleLayer, oracleKeys, oracleMine, oraclePiece } from "./layers/oracle-layers";
import { MoonDiagram, moonKeys, moonMine, moonPiece, type MoonLayer } from "./layers/moon";

/**
 * Las capas del modelo por partes que no son la rueda de la carta (components/course/astro-layer.tsx):
 * Human Design (layers/hd.tsx), Gene Keys (layers/gk.tsx), la Luna (layers/moon.tsx) y las cualidades,
 * los ángulos y las runas (layers/extra.tsx). Cada capa dice qué piezas tiene con su configuración, qué
 * dice cada una, cuáles son de la alumna (con su carta) y cómo se dibuja.
 */

export type { LayerCtx, SystemPiece } from "./layers/common";
export { LINES } from "./layers/hd";

const WHEEL_LAYERS = ["signs", "houses", "planets", "aspects", "elements"] as const;
export type SystemLayer = Exclude<AstroLayer, (typeof WHEEL_LAYERS)[number]>;
export const isSystemLayer = (l: AstroLayer): l is SystemLayer => !(WHEEL_LAYERS as readonly string[]).includes(l);

const isHd2 = (l: SystemLayer): l is Hd2Layer => HD2_LAYERS.has(l);
const isHd = (l: SystemLayer): l is HdLayer => l.startsWith("hd-");
const isGk2 = (l: SystemLayer): l is Gk2Layer => GK2_LAYERS.has(l);
const isGk = (l: SystemLayer): l is GkLayer => l.startsWith("gk-");
const isRunes2 = (l: SystemLayer): l is Runes2Layer => RUNES2_LAYERS.has(l);
const isMoon2 = (l: SystemLayer): l is Moon2Layer => MOON2_LAYERS.has(l);
const isMoon = (l: SystemLayer): l is MoonLayer => l.startsWith("moon-");
const isAstro3 = (l: SystemLayer): l is Astro3Layer => ASTRO3_LAYERS.has(l);
const isAstro2 = (l: SystemLayer): l is Astro2Layer => l.startsWith("astro-");

/** Las piezas de la capa con su configuración (las puertas de un centro, solo las llaves de su perfil…). */
export function systemKeys(layer: SystemLayer, ctx: LayerCtx): string[] {
  if (isKunLayer(layer)) return kunKeys(layer);
  if (isDayLayer(layer)) return dayKeys();
  if (isGeoLayer(layer)) return geoKeys(layer);
  if (isDimLayer(layer)) return dimKeys(layer);
  if (isOracleLayer(layer)) return oracleKeys(layer, ctx);
  if (isHd2(layer)) return hd2Keys(layer, ctx);
  if (isHd(layer)) return hdKeys(layer, ctx);
  if (isGk2(layer)) return gk2Keys(layer);
  if (isGk(layer)) return gkKeys(layer, ctx);
  if (isMoon2(layer)) return moon2Keys(layer, ctx);
  if (isMoon(layer)) return moonKeys(layer);
  if (isAstro3(layer)) return astro3Keys(layer);
  if (isAstro2(layer)) return astro2Keys(layer);
  if (isRunes2(layer)) return runes2Keys(layer, ctx);
  return extraKeys(layer as ExtraLayer, ctx);
}

export function systemPiece(layer: SystemLayer, key: string, ctx: LayerCtx): SystemPiece {
  if (isKunLayer(layer)) return kunPiece(layer, key, ctx);
  if (isDayLayer(layer)) return dayPiece(layer, key, ctx);
  if (isGeoLayer(layer)) return geoPiece(layer, key, ctx);
  if (isDimLayer(layer)) return dimPiece(layer, key, ctx);
  if (isOracleLayer(layer)) return oraclePiece(layer, key, ctx);
  if (isHd2(layer)) return hd2Piece(layer, key, ctx);
  if (isHd(layer)) return hdPiece(layer, key, ctx);
  if (isGk2(layer)) return gk2Piece(layer, key, ctx);
  if (isGk(layer)) return gkPiece(layer, key, ctx);
  if (isMoon2(layer)) return moon2Piece(layer, key, ctx);
  if (isMoon(layer)) return moonPiece(layer, key, ctx);
  if (isAstro3(layer)) return astro3Piece(layer, key, ctx);
  if (isAstro2(layer)) return astro2Piece(layer, key, ctx);
  if (isRunes2(layer)) return runes2Piece(layer, key, ctx);
  return extraPiece(layer as ExtraLayer, key, ctx);
}

/** Las piezas de la alumna en esta capa: con la primera se abre, y todas llevan «★ En tu carta». */
export function systemMine(layer: SystemLayer, ctx: LayerCtx): string[] {
  if (isKunLayer(layer)) return kunMine(layer, ctx);
  if (isDayLayer(layer)) return dayMine();
  if (isGeoLayer(layer)) return geoMine(layer, ctx);
  if (isDimLayer(layer)) return dimMine(layer, ctx);
  if (isOracleLayer(layer)) return oracleMine(layer, ctx);
  if (isHd2(layer)) return hd2Mine(layer, ctx);
  if (isHd(layer)) return hdMine(layer, ctx);
  if (isGk2(layer)) return gk2Mine(layer, ctx);
  if (isGk(layer)) return gkMine(layer, ctx);
  if (isMoon2(layer)) return moon2Mine(layer, ctx);
  if (isMoon(layer)) return moonMine(layer, ctx);
  if (isAstro3(layer)) return astro3Mine(layer, ctx);
  if (isAstro2(layer)) return astro2Mine(layer, ctx);
  if (isRunes2(layer)) return runes2Mine(layer, ctx);
  return extraMine(layer as ExtraLayer, ctx);
}

export function SystemDiagram({ layer, ...props }: DiagramProps & { layer: SystemLayer }) {
  if (isKunLayer(layer)) return <KunDiagram layer={layer} {...props} />;
  if (isDayLayer(layer)) return <DayDiagram layer={layer} {...props} />;
  if (isGeoLayer(layer)) return <GeoDiagram layer={layer} {...props} />;
  if (isDimLayer(layer)) return <DimDiagram layer={layer} {...props} />;
  if (isOracleLayer(layer)) return <OracleDiagram layer={layer} {...props} />;
  if (isHd2(layer)) return <Hd2Diagram layer={layer} {...props} />;
  if (isHd(layer)) return <HdDiagram layer={layer} {...props} />;
  if (isGk2(layer)) return <Gk2Diagram layer={layer} {...props} />;
  if (isGk(layer)) return <GkDiagram layer={layer} {...props} />;
  if (isMoon2(layer)) return <Moon2Diagram layer={layer} {...props} />;
  if (isMoon(layer)) return <MoonDiagram layer={layer} {...props} />;
  if (isAstro3(layer)) return <Astro3Diagram layer={layer} {...props} />;
  if (isAstro2(layer)) return <Astro2Diagram layer={layer} {...props} />;
  if (isRunes2(layer)) return <Runes2Diagram layer={layer} {...props} />;
  return <ExtraDiagram layer={layer as ExtraLayer} {...props} />;
}
