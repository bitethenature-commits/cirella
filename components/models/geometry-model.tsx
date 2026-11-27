"use client";

import { GEO_INTRO, GEO_KEYS, GEO_TITLE, GeoDiagram, geoPiece, type GeoLayer } from "@/components/course/layers/geo";
import { LayerExplorer, type ExplorerTab } from "./layer-explorer";
import { useT } from "@/lib/i18n/client";

/**
 * Filosofía · geometría sagrada: el modelo principal. Las doce figuras de los modelos por partes en uno: se elige la
 * figura, se dibuja en oro paso a paso y cada parte se explica al tocarla.
 */

const SHORT: Record<GeoLayer, string> = {
  "geo-circle": "El círculo",
  "geo-vesica": "Vesica piscis",
  "geo-flower": "Flor de la vida",
  "geo-metatron": "Metatrón",
  "geo-platonic": "Sólidos",
  "geo-golden": "Proporción áurea",
  "geo-numbers": "Números",
  "geo-tree": "Árbol de la vida",
  "geo-sriyantra": "Sri Yantra",
  "geo-merkaba": "Merkaba",
  "geo-torus": "El toro",
  "geo-chakras": "Chakras",
};

const ORDER: GeoLayer[] = ["geo-circle", "geo-vesica", "geo-flower", "geo-metatron", "geo-platonic", "geo-golden", "geo-numbers", "geo-tree", "geo-sriyantra", "geo-merkaba", "geo-torus", "geo-chakras"];

const TABS: ExplorerTab<GeoLayer>[] = ORDER.map((l) => ({ layer: l, label: SHORT[l], title: GEO_TITLE[l], intro: GEO_INTRO[l] }));

export function GeometryModel() {
  const t = useT();
  return <LayerExplorer tabs={TABS} keysOf={(l) => GEO_KEYS[l]} pieceOf={geoPiece} Diagram={GeoDiagram} label={t("Geometría sagrada")} footnote="Las figuras se trazan como con compás y regla: toca «Volver a dibujar» para verlas nacer otra vez." />;
}
