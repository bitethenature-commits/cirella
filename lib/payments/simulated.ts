import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { appUrl, isProductionLike } from "../env";
import type { PaymentProvider, PaymentStatus, PayoutAccountSnapshot, StartPaymentResult } from "./provider";

/**
 * Simulador de pagos para demo y desarrollo: el mismo ciclo de vida que Stripe sin dinero real.
 *
 * Tarjetas de prueba:
 *   · 4000 0000 0000 0002 → rechazada.
 *   · 4000 0027 6000 3184 → el banco pide confirmar: página /test-payment/<ref> con
 *     «Confirmar el pago», «Cancelar» y «El banco tarda (pago pendiente)».
 *   · 4000 0000 0000 0341 → se cobra y se guarda, pero la renovación de la membresía falla.
 *   · Cualquier otra (12+ dígitos) o Apple / Google Pay → aprobada al momento.
 *
 * El «servidor» del simulador es nuestra BD: el estado de un pago es el del pedido y el de una
 * cuenta de cobro, lo que eligió la creadora en /test-payment/account. No hay webhooks: sus páginas
 * llaman directamente a applyPaymentUpdate / syncPayoutAccount.
 */
export const DECLINED_TEST_CARD = "4000000000000002";
export const THREE_DS_TEST_CARD = "4000002760003184";
export const RENEWAL_FAIL_TEST_CARD = "4000000000000341";

const CHECKOUT_MINUTES = 30;
const hex = (n = 8) => randomBytes(n).toString("hex");

export const simulatedProvider: PaymentProvider = {
  key: "simulated",
  label: "Pago simulado",
  collectsCardOnSite: true,

  async startPayment(i) {
    assertNotProduction();
    const method = i.payment.method ?? "card";
    const digits = (i.payment.cardNumber ?? "").replace(/\D/g, "");
    if (method === "card") {
      if (digits === DECLINED_TEST_CARD) return { state: "failed", error: "Tu banco ha rechazado el pago. Prueba con otra tarjeta." };
      if (digits.length < 12) return { state: "failed", error: "Revisa el número de tarjeta." };
    }
    await new Promise((r) => setTimeout(r, 350)); // latencia realista
    if (method === "card" && digits === THREE_DS_TEST_CARD) {
      const checkoutRef = `sim_cs_${hex()}`;
      return { state: "requires_action", checkoutRef, redirectUrl: `${appUrl()}/test-payment/${checkoutRef}`, expiresAt: new Date(Date.now() + CHECKOUT_MINUTES * 60_000) };
    }
    const last4 = method === "card" ? digits.slice(-4) : "4242";
    return {
      state: "succeeded",
      ref: `sim_ch_${hex()}`,
      customerRef: i.saveForFutureUse ? (i.customerRef ?? `sim_cus_${hex(6)}`) : undefined,
      paymentMethodRef: i.saveForFutureUse ? simulatedPaymentMethod(last4) : undefined,
    } satisfies StartPaymentResult;
  },

  async getPaymentStatus(ref) {
    const order = await prisma.order.findFirst({
      where: { OR: [{ checkoutRef: ref }, { paymentRef: ref }] },
      include: { creator: { select: { payoutAccountId: true } } },
    });
    if (!order) throw new Error(`Pago simulado desconocido: ${ref}`);
    const state: PaymentStatus["state"] =
      order.status === "PAID" || order.status === "REFUNDED"
        ? "succeeded"
        : order.status === "PROCESSING"
          ? "processing"
          : order.status === "FAILED"
            ? "failed"
            : "requires_action";
    return {
      state,
      ref: order.paymentRef ?? undefined,
      checkoutRef: order.checkoutRef ?? undefined,
      amountCents: order.amountCents,
      currency: order.currency,
      destinationAccount: order.creator.payoutAccountId,
      metadata: { orderId: order.id },
      error: order.paymentError ?? undefined,
    };
  },

  async cancelCheckout() {},

  async chargeSaved(i) {
    assertNotProduction();
    // Sin tarjeta guardada (membresías del seed) la renovación simulada se cobra igualmente.
    if (i.paymentMethodRef?.endsWith(RENEWAL_FAIL_TEST_CARD.slice(-4))) return { state: "failed", error: "La tarjeta ha sido rechazada." };
    return { state: "succeeded", ref: `sim_ch_${hex()}`, customerRef: i.customerRef ?? undefined, paymentMethodRef: i.paymentMethodRef ?? undefined };
  },

  async refund() {
    assertNotProduction();
    return { ok: true, refundRef: `sim_re_${hex()}`, status: "succeeded" };
  },

  async createPayoutAccount() {
    assertNotProduction();
    return { accountId: `sim_acct_${hex(6)}` };
  },

  async payoutOnboardingUrl({ returnUrl }) {
    return `${appUrl()}/test-payment/account?vuelta=${encodeURIComponent(returnUrl)}`;
  },

  async getPayoutAccount(accountId) {
    const c = await prisma.creator.findUnique({
      where: { payoutAccountId: accountId },
      select: { payoutChargesEnabled: true, payoutPayoutsEnabled: true, payoutRequirements: true },
    });
    const stored = (c?.payoutRequirements ?? {}) as Partial<PayoutAccountSnapshot>;
    return {
      ...emptySnapshot(accountId),
      ...stored,
      accountId,
      chargesEnabled: c?.payoutChargesEnabled ?? false,
      payoutsEnabled: c?.payoutPayoutsEnabled ?? false,
      // Cuentas del seed (activas sin requisitos guardados): ya enviaron sus datos.
      detailsSubmitted: stored.detailsSubmitted ?? c?.payoutChargesEnabled ?? false,
    };
  },

  async payoutDashboardUrl() {
    return null;
  },

  async parseWebhook() {
    throw new Error("El simulador no recibe webhooks: sus páginas aplican los cambios directamente.");
  },
};

/** Referencia de la tarjeta guardada del simulador: sim_pm_<últimos 4>. */
export function simulatedPaymentMethod(last4: string) {
  return `sim_pm_${last4 || "4242"}`;
}

export function emptySnapshot(accountId: string): PayoutAccountSnapshot {
  return {
    accountId,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    currentlyDue: [],
    pastDue: [],
    eventuallyDue: [],
    pendingVerification: [],
    disabledReason: null,
    currentDeadline: null,
  };
}

/** Segunda barrera por si algo se saltara la validación del arranque (instrumentation.ts). */
function assertNotProduction() {
  if (isProductionLike()) throw new Error("El pago simulado no puede usarse en producción.");
}
