import "server-only";
import { SECTION_PAGE_TITLE, SECTION_PAGES, sectionPagePath } from "./site-sections";
import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { updateDraft } from "./creator";
import { prisma } from "./db";
import { appUrl } from "./env";
import { isOwnImageSrc } from "./page-blocks";
import { sanitizeBlocks } from "./page-blocks.server";
import { isPublicUsernameAllowed } from "./personal-routing";
import { getPublicCreator } from "./public";
import { isPersonalMode, ownerUsername } from "./site-mode";
import { siteText } from "./site-texts";
import {
  readSitePageContent,
  SITE_PAGE_SLUG_RE,
  SITE_PAGES_MAX,
  sitePageContentSchema,
  sitePagePath,
  sitePageSlugBase,
  sitePageSlugProblem,
  FIXED_PAGE_SLUGS,
  COMMUNITY_SLUG,
  communityContent,
  GIFTS_SLUG,
  giftsContent,
  isFixedPageSlug,
  ONE_TO_ONE_SLUG,
  oneToOneContent,
  starterContent,
  type SitePageContent,
  type SitePageTemplate,
} from "./site-pages";
import { randomCode } from "./slug";
import { tenantDb, type TenantDb } from "./tenant";

/**
 * Páginas extra: lectura pública y escrituras del panel (siempre con tenantDb). Las acciones del
 * panel (app/panel/paginas/actions.ts) son finas, llaman aquí y regeneran lo publicado; las pruebas
 * de BD llaman aquí directamente (por eso aquí no hay revalidatePath).
 */

const json = (v: unknown) => v as Prisma.InputJsonValue;

// ── Lectura pública ──

/**
 * Página extra publicada de una creadora publicada, o null (404). Una sola consulta decide el 404
 * (un bot que pruebe direcciones no cuesta más), y nunca se lee el borrador.
 */
export const getPublicSitePage = cache(async (username: string, slug: string) => {
  if (!isPublicUsernameAllowed(username, ownerUsername()) || !SITE_PAGE_SLUG_RE.test(slug)) return null;
  const page = await prisma.sitePage.findFirst({
    where: { slug, status: "PUBLISHED", creator: { username: username.toLowerCase() } },
    select: { id: true, slug: true, title: true, published: true, publishedAt: true, updatedAt: true },
  });
  if (!page?.published) return null;
  const data = await getPublicCreator(username);
  if (!data?.creator.published) return null;
  const path = sitePagePath(data.creator.username, page.slug, data.personal);
  return { data, page, content: readSitePageContent(page.published, page.title), path, url: `${appUrl()}${path}` };
});

// ── Panel ──

