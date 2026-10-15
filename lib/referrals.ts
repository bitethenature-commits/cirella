import { prisma } from "./db";
import { getSettings } from "./settings";

/**
 * Programa de referidos: Creadora A comparte su enlace (?ref=CODIGO o el
 * «Powered by» de su página). Cuando la creadora B publica su página, A recibe
 * la recompensa configurada en /admin/ajustes:
 *   FREE_MONTH          → crédito equivalente a N meses de su plan
 *   CREDIT              → crédito fijo (céntimos)
 *   COMMISSION_DISCOUNT → X puntos básicos menos de comisión durante N meses
 */
export async function attachReferral(newCreatorId: string, code: string | null | undefined) {
  if (!code) return;
  const referrer = await prisma.creator.findUnique({ where: { referralCode: code.toUpperCase() } });
  if (!referrer || referrer.id === newCreatorId) return;
  await prisma.creator.update({ where: { id: newCreatorId }, data: { referredById: referrer.id } });
  await prisma.referral.upsert({
    where: { referredId: newCreatorId },
    create: { referrerId: referrer.id, referredId: newCreatorId },
    update: {},
  });
}

export async function rewardReferral(referredCreatorId: string) {
  const ref = await prisma.referral.findUnique({
    where: { referredId: referredCreatorId },
    include: { referrer: { include: { plan: true } } },
  });
  if (!ref || ref.status !== "PENDING") return;
  const s = await getSettings();
  const type = s.referralRewardType;
  const value = Number(s.referralRewardValue) || 0;
  const data: Record<string, unknown> = {};
  let rewardValue = value;
  if (type === "FREE_MONTH") {
    rewardValue = ref.referrer.plan.priceMonthlyCents * Math.max(1, value);
    data.creditCents = { increment: rewardValue };
  } else if (type === "CREDIT") {
    data.creditCents = { increment: value };
  } else {
    const until = new Date();
    until.setMonth(until.getMonth() + (Number(s.referralDiscountMonths) || 3));
    data.commissionDiscountBps = value;
    data.commissionDiscountUntil = until;
  }
  await prisma.$transaction([
    prisma.creator.update({ where: { id: ref.referrerId }, data }),
    prisma.referral.update({
      where: { id: ref.id },
      data: { status: "REWARDED", rewardType: type, rewardValue, rewardedAt: new Date() },
    }),
  ]);
}

export const REWARD_LABEL: Record<string, string> = {
  FREE_MONTH: "Mes gratis",
  CREDIT: "Crédito",
  COMMISSION_DISCOUNT: "Comisión reducida",
};
