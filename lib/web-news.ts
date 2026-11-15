import "server-only";
import { postCover } from "@/app/cuenta/membresias/cover";
import { prisma } from "./db";
import { visibleMemberPostWhere } from "./community-rules";
import { readCodePhotos, visibleCodeWhere } from "./discount-codes";
import { formatDate } from "./tz";

/**
 * «Actualidades», automáticas: lo que se va subiendo a la web, de lo más nuevo a lo más antiguo. Se ve sin
 * cuenta (solo el aviso: el contenido de las membresías sigue siendo de sus miembros).
 *   · Lo nuevo de las membresías: «Nuevo podcast en Plena», con su título (lleva a hacerse miembro, o a la
 *     publicación si ya lo es: /api/novedades/abrir).
 *   · Cursos, lecturas, sesiones y talleres nuevos (con su ficha).
 *   · Códigos de descuento nuevos (lleva a la sección de códigos de la portada).
 *   · El próximo círculo de la luna, para venir sin ser miembro: sale un día antes.
 */

export type NewsItem = {
  key: string;
  /** Cuándo (ISO): el orden y el aviso de novedades. */
  at: string;
  kind: "member" | "course" | "session" | "reading" | "workshop" | "code" | "circle";
  label: string;
  /** «5 nov». */
  dateLabel: string;
  title: string;
  text: string | null;
  href: string;
  image: string | null;
};

const MEMBER_LABEL: Record<string, string> = {
  TEXT: "Nuevo texto",
  PODCAST: "Nuevo podcast",
  AUDIO: "Nuevo podcast",
  MEDITACION: "Nueva meditación",
  ASTROWEATHER: "Nuevo Astroweather",
  MASTERCLASS: "Nueva masterclass",
  EVENT: "Nueva masterclass",
  CEREMONIA: "Nueva ceremonia",
  VIDEO: "Nuevo vídeo",
  CIRCULO_LUNAR: "Nuevo círculo",
};

const DAY = 86_400_000;

export async function webNews(o: {
  creatorId: string;
  username: string;
  /** Lo que la web enseña (ids de productos públicos), para no anunciar lo que no se ofrece. */
  publicProductIds: string[];
  /** Adónde lleva un código de descuento (la sección de la portada). */
  codesHref: string;
  timeZone: string;
  limit?: number;
  now?: Date;
  /** Cuántos días sale cada novedad (Creator.newsDays); null = siempre. Las más viejas se cuentan en `older`. */
  maxAgeDays?: number | null;
}): Promise<{ items: NewsItem[]; older: number }> {
  const now = o.now ?? new Date();
  const take = o.limit ?? 40;
  const cutoff = o.maxAgeDays ? new Date(now.getTime() - o.maxAgeDays * DAY) : null;
  const [posts, products, codes] = await Promise.all([
    prisma.membershipPost.findMany({
      where: { creatorId: o.creatorId, product: { type: "MEMBERSHIP", status: "PUBLISHED" }, ...visibleMemberPostWhere(now), ...(cutoff ? { publishedAt: { gte: cutoff, lte: now } } : {}) },
      orderBy: { publishedAt: "desc" },
      take,
      select: { id: true, title: true, kind: true, body: true, imageUrl: true, publishedAt: true, product: { select: { title: true } } },
    }),
    prisma.product.findMany({
      where: { id: { in: o.publicProductIds }, type: { in: ["COURSE", "SESSION", "DIGITAL"] } },
      select: { id: true, slug: true, title: true, summary: true, imageUrl: true, type: true, groupSession: true, moonCircle: true, eventStartAt: true, createdAt: true },
    }),
    prisma.discountCode.findMany({
      where: { creatorId: o.creatorId, ...visibleCodeWhere(now) },
      select: { id: true, brand: true, description: true, imageUrl: true, images: true, createdAt: true },
    }),
  ]);

  const items: Omit<NewsItem, "dateLabel">[] = [];
  for (const p of posts)
    items.push({
      key: `m-${p.id}`,
      at: p.publishedAt.toISOString(),
      kind: "member",
      label: `${MEMBER_LABEL[p.kind] ?? "Nuevo"} en ${p.product.title}`,
      title: p.title,
      text: `Para miembros de ${p.product.title}.`,
      href: `/api/novedades/abrir?p=${p.id}`,
      image: postCover(p).src,
    });
  for (const p of products) {
    if (p.moonCircle) {
      // El círculo de la luna, para venir sin ser miembro: un día antes.
      if (!p.eventStartAt) continue;
      const t = p.eventStartAt.getTime();
      if (t <= now.getTime() || t - now.getTime() > DAY) continue;
      items.push({
        key: `c-${p.id}`,
        at: new Date(t - DAY).toISOString(),
        kind: "circle",
        label: "Mañana · círculo de la luna",
        title: p.title,
        text: "Ven sin ser miembro: apúntate a este círculo.",
        href: `/${o.username}/${p.slug}`,
        image: p.imageUrl,
      });
      continue;
    }
    const kind = p.type === "COURSE" ? "course" : p.type === "DIGITAL" ? "reading" : p.groupSession ? "workshop" : "session";
    items.push({
      key: `p-${p.id}`,
      at: p.createdAt.toISOString(),
      kind,
      label: { course: "Nuevo curso", reading: "Nueva lectura", workshop: "Nuevo taller", session: "Nueva sesión" }[kind],
      title: p.title,
      text: p.summary,
      href: `/${o.username}/${p.slug}`,
      image: p.imageUrl,
    });
  }
  for (const c of codes)
    items.push({
      key: `d-${c.id}`,
      at: c.createdAt.toISOString(),
      kind: "code",
      label: "Nuevo código de descuento",
      title: c.brand,
      text: c.description,
      href: o.codesHref,
      image: c.imageUrl ?? readCodePhotos(c.images)[0]?.src ?? null,
    });
  // Las que ya pasaron de sus días: fuera de la lista, pero contadas (los posts viejos, con su propia cuenta).
  const fresh = cutoff ? items.filter((i) => new Date(i.at) >= cutoff) : items;
  const oldPosts = cutoff
    ? await prisma.membershipPost.count({ where: { creatorId: o.creatorId, product: { type: "MEMBERSHIP", status: "PUBLISHED" }, ...visibleMemberPostWhere(now), publishedAt: { lt: cutoff } } })
    : 0;
  return {
    items: fresh
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, take)
      .map((i) => ({ ...i, dateLabel: formatDate(new Date(i.at), { day: "numeric", month: "short" }, o.timeZone).replace(".", "") })),
    older: items.length - fresh.length + oldPosts,
  };
}
