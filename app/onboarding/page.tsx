import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DELIVERY_COUNT, deliveryFacts, deliveryIssue } from "@/lib/delivery";
import { appHost, isDemoMode } from "@/lib/env";
import { legalIdentityComplete } from "@/lib/legal";
import { legalIdentityOf } from "@/lib/legal-snapshot";
import { payoutView } from "@/lib/payouts";
import { getSettings } from "@/lib/settings";
import { defaultPageConfig, readPageConfig } from "@/lib/page-config";
import { planFeatures } from "@/lib/plans";
import { isPersonalMode } from "@/lib/site-mode";
import type { ProductType } from "@/lib/types";
import { OnboardingWizard, type WizardInit } from "./wizard";

export const metadata: Metadata = { title: "Crea tu página · Cirella" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const creator = await prisma.creator.findUnique({
    where: { userId: user.id },
    include: {
      plan: true,
      products: { orderBy: { createdAt: "asc" }, take: 1, include: { files: { orderBy: { sortOrder: "asc" } }, ...DELIVERY_COUNT } },
    },
  });
  if (creator?.onboardedAt) redirect("/panel");
  // Modo personal: nadie crea páginas nuevas (la cuenta de la dueña la crea `npm run personal:setup`).
  if (isPersonalMode()) redirect("/login?error=cerrado");

  const [categories, defaultPlan, settings] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.plan.findFirst({ where: { isDefault: true } }),
    getSettings(),
  ]);
  const plan = creator?.plan ?? defaultPlan!;
  const jar = await cookies();
  let signup: { username?: string } = {};
  try {
    signup = JSON.parse(jar.get("cirella_signup")?.value ?? "{}");
  } catch {}

  const p = creator?.products[0];
  // Dónde retomar el asistente (10 pasos: 1 es /signup). Paso 7 si el producto aún no tiene
  // precio; paso 8 si al digital le falta la entrega y aún no ha empezado con los cobros (al volver
  // del formulario de Stripe sigue en el paso 9 aunque eligiera «más tarde»).
  const resumeStep = () => {
    if (!creator) return 2;
    if (!creator.categoryId) return 3;
    if (!p) return 6;
    if (p.priceCents === 0) return 7;
    if (p.type === "DIGITAL" && deliveryIssue(deliveryFacts(p))?.blocking && creator.payoutStatus === "NONE") return 8;
    return creator.payoutStatus !== "ACTIVE" ? 9 : 10;
  };
  const step = resumeStep();
  const config = creator ? readPageConfig(creator.pageDraft, creator.displayName) : { ...defaultPageConfig({ displayName: "Mi página" }), displayName: user.name ?? "" };
  const features = planFeatures(plan);

  const init: WizardInit = {
    step,
    host: appHost(),
    username: creator?.username ?? (signup.username || "").toLowerCase().replace(/[^a-z0-9._-]/g, ""),
    config,
    categoryId: creator?.categoryId ?? null,
    categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    product: {
      productId: p?.id ?? null,
      type: (p?.type as ProductType) ?? features.productTypes[0] ?? "DIGITAL",
      title: p?.title ?? "",
      summary: p?.summary ?? "",
      emoji: p?.emoji ?? "✨",
      imageUrl: p?.imageUrl ?? null,
      price: p && p.priceCents ? String(p.priceCents / 100).replace(".", ",") : "",
      durationMin: p?.durationMin ?? 60,
    },
    delivery: {
      mode: p?.deliveryMode === "PERSONAL" ? "PERSONAL" : "AUTOMATIC",
      instructions: p?.instructions ?? "",
      files: (p?.files ?? []).map((f) => ({ id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes })),
    },
    allowedTypes: features.productTypes,
    commissionBps: plan.commissionBps,
    planName: plan.name,
    payout: creator
      ? payoutView(creator, { supportEmail: settings.supportEmail })
      : payoutView({ status: "ACTIVE", payoutProvider: null, payoutStatus: "NONE", payoutChargesEnabled: false, payoutPayoutsEnabled: false, payoutRequirements: null }),
    demo: isDemoMode(),
    creatorId: creator?.id ?? null,
    termsAccepted: !!creator?.termsAcceptedAt,
    legal: {
      // Solo los campos legales: el resto de la fila (IBAN, cuenta de cobro…) no va al navegador.
      defaults: creator ? legalIdentityOf(creator) : {},
      contactFallback: creator?.contactEmail ?? user.email,
      complete: !!creator && legalIdentityComplete(creator),
    },
  };
  return <OnboardingWizard init={init} />;
}
