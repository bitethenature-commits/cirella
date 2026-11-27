import { prisma } from "@/lib/db";

/**
 * Clics por enlace (únicos: una persona y un enlace cuentan una vez). Sin el enlace de baja.
 * `campaignIds` vacío = de todas las newsletters.
 */
export async function clicksByLink(creatorId: string, campaignIds: string[] | null, take = 10): Promise<{ link: string; clicks: number }[]> {
  if (campaignIds && !campaignIds.length) return [];
  const rows = await prisma.emailClick.groupBy({
    by: ["link"],
    where: { creatorId, ...(campaignIds ? { campaignId: { in: campaignIds } } : { campaignId: { not: null } }), NOT: { link: { contains: "/baja/" } } },
    _count: { _all: true },
    orderBy: { _count: { link: "desc" } },
    take,
  });
  return rows.map((r) => ({ link: r.link, clicks: r._count._all }));
}

/** El enlace, más corto y legible para una tabla (sin https:// ni los parámetros de seguimiento). */
export function prettyLink(link: string) {
  try {
    const u = new URL(link);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    const s = `${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
    return s.length > 70 ? `${s.slice(0, 67)}…` : s;
  } catch {
    return link.slice(0, 70);
  }
}
