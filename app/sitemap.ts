import { productPath } from "@/lib/public-paths";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { postsListPath, publicPostWhere } from "@/lib/posts";
import { sectionPagePath } from "@/lib/site-sections";
import { ownerUsername } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const owner = ownerUsername();
  if (owner) return personalSitemap(base, owner);
  const creators = await prisma.creator.findMany({
    where: { published: true, status: "ACTIVE" },
    select: {
      username: true,
      updatedAt: true,
      products: { where: { status: "PUBLISHED" }, select: { slug: true, type: true, updatedAt: true } },
      posts: { where: publicPostWhere(), select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } },
      sitePages: { where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } },
    },
  });
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...["/terms", "/privacy", "/legal-notice"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...creators.flatMap((c) => [
      { url: `${base}/${c.username}`, lastModified: c.updatedAt, priority: 0.8 },
      ...c.products.map((p) => ({ url: `${base}${productPath(c.username, p)}`, lastModified: p.updatedAt, priority: 0.6 })),
      ...postEntries(base, c.username, c.posts),
      ...c.sitePages.map((p) => ({ url: `${base}/${c.username}/p/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })),
    ]),
  ];
}

/** Modo personal: solo la web de la dueña (portada, páginas de la portada, páginas extra, productos y actualidades). Sin páginas de la plataforma. */
async function personalSitemap(base: string, owner: string): Promise<MetadataRoute.Sitemap> {
  const c = await prisma.creator.findFirst({
    where: { username: owner, published: true, status: "ACTIVE" },
    select: {
      updatedAt: true,
      // Lo de pago no se ofrece aquí: su ficha es un 404 para las visitas.
      products: { where: { status: "PUBLISHED", accessMode: { not: "PAID" } }, select: { slug: true, type: true, updatedAt: true } },
      posts: { where: publicPostWhere(), select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } },
      sitePages: { where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } },
    },
  });
  if (!c) return [{ url: `${base}/`, changeFrequency: "weekly", priority: 1 }];
  return [
    { url: `${base}/`, lastModified: c.updatedAt, changeFrequency: "weekly", priority: 1 },
    // Sus páginas extra viven en la raíz (/aboutme), que es su dirección canónica.
    ...c.sitePages.map((p) => ({ url: `${base}/${p.slug}`, lastModified: p.updatedAt, priority: 0.7 })),
    // Las páginas de la portada nueva, también en la raíz (lib/site-sections.ts).
    ...(["comunidad", "cursos", "lecturas", "sesiones"] as const).map((p) => ({ url: `${base}${sectionPagePath(owner, p, true)}`, priority: 0.6 })),
    ...c.products.map((p) => ({ url: `${base}${productPath(owner, p)}`, lastModified: p.updatedAt, priority: 0.7 })),
    ...postEntries(base, owner, c.posts, true),
  ];
}

/** Actualidades de una creadora: la lista y cada publicación visible (nada si no tiene ninguna). */
function postEntries(base: string, username: string, posts: { slug: string; updatedAt: Date }[], personal = false): MetadataRoute.Sitemap {
  if (!posts.length) return [];
  return [
    { url: `${base}${postsListPath(username, personal)}`, lastModified: posts[0].updatedAt, changeFrequency: "weekly", priority: 0.6 },
    // Las publicaciones escritas a mano ya no salen en la web: solo la lista de novedades.
  ];
}
