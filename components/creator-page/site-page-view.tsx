import type { PageConfig } from "@/lib/page-config";
import { creatorLegalHref } from "@/lib/legal";
import { imageSrcSet } from "@/lib/media-url";
import { isOwnImageSrc, visibleBlocks } from "@/lib/page-blocks";
import type { SitePageContent } from "@/lib/site-pages";
import type { OracleDecks } from "@/components/models/data/oracle";
import { Reveal } from "@/components/reveal";
import { ContentBlocks } from "./content-blocks";
import { knownSystemIcon, SystemIconMark } from "./system-icon";
import { CreatorShell } from "./creator-shell";
import type { SiteNavPage } from "./site-nav";
import type { PublicProduct } from "./creator-page-view";

/**
 * Una página extra con el tema de la web (cabecera con «Volver», su avatar y su nombre; pie con las
 * demás páginas y lo legal): imagen de cabecera opcional, título, subtítulo y bloques. La usan la
 * ruta pública, la vista previa del borrador y la vista previa en vivo del editor.
 */
export function SitePageView({
  username,
  config,
  content,
  allowCustom,
  personal,
  signupsOnly,
  hiddenSlugs,
  siteOrigin,
  pages,
  currentPath,
  back = true,
  oracleDecks,
  moonCircles,
  bare = false,
}: {
  username: string;
  /** Sin cajas en los bloques (página «Sobre mí»: barePage()). */
  bare?: boolean;
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "template" | "theme">;
  content: SitePageContent;
  allowCustom: boolean;
  personal: boolean;
  signupsOnly: boolean;
  /** Productos que no se ven (web personal sin cobros): sin botones hacia ellos. */
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin?: string;
  pages?: SiteNavPage[];
  currentPath?: string;
  back?: boolean;
  /** Barajas propias de sus bloques «Oráculo» (lib/oracle-decks.ts → oracleDecksForBlocks). */
  oracleDecks?: OracleDecks;
  /** Los próximos círculos de la luna (lib/moon-circles.ts) para su bloque; sin pasar, un aviso (vista previa). */
  moonCircles?: PublicProduct[];
}) {
  const cover = content.cover && isOwnImageSrc(content.cover.src) ? content.cover : null;
  const method = methodTitle(content.title);
  return (
    <CreatorShell username={username} config={config} allowCustom={allowCustom} personal={personal} signupsOnly={signupsOnly} pages={pages} currentPath={currentPath} back={back}>
      <main className={`relative mx-auto w-full max-w-[44rem] px-5 pb-10 ${cover ? "pt-8" : "pt-10 sm:pt-16"}`} data-cover={cover ? "yes" : "no"}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.src}
            srcSet={imageSrcSet(cover.src, cover.width)}
            sizes="(min-width: 768px) 704px, calc(100vw - 40px)"
            width={cover.width}
            height={cover.height}
            alt={cover.alt}
            fetchPriority="high"
            decoding="async"
            className="mb-8 h-auto w-full rounded-[var(--r-card)]"
          />
        )}
        {method ? (
          // Página de un método («Human Design: el manual…»): su icono delante del nombre y la frase debajo, como subtítulo.
          <>
            <div className="flex items-center gap-4">
              <SystemIconMark icon={method.icon} scale={1.15} />
              <h1 className="cp-display text-[2.4rem] leading-[1.05] sm:text-[3rem]">{method.name}</h1>
            </div>
            <p className="cp-display cp-gold mt-3 text-[1.45rem] italic leading-snug sm:text-[1.7rem]">{method.tagline}</p>
          </>
        ) : (
          <>
            {/* Sin imagen de cabecera: el nombre encima, como una portadilla, y una línea dorada debajo de la entradilla. */}
            {!cover && <p className="cp-eyebrow cp-gold mb-4">{config.displayName}</p>}
            <h1 className="cp-display text-[2.4rem] leading-[1.05] sm:text-[3rem]">{content.title}</h1>
          </>
        )}
        {content.subtitle && <p className="cp-muted mt-5 whitespace-pre-line text-[1.05rem] leading-relaxed sm:text-[1.1rem]">{content.subtitle}</p>}
        {!cover && <span aria-hidden className="mt-8 block h-px w-20 bg-[var(--c-gold)] opacity-70" />}
        <div className={bare ? "mt-12 space-y-16" : "mt-10 space-y-6"}>
          <ContentBlocks
            bare={bare}
            modelIcon={method?.icon}
            blocks={visibleBlocks(content.blocks)}
            username={username}
            titleLevel={2}
            hiddenSlugs={hiddenSlugs}
            siteOrigin={siteOrigin}
            oracleDecks={oracleDecks}
            modelGate={personal ? { username, creatorName: config.displayName, privacyHref: creatorLegalHref(username, "privacidad") } : null}
            moonCircles={moonCircles}
          />
        </div>
      </main>
      <Reveal />
    </CreatorShell>
  );
}

/**
 * Una página de método: su título es «<sistema>: <frase>» y el sistema tiene icono (system-icon.tsx).
 * Devuelve el nombre, la frase (con mayúscula) y el icono; si no, null.
 */
function methodTitle(title: string) {
  const i = title.indexOf(":");
  if (i <= 0) return null;
  const name = title.slice(0, i).trim();
  const rest = title.slice(i + 1).trim();
  const icon = knownSystemIcon(name);
  if (!icon || !rest) return null;
  return { name, tagline: rest.charAt(0).toUpperCase() + rest.slice(1), icon };
}

/** Páginas extra que van sin cajas, con los bloques sueltos sobre el fondo: «Sobre mí». */
export function barePage(slug: string): boolean {
  return slug === "sobre-mi";
}

/** Productos que no se ven (web personal sin cobros), como en la portada. */
export function hiddenProductSlugs(..._args: [products: { slug: string; accessMode?: string }[], signupsOnly: boolean]): Set<string> {
  // Lo de pago ya no se esconde: se solicita por formulario (lib/requests.ts).
  return new Set<string>();
}
