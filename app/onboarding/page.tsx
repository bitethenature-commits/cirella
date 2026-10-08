import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appHost } from "@/lib/env";
import { defaultPageConfig, readPageConfig } from "@/lib/page-config";
import { planFeatures } from "@/lib/plans";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";
import type { ProductType } from "@/lib/types";
import { OnboardingWizard, type WizardInit } from "./wizard";

export const metadata: Metadata = { title: "Crea tu página · Cirella" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const creator = await prisma.creator.findUnique({
    where: { userId: user.id },
    include: { plan: true, products: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (creator?.onboardedAt) redirect("/panel");

  const [categories, templates, defaultPlan] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.template.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.plan.findFirst({ where: { isDefault: true } }),
  ]);
  const plan = creator?.plan ?? defaultPlan!;
  const jar = await cookies();
  let signup: { username?: string } = {};
  try {
    signup = JSON.parse(jar.get("cirella_signup")?.value ?? "{}");
  } catch {}

  const p = creator?.products[0];
  const step = !creator ? 2 : !creator.categoryId ? 3 : !p ? 6 : p.priceCents === 0 ? 8 : !creator.payoutConnectedAt ? 9 : 10;
  const config = creator ? readPageConfig(creator.pageDraft, creator.displayName) : { ...defaultPageConfig({ displayName: "Mi página" }), displayName: user.name ?? "" };
  const features = planFeatures(plan);

  const init: WizardInit = {
    step,
    host: appHost(),
    username: creator?.username ?? (signup.username || "").toLowerCase().replace(/[^a-z0-9._-]/g, ""),
    config,
    categoryId: creator?.categoryId ?? null,
    categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, defaultTemplate: c.defaultTemplate })),
    templates: templates.map((t) => t.key).filter((k): k is TemplateKey => (TEMPLATE_KEYS as readonly string[]).includes(k)),
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
    allowedTypes: features.productTypes,
    commissionBps: plan.commissionBps,
    planName: plan.name,
    payoutConnected: !!creator?.payoutConnectedAt,
    creatorId: creator?.id ?? null,
  };
  return <OnboardingWizard init={init} />;
}
