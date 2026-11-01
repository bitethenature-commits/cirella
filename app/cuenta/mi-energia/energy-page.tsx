import { EnergyLocked } from "./energy-locked";
import { EnergyViewClient } from "./energy-view";
import { loadEnergy } from "./load";
import { energyHref, type EnergyView } from "./systems";

/** Lo común de /cuenta/mi-energia y /cuenta/mi-energia/<vista>: cabecera y, dentro de los colores de la web, la vista. */
export async function EnergyPage({ view, profileId }: { view: EnergyView; profileId: string | null }) {
  const data = await loadEnergy(energyHref(view, profileId), { decks: view === "oraculo" });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[2.4rem]">Mi energía</h1>
        <p className="mt-1 text-sm text-muted">Tu carta, tu diseño, tus llaves y tu luna, y lo que el cielo de hoy despierta en ellos.</p>
      </div>
      <div {...data.themeProps}>
        {data.unlocked ? (
          <EnergyViewClient view={view} profiles={data.profiles} selectedId={profileId} decks={data.decks} />
        ) : (
          <EnergyLocked access={data.access} creatorName={data.owner.displayName} privacyHref={data.privacyHref} />
        )}
      </div>
    </div>
  );
}
