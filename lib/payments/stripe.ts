import type Stripe from "stripe";
import { captureError } from "../monitoring";
import { WebhookSignatureError, type PaymentProvider, type StartPaymentResult } from "./provider";
import { stripeClient, stripeConfig, type StripeConfig } from "./stripe-client";
import { mapAccount, mapEvent, mapIntent, mapIntentState, mapSession } from "./stripe-map";

/**
 * Stripe: Checkout alojado + Connect Express con cargos de destino.
 *   · El cobro lo hace la cuenta de Cirella; `application_fee_amount` es su comisión y
 *     `transfer_data.destination` la cuenta Express de la creadora, que recibe el resto.
 *   · La tarjeta (y Apple Pay / Google Pay) se pide en la página de Stripe: 3DS incluido y ningún
 *     dato de tarjeta pasa por nuestro servidor. Solo `card`: nada de métodos que tarden días.
 *   · Las membresías guardan la tarjeta (setup_future_usage=off_session) para las renovaciones.
 * El cliente se inyecta para poder probarlo sin red (scripts/unit/payments.test.ts).
 */

/** Lo que usamos del SDK. Las pruebas pasan un objeto falso con esta forma. */
export type StripeLike = {
  checkout: { sessions: Pick<Stripe["checkout"]["sessions"], "create" | "retrieve" | "expire"> };
  paymentIntents: Pick<Stripe["paymentIntents"], "create" | "retrieve">;
  refunds: Pick<Stripe["refunds"], "create">;
  accounts: Pick<Stripe["accounts"], "create" | "retrieve" | "createLoginLink">;
  accountLinks: Pick<Stripe["accountLinks"], "create">;
  webhooks: Pick<Stripe["webhooks"], "constructEvent">;
};

const CHECKOUT_MINUTES = 30;
const DECLINED = "Tu banco ha rechazado el pago. Prueba con otra tarjeta.";
const UNAVAILABLE = "No hemos podido conectar con la pasarela de pago. Inténtalo de nuevo en unos minutos.";

type StripeErrorLike = { type?: string; code?: string; decline_code?: string; message?: string; payment_intent?: { id?: string } };
const asStripeError = (e: unknown): StripeErrorLike => (e && typeof e === "object" ? (e as StripeErrorLike) : {});

/** Mensaje para la compradora. Los detalles técnicos van a los registros, nunca a la pantalla. */
export function friendlyStripeError(e: unknown, declined = DECLINED) {
  const err = asStripeError(e);
  if (err.type === "StripeCardError") {
    if (err.code === "expired_card") return "La tarjeta ha caducado. Prueba con otra.";
    if (err.code === "insufficient_funds" || err.decline_code === "insufficient_funds") return "La tarjeta no tiene saldo suficiente.";
    return declined;
  }
  return UNAVAILABLE;
}

