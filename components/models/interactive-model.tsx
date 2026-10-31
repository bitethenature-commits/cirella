"use client";

import dynamic from "next/dynamic";
import type { ModelKind } from "@/lib/page-blocks";

/**
 * Los modelos interactivos del bloque «Modelo interactivo» (lib/page-blocks.ts). Cada uno se carga aparte
 * y solo en el navegador: el SVG grande y sus datos no pesan en el HTML ni en las páginas que no lo usan.
 * Mientras llega, un hueco de su tamaño (sin saltos al cargar).
 */
function Loading() {
  return (
    <div className="grid min-h-[24rem] place-items-center" aria-busy="true">
      <span className="cp-faint text-[0.85rem]">Cargando el modelo…</span>
    </div>
  );
}

const ChartModel = dynamic(() => import("./chart-model").then((m) => m.ChartModel), { ssr: false, loading: Loading });
const BodygraphModel = dynamic(() => import("./bodygraph-model").then((m) => m.BodygraphModel), { ssr: false, loading: Loading });
const GeneKeysModel = dynamic(() => import("./gene-keys-model").then((m) => m.GeneKeysModel), { ssr: false, loading: Loading });
const LunarModel = dynamic(() => import("./lunar-model").then((m) => m.LunarModel), { ssr: false, loading: Loading });

export function InteractiveModel({ model }: { model: Exclude<ModelKind, "geometry"> }) {
  switch (model) {
    case "chart":
      return <ChartModel />;
    case "bodygraph":
      return <BodygraphModel />;
    case "geneKeys":
      return <GeneKeysModel />;
    case "lunar":
      return <LunarModel />;
  }
}