/** Slug libre entre las páginas de la creadora (sobre-mi, sobre-mi-2…). */
async function uniqueSitePageSlug(db: TenantDb, base: string, exceptId?: string) {
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.sitePage.findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base.slice(0, 56)}-${i}`;
  }
  return `${base.slice(0, 50)}-${randomCode(4).toLowerCase()}`;
}

async function creatorOf(creatorId: string) {
  return prisma.creator.findUniqueOrThrow({ where: { id: creatorId }, select: { id: true, username: true } });
}

export async function createSitePage(creatorId: string, input: { template: SitePageTemplate; title?: string }): Promise<{ id: string; slug: string } | { error: string }> {
  const db = tenantDb(creatorId);
  if ((await db.sitePage.count()) >= SITE_PAGES_MAX) return { error: `Máximo ${SITE_PAGES_MAX} páginas` };
  const creator = await creatorOf(creatorId);
  const content = starterContent(input.template, input.title);
  let base = sitePageSlugBase(content.title);
  if (sitePageSlugProblem(base, creator.username)) base = `${base.slice(0, 50)}-pagina`;
  const slug = await uniqueSitePageSlug(db, base);
  const last = await db.sitePage.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const page = await db.sitePage.create({
    data: { creatorId, slug, title: content.title, draft: json(content), status: "DRAFT", sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  return { id: page.id, slug };
}

export type SitePageInput = { content: SitePageContent; slug: string; showInNav: boolean };
export type SaveSitePageResult = { ok: true; slug: string; message: string } | { ok: false; error: string };

/**
 * Guarda el borrador (y, con `publish`, lo publica). La dirección y «en el pie» se aplican al
 * guardar, como el slug de las publicaciones; el contenido publicado solo cambia al publicar.
 */
export async function saveSitePage(creatorId: string, id: string, input: SitePageInput, o: { publish: boolean }): Promise<SaveSitePageResult> {
  const db = tenantDb(creatorId);
  const current = await db.sitePage.findFirst({ where: { id } });
  if (!current) return { ok: false, error: "Esta página ya no existe" };
  const parsed = sitePageContentSchema.safeParse(input.content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const content = parsed.data as SitePageContent;
  if (content.cover && !isOwnImageSrc(content.cover.src, creatorId)) return { ok: false, error: "Una imagen no es tuya o ya no existe: vuelve a subirla" };
  const clean = sanitizeBlocks(creatorId, content.blocks);
  if ("error" in clean) return { ok: false, error: clean.error };
  content.blocks = clean.blocks;

  const creator = await creatorOf(creatorId);
  // La 1:1 y Gifts no cambian de dirección (/uno-a-uno, /gifts).
  const fixed = isFixedPageSlug(current.slug);
  const wanted = fixed ? current.slug : sitePageSlugBase(content.title, input.slug);
  const problem = fixed ? null : sitePageSlugProblem(wanted, creator.username);
  if (problem) return { ok: false, error: problem };
  const slug = fixed ? current.slug : await uniqueSitePageSlug(db, wanted, current.id);

  const now = new Date();
  await db.sitePage.update({
    where: { id: current.id },
    data: {
      draft: json(content),
      title: content.title,
      slug,
      showInNav: !!input.showInNav,
      ...(o.publish ? { published: json(content), publishedTitle: content.title, status: "PUBLISHED", publishedAt: current.publishedAt ?? now } : {}),
    },
  });
  const where = sitePagePath(creator.username, slug, isPersonalMode());
  const message = o.publish ? `¡Publicada! Ya se ve en ${where}` : current.status === "PUBLISHED" ? "Borrador guardado: la página publicada no cambia hasta que publiques" : "Borrador guardado";
  const notice = slug !== wanted ? ` Esa dirección ya la usa otra de tus páginas; se ha guardado como «${slug}».` : "";
  return { ok: true, slug, message: message + notice };
}

/** Deja de verse (404) y conserva lo publicado, por si se vuelve a publicar. */
export async function unpublishSitePage(creatorId: string, id: string): Promise<boolean> {
  const db = tenantDb(creatorId);
  const r = await db.sitePage.updateMany({ where: { id }, data: { status: "DRAFT" } });
  return r.count > 0;
}

export async function deleteSitePage(creatorId: string, id: string): Promise<boolean> {
  const db = tenantDb(creatorId);
  // También la 1:1 y Gifts: ya no vuelven a crearse solas (fixedPageMade). En la web, su sección
  // enseña el texto de partida hasta que se quita en Mi página › Secciones.
  const r = await db.sitePage.deleteMany({ where: { id } });
  return r.count > 0;
}

/**
 * La 1:1 y Gifts se crean solas una sola vez: si ya se hicieron (o ya estaban), no vuelven aunque se
 * borren. La marca es una fila de PlatformSetting por creadora y página (su clave es única).
 */
async function fixedPageMade(creatorId: string, slug: string, exists: boolean): Promise<boolean> {
  const key = `paginaFijaHecha:${creatorId}:${slug}`;
  if (await prisma.platformSetting.findUnique({ where: { key }, select: { key: true } })) return true;
  await prisma.platformSetting.create({ data: { key, value: true } }).catch(() => {});
  return exists;
}

/**
 * La 1:1 y Gifts siempre se ven en la web (sin la suya, sale la de partida): se crean ya publicadas y las que se
 * crearon en borrador sin publicarse nunca se publican tal cual están (son lo que enseña la web).
 */
const publishedNow = (content: SitePageContent) => ({ published: json(content), publishedTitle: content.title, status: "PUBLISHED", publishedAt: new Date() });

async function publishFixedPage(creatorId: string, slug: string): Promise<void> {
  const db = tenantDb(creatorId);
  const p = await db.sitePage.findFirst({ where: { slug, status: "DRAFT" }, select: { id: true, title: true, draft: true, published: true } });
  if (!p || p.published !== null) return;
  await db.sitePage.update({ where: { id: p.id }, data: { published: json(p.draft), publishedTitle: p.title, status: "PUBLISHED", publishedAt: new Date() } });
}

export async function ensureOneToOnePage(creatorId: string): Promise<void> {
  const db = tenantDb(creatorId);
  const exists = !!(await db.sitePage.findFirst({ where: { slug: ONE_TO_ONE_SLUG }, select: { id: true } }));
  if (await fixedPageMade(creatorId, ONE_TO_ONE_SLUG, exists)) return publishFixedPage(creatorId, ONE_TO_ONE_SLUG);
  const creator = await creatorOf(creatorId);
  const data = await getPublicCreator(creator.username, true);
  const content = oneToOneContent(data?.config.displayName || creator.username, data?.config.contact.email || null);
  try {
    await db.sitePage.create({ data: { creatorId, slug: ONE_TO_ONE_SLUG, title: content.title, draft: json(content), ...publishedNow(content), showInNav: false, sortOrder: -1 } });
  } catch {
    // Otra pestaña la acaba de crear: ya está.
  }
}

/** Gifts en Páginas: si aún no está, se crea en borrador con lo que enseña la web (no sale en el pie). */
export async function ensureGiftsPage(creatorId: string): Promise<void> {
  const db = tenantDb(creatorId);
  const exists = !!(await db.sitePage.findFirst({ where: { slug: GIFTS_SLUG }, select: { id: true } }));
  if (await fixedPageMade(creatorId, GIFTS_SLUG, exists)) return publishFixedPage(creatorId, GIFTS_SLUG);
  const creator = await creatorOf(creatorId);
  const data = await getPublicCreator(creator.username, true);
  const content = giftsContent(data?.config.contact.email || null);
  try {
    await db.sitePage.create({ data: { creatorId, slug: GIFTS_SLUG, title: content.title, draft: json(content), ...publishedNow(content), showInNav: false, sortOrder: -1 } });
  } catch {
    // Otra pestaña la acaba de crear: ya está.
  }
}

/**
 * «Hacerte miembro» en Páginas: si aún no está, se crea ya publicada con lo que enseñaba la página de siempre (su
 * título, su entradilla y la sección de los niveles), para escribirla en Mi página. Como la 1:1, solo una vez.
 */
export async function ensureCommunityPage(creatorId: string): Promise<void> {
  const db = tenantDb(creatorId);
  const exists = !!(await db.sitePage.findFirst({ where: { slug: COMMUNITY_SLUG }, select: { id: true } }));
  if (await fixedPageMade(creatorId, COMMUNITY_SLUG, exists)) return publishFixedPage(creatorId, COMMUNITY_SLUG);
  const creator = await creatorOf(creatorId);
  const data = await getPublicCreator(creator.username, true);
  const texts = data?.config.texts;
  const many = (data?.products ?? []).filter((p) => p.type === "MEMBERSHIP").length > 1;
  const content = communityContent({
    title: siteText(texts, "pg.community.title"),
    text: siteText(texts, "pg.community.text"),
    more: siteText(texts, many ? "pg.community.textN" : "pg.community.text1"),
    badge: siteText(texts, "pg.community.badge"),
  });
  try {
    await db.sitePage.create({ data: { creatorId, slug: COMMUNITY_SLUG, title: content.title, draft: json(content), ...publishedNow(content), showInNav: false, sortOrder: -1 } });
  } catch {
    // Otra pestaña la acaba de crear: ya está.
  }
}


/** Sube o baja una página en la lista (es el orden del pie de la web). */
export async function moveSitePage(creatorId: string, id: string, dir: "up" | "down"): Promise<void> {
  const db = tenantDb(creatorId);
  const pages = await db.sitePage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = pages.findIndex((p) => p.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= pages.length) return;
  [pages[i], pages[j]] = [pages[j], pages[i]];
  await Promise.all(pages.map((p, n) => db.sitePage.updateMany({ where: { id: p.id }, data: { sortOrder: n } })));
}

/** «Añadir un botón a esta página en mi portada»: al borrador de «Mi página» (una vez). */
export async function addSitePageButton(creatorId: string, id: string): Promise<{ ok: boolean; message: string }> {
  const db = tenantDb(creatorId);
  const page = await db.sitePage.findFirst({ where: { id }, select: { title: true, slug: true } });
  if (!page) return { ok: false, message: "Esta página ya no existe" };
  const creator = await creatorOf(creatorId);
  const url = sitePagePath(creator.username, page.slug, isPersonalMode());
  let added = false;
  let full = false;
  await updateDraft(creatorId, (cfg) => {
    if (cfg.links.some((l) => l.url === url)) return cfg;
    if (cfg.links.length >= 12) {
      full = true;
      return cfg;
    }
    added = true;
    return { ...cfg, links: [...cfg.links, { id: `pg-${randomCode(6).toLowerCase()}`, label: page.title.slice(0, 60), url }] };
  });
  if (full) return { ok: false, message: "Tu portada ya tiene 12 botones: quita alguno en «Mi página»" };
  return added
    ? { ok: true, message: "Botón añadido al borrador de «Mi página». Publícala para que se vea." }
    : { ok: true, message: "Tu portada ya tiene un botón a esta página." };
}

/** Sugerencias de los campos de enlace del editor: portada, las páginas de la portada, productos y páginas extra. */
export async function sitePageLinkTargets(creatorId: string, username: string, personal: boolean): Promise<{ label: string; href: string }[]> {
  const db = tenantDb(creatorId);
  const [pages, products] = await Promise.all([
    db.sitePage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { title: true, slug: true } }),
    db.product.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { title: true, slug: true } }),
  ]);
  return [
    { label: "Portada", href: personal ? "/" : `/${username}` },
    ...SECTION_PAGES.filter((p) => personal || p !== "portal").map((p) => ({ label: SECTION_PAGE_TITLE[p], href: sectionPagePath(username, p, personal) })),
    ...pages.map((p) => ({ label: `Página: ${p.title}`, href: sitePagePath(username, p.slug, personal) })),
    ...products.map((p) => ({ label: `Producto: ${p.title}`, href: `/${username}/${p.slug}` })),
  ];
}
