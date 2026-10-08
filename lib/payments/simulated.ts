import { randomBytes } from "node:crypto";
import type { PaymentProvider } from "./provider";

/** Tarjetas de prueba: 4000 0000 0000 0002 → rechazada. Cualquier otra → aprobada. */
export const DECLINED_TEST_CARD = "4000000000000002";

export const simulatedProvider: PaymentProvider = {
  key: "simulated",
  label: "Pago simulado",
  async charge(input) {
    const digits = (input.payment.cardNumber ?? "").replace(/\D/g, "");
    if (input.payment.method === "card") {
      if (digits === DECLINED_TEST_CARD) return { ok: false, error: "Tu banco ha rechazado el pago. Prueba con otra tarjeta." };
      if (digits.length < 12) return { ok: false, error: "Revisa el número de tarjeta." };
    }
    await new Promise((r) => setTimeout(r, 350)); // latencia realista
    return { ok: true, ref: `sim_ch_${randomBytes(8).toString("hex")}` };
  },
  async connectAccount() {
    return { accountId: `sim_acct_${randomBytes(6).toString("hex")}` };
  },
};
