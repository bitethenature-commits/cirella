import { EnergyLocked } from "./energy-locked";
import { EnergyViewClient } from "./energy-view";
import { loadEnergy } from "./load";
import { energyHref, type EnergyView } from "./systems";
import { PageHeader } from "../page-header";
import { WelcomeCard } from "../welcome-card";
import { getT } from "@/lib/i18n/server";

/** Lo común de /area/energy y /area/energy/<vista>: cabecera y, dentro de los colores de la web, la vista. */
export async function EnergyPage({ view, profileId, welcome = null }: { view: EnergyView; profileId: string | null; welcome?: { name: string; email: string; hasPassword: boolean } | null }) {
  const t = await getT();
  const data = await loadEnergy(energyHref(view, profileId), { decks: view === "oracle" });
  return (
    <div className="space-y-6">
      <PageHeader title={t("Mi energía")} />
      {welcome && <WelcomeCard name={welcome.name} email={welcome.email} hasPassword={welcome.hasPassword} />}
      {/* acc-energy: tarjetas y botones con la doble línea dorada de la web (app/globals.css). */}
      <div className="acc-energy">
      <div {...data.themeProps}>
        {data.unlocked ? (
          <EnergyViewClient view={view} profiles={data.profiles} selectedId={profileId} decks={data.decks} />
        ) : (
          <EnergyLocked access={data.access} creatorName={data.owner.displayName} privacyHref={data.privacyHref} />
        )}
      </div>
      </div>
    </div>
  );
}
