import { prisma } from "./db";

/** Destino natural de un usuario tras iniciar sesión. */
export async function homeFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { creator: true, _count: { select: { customerOf: true } } },
  });
  if (user.isAdmin) return "/admin";
  if (user.creator) return user.creator.onboardedAt ? "/panel" : "/onboarding";
  if (user._count.customerOf > 0) return "/cuenta";
  return "/onboarding";
}
