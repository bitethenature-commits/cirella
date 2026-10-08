import "server-only";
import { prisma } from "./db";
import { getPublicCreator } from "./public";

/** Producto público de una creadora con lo necesario para su ficha. */
export async function getPublicProduct(username: string, slug: string, draft = false) {
  const data = await getPublicCreator(username, draft);
  if (!data) return null;
  const summary = data.products.find((p) => p.slug === slug);
  if (!summary) return null;
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: summary.id },
    include: {
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, kind: true, durationMin: true } } } },
      files: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, kind: true } },
      posts: { orderBy: { publishedAt: "desc" }, take: 3, select: { id: true, title: true, publishedAt: true } },
    },
  });
  return { ...data, product, summary };
}
