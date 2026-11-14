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
  ["astrologia", "Astrología", "🌙", "mystical"],
  ["human-design", "Human Design", "🧬", "mystical"],
  ["gene-keys", "Gene Keys", "🔑", "cosmic"],
  ["tarot", "Tarot y oráculos", "🔮", "mystical"],
  ["espiritualidad", "Espiritualidad", "✨", "cosmic"],
  ["wellness", "Wellness", "🌿", "minimal"],
  ["yoga", "Yoga y meditación", "🧘", "minimal"],
  ["terapias", "Terapias holísticas", "🪷", "minimal"],
  ["coaching", "Coaching", "🌱", "luxury"],
  ["contenido", "Creadora de contenido", "📸", "editorial"],
] as const;

const TEMPLATES = [
  ["mystical", "Mystical", "Astrología · azul noche, crema, lavanda y destellos dorados"],
  ["minimal", "Minimal", "Wellness · arena, salvia y mucho aire"],
  ["luxury", "Luxury", "Marca personal · marfil, negro y oro"],
  ["cosmic", "Cosmic", "Oscuro · negro profundo con auroras violeta"],
  ["editorial", "Editorial", "Femenino · rubor, terracota y serif con carácter"],
  ["tierra", "Tierra", "Cálida · barro, ocre y oliva con textura de papel"],
  ["oceano", "Océano", "Profunda · azul de mar abierto y arena"],
  ["cuarzo", "Rosa cuarzo", "Dulce · rosa empolvado y oro suave"],
  ["bosque", "Bosque", "Serena · verde bosque oscuro y crema"],
  ["medianoche", "Medianoche dorada", "Elegante · negro, oro y marfil con líneas finas"],
  ["fugaces", "Estrellas fugaces", "En movimiento · cielo de noche con estrellas que cruzan"],
  ["polvo", "Polvo dorado", "En movimiento · motas de oro que suben despacio"],
  ["luciernagas", "Luciérnagas", "En movimiento · bosque de noche con luces que flotan"],
  ["olas", "Olas", "En movimiento · azul agua con olas suaves al pie"],
  ["petalos", "Pétalos de rosa", "En movimiento · rosa y oro con pétalos que caen"],
  ["luna", "Luna", "En movimiento · una luna que flota y cambia de fase"],
  ["nebulosa", "Nebulosa", "En movimiento · nubes rosas y violetas que respiran"],
  ["constelaciones", "Constelaciones", "En movimiento · constelaciones que se dibujan y brillan"],
  ["otono", "Hojas de otoño", "En movimiento · hojas cobrizas que caen despacio"],
  ["niebla", "Niebla", "En movimiento · bruma que pasa sobre verde salvia"],
  ["nieve", "Nieve", "En movimiento · nieve suave sobre azul de invierno"],
  ["burbujas", "Burbujas", "En movimiento · burbujas irisadas que suben"],
  ["velas", "Velas", "En movimiento · velas encendidas con llamas que tiemblan"],
  ["mandala", "Mandala", "En movimiento · un mandala dorado que gira muy lento"],
  ["lluvia", "Lluvia", "En movimiento · lluvia fina sobre gris azulado"],
  ["reflejos", "Bajo el agua", "En movimiento · rayos de luz que bailan bajo el agua"],
  ["desierto", "Calima", "En movimiento · arena del desierto con calima que pasa"],
] as const;

type PlanKey = (typeof PLANS)[number]["key"];

export async function ensureBaseData(db: PrismaClient): Promise<{
  plans: Record<PlanKey, Plan>;
  categories: Record<string, string>;
  templates: string[];
}> {
  const plans = {} as Record<PlanKey, Plan>;
  for (const plan of PLANS) plans[plan.key] = await db.plan.upsert({ where: { key: plan.key }, update: {}, create: plan });

  const categories: Record<string, string> = {};
  for (const [i, [slug, name, emoji, defaultTemplate]] of CATEGORIES.entries()) {
    const c = await db.category.upsert({ where: { slug }, update: {}, create: { slug, name, emoji, defaultTemplate, sortOrder: i } });
    categories[slug] = c.id;
  }

  for (const [i, [key, name, description]] of TEMPLATES.entries())
    await db.template.upsert({ where: { key }, update: {}, create: { key, name, description, sortOrder: i } });

  return { plans, categories, templates: TEMPLATES.map(([key]) => key) };
}
