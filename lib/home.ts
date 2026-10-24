import { prisma } from "./db";
import { isPersonalMode } from "./site-mode";

/** Destino natural de un usuario tras iniciar sesión. */
export async function homeFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { creator: true, _count: { select: { customerOf: true } } },
  });
  // Web personal: la dueña también es admin, pero su sitio natural es su panel.
  if (user.isAdmin && !(isPersonalMode() && user.creator?.onboardedAt)) return "/admin";
  if (user.creator) return user.creator.onboardedAt ? "/panel" : "/onboarding";
  if (user._count.customerOf > 0) return "/cuenta";
  // Web personal: no se crean páginas nuevas; quien no es la dueña es alumna (su área).
  if (isPersonalMode()) return "/cuenta";
  return "/onboarding";
}
