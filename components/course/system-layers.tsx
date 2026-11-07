"use client";

import type { AstroLayer } from "@/lib/lesson-blocks";
import type { DiagramProps, LayerCtx, SystemPiece } from "./layers/common";
import { ExtraDiagram, extraKeys, extraMine, extraPiece, type ExtraLayer } from "./layers/extra";
import { GkDiagram, gkKeys, gkMine, gkPiece, type GkLayer } from "./layers/gk";
import { HdDiagram, hdKeys, hdMine, hdPiece, type HdLayer } from "./layers/hd";
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

const isHd = (l: SystemLayer): l is HdLayer => l.startsWith("hd-");
const isGk = (l: SystemLayer): l is GkLayer => l.startsWith("gk-");
const isMoon = (l: SystemLayer): l is MoonLayer => l.startsWith("moon-");

/** Las piezas de la capa con su configuración (las puertas de un centro, solo las llaves de su perfil…). */
export function systemKeys(layer: SystemLayer, ctx: LayerCtx): string[] {
  if (isHd(layer)) return hdKeys(layer, ctx);
  if (isGk(layer)) return gkKeys(layer, ctx);
  if (isMoon(layer)) return moonKeys(layer);
  return extraKeys(layer as ExtraLayer, ctx);
}

export function systemPiece(layer: SystemLayer, key: string, ctx: LayerCtx): SystemPiece {
  if (isHd(layer)) return hdPiece(layer, key, ctx);
  if (isGk(layer)) return gkPiece(layer, key, ctx);
  if (isMoon(layer)) return moonPiece(layer, key, ctx);
  return extraPiece(layer as ExtraLayer, key, ctx);
}

/** Las piezas de la alumna en esta capa: con la primera se abre, y todas llevan «★ En tu carta». */
export function systemMine(layer: SystemLayer, ctx: LayerCtx): string[] {
  if (isHd(layer)) return hdMine(layer, ctx);
  if (isGk(layer)) return gkMine(layer, ctx);
  if (isMoon(layer)) return moonMine(layer, ctx);
  return extraMine(layer as ExtraLayer, ctx);
}

export function SystemDiagram({ layer, ...props }: DiagramProps & { layer: SystemLayer }) {
  if (isHd(layer)) return <HdDiagram layer={layer} {...props} />;
  if (isGk(layer)) return <GkDiagram layer={layer} {...props} />;
  if (isMoon(layer)) return <MoonDiagram layer={layer} {...props} />;
  return <ExtraDiagram layer={layer as ExtraLayer} {...props} />;
}
