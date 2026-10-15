import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const creators = await prisma.creator.findMany({
    where: { published: true, status: "ACTIVE" },
    select: { username: true, updatedAt: true, products: { where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } } },
  });
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...["/terminos", "/privacidad", "/aviso-legal"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...creators.flatMap((c) => [
      { url: `${base}/${c.username}`, lastModified: c.updatedAt, priority: 0.8 },
      ...c.products.map((p) => ({ url: `${base}/${c.username}/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })),
    ]),
  ];
}
