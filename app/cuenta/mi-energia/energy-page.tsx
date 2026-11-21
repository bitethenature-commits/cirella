import { EnergyLocked } from "./energy-locked";
import { EnergyViewClient } from "./energy-view";
import { loadEnergy } from "./load";
import { energyHref, type EnergyView } from "./systems";
import { PageHeader } from "../page-header";
import { WelcomeCard } from "../welcome-card";

/** Lo común de /cuenta/mi-energia y /cuenta/mi-energia/<vista>: cabecera y, dentro de los colores de la web, la vista. */
export async function EnergyPage({ view, profileId, welcome = null }: { view: EnergyView; profileId: string | null; welcome?: { name: string; email: string; hasPassword: boolean } | null }) {
  const data = await loadEnergy(energyHref(view, profileId), { decks: view === "oraculo" });
  return (
    <div className="space-y-6">
      <PageHeader title="Mi energía" />
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
