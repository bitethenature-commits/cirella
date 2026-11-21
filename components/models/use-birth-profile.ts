"use client";

import { useEffect, useState } from "react";
import type { BirthProfile, ComputedProfile } from "@/lib/birth-profile";

/**
 * El perfil calculado (lib/birth-profile.ts: carta, Diseño Humano, Gene Keys, Luna natal) para un modelo que
 * recibe `profile` o, ya calculado, `computed`. Las efemérides se cargan aparte y solo si hay un perfil
 * que calcular: el modelo de ejemplo no las descarga. `pending` mientras llegan.
 */
export function useComputedProfile(profile?: BirthProfile, computed?: ComputedProfile) {
  const key = profile && !computed ? JSON.stringify(profile) : "";
  const [state, setState] = useState<{ key: string; value: ComputedProfile } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    import("@/lib/birth-profile").then((m) => {
      if (alive) setState({ key, value: m.computeAll(JSON.parse(key) as BirthProfile) });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  if (computed) return { result: computed, pending: false };
  if (!key) return { result: null, pending: false };
  const result = state?.key === key ? state.value : null;
  return { result, pending: !result };
}
