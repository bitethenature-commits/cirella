import type { Metadata } from "next";
import { hiddenProductSlugs } from "@/components/creator-page/site-page-view";
import { requireCreator } from "@/lib/auth";
import { CODE_STATE_LABEL, codeState, dateKeyFromExpiry, readCodePhotos, readCodeRecommendations } from "@/lib/discount-codes";
import { appHost, appUrl } from "@/lib/env";
import { creatorLegalHref } from "@/lib/legal";
import { nextMoonCircles } from "@/lib/moon-circles";
import { getPublishedOracleDecks } from "@/lib/oracle-decks";
import { readPageConfig } from "@/lib/page-config";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode } from "@/lib/site-mode";
import { COMMUNITY_SLUG, isFixedPageSlug, readSitePageContent, sitePagePath, sitePageState } from "@/lib/site-pages";
import { ensureCommunityPage, ensureGiftsPage, ensureOneToOnePage, sitePageLinkTargets } from "@/lib/site-pages.server";
import { webTiers } from "@/lib/web-tiers.server";
import { sectionPagePath, type SectionPage } from "@/lib/site-sections";
import { tenantDb } from "@/lib/tenant";
import { BuiltinCanva } from "../canva/builtin-canva";
import { HomeCanva, type CanvaCode } from "../canva/home-canva";
import { PageCanva } from "../canva/page-canva";
import { LEGAL_PAGES, WEB_PAGES, type PanelPage } from "../canva/web-pages";

export const metadata: Metadata = { title: "Mi página" };

/** Dónde se cambia lo que enseña cada página que se crea sola. */
const MANAGE: Partial<Record<SectionPage | "legal", { href: string; label: string }>> = {
  cursos: { href: "/panel/cursos", label: "Tus cursos" },
  comunidad: { href: "/panel/comunidad", label: "Tu membresía" },
  actualidades: { href: "/panel/actualidades", label: "Actualidades" },
  portal: { href: "/panel/portal", label: "Portal de Noticias" },
  ofertas: { href: "/panel/sesiones", label: "Sesiones y lecturas (cada una con su oferta)" },
  sesiones: { href: "/panel/sesiones", label: "Sesiones y lecturas" },
  lecturas: { href: "/panel/sesiones", label: "Sesiones y lecturas" },
  legal: { href: "/panel/ajustes/legal", label: "Tus datos legales" },
};

/**
 * Mi página, dentro del panel: la web con todo editable encima, en su marco de ordenador o de móvil, y lo que se
 * cambia en formularios al lado (las partes y el Diseño). Arriba, «Mis páginas» lleva a cada página (?pagina=):
 *   · la portada (sin nada) y las suyas (también la 1:1 y Gifts): se escriben encima;
 *   · las que se crean solas (Cursos, Ofertas…) y las legales: se ven de verdad, con sus textos fijos encima.
 * ?ver=paginas abre «Mis páginas» al llegar y ?ver=codigos, la lista de códigos de la portada.
 */
