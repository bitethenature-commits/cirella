"use client";

import dynamic from "next/dynamic";
import type { ModelKind } from "@/lib/page-blocks";
import type { OracleDeckView } from "./data/oracle";
import type { ModelGateInfo } from "./model-gate";

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
const RunesModel = dynamic(() => import("./runes-model").then((m) => m.RunesModel), { ssr: false, loading: Loading });
// El candado de «Calcular con mis datos» (con su formulario y el de la newsletter), también aparte.
const ModelGate = dynamic(() => import("./model-gate").then((m) => m.ModelGate), { ssr: false, loading: Loading });
const OracleModel = dynamic(() => import("./oracle-model").then((m) => m.OracleModel), { ssr: false, loading: Loading });

/**
 * `deck`: solo el oráculo, una baraja propia ya cargada en el servidor (sin ella, la de serie).
 * `gate`: en las páginas públicas de la web personal, los cuatro modelos calculados enseñan el ejemplo
 * y «Calcular con mis datos» solo a quien tiene el acceso (components/models/model-gate.tsx). Sin él
 * (vistas previas del panel, modo plataforma), cada modelo trae su propio formulario como siempre.
 */
export function InteractiveModel({ model, deck, gate }: { model: Exclude<ModelKind, "geometry">; deck?: OracleDeckView | null; gate?: ModelGateInfo | null }) {
  if (gate && (model === "chart" || model === "bodygraph" || model === "geneKeys" || model === "lunar"))
    return (
      <ModelGate model={model} gate={gate}>
        {(profile) =>
          model === "chart" ? (
            <ChartModel profile={profile} ownForm={false} />
          ) : model === "bodygraph" ? (
            <BodygraphModel profile={profile} />
          ) : model === "geneKeys" ? (
            <GeneKeysModel profile={profile} />
          ) : (
            <LunarModel profile={profile} ownForm={false} />
          )
        }
      </ModelGate>
    );
  switch (model) {
    case "chart":
      return <ChartModel />;
    case "bodygraph":
      return <BodygraphModel />;
    case "geneKeys":
      return <GeneKeysModel />;
    case "lunar":
      return <LunarModel />;
    case "runes":
      return <RunesModel />;
    case "oracle":
      // Otra baraja, otra tirada: se empieza de cero.
      return <OracleModel key={deck?.id ?? "serie"} deck={deck} />;
  }
}
