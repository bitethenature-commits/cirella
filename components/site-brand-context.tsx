"use client";
import { createContext, useContext } from "react";
import { Avatar } from "@/components/creator-page/product-art";
import { LogoMark } from "@/components/logo";
import type { ClientSiteBrand } from "@/lib/site-brand-client";

/**
 * Marca del sitio para las pantallas de error (componentes cliente). La inyecta app/layout.tsx
 * solo en modo personal; sin proveedor (plataforma) vale null y se ve el logo de siempre.
 */
const SiteBrandContext = createContext<ClientSiteBrand>(null);

export function SiteBrandProvider({ value, children }: { value: ClientSiteBrand; children: React.ReactNode }) {
  return <SiteBrandContext.Provider value={value}>{children}</SiteBrandContext.Provider>;
}

export function useSiteBrand() {
  return useContext(SiteBrandContext);
}

/**
 * Símbolo suelto de las pantallas de error: el de la plataforma o, en modo personal, la foto
 * (o la inicial) de la dueña; nada si aún no se sabe quién es.
 */
export function SiteMark({ className = "h-10 w-10", dark = false }: { className?: string; dark?: boolean }) {
  const brand = useSiteBrand();
  if (!brand) return <LogoMark className={className} />;
  if (!brand.name) return null;
  const colors = dark ? { accent: "#F6F1E7", text: "#0E1024" } : { accent: "#0E1024", text: "#F6F1E7" };
  return (
    <span className="inline-flex shrink-0" style={{ ["--c-accent" as string]: colors.accent, ["--c-accent-text" as string]: colors.text }}>
      <Avatar src={brand.avatarUrl} name={brand.name} className={`${className} text-xs`} sizes="40px" />
    </span>
  );
}
