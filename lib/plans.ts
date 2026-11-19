import type { Plan } from "@prisma/client";
import { PRODUCT_TYPES, type ProductType } from "./types";

/**
 * Entitlements de un plan. Viven en la columna JSON `Plan.features`, así que
 * el modelo de monetización (qué incluye cada plan, precios, comisiones y
 * límites) se cambia desde /admin/planes sin tocar código ni migrar datos.
 *
 * Para añadir una nueva palanca: añade la clave aquí con su valor por defecto,
 * léela con `planFeatures(plan)` donde haga falta, y aparecerá en el editor
 * de planes del admin.
 */
export type PlanFeatures = {
  productTypes: ProductType[];
  customDesign: boolean; // colores, tipografías y fondos propios
  removeBranding: boolean; // ocultar "Powered by"
  analytics: "basic" | "full" | "advanced";
  customerArea: boolean; // área privada de clientes con comunidad
  automations: boolean;
};

export const DEFAULT_FEATURES: PlanFeatures = {
  productTypes: ["DIGITAL"],
  customDesign: false,
  removeBranding: false,
  analytics: "basic",
  customerArea: false,
  automations: false,
};

export const ANALYTICS_LABEL: Record<PlanFeatures["analytics"], string> = {
  basic: "Métricas básicas",
  full: "Estadísticas",
  advanced: "Estadísticas avanzadas",
};

export function planFeatures(plan: Pick<Plan, "features">): PlanFeatures {
  const raw = (plan.features ?? {}) as Partial<PlanFeatures>;
  return {
    ...DEFAULT_FEATURES,
    ...raw,
    productTypes: Array.isArray(raw.productTypes)
      ? raw.productTypes.filter((t): t is ProductType => (PRODUCT_TYPES as readonly string[]).includes(t))
      : DEFAULT_FEATURES.productTypes,
  };
}

export function canSellType(plan: Pick<Plan, "features">, type: ProductType) {
  return planFeatures(plan).productTypes.includes(type);
}

/** Comisión efectiva (en puntos básicos) aplicando descuentos de referidos vigentes. */
export function effectiveCommissionBps(
  plan: Pick<Plan, "commissionBps">,
  creator: { commissionDiscountBps: number; commissionDiscountUntil: Date | null },
  now = new Date(),
) {
  const discountActive =
    creator.commissionDiscountBps > 0 &&
    (!creator.commissionDiscountUntil || creator.commissionDiscountUntil > now);
  const bps = plan.commissionBps - (discountActive ? creator.commissionDiscountBps : 0);
  return Math.max(0, bps);
}

export function planBullets(plan: Plan): string[] {
  const f = planFeatures(plan);
  const bullets: string[] = [];
  bullets.push(plan.maxProducts == null ? "Productos ilimitados" : `Hasta ${plan.maxProducts} productos`);
  const typeNames: Record<ProductType, string> = {
    DIGITAL: "Productos digitales",
    SESSION: "Reservas de sesiones",
    COURSE: "Cursos",
    MEMBERSHIP: "Membresías",
  };
  for (const t of f.productTypes) bullets.push(typeNames[t]);
  bullets.push(ANALYTICS_LABEL[f.analytics]);
  if (f.customDesign) bullets.push("Personalización visual completa");
  if (f.customerArea) bullets.push("Área de clientes y comunidad");
  if (f.automations) bullets.push("Automatizaciones de email");
  if (f.removeBranding) bullets.push("Sin marca de la plataforma");
  bullets.push(`Comisión por venta ${(plan.commissionBps / 100).toLocaleString("es-ES")} %`);
  return bullets;
}
