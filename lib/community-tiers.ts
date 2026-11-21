import "server-only";
import { prisma } from "./db";
import { ancestorsOf, descendantsOf, orderTiers } from "./tiers";

export type CommunityTier = {
  id: string;
  title: string;
  emoji: string | null;
  priceCents: number;
  status: string;
  level: number;
  /** Niveles de abajo que incluye (sus miembros leen también lo de esos niveles). */
  includes: string[];
  /** Niveles de arriba que lo incluyen (también leen lo que se publica en este). */
  includedBy: string[];
};

/**
 * Los niveles de la comunidad de una creadora (sus membresías sin archivar), de abajo arriba:
 * «Esencia» → «Plena» → «Luna completa» (lib/tiers.ts).
 */
export async function communityTiers(creatorId: string): Promise<CommunityTier[]> {
  const [memberships, edges] = await Promise.all([
    prisma.product.findMany({
      where: { creatorId, type: "MEMBERSHIP", status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, emoji: true, priceCents: true, status: true },
    }),
    prisma.productInclusion.findMany({ where: { creatorId }, select: { productId: true, includedProductId: true } }),
  ]);
  const ids = new Set(memberships.map((m) => m.id));
  return orderTiers(memberships, edges).map(({ tier, level }) => ({
    ...tier,
    level,
    includes: descendantsOf(edges, tier.id).filter((id) => ids.has(id)),
    includedBy: ancestorsOf(edges, tier.id).filter((id) => ids.has(id)),
  }));
}
