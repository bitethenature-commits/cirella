import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoFactorBanner } from "@/components/auth/two-factor-banner";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { Avatar } from "@/components/creator-page/product-art";
import { LogoMark } from "@/components/logo";
import { requireCreator } from "@/lib/auth";
import { appHost, appUrl } from "@/lib/env";
import { PanelDesignRoot } from "@/components/panel-design-root";
import { readPanelPrefs } from "@/lib/panel-prefs";
import { getSiteBrand } from "@/lib/site-brand";
import { ownerUsername } from "@/lib/site-mode";
import { PanelFrame } from "./frame";
import { panelNavFlags } from "./nav-flags";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

/**
 * El panel: sin barra arriba ni a la izquierda. El menú va en los 4 bordes (app/panel/frame.tsx) y el contenido,
 * en medio, con sitio para las pestañas.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { creator, user } = await requireCreator();
  // Modo personal: el panel es solo de la dueña (otras cuentas de creadora que quedaran en la BD no entran).
  const owner = ownerUsername();
  if (owner && creator.username !== owner) redirect("/login?error=cerrado");
  const [flags, brand] = await Promise.all([panelNavFlags(creator.id), getSiteBrand()]);
  // «Diseño de mi panel» (Ajustes): su diseño y el orden del menú. Sin nada guardado, el de siempre.
  const prefs = readPanelPrefs(creator.panelPrefs);
  // En modo personal su página es la portada de la web.
  const url = owner ? appUrl() : `${appUrl()}/${creator.username}`;
  const pretty = owner ? appHost() : `${appHost()}/${creator.username}`;
  const publicHref = owner ? "/" : `/${creator.username}`;
  const mark = brand.personal ? (
    <span className="inline-flex" style={{ ["--c-accent" as string]: "#0E1024", ["--c-accent-text" as string]: "#F6F1E7" }}>
      <Avatar src={brand.avatarUrl} name={brand.name} className="h-10 w-10 text-xs" sizes="40px" />
    </span>
  ) : (
    <LogoMark className="h-9 w-9" />
  );
  return (
    <PanelDesignRoot saved={{ design: prefs.design, sidebar: prefs.sidebar }} className="min-h-dvh text-ink">
      <PanelFrame
        flags={flags}
        nav={prefs.nav}
        name={brand.name}
        mark={mark}
        site={{ url, pretty, publicHref, published: creator.published, admin: !!owner && user.isAdmin }}
      />
      {/* Sitio para las pestañas: arriba la etiqueta, a la izquierda las de lo que ofrece, abajo las de las esquinas. */}
      <div className="pl-9 lg:pl-14">
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-24 sm:px-6 lg:pt-28">
          <VerifyEmailBanner />
          <TwoFactorBanner user={user} />
          {children}
        </main>
      </div>
    </PanelDesignRoot>
  );
}
