import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { publicPostWhere } from "@/lib/posts";
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
      products: { where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } },
      posts: { where: publicPostWhere(), select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } },
    },
  });
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...["/terminos", "/privacidad", "/aviso-legal"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...creators.flatMap((c) => [
      { url: `${base}/${c.username}`, lastModified: c.updatedAt, priority: 0.8 },
      ...c.products.map((p) => ({ url: `${base}/${c.username}/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })),
      ...postEntries(base, c.username, c.posts),
    ]),
  ];
}

/** Modo personal: solo la web de la dueña (portada, productos y novedades). Sin páginas de la plataforma. */
async function personalSitemap(base: string, owner: string): Promise<MetadataRoute.Sitemap> {
  const c = await prisma.creator.findFirst({
    where: { username: owner, published: true, status: "ACTIVE" },
    select: {
      updatedAt: true,
      // Lo de pago no se ofrece aquí: su ficha es un 404 para las visitas.
      products: { where: { status: "PUBLISHED", accessMode: { not: "PAID" } }, select: { slug: true, updatedAt: true } },
      posts: { where: publicPostWhere(), select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } },
    },
  });
  if (!c) return [{ url: `${base}/`, changeFrequency: "weekly", priority: 1 }];
  return [
    { url: `${base}/`, lastModified: c.updatedAt, changeFrequency: "weekly", priority: 1 },
    ...c.products.map((p) => ({ url: `${base}/${owner}/${p.slug}`, lastModified: p.updatedAt, priority: 0.7 })),
    ...postEntries(base, owner, c.posts),
  ];
}

/** Novedades de una creadora: la lista y cada publicación visible (nada si no tiene ninguna). */
function postEntries(base: string, username: string, posts: { slug: string; updatedAt: Date }[]): MetadataRoute.Sitemap {
  if (!posts.length) return [];
  return [
    { url: `${base}/${username}/novedades`, lastModified: posts[0].updatedAt, changeFrequency: "weekly", priority: 0.6 },
    ...posts.map((p) => ({ url: `${base}/${username}/novedades/${p.slug}`, lastModified: p.updatedAt, priority: 0.5 })),
  ];
}
