import "server-only";
import { visibleMemberPostWhere } from "./community-rules";
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
      // De cada lección, solo el tipo de sus partes y de sus archivos: ni ids, ni nombres, ni textos.
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true, durationMin: true, parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, file: { select: { kind: true } } } } },
          },
        },
      },
      // Los adjuntos de las publicaciones de la comunidad nunca se listan en la ficha.
      files: { where: { postId: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, kind: true } },
      // Solo las publicaciones ya visibles: nunca el título de un borrador o de una programada.
      posts: { where: visibleMemberPostWhere(new Date()), orderBy: { publishedAt: "desc" }, take: 3, select: { id: true, title: true, publishedAt: true } },
      // Cursos que incluye una membresía («Con esta membresía también tienes»).
      includes: {
        orderBy: { createdAt: "asc" },
        select: { includedProduct: { select: { id: true, title: true, slug: true, type: true, status: true, emoji: true, creatorId: true, _count: { select: { lessons: true } } } } },
      },
    },
  });
  return { ...data, product, summary };
}
