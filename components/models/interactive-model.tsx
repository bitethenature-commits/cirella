"use client";

import dynamic from "next/dynamic";
import type { ModelKind } from "@/lib/page-blocks";
import type { BirthProfile } from "@/lib/birth-profile";
import type { OracleDeckView } from "./data/oracle";
import { useModelGate, type GatedModel, type ModelGateInfo } from "./model-gate-scope";
import { Tr } from "@/lib/i18n/client";

/**
 * Los modelos interactivos del bloque «Modelo interactivo» (lib/page-blocks.ts). Cada uno se carga aparte
 * y solo en el navegador: el SVG grande y sus datos no pesan en el HTML ni en las páginas que no lo usan.
 * Mientras llega, un hueco de su tamaño (sin saltos al cargar).
 */
function Loading() {
  return (
    <div className="grid min-h-[24rem] place-items-center" aria-busy="true">
      <span className="cp-faint text-[0.85rem]"><Tr s={"Cargando el modelo…"} /></span>
    </div>
  );
}
function LoadingBar() {
  return <div className="min-h-12" aria-busy="true" />;
}

const ChartModel = dynamic(() => import("./chart-model").then((m) => m.ChartModel), { ssr: false, loading: Loading });
const BodygraphModel = dynamic(() => import("./bodygraph-model").then((m) => m.BodygraphModel), { ssr: false, loading: Loading });
const GeneKeysModel = dynamic(() => import("./gene-keys-model").then((m) => m.GeneKeysModel), { ssr: false, loading: Loading });
const LunarModel = dynamic(() => import("./lunar-model").then((m) => m.LunarModel), { ssr: false, loading: Loading });
const RunesModel = dynamic(() => import("./runes-model").then((m) => m.RunesModel), { ssr: false, loading: Loading });
// El candado de «Calcular con mis datos» (con su formulario y el de la newsletter), también aparte.
const ModelGate = dynamic(() => import("./model-gate").then((m) => m.ModelGate), { ssr: false, loading: Loading });
/** La barra de «Calcular con mis datos» de la versión rápida, debajo de la caja (dentro de un ModelGateScope). */
export const ModelGateBelow = dynamic(() => import("./model-gate").then((m) => () => <m.ModelGateBar variant="below" />), { ssr: false, loading: LoadingBar });
const KundaliniModel = dynamic(() => import("./kundalini-model").then((m) => m.KundaliniModel), { ssr: false, loading: Loading });
const GeometryModel = dynamic(() => import("./geometry-model").then((m) => m.GeometryModel), { ssr: false, loading: Loading });
const DimensionsModel = dynamic(() => import("./dimensions-model").then((m) => m.DimensionsModel), { ssr: false, loading: Loading });
const OracleModel = dynamic(() => import("./oracle-model").then((m) => m.OracleModel), { ssr: false, loading: Loading });
// El oráculo con «Más barajas» (solo con cuenta y newsletter) en las páginas públicas de la web personal.
const OracleWithDecks = dynamic(() => import("./oracle-decks-gate").then((m) => m.OracleWithDecks), { ssr: false, loading: Loading });

const GATED: readonly string[] = ["chart", "bodygraph", "geneKeys", "lunar"];
export const isGatedModel = (m: ModelKind): m is GatedModel => GATED.includes(m);

function Calculated({ model, profile, compact }: { model: GatedModel; profile: BirthProfile | undefined; compact: boolean }) {
  switch (model) {
    case "chart":
      return <ChartModel profile={profile} ownForm={false} compact={compact} />;
    case "bodygraph":
      return <BodygraphModel profile={profile} compact={compact} />;
    case "geneKeys":
      return <GeneKeysModel profile={profile} compact={compact} />;
    case "lunar":
      return <LunarModel profile={profile} ownForm={false} compact={compact} />;
  }
}

/**
 * `deck`: solo el oráculo, una baraja propia ya cargada en el servidor (sin ella, la de serie).
 * `gate`: en las páginas públicas de la web personal, los cuatro modelos calculados enseñan el ejemplo
 * y «Calcular con mis datos» solo a quien tiene el acceso (components/models/model-gate.tsx). Sin él
 * (vistas previas del panel, modo plataforma), cada modelo trae su propio formulario como siempre.
 * Dentro de un ModelGateScope (versión rápida), el perfil sale de ahí y la barra la pinta su hermana
 * ModelGateBelow, debajo de la caja. En el oráculo, `gate` añade «Más barajas».
 * `compact`: versión rápida (solo el dibujo; chart, bodygraph, geneKeys y lunar).
 * `profile`: en las lecciones, la carta que la alumna guardó en «Mi energía» (los cuatro calculados salen con ella).
 */
export function InteractiveModel({
  model,
  deck,
  gate,
  compact = false,
  profile,
}: {
  model: Exclude<ModelKind, "geometry">;
  deck?: OracleDeckView | null;
  gate?: ModelGateInfo | null;
  compact?: boolean;
  profile?: BirthProfile | null;
}) {
  const scope = useModelGate();
  if (isGatedModel(model)) {
    if (profile) return <Calculated model={model} profile={profile} compact={compact} />;
    if (gate && scope && scope.model === model) return <Calculated model={model} profile={scope.active?.profile} compact={compact} />;
    if (gate) return <ModelGate model={model} gate={gate}>{(profile) => <Calculated model={model} profile={profile} compact={compact} />}</ModelGate>;
  }
  switch (model) {
    case "chart":
      return <ChartModel compact={compact} />;
    case "bodygraph":
      return <BodygraphModel compact={compact} />;
    case "geneKeys":
      return <GeneKeysModel compact={compact} />;
    case "lunar":
      return <LunarModel compact={compact} />;
    case "runes":
      return <RunesModel />;
    case "kundalini":
      return <KundaliniModel />;
    case "sacred":
      return <GeometryModel />;
    case "dimensions":
      return <DimensionsModel />;
    case "oracle":
      // Otra baraja, otra tirada: se empieza de cero.
      return gate ? <OracleWithDecks deck={deck ?? null} gate={gate} /> : <OracleModel key={deck?.id ?? "serie"} deck={deck} />;
  }
}
