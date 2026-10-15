import "server-only";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";

/**
 * Membresías gratis (o dadas a mano) de una usuaria: acceso vigente a una membresía sin suscripción
 * detrás (lib/free-access.ts no crea suscripción: no hay nada que renovar). Las de pago salen de
 * getCustomerLibrary (lib/customer.ts) con su suscripción.
 */
export async function freeMemberships(userId: string) {
  const now = new Date();
  const rows = await prisma.access.findMany({
    where: {
      userId,
      status: "ACTIVE",
      subscriptionId: null,
      product: { type: "MEMBERSHIP" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    include: { product: { include: { creator: true } } },
  });
  return rows.map((a) => ({ id: a.id, productId: a.productId, product: a.product, since: a.createdAt, creatorBrief: creatorBrief(a.product.creator) }));
}
