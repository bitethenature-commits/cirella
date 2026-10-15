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

export function CreatorBrandingProvider({ value, children }: { value: CreatorBranding; children: React.ReactNode }) {
  return <CreatorBrandingContext.Provider value={value}>{children}</CreatorBrandingContext.Provider>;
}

export function useCreatorBranding() {
  return useContext(CreatorBrandingContext);
}
