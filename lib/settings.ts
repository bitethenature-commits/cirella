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
  // Identidad legal de la plataforma (LSSI art. 10): /aviso-legal, /privacidad y /terminos.
  // Vacíos = «Pendiente de completar».
  legalCompanyName: "",
  legalTaxId: "",
  legalAddress: "",
  legalRegistry: "",
  privacyEmail: "", // si está vacío, se muestra supportEmail
  // Newsletter (lib/newsletter-send.ts y la bandeja de salida): emails al día que caben en el plan de
  // Resend (el gratuito: 100 al día y 3000 al mes, contando TODOS los emails). null = automático:
  // 100 en la web personal que envía con Resend, sin límite en lo demás (plataforma, demo y pruebas).
  // 0 = sin límite. La reserva queda siempre para los transaccionales (accesos, recibos, enlaces).
  emailDailyCap: null as number | null,
  emailTransactionalReserve: 20,
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
