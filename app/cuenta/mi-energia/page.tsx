import type { Metadata } from "next";
import { EnergyPage } from "./energy-page";

export const metadata: Metadata = { title: "Mi energía" };

/** «Mi energía»: sus datos, el oráculo y las runas, los cuatro sistemas y su energía de hoy. */
export default async function MiEnergiaPage({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const { perfil } = await searchParams;
  return <EnergyPage view="inicio" profileId={typeof perfil === "string" ? perfil.slice(0, 40) : null} />;
}
