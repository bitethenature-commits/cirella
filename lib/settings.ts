import { prisma } from "./db";

/**
 * Ajustes globales editables desde /admin/ajustes (clave → JSON).
 * Los valores por defecto viven aquí; la BD solo guarda lo que el admin cambia.
 */
export const SETTING_DEFAULTS = {
  platformName: "Cirella",
  supportEmail: "hola@cirella.app",
  referralRewardType: "FREE_MONTH" as "FREE_MONTH" | "CREDIT" | "COMMISSION_DISCOUNT",
  referralRewardValue: 1, // meses gratis | céntimos de crédito | puntos básicos de descuento
  referralDiscountMonths: 3, // duración del descuento de comisión
};

export type PlatformSettings = typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany();
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as PlatformSettings;
}

export async function setSetting<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}