export default async function MiPagina({ searchParams }: { searchParams: Promise<{ pagina?: string; ver?: string }> }) {
  const { pagina, ver } = await searchParams;
  const { creator } = await requireCreator();
  const personal = isPersonalMode();
  const db = tenantDb(creator.id);
  // La 1:1, Gifts y Hacerte miembro salen siempre en «Mis páginas» (la primera vez se crean con lo que enseña la web).
  await ensureOneToOnePage(creator.id);
  await ensureGiftsPage(creator.id);
  await ensureCommunityPage(creator.id);
  const [data, pages, oracleDecks, linkTargets] = await Promise.all([
    getPublicCreator(creator.username, true),
    db.sitePage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    getPublishedOracleDecks(creator.id),
    sitePageLinkTargets(creator.id, creator.username, personal),
  ]);
  const panelPages: PanelPage[] = pages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    state: sitePageState(p),
    path: sitePagePath(creator.username, p.slug, personal),
    inNav: p.showInNav,
    fixed: isFixedPageSlug(p.slug),
  }));
  const menu = { pages: panelPages, initialOpen: ver === "paginas" };
  const designPages = pages.map((p) => ({ title: p.title, slug: p.slug }));
  // El diseño de la web va en la portada (también el de cada página).
  const draft = readPageConfig(creator.pageDraft, creator.displayName);
  const page = pagina ? pages.find((p) => p.slug === pagina) : undefined;

  if (page && data) {
    return (
      <PageCanva
        id={page.id}
        title={WEB_PAGES.find((w) => w.key === page.slug)?.label ?? page.title}
        initial={readSitePageContent(page.draft, page.title)}
        status={page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
        slug={page.slug}
        showInNav={page.showInNav}
        username={creator.username}
        personal={personal}
        host={appHost()}
        origin={appUrl()}
        linkTargets={linkTargets.filter((t) => !t.href.endsWith(`/${page.slug}`))}
        config={{ displayName: data.config.displayName, avatarUrl: data.config.avatarUrl, theme: data.config.theme, pageThemes: data.config.pageThemes, newsletter: data.config.newsletter, texts: data.config.texts }}
        allowCustom={data.allowCustom}
        signupsOnly={data.signupsOnly}
        hiddenSlugs={[...hiddenProductSlugs(data.products, data.signupsOnly)]}
        navPages={data.pages}
        menu={menu}
        design={draft}
        designPages={designPages}
        oracleDecks={oracleDecks}
        moonCircles={nextMoonCircles(data.products)}
        tiers={page.slug === COMMUNITY_SLUG ? await webTiers(creator.id, creator.username, data.products, { href: personal ? "/" : `/${creator.username}`, texts: data.config.texts }) : undefined}
        viewHref={sitePagePath(creator.username, page.slug, personal)}
      />
    );
  }

  // Una página que se crea sola o una parte de la legal: se ve de verdad.
  const web = WEB_PAGES.find((w) => w.key === pagina && (personal || !w.personalOnly));
  const legal = LEGAL_PAGES.find((l) => l.key === pagina);
  if ((web || legal) && data) {
    const viewHref = web ? sectionPagePath(creator.username, web.key, personal) : creatorLegalHref(creator.username, legal!.anchor);
    return (
      <BuiltinCanva
        key={pagina}
        page={pagina!}
        designKey={web ? web.key : "legal"}
        label={web?.label ?? legal!.label}
        src={viewHref}
        viewHref={viewHref}
        manage={MANAGE[web ? web.key : "legal"] ?? null}
        menu={menu}
        personal={personal}
        design={draft}
        designPages={designPages}
        allowCustom={data.allowCustom}
        texts={data.config.texts ?? {}}
      />
    );
  }

  // La portada.
  const allCodes = await db.discountCode.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  // Todos los códigos (también los ocultos y caducados), para cambiarlos en su ventanita.
  const codes: CanvaCode[] = allCodes.map((c) => ({
    id: c.id,
    brand: c.brand,
    code: c.code,
    description: c.description ?? "",
    url: c.url,
    imageUrl: c.imageUrl,
    images: readCodePhotos(c.images),
    recommendations: readCodeRecommendations(c.recommendations),
    expiresOn: dateKeyFromExpiry(c.expiresAt, creator.timezone),
    active: c.active,
    stateLabel: CODE_STATE_LABEL[codeState(c)],
  }));
  const published = creator.pagePublished ? readPageConfig(creator.pagePublished, creator.displayName) : null;
  return (
    <HomeCanva
      menu={menu}
      openCodes={ver === "codigos"}
      sellerName={data?.creator.legalName ?? null}
      viewHref={personal ? "/" : `/${creator.username}`}
      codes={codes}
      editor={{
        initial: draft,
        publishedJson: published ? JSON.stringify(published) : "",
        creatorId: creator.id,
        username: creator.username,
        products: data?.products ?? [],
        posts: data?.posts ?? [],
        postCount: data?.postCount ?? 0,
        news: data?.news ?? [],
        portal: data?.portal ?? [],
        gifts: data?.gifts,
        discountCodes: data?.discountCodes ?? [],
        personal: data?.personal ?? false,
        signupsOnly: data?.signupsOnly ?? false,
        siteOrigin: appUrl(),
        allowCustom: data?.features.customDesign ?? false,
        allowRemoveBranding: data?.features.removeBranding ?? false,
        platformName: data?.platformName ?? "Cirella",
        referralCode: creator.referralCode,
        pages: pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, state: sitePageState(p) })),
        linkTargets,
        oracleDecks,
      }}
    />
  );
}
