import type { Metadata } from "next";
import { requireBuyerFull } from "@/lib/buyer-access";
import { EnergyPage } from "./energy-page";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Mi energía") };
}

/** «Mi energía»: sus datos, el oráculo y las runas, los cuatro sistemas y su energía de hoy. El área empieza aquí (?bienvenida=1 enseña la bienvenida). */
export default async function MiEnergiaPage({ searchParams }: { searchParams: Promise<{ perfil?: string; bienvenida?: string }> }) {
  const { perfil, bienvenida } = await searchParams;
  const user = bienvenida === "1" ? await requireBuyerFull("/area/energy") : null;
  const welcome = user ? { name: (user.name ?? user.email.split("@")[0]).split(" ")[0], email: user.email, hasPassword: !!user.passwordHash } : null;
  return <EnergyPage view="inicio" profileId={typeof perfil === "string" ? perfil.slice(0, 40) : null} welcome={welcome} />;
}
