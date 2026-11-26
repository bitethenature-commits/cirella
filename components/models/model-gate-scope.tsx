"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UnlockAccess } from "@/components/creator-page/portal-section";
import type { BirthProfile } from "@/lib/birth-profile";
import type { SavedBirthProfile } from "@/lib/birth-profiles-rules";

/**
 * Estado compartido del candado de «Calcular con mis datos» (components/models/model-gate.tsx): si
 * quien mira tiene el acceso, sus perfiles guardados y el perfil con el que se calcula ahora. Va en un
 * contexto para que la versión rápida pueda pintar el modelo DENTRO de su caja y la barra con el botón
 * FUERA, debajo (dos piezas hermanas que comparten el mismo perfil).
 *
 * Es ligero a propósito (sin formularios): se carga con la página; la barra, con sus formularios, aparte.
 */

export type ModelGateInfo = {
  username: string;
  creatorName: string;
  privacyHref: string;
};
export type GatedModel = "chart" | "bodygraph" | "geneKeys" | "lunar";

export type AccessData = UnlockAccess & {
  unlocked: boolean;
  profiles: SavedBirthProfile[];
};

/** Una petición por página aunque haya varios modelos (se repite tras suscribirse o guardar). */
const requests = new Map<string, Promise<AccessData | null>>();
export function loadAccess(username: string, fresh = false): Promise<AccessData | null> {
  if (fresh) requests.delete(username);
  let p = requests.get(username);
  if (!p) {
    p = fetch(`/api/mi-energia?u=${encodeURIComponent(username)}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? (r.json() as Promise<AccessData>) : null))
      .catch(() => null);
    requests.set(username, p);
  }
  return p;
}

export type GatePanel = "none" | "subscribe" | "choose" | "form";
export type ActiveProfile = { id: string | null; profile: BirthProfile };

export type ModelGateState = {
  model: GatedModel;
  gate: ModelGateInfo;
  access: AccessData | null | "loading";
  unlocked: boolean;
  profiles: SavedBirthProfile[];
  own: SavedBirthProfile | null;
  active: ActiveProfile | null;
  panel: GatePanel;
  setPanel: (p: GatePanel) => void;
  /** Elige un perfil (o null: el ejemplo). A partir de ahí no se vuelve a aplicar el propio solo. */
  choose: (a: ActiveProfile | null) => void;
  refresh: (fresh: boolean) => Promise<AccessData | null>;
};

const GateContext = createContext<ModelGateState | null>(null);

/** El estado del candado más cercano, o null si el modelo no está dentro de uno. */
export function useModelGate(): ModelGateState | null {
  return useContext(GateContext);
}

export function ModelGateScope({ model, gate, children }: { model: GatedModel; gate: ModelGateInfo; children: ReactNode }) {
  const [access, setAccess] = useState<AccessData | null | "loading">("loading");
  const [active, setActive] = useState<ActiveProfile | null>(null);
  /** Ya eligió algo (otro perfil, el ejemplo): no se vuelve a aplicar el propio solo. */
  const [chosen, setChosen] = useState(false);
  const [panel, setPanel] = useState<GatePanel>("none");

  const refresh = useCallback(
    (fresh: boolean) =>
      loadAccess(gate.username, fresh).then((d) => {
        setAccess(d);
        return d;
      }),
    [gate.username],
  );
  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const profiles = useMemo(() => (access && access !== "loading" ? access.profiles : []), [access]);
  const own = profiles.find((p) => p.isOwn) ?? null;
  // Con sus datos guardados: se aplican solos (una vez; si elige otra cosa, se respeta).
  useEffect(() => {
    if (!chosen && !active && own) setActive({ id: own.id, profile: own });
  }, [own, chosen, active]);

  const unlocked = access !== "loading" && !!access?.unlocked;
  const choose = useCallback((a: ActiveProfile | null) => {
    setChosen(true);
    setActive(a);
    setPanel("none");
  }, []);

  const value = useMemo<ModelGateState>(
    () => ({ model, gate, access, unlocked, profiles, own, active, panel, setPanel, choose, refresh }),
    [model, gate, access, unlocked, profiles, own, active, panel, choose, refresh],
  );
  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

/** Dirección de la versión completa de cada modelo en «Mi energía» (app/area/energy/systems.ts). */
export const ENERGY_PATH: Record<GatedModel, string> = {
  chart: "/area/energy/astrology",
  bodygraph: "/area/energy/human-design",
  geneKeys: "/area/energy/gene-keys",
  lunar: "/area/energy/moon",
};
