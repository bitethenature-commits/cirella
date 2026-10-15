import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PageConfig } from "@/lib/page-config";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { LegalLinks } from "./legal-links";
import { Avatar } from "./product-art";

/** Envoltorio con la identidad visual de la creadora para producto, checkout y confirmación. */
export function CreatorShell({
  username,
  config,
  allowCustom,
  children,
  back = true,
  sellerName,
}: {
  username: string;
  /** Solo lo que pinta la cabecera y el tema (también lo usan las páginas de error, en cliente). */
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "template" | "theme">;
  allowCustom: boolean;
  children: React.ReactNode;
  back?: boolean;
  /** Nombre fiscal de quien vende, para el pie («Vende: …»). */
  sellerName?: string | null;
}) {
  const theme = resolveTheme(config.template, config.theme, allowCustom);
  return (
    <div className="cp" style={themeStyle(theme)} data-card={theme.card} data-template={config.template}>
      <div className={`cp-decor cp-decor-${theme.decor}`} aria-hidden>
        {theme.decor === "stars" && <div className="starfield absolute inset-0 opacity-50" />}
      </div>
      <header className="sticky top-0 z-30 border-b backdrop-blur-xl" style={{ borderColor: "var(--c-line)", background: "color-mix(in oklab, var(--c-bg) 78%, transparent)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          {back && (
            <Link href={`/${username}`} className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-70" aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <Link href={`/${username}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar src={config.avatarUrl} name={config.displayName} className="h-8 w-8 text-xs" />
            <span className="truncate text-sm font-semibold">{config.displayName}</span>
          </Link>
        </div>
      </header>
      {children}
      {/* El margen inferior deja sitio al botón fijo de compra de la ficha en móvil. */}
      <footer className="mx-auto max-w-5xl px-4 pb-28 pt-10 text-center md:pb-10">
        <LegalLinks username={username} sellerName={sellerName} />
      </footer>
    </div>
  );
}
