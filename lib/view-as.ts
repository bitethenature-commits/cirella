import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { includedMembershipIds } from "./membership-access";

/**
 * «Ver como miembro» (estudio Comunidad): la dueña abre su área de miembros como la vería alguien de
 * un nivel concreto, sin comprarlo. La cookie solo guarda el id del nivel y solo vale con la sesión
 * de la dueña de ese producto (quien llama ya ha comprobado isOwner con requireBuyerFor): para
 * cualquier otra persona se ignora. Además solo QUITA cosas (borradores, programadas, niveles de
 * arriba): nunca da acceso a nada que la sesión no tuviera ya.
 */
export const VIEW_AS_COOKIE = "cirella_ver_como";
export const VIEW_AS_MAX_AGE = 6 * 3600;

export type ViewAsTier = {
  /** Nivel con el que mira. */
  id: string;
  title: string;
  /** Lo que lee una miembro de ese nivel: él mismo y los niveles de abajo que incluye. */
  reach: string[];
};

/** El nivel con el que la dueña mira su comunidad, o null (vista normal de dueña). */
export async function ownerViewAs(owner: { creatorId: string | null | undefined; isOwner: boolean }): Promise<ViewAsTier | null> {
  if (!owner.isOwner || !owner.creatorId) return null;
  const id = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!id || id.length > 40) return null;
  const tier = await prisma.product.findFirst({ where: { id, creatorId: owner.creatorId, type: "MEMBERSHIP" }, select: { id: true, title: true } });
  if (!tier) return null;
  return { ...tier, reach: [tier.id, ...(await includedMembershipIds(tier.id))] };
}
