"use client";

import { DIM_INTRO, DIM_TITLE, DimDiagram, dimKeys, dimPiece, type DimLayer } from "@/components/course/layers/dimensions";
import { DIM_NOTE } from "./data/dimensions";
import { LayerExplorer, type ExplorerTab } from "./layer-explorer";
import { useT } from "@/lib/i18n/client";

/**
 * Las dimensiones del ser, de la 3D a la 12D: el modelo principal. Sus cuatro partes en uno: las diez dimensiones
 * (una figura dentro de otra), el paso de la 3D a la 5D, las dimensiones en los chakras y la forma de cada una.
 */

const TABS: ExplorerTab<DimLayer>[] = [
  { layer: "dim-levels", label: "Las 10 dimensiones" },
  { layer: "dim-shift", label: "De 3D a 5D" },
  { layer: "dim-chakras", label: "Chakras" },
  { layer: "dim-geometry", label: "Geometría" },
].map((t) => ({ layer: t.layer as DimLayer, label: t.label, title: DIM_TITLE[t.layer as DimLayer], intro: DIM_INTRO[t.layer as DimLayer] }));

export function DimensionsModel() {
  const t = useT();
  return <LayerExplorer tabs={TABS} keysOf={dimKeys} pieceOf={dimPiece} Diagram={DimDiagram} label={t("Las dimensiones del ser")} footnote={DIM_NOTE} />;
}
