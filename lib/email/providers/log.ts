import type { EmailProvider } from "../provider";

/**
 * Proveedor de desarrollo y demo: no envía nada (los emails se guardan y se leen en /dev/email).
 * Para probar los reintentos simula fallos según la dirección:
 *   · ana+fallo@…  → fallo transitorio del proveedor (se reintenta)
 *   · ana+rebote@… → dirección rechazada (fallo permanente)
 * lib/env.ts impide usarlo en producción.
 */
export function simulatedEmailOutcome(to: string): "ok" | "retry" | "permanent" {
  const local = to.split("@")[0]?.toLowerCase() ?? "";
  if (local.includes("+rebote")) return "permanent";
  if (local.includes("+fallo")) return "retry";
  return "ok";
}

export const logProvider: EmailProvider = {
  key: "log",
  async send(msg) {
    if (process.env.NODE_ENV === "development") console.info(`[email] → ${msg.to} · ${msg.subject}`);
    const outcome = simulatedEmailOutcome(msg.to);
    if (outcome === "retry") return { ok: false, kind: "retry", error: "Fallo simulado del proveedor de email (+fallo)" };
    if (outcome === "permanent") return { ok: false, kind: "permanent", error: "Dirección rechazada (+rebote)" };
    return { ok: true, providerId: `log_${msg.id}` };
  },
};
