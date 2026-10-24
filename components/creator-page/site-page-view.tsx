import type { PageConfig } from "@/lib/page-config";
import { imageSrcSet } from "@/lib/media-url";
import { isOwnImageSrc, visibleBlocks } from "@/lib/page-blocks";
import type { SitePageContent } from "@/lib/site-pages";
import { ContentBlocks } from "./content-blocks";
import { CreatorShell } from "./creator-shell";
import type { SiteNavPage } from "./site-nav";

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
}: {
  username: string;
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
}) {
  const cover = content.cover && isOwnImageSrc(content.cover.src) ? content.cover : null;
  return (
    <CreatorShell username={username} config={config} allowCustom={allowCustom} personal={personal} signupsOnly={signupsOnly} pages={pages} currentPath={currentPath} back={back}>
      <main className="relative mx-auto w-full max-w-[44rem] px-5 pb-10 pt-8">
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
        <h1 className="cp-display text-[2.4rem] leading-[1.05] sm:text-[3rem]">{content.title}</h1>
        {content.subtitle && <p className="cp-muted mt-4 text-[1.05rem] leading-relaxed">{content.subtitle}</p>}
        <div className="mt-10 space-y-6">
          <ContentBlocks blocks={visibleBlocks(content.blocks)} username={username} titleLevel={2} hiddenSlugs={hiddenSlugs} siteOrigin={siteOrigin} />
        </div>
      </main>
    </CreatorShell>
  );
}

/** Productos que no se ven (web personal sin cobros), como en la portada. */
export function hiddenProductSlugs(products: { slug: string; accessMode?: string }[], signupsOnly: boolean): Set<string> {
  return new Set(signupsOnly ? products.filter((p) => (p.accessMode ?? "PAID") === "PAID").map((p) => p.slug.toLowerCase()) : []);
}
