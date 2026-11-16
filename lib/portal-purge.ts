import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { readPortalMedia } from "./portal-rules";
import { privateKey, storage } from "./storage";

/**
 * «Cada X días se borran los portales viejos» (Creator.portalDays; null = nunca). Se BORRAN de verdad,
 * con sus archivos: los publicados hace más de esos días (los de antes sin fecha de publicación cuentan
 * desde que se crearon). La principal (featured) y los borradores no se tocan. Sin `creatorId`, todas las
 * creadoras con días puestos (la tarea del cron). Devuelve cuántos se han borrado.
 */
export async function purgeOldPortalItems(now: Date, creatorId?: string): Promise<number> {
  const creators = await prisma.creator.findMany({
    where: { portalDays: { not: null }, ...(creatorId ? { id: creatorId } : {}) },
    select: { id: true, username: true, portalDays: true },
  });
  let total = 0;
  for (const c of creators) {
    const cutoff = new Date(now.getTime() - (c.portalDays ?? 0) * 86_400_000);
    // La principal: la marcada o, si no hay, la primera de la lista (como en el panel y la portada).
    const main =
      (await prisma.portalItem.findFirst({ where: { creatorId: c.id, featured: true }, select: { id: true } })) ??
      (await prisma.portalItem.findFirst({ where: { creatorId: c.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } }));
    const old = await prisma.portalItem.findMany({
      where: {
        creatorId: c.id,
        status: "PUBLISHED",
        featured: false,
        ...(main ? { NOT: { id: main.id } } : {}),
        OR: [{ publishedAt: { lt: cutoff } }, { publishedAt: null, createdAt: { lt: cutoff } }],
      },
      select: { id: true, media: true },
    });
    if (!old.length) continue;
    await prisma.portalItem.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    const keys = old.flatMap((o) => readPortalMedia(o.media).map((m) => privateKey(m.key)));
    if (keys.length) await storage().delete(keys).catch(() => {});
    total += old.length;
    try {
      revalidatePath("/");
      revalidatePath(`/${c.username}`);
      revalidatePath(`/${c.username}/portal`);
    } catch {
      // Fuera de una petición (scripts): no hay caché que refrescar.
    }
  }
  return total;
}
