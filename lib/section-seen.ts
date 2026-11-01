import "server-only";
import { publicPostWhere } from "./posts";
import { getPublicCreator } from "./public";
import { portalViewer } from "./portal";
import { tenantDb } from "./tenant";
import { SEEN_SECTIONS, type SeenSection } from "./section-seen-rules";

/**
 * Avisos de novedades de la portada (el punto rojo de «Actualidades», «Portal de Noticias» y
 * «Ofertas»). Quien tiene cuenta y está suscrita (la regla del portal: lib/portal.ts → portalViewer)
 * guarda aquí cuándo abrió cada sección, así vale en todos sus dispositivos; el resto lo guarda solo
 * su navegador (components/creator-page/section-dropdown.tsx). La portada está cacheada: el navegador
 * pregunta a /api/novedades después de cargar.
 */

export type SectionCounts = Record<SeenSection, number>;

/** Lo que cuenta como «nuevo» en cada sección: publicadas, del portal y ofertas empezadas después. */
export async function sectionCounts(username: string, seen: Partial<Record<SeenSection, Date | null>>): Promise<SectionCounts> {
  const data = await getPublicCreator(username);
  if (!data) return { posts: 0, portal: 0, offers: 0 };
  const now = new Date();
  const after = (s: SeenSection) => seen[s]?.getTime() ?? 0;
  const posts = await tenantDb(data.creator.id).post.count({
    where: { ...publicPostWhere(now), publishedAt: { gt: new Date(after("posts")), lte: now } },
  });
  // Lo mismo que pinta la portada (creator-page-view): el portal solo en la web personal y las ofertas
  // solo en lo que se paga en la web.
  const portal = data.personal ? data.portal.filter((i) => Date.parse(i.publishedAt) > after("portal")).length : 0;
  const offers = data.signupsOnly ? 0 : data.products.filter((p) => p.sale && Date.parse(p.sale.startedAt) > after("offers")).length;
  return { posts, portal, offers };
}

/** Cuándo abrió cada sección esta usuaria (null = nunca, en ningún dispositivo). */
export async function seenAtFor(creatorId: string, userId: string): Promise<Partial<Record<SeenSection, Date>>> {
  const rows = await tenantDb(creatorId).sectionSeen.findMany({ where: { userId }, select: { section: true, seenAt: true } });
  const out: Partial<Record<SeenSection, Date>> = {};
  for (const r of rows) if ((SEEN_SECTIONS as readonly string[]).includes(r.section)) out[r.section as SeenSection] = r.seenAt;
  return out;
}

export async function markSectionSeen(creatorId: string, userId: string, section: SeenSection, at = new Date()) {
  await tenantDb(creatorId).sectionSeen.upsert({
    where: { userId_creatorId_section: { userId, creatorId, section } },
    create: { creatorId, userId, section, seenAt: at },
    update: { seenAt: at },
  });
}

/** ¿Se guarda en el servidor? Solo con cuenta y suscrita (o la dueña): el portal desbloqueado. */
export async function seenViewer(creator: { id: string; userId: string }) {
  const viewer = await portalViewer(creator);
  return viewer.unlocked && viewer.userId ? { userId: viewer.userId } : null;
}
