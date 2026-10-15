import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import { appUrl } from "@/lib/env";
import { SiteBrandProvider } from "@/components/site-brand-context";
import { getSiteBrand } from "@/lib/site-brand";
import { toClientSiteBrand } from "@/lib/site-brand-client";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  if (!isPersonalMode())
    return {
      metadataBase: new URL(appUrl()),
      title: {
        default: "Cirella — Convierte tu perfil social en tu negocio completo",
        template: "%s",
      },
      description:
        "Link-in-bio, tienda, reservas, cursos y membresías en un solo enlace. Para astrólogas, terapeutas, coaches y creadoras del bienestar.",
      openGraph: { siteName: "Cirella", type: "website", locale: "es_ES" },
    };
  // Web personal: el nombre de la página de la dueña en vez de la plataforma (p. ej. en la pestaña de un 404).
  const name = (await getSiteBrand().catch(() => null))?.name ?? "";
  // Favicon de la dueña en todas las rutas (entrar, panel, cuenta, admin…): con `icons` definido,
  // Next deja de usar app/icon.svg, el símbolo de la plataforma.
  const owner = personalOwner();
  return {
    metadataBase: new URL(appUrl()),
    title: { default: name, template: "%s" },
    openGraph: { siteName: name || undefined, type: "website", locale: "es_ES" },
    ...(owner ? { icons: { icon: [{ url: `/${owner}/icon`, type: "image/png", sizes: "64x64" }] } } : {}),
  };
}

/** Usuario de la dueña sin romper la página si faltara (assertEnv ya no deja arrancar sin él). */
function personalOwner() {
  try {
    return ownerUsername();
  } catch {
    return null;
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E1024",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Web personal: las pantallas de error (componentes cliente) muestran la marca de la dueña.
  const personal = isPersonalMode();
  const brand = personal ? toClientSiteBrand(true, await getSiteBrand().catch(() => null)) : null;
  return (
    <html lang="es" className={fontVariables}>
      <body>{personal ? <SiteBrandProvider value={brand}>{children}</SiteBrandProvider> : children}</body>
    </html>
  );
}
