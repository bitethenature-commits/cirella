/**
 * Datos base que la plataforma necesita para funcionar: planes, categorías y diseños.
 * Sin ellos nadie puede completar el onboarding (lib/creator.ts busca el plan por defecto).
 *
 * Los usan el seed de la demo y `prisma/bootstrap.ts` (producción). Solo crean lo que falta:
 * lo que la administradora ya ha editado en /admin no se sobrescribe nunca.
 */
import type { Plan, PrismaClient } from "@prisma/client";

const PLANS = [
  {
    key: "free", name: "Free", tagline: "Para empezar a vender hoy", priceMonthlyCents: 0, commissionBps: 1000, maxProducts: 3,
    isDefault: true, sortOrder: 1,
    features: { productTypes: ["DIGITAL"], customDesign: false, removeBranding: false, analytics: "basic", customerArea: false, automations: false },
  },
  {
    key: "creator", name: "Creator", tagline: "Para profesionales que ya venden", priceMonthlyCents: 1200, commissionBps: 500, maxProducts: 15,
    highlighted: true, sortOrder: 2,
    features: { productTypes: ["DIGITAL", "SESSION"], customDesign: true, removeBranding: true, analytics: "full", customerArea: false, automations: false },
  },
  {
    key: "pro", name: "Pro", tagline: "Tu negocio completo", priceMonthlyCents: 2900, commissionBps: 200, maxProducts: null, sortOrder: 3,
    features: { productTypes: ["DIGITAL", "SESSION", "COURSE", "MEMBERSHIP"], customDesign: true, removeBranding: true, analytics: "advanced", customerArea: true, automations: true },
  },
] as const;

const CATEGORIES = [
  ["astrologia", "Astrología", "🌙"],
  ["human-design", "Human Design", "🧬"],
  ["gene-keys", "Gene Keys", "🔑"],
  ["tarot", "Tarot y oráculos", "🔮"],
  ["espiritualidad", "Espiritualidad", "✨"],
  ["wellness", "Wellness", "🌿"],
  ["yoga", "Yoga y meditación", "🧘"],
  ["terapias", "Terapias holísticas", "🪷"],
  ["coaching", "Coaching", "🌱"],
  ["contenido", "Creadora de contenido", "📸"],
] as const;

type PlanKey = (typeof PLANS)[number]["key"];

export async function ensureBaseData(db: PrismaClient): Promise<{
  plans: Record<PlanKey, Plan>;
  categories: Record<string, string>;
}> {
  const plans = {} as Record<PlanKey, Plan>;
  for (const plan of PLANS) plans[plan.key] = await db.plan.upsert({ where: { key: plan.key }, update: {}, create: plan });

  const categories: Record<string, string> = {};
  for (const [i, [slug, name, emoji]] of CATEGORIES.entries()) {
    const c = await db.category.upsert({ where: { slug }, update: {}, create: { slug, name, emoji, sortOrder: i } });
    categories[slug] = c.id;
  }

  return { plans, categories };
}
