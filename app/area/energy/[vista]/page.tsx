import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnergyPage } from "../energy-page";
import { ENERGY_SYSTEMS, ENERGY_TOOLS, asEnergyView } from "../systems";

type Params = { vista: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { vista } = await params;
  const label = [...ENERGY_SYSTEMS, ...ENERGY_TOOLS].find((s) => s.slug === vista)?.label;
  return { title: label ? `${label} · Mi energía` : "Mi energía" };
}

/** Un sistema (astrologia, diseno-humano, gene-keys, luna) o una herramienta (oraculo, runas) de «Mi energía». */
export default async function MiEnergiaVistaPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ perfil?: string }> }) {
  const [{ vista }, { perfil }] = await Promise.all([params, searchParams]);
  const view = asEnergyView(vista);
  if (!view || view === "inicio") notFound();
  return <EnergyPage view={view} profileId={typeof perfil === "string" ? perfil.slice(0, 40) : null} />;
}
