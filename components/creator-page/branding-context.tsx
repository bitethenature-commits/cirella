"use client";
import { createContext, useContext } from "react";
import type { PageConfig } from "@/lib/page-config";

/**
 * Identidad visual mínima de la creadora (nombre, avatar, plantilla y tema) para las páginas de
 * error y de «no encontrado» de su segmento, que son componentes cliente y no reciben datos del
 * servidor. La inyecta app/[username]/layout.tsx; null si la usuaria no existe o no está publicada.
 */
export type CreatorBranding = {
  username: string;
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "template" | "theme">;
  allowCustom: boolean;
} | null;

const CreatorBrandingContext = createContext<CreatorBranding>(null);
/** Web personal (SITE_MODE=personal): la portada es la página de la dueña y no hay registro. */
const PersonalModeContext = createContext(false);
/** Web personal sin cobros: el pie no lleva condiciones de venta. */
const SignupsOnlyContext = createContext(false);

export function CreatorBrandingProvider({
  value,
  personal = false,
  signupsOnly = false,
  children,
}: {
  value: CreatorBranding;
  personal?: boolean;
  signupsOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PersonalModeContext.Provider value={personal}>
      <SignupsOnlyContext.Provider value={signupsOnly}>
        <CreatorBrandingContext.Provider value={value}>{children}</CreatorBrandingContext.Provider>
      </SignupsOnlyContext.Provider>
    </PersonalModeContext.Provider>
  );
}

export function useSignupsOnly() {
  return useContext(SignupsOnlyContext);
}

export function useCreatorBranding() {
  return useContext(CreatorBrandingContext);
}

export function usePersonalMode() {
  return useContext(PersonalModeContext);
}
