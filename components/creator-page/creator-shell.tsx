import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { designFor, type PageConfig } from "@/lib/page-config";
import { resolveTheme, themeAttrs, themeStyle } from "@/lib/templates";
import { DesignBackdrop } from "@/components/design-backdrop";
import { AccountEntry } from "./account-entry";
import { creatorLegalHref } from "@/lib/legal";
import { LegalLinks } from "./legal-links";
import { NewsletterSignup } from "./newsletter-signup";
import { PieceStyles } from "./piece-styles";
import { Avatar } from "./product-art";
import { SiteNav, type SiteNavPage } from "./site-nav";
import { TemplateDecor } from "@/components/template-decor";
import type { TextEdit } from "./home-edit";

/** Envoltorio con la identidad visual de la creadora para producto, checkout y confirmación. */
export function CreatorShell({
  username,
  config,
  allowCustom,
  children,
  back = true,
  sellerName,
  personal = false,
  signupsOnly = false,
  pages,
  currentPath,
  showAccount = true,
  showNewsletter = true,
  page,
  editText,
  editNewsletterButton,
}: {
  username: string;
  /** En el Canva: los textos fijos (pie, newsletter, entrar) escritos encima. */
  editText?: TextEdit;
  /** En el Canva: el texto del botón de la newsletter del pie, escrito encima. */
  editNewsletterButton?: React.ReactNode;
  /** Solo lo que pinta la cabecera y el tema (también lo usan las páginas de error, en cliente). */
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "theme"> & Partial<Pick<PageConfig, "newsletter" | "template" | "pageThemes" | "texts" | "pieces">>;
  allowCustom: boolean;
  children: React.ReactNode;
  back?: boolean;
  /** Nombre fiscal de quien vende, para el pie («Vende: …»). */
  sellerName?: string | null;
  /** Web personal: la página de la dueña es la portada («/»). */
  personal?: boolean;
  /** Web personal sin cobros: el pie no lleva condiciones de venta. */
  signupsOnly?: boolean;
  /** Páginas extra publicadas (enlaces del pie) y la dirección de la que se está viendo. */
  pages?: SiteNavPage[];
  currentPath?: string;
  /** Entrada «Entrar» / «Mi área» a la derecha de la cabecera (no en la propia pantalla de entrar). */
  showAccount?: boolean;
  /** Formulario de la newsletter del pie (si lo activó): no en las pantallas de entrar, pagar o darse de baja. */
  showNewsletter?: boolean;
  /** Qué página es, para su diseño propio (PageConfig.pageThemes): «cursos», «uno-a-uno», el slug de una página extra… */
  page?: string;
}) {
  const theme = resolveTheme(null, designFor(config, page), allowCustom);
  const home = personal ? "/" : `/${username}`;
  return (
    <>
    {/* Las piezas sueltas de esta página (no en el Canva: allí la página lleva más cosas dentro). */}
    {page && !editText && allowCustom && <PieceStyles pieces={config.pieces?.[page]} gold={theme.colors.gold} />}
    <div className="cp" style={themeStyle(theme)} {...themeAttrs(theme)}>
      <DesignBackdrop theme={theme} />
      <TemplateDecor decor={theme.decor} starOpacity={0.5} />
      <header className="sticky top-0 z-30 border-b backdrop-blur-xl" style={{ borderColor: "var(--c-line)", background: "color-mix(in oklab, var(--c-bg) 78%, transparent)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          {back && (
            <Link href={home} className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-70" aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <Avatar src={config.avatarUrl} name={config.displayName} className="h-8 w-8 text-xs" />
            <span className="truncate text-sm font-semibold">{config.displayName}</span>
          </Link>
          {showAccount && <AccountEntry username={username} personal={personal} variant="header" texts={config.texts} editText={editText} />}
        </div>
      </header>
      {children}
      {/* El margen inferior deja sitio al botón fijo de compra de la ficha en móvil. */}
      <footer className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 pb-28 pt-10 text-center md:pb-10">
        {personal && showNewsletter && config.newsletter?.footer && (
          <NewsletterSignup variant="footer" button={config.newsletter.button} creatorName={config.displayName} privacyHref={creatorLegalHref(username, "privacidad")} opensPortal={!!personal} texts={config.texts} editText={editText} editButton={editNewsletterButton} preview={!!editText} />
        )}
        <SiteNav pages={pages} current={currentPath} />
        <LegalLinks username={username} sellerName={sellerName} signupsOnly={signupsOnly} texts={config.texts} editText={editText} />
      </footer>
    </div>
    </>
  );
}