export function createStripeProvider(client: StripeLike = stripeClient(), cfg: StripeConfig = stripeConfig()): PaymentProvider {
  return {
    key: "stripe",
    label: "Stripe",
    collectsCardOnSite: false,

    async startPayment(i) {
      const expiresAt = new Date(Date.now() + CHECKOUT_MINUTES * 60_000);
      const owner = i.orderId ?? i.subscriptionId ?? "x";
      try {
        const session = await client.checkout.sessions.create(
          {
            mode: "payment",
            locale: "es",
            client_reference_id: owner,
            customer: i.customerRef ?? undefined,
            customer_email: i.customerRef ? undefined : i.customerEmail,
            customer_creation: i.saveForFutureUse && !i.customerRef ? "always" : undefined,
            // Tarjeta, que incluye Apple Pay y Google Pay. Sin métodos asíncronos (SEPA…): una sesión
            // reservada no puede esperar días a que llegue el dinero.
            payment_method_types: ["card"],
            line_items: [{ quantity: 1, price_data: { currency: i.currency.toLowerCase(), unit_amount: i.amountCents, product_data: { name: i.description } } }],
            payment_intent_data: {
              application_fee_amount: i.platformFeeCents,
              transfer_data: { destination: i.destinationAccount },
              on_behalf_of: cfg.onBehalfOf ? i.destinationAccount : undefined,
              setup_future_usage: i.saveForFutureUse ? "off_session" : undefined,
              statement_descriptor_suffix: i.statementSuffix?.slice(0, 22),
              description: i.description,
              metadata: i.metadata,
            },
            metadata: i.metadata,
            success_url: i.returnUrl.replace("{REF}", "{CHECKOUT_SESSION_ID}"),
            cancel_url: i.cancelUrl,
            expires_at: Math.floor(expiresAt.getTime() / 1000),
          },
          { idempotencyKey: `checkout:${owner}:${Date.now()}` },
        );
        if (!session.url) throw new Error("Stripe no ha devuelto la URL del checkout");
        return { state: "requires_action", checkoutRef: session.id, redirectUrl: session.url, expiresAt } satisfies StartPaymentResult;
      } catch (e) {
        captureError(e, { area: "payments", tags: { op: "checkout" }, extra: { owner } });
        return { state: "failed", error: friendlyStripeError(e) };
      }
    },

    async getPaymentStatus(ref) {
      if (ref.startsWith("cs_")) return mapSession(await client.checkout.sessions.retrieve(ref, { expand: ["payment_intent"] }));
      return mapIntent(await client.paymentIntents.retrieve(ref));
    },

    async cancelCheckout(checkoutRef) {
      try {
        await client.checkout.sessions.expire(checkoutRef);
      } catch (e) {
        // Ya caducada o completada: no hay nada que cancelar.
        if (asStripeError(e).type !== "StripeInvalidRequestError") throw e;
      }
    },

    async chargeSaved(i) {
      try {
        const pi = await client.paymentIntents.create(
          {
            amount: i.amountCents,
            currency: i.currency.toLowerCase(),
            customer: i.customerRef ?? undefined,
            payment_method: i.paymentMethodRef ?? undefined,
            off_session: true,
            confirm: true,
            application_fee_amount: i.platformFeeCents,
            transfer_data: { destination: i.destinationAccount },
            on_behalf_of: cfg.onBehalfOf ? i.destinationAccount : undefined,
            statement_descriptor_suffix: i.statementSuffix?.slice(0, 22),
            description: i.description,
            metadata: { ...i.metadata, kind: "renewal", subscriptionId: i.subscriptionId ?? "", periodKey: i.periodKey ?? "" },
          },
          { idempotencyKey: i.idempotencyKey },
        );
        const state = mapIntentState(pi.status);
        if (state === "succeeded") return { state, ref: pi.id, customerRef: i.customerRef ?? undefined, paymentMethodRef: i.paymentMethodRef ?? undefined };
        if (state === "processing") return { state, ref: pi.id };
        return { state: "failed", ref: pi.id, error: pi.last_payment_error?.message ? "Tu banco ha rechazado la renovación." : "Tu banco pide confirmar el pago." };
      } catch (e) {
        const err = asStripeError(e);
        // SCA: el banco quiere que la clienta confirme. Quien llama lo trata como un fallo que
        // necesita un pago con ella delante («Pagar ahora»).
        if (err.type === "StripeCardError" && err.code === "authentication_required")
          return { state: "requires_action", checkoutRef: "", redirectUrl: "", expiresAt: new Date() };
        if (err.type === "StripeCardError") return { state: "failed", ref: err.payment_intent?.id, error: "Tu banco ha rechazado la renovación." };
        captureError(e, { area: "payments", tags: { op: "renovacion" }, extra: { subscriptionId: i.subscriptionId } });
        return { state: "failed", error: UNAVAILABLE };
      }
    },

    async refund(i) {
      try {
        const re = await client.refunds.create(
          {
            payment_intent: i.paymentRef,
            amount: i.amountCents,
            // Cargos de destino: se recupera de la cuenta de la creadora lo que se le transfirió.
            reverse_transfer: true,
            refund_application_fee: i.refundApplicationFee,
            reason: i.reason,
            metadata: i.metadata,
          },
          { idempotencyKey: i.idempotencyKey },
        );
        if (re.status === "failed" || re.status === "canceled") return { ok: false, error: re.failure_reason ?? "Stripe ha rechazado el reembolso." };
        return { ok: true, refundRef: re.id, status: re.status === "succeeded" ? "succeeded" : "pending" };
      } catch (e) {
        captureError(e, { area: "payments", tags: { op: "reembolso" }, extra: { paymentRef: i.paymentRef } });
        return { ok: false, error: asStripeError(e).message ?? UNAVAILABLE };
      }
    },

    async createPayoutAccount(i) {
      const acct = await client.accounts.create(
        {
          type: "express",
          country: i.country,
          email: i.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_profile: { url: i.pageUrl, product_description: "Servicios y productos digitales vendidos en Cirella" },
          metadata: { creatorId: i.creatorId },
        },
        { idempotencyKey: `acct:${i.creatorId}` },
      );
      return { accountId: acct.id };
    },

    async payoutOnboardingUrl(i) {
      const link = await client.accountLinks.create({
        account: i.accountId,
        type: "account_onboarding",
        collection_options: { fields: "eventually_due" },
        return_url: i.returnUrl,
        refresh_url: i.refreshUrl,
      });
      return link.url;
    },

    async getPayoutAccount(accountId) {
      return mapAccount(await client.accounts.retrieve(accountId));
    },

    async payoutDashboardUrl(accountId) {
      return (await client.accounts.createLoginLink(accountId)).url;
    },

    async parseWebhook(rawBody, headers) {
      const signature = headers.get("stripe-signature");
      if (!signature || !cfg.webhookSecrets.length) throw new WebhookSignatureError("Aviso sin firma");
      // Dos endpoints (plataforma y cuentas conectadas) con su propio secreto: vale el que encaje.
      let evt: Stripe.Event | null = null;
      for (const secret of cfg.webhookSecrets) {
        try {
          evt = client.webhooks.constructEvent(rawBody, signature, secret);
          break;
        } catch {}
      }
      if (!evt) throw new WebhookSignatureError("La firma del aviso no es válida");
      return { eventId: evt.id, type: evt.type, accountId: evt.account ?? null, updates: mapEvent(evt) };
    },
  };
}

let instance: PaymentProvider | undefined;
const real = () => (instance ??= createStripeProvider());

/** Se crea al primer uso: `next build` y el modo simulado no necesitan claves de Stripe. */
export const stripeProvider: PaymentProvider = {
  key: "stripe",
  label: "Stripe",
  collectsCardOnSite: false,
  startPayment: (i) => real().startPayment(i),
  getPaymentStatus: (ref) => real().getPaymentStatus(ref),
  cancelCheckout: (ref) => real().cancelCheckout(ref),
  chargeSaved: (i) => real().chargeSaved(i),
  refund: (i) => real().refund(i),
  createPayoutAccount: (i) => real().createPayoutAccount(i),
  payoutOnboardingUrl: (i) => real().payoutOnboardingUrl(i),
  getPayoutAccount: (id) => real().getPayoutAccount(id),
  payoutDashboardUrl: (id) => real().payoutDashboardUrl(id),
  parseWebhook: (raw, headers) => real().parseWebhook(raw, headers),
};
