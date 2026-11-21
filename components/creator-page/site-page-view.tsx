import type { ReactNode } from "react";
import { designFor, type PageConfig } from "@/lib/page-config";
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
import type { WebTiers } from "@/lib/web-tiers";
import type { TextEdit } from "./home-edit";

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
  tiers,
  bare = false,
  edit,
  page,
}: {
  /**
   * Editor de Páginas (app/panel/paginas/[id]/page-editor.tsx): en lugar del título, el subtítulo, la
   * imagen de cabecera y los bloques, lo que se escribe encima. `blocks` recibe el aspecto de la página.
   */
  edit?: { title: ReactNode; subtitle: ReactNode; cover: ReactNode; blocks: (mode: { bare: boolean; luxe: boolean }) => ReactNode; /** Su nombre y su foto (cabecera y nombre dorado de arriba), los de la portada (Canva). */ name?: ReactNode; avatar?: ReactNode; /** Los textos fijos del pie y la cabecera (Canva). */ text?: TextEdit; /** El botón de la newsletter del pie (Canva). */ newsletterButton?: ReactNode };
  username: string;
  /** Sin cajas en los bloques (página «Sobre mí»: barePage()). */
  bare?: boolean;
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "theme"> & Partial<Pick<PageConfig, "template" | "pageThemes" | "newsletter" | "texts" | "pieces">>;
  /** Qué página es, para su diseño propio (su slug: PageConfig.pageThemes). */
  page?: string;
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
  /** Los niveles de la comunidad (lib/web-tiers.server.ts) para su sección «Niveles»; sin pasar, un aviso. */
  tiers?: WebTiers;
}) {
  const cover = content.cover && isOwnImageSrc(content.cover.src) ? content.cover : null;
  // El diseño de esta página: los bloques con diseño propio lo cambian encima (solo con diseño propio en su plan).
  const designBase = allowCustom ? designFor(config, page) : undefined;
  const method = methodTitle(content.title);
  if (bare)
    // «Sobre mí»: con el estilo de lujo de la portada (cabecera centrada con oro, foto con marco dorado).
    return (
      <CreatorShell username={username} config={config} allowCustom={allowCustom} personal={personal} signupsOnly={signupsOnly} pages={pages} currentPath={currentPath} back={back} page={page} editText={edit?.text} editNewsletterButton={edit?.newsletterButton} editName={edit?.name} editAvatar={edit?.avatar}>
        <main className="cp-luxe relative mx-auto w-full max-w-[52rem] px-5 pb-20 pt-8 sm:pt-14" data-cover={cover ? "yes" : "no"}>
          <header className="text-center" data-reveal>
            <p className="cp-eyebrow !tracking-[0.42em]" style={{ color: "var(--c-gold)" }}>
              {edit?.name ?? config.displayName}
            </p>
            <div aria-hidden className="cp-section-rule mt-4">
              <span />
              <i>✦</i>
              <span />
            </div>
            <h1 className="cp-display cp-thin mt-5 text-[2.9rem] leading-[1.05] sm:text-[3.8rem]">{edit ? edit.title : content.title}</h1>
            {(edit || content.subtitle) && (
              <div className="cp-display cp-thin mx-auto mt-4 max-w-xl whitespace-pre-line text-[1.35rem] italic leading-snug sm:text-[1.6rem]" style={{ color: "var(--c-gold)" }}>
                {edit ? edit.subtitle : content.subtitle}
              </div>
            )}
          </header>
          {edit ? <div className="mt-10">{edit.cover}</div> : cover && (
            <div className="cp-luxe-frame mt-10" data-reveal>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover.src}
                srcSet={imageSrcSet(cover.src, cover.width)}
                sizes="(min-width: 860px) 792px, calc(100vw - 40px)"
                width={cover.width}
                height={cover.height}
                alt={cover.alt}
                fetchPriority="high"
                decoding="async"
                className="block h-auto w-full"
              />
            </div>
          )}
          <div className="mt-20 space-y-24">
            {edit ? edit.blocks({ bare: true, luxe: false }) : <ContentBlocks
              bare
              blocks={visibleBlocks(content.blocks)}
              designBase={designBase}
              username={username}
              titleLevel={2}
              hiddenSlugs={hiddenSlugs}
              siteOrigin={siteOrigin}
              oracleDecks={oracleDecks}
              modelGate={personal ? { username, creatorName: config.displayName, privacyHref: creatorLegalHref(username, "privacidad") } : null}
              moonCircles={moonCircles}
              tiers={tiers}
            />}
          </div>
        </main>
        <Reveal />
      </CreatorShell>
    );
  if (method)
    // Página de un sistema: con el estilo de lujo de la portada. Su icono grande y dorado, el nombre en
    // letra fina, la frase en cursiva dorada y la raya con la estrella; los bloques, en paneles dorados.
    return (
      <CreatorShell username={username} config={config} allowCustom={allowCustom} personal={personal} signupsOnly={signupsOnly} pages={pages} currentPath={currentPath} back={back} page={page} editText={edit?.text} editNewsletterButton={edit?.newsletterButton} editName={edit?.name} editAvatar={edit?.avatar}>
        <main className="cp-luxe relative mx-auto w-full max-w-[46rem] px-5 pb-20 pt-8 sm:pt-14" data-cover={cover ? "yes" : "no"}>
          <header className="text-center" data-reveal>
            <div className="flex justify-center">
              <SystemIconMark icon={method.icon} scale={1.7} />
            </div>
            <p className="cp-eyebrow mt-6 !tracking-[0.42em]" style={{ color: "var(--c-gold)" }}>
              {edit?.name ?? config.displayName}
            </p>
            <h1 className="cp-display cp-thin mt-3 text-[2.9rem] leading-[1.05] sm:text-[3.8rem]">{edit ? edit.title : method.name}</h1>
            <div aria-hidden className="cp-section-rule mt-5">
              <span />
              <i>✦</i>
              <span />
            </div>
            {!edit && (
              <p className="cp-display cp-thin mx-auto mt-5 max-w-xl text-[1.45rem] italic leading-snug sm:text-[1.75rem]" style={{ color: "var(--c-gold)" }}>
                {method.tagline}
              </p>
            )}
            {(edit || content.subtitle) && <div className="cp-muted cp-thin-text mx-auto mt-5 max-w-lg whitespace-pre-line text-[1.05rem] leading-relaxed">{edit ? edit.subtitle : content.subtitle}</div>}
          </header>
          {edit ? <div className="mt-10">{edit.cover}</div> : cover && (
            <div className="cp-luxe-frame mt-10" data-reveal>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover.src}
                srcSet={imageSrcSet(cover.src, cover.width)}
                sizes="(min-width: 768px) 696px, calc(100vw - 40px)"
                width={cover.width}
                height={cover.height}
                alt={cover.alt}
                fetchPriority="high"
                decoding="async"
                className="block h-auto w-full"
              />
            </div>
          )}
          <div className="mt-14 space-y-8">
            {edit ? edit.blocks({ bare: false, luxe: true }) : <ContentBlocks
              luxe
              modelIcon={method.icon}
              blocks={visibleBlocks(content.blocks)}
              designBase={designBase}
              username={username}
              titleLevel={2}
              hiddenSlugs={hiddenSlugs}
              siteOrigin={siteOrigin}
              oracleDecks={oracleDecks}
              modelGate={personal ? { username, creatorName: config.displayName, privacyHref: creatorLegalHref(username, "privacidad") } : null}
              moonCircles={moonCircles}
              tiers={tiers}
            />}
          </div>
        </main>
        <Reveal />
      </CreatorShell>
    );
  return (
    <CreatorShell username={username} config={config} allowCustom={allowCustom} personal={personal} signupsOnly={signupsOnly} pages={pages} currentPath={currentPath} back={back} page={page} editText={edit?.text} editNewsletterButton={edit?.newsletterButton} editName={edit?.name} editAvatar={edit?.avatar}>
      <main className={`relative mx-auto w-full max-w-[44rem] px-5 pb-10 ${cover ? "pt-8" : "pt-10 sm:pt-16"}`} data-cover={cover ? "yes" : "no"}>
        {edit ? <div className="mb-8">{edit.cover}</div> : cover && (
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
        {/* Sin imagen de cabecera: el nombre encima, como una portadilla, y una línea dorada debajo de la entradilla. */}
        {!cover && <p className="cp-eyebrow cp-gold mb-4">{edit?.name ?? config.displayName}</p>}
        <h1 className="cp-display text-[2.4rem] leading-[1.05] sm:text-[3rem]">{edit ? edit.title : content.title}</h1>
        {(edit || content.subtitle) && <div className="cp-muted mt-5 whitespace-pre-line text-[1.05rem] leading-relaxed sm:text-[1.1rem]">{edit ? edit.subtitle : content.subtitle}</div>}
        {!cover && <span aria-hidden className="mt-8 block h-px w-20 bg-[var(--c-gold)] opacity-70" />}
        <div className={bare ? "mt-12 space-y-16" : "mt-10 space-y-6"}>
          {edit ? edit.blocks({ bare, luxe: false }) : <ContentBlocks
            bare={bare}
            blocks={visibleBlocks(content.blocks)}
            designBase={designBase}
            username={username}
            titleLevel={2}
            hiddenSlugs={hiddenSlugs}
            siteOrigin={siteOrigin}
            oracleDecks={oracleDecks}
            modelGate={personal ? { username, creatorName: config.displayName, privacyHref: creatorLegalHref(username, "privacidad") } : null}
            moonCircles={moonCircles}
            tiers={tiers}
          />}
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

/** Páginas extra que van sin cajas, con los bloques sueltos sobre el fondo: «Sobre mí», la 1:1, Gifts y Hacerte miembro. */
export function barePage(slug: string): boolean {
  return slug === "sobre-mi" || slug === "uno-a-uno" || slug === "gifts" || slug === "comunidad";
}

/** Productos que no se ven (web personal sin cobros), como en la portada. */
export function hiddenProductSlugs(..._args: [products: { slug: string; accessMode?: string }[], signupsOnly: boolean]): Set<string> {
  // Lo de pago ya no se esconde: se solicita por formulario (lib/requests.ts).
  return new Set<string>();
}
