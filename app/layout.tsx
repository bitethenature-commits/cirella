import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import { appUrl } from "@/lib/env";
import { getSiteBrand } from "@/lib/site-brand";
import { isPersonalMode } from "@/lib/site-mode";
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
  return {
    metadataBase: new URL(appUrl()),
    title: { default: name, template: "%s" },
    openGraph: { siteName: name || undefined, type: "website", locale: "es_ES" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E1024",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
