import type Stripe from "stripe";
import { captureError } from "../monitoring";
import { WebhookSignatureError, type PaymentProvider, type StartPaymentResult } from "./provider";
import { stripeClient, stripeConfig, type StripeConfig } from "./stripe-client";
import { mapAccount, mapEvent, mapIntent, mapIntentState, mapSession } from "./stripe-map";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? undefined));

/**
 * Stripe: Checkout alojado. Dos formas de cobrar:
 *   · Plataforma (Connect Express, cargos de destino): el cobro lo hace la cuenta de Cirella;
 *     `application_fee_amount` es su comisión y `transfer_data.destination` la cuenta Express de la
 *     creadora, que recibe el resto.
 *   · Web personal (cobro directo, destinationAccount null): la cuenta es de la dueña y el cobro es
 *     suyo entero, sin comisión ni transferencia. Los reembolsos no revierten nada.
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
  /** Solo para recuperar de la creadora un contracargo perdido (recoverDispute). */
  transfers?: Pick<Stripe["transfers"], "retrieve" | "createReversal">;
  accounts: Pick<Stripe["accounts"], "create" | "retrieve" | "createLoginLink">;
  accountLinks: Pick<Stripe["accountLinks"], "create">;
  webhooks: Pick<Stripe["webhooks"], "constructEvent">;
};

// Stripe exige que expires_at quede al menos 30 min después de SU hora de creación de la sesión:
// un minuto de margen por la latencia y el redondeo a segundos (con 30 justos la rechaza).
const CHECKOUT_MINUTES = 31;
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
  // Con Connect cada cobro va a una cuenta de creadora; sin Connect, nunca (cobro directo). Un cobro
  // que no encaja con la configuración no se intenta: el dinero acabaría en la cuenta equivocada.
  const destinationFits = (destination: string | null) => (cfg.connect ? !!destination : destination == null);
  const connectFields = (i: { platformFeeCents: number; destinationAccount: string | null }) =>
    cfg.connect && i.destinationAccount
      ? {
          application_fee_amount: i.platformFeeCents,
          transfer_data: { destination: i.destinationAccount },
          on_behalf_of: cfg.onBehalfOf ? i.destinationAccount : undefined,
        }
      : {};
  return {
    key: "stripe",
    label: "Stripe",
    collectsCardOnSite: false,

    async startPayment(i) {
      // Un único valor para Stripe y para Order.checkoutExpiresAt: el pedido no cuenta como
      // abandonado mientras la página de pago siga abierta de verdad.
      const expiresSec = Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60;
      const expiresAt = new Date(expiresSec * 1000);
      const owner = i.orderId ?? i.subscriptionId ?? "x";
      if (!destinationFits(i.destinationAccount)) return { state: "failed", error: UNAVAILABLE };
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
              ...connectFields(i),
              setup_future_usage: i.saveForFutureUse ? "off_session" : undefined,
              statement_descriptor_suffix: i.statementSuffix?.slice(0, 22),
              description: i.description,
              metadata: i.metadata,
            },
            metadata: i.metadata,
            success_url: i.returnUrl.replace("{REF}", "{CHECKOUT_SESSION_ID}"),
            cancel_url: i.cancelUrl,
            expires_at: expiresSec,
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
      if (!destinationFits(i.destinationAccount)) return { state: "failed", error: UNAVAILABLE };
      try {
        const pi = await client.paymentIntents.create(
          {
            amount: i.amountCents,
            currency: i.currency.toLowerCase(),
            customer: i.customerRef ?? undefined,
            payment_method: i.paymentMethodRef ?? undefined,
            off_session: true,
            confirm: true,
            ...connectFields(i),
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
            // En el cobro directo (web personal) no hubo transferencia ni comisión.
            ...(cfg.connect ? { reverse_transfer: true, refund_application_fee: i.refundApplicationFee } : {}),
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

    async recoverDispute(i) {
      // Cargos de destino: Stripe cobra el contracargo perdido a la cuenta de Cirella y NO revierte
      // la transferencia a la creadora. Se recupera su parte con una reversión de la transferencia.
      // En el cobro directo el contracargo ya sale de la cuenta de la dueña: nada que recuperar.
      if (!cfg.connect) return { ok: true, reversalRef: null };
      if (!client.transfers) return { ok: false, error: "Cliente de Stripe sin transferencias" };
      try {
        const pi = await client.paymentIntents.retrieve(i.paymentRef, { expand: ["latest_charge"] });
        const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        const transferId = charge ? idOf(charge.transfer) : undefined;
        if (!transferId) return { ok: false, error: "El cobro no tiene transferencia a la creadora" };
        const transfer = await client.transfers.retrieve(transferId);
        const amount = Math.min(i.amountCents, transfer.amount - transfer.amount_reversed);
        if (amount <= 0) return { ok: true, reversalRef: null };
        const rev = await client.transfers.createReversal(
          transferId,
          { amount, metadata: { disputeRef: i.disputeRef } },
          { idempotencyKey: `dispute-reversal:${i.disputeRef}` },
        );
        return { ok: true, reversalRef: rev.id };
      } catch (e) {
        captureError(e, { area: "payments", tags: { op: "contracargo" }, extra: { paymentRef: i.paymentRef, disputeRef: i.disputeRef } });
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
      // Stripe nunca expande objetos en los avisos: en checkout.session.* el PaymentIntent llega
      // como id y sin él no sabríamos la tarjeta guardada (membresías) ni la cuenta de destino.
      // Se pide la sesión con el PaymentIntent expandido. Si falla, lanza un error que no es de
      // firma: processWebhook responde 500 y Stripe reintenta.
      if (evt.type.startsWith("checkout.session.")) {
        const s = evt.data.object as Stripe.Checkout.Session;
        if (typeof s.payment_intent === "string") {
          const full = await client.checkout.sessions.retrieve(s.id, { expand: ["payment_intent"] });
          evt = { ...evt, data: { ...evt.data, object: full } } as unknown as Stripe.Event;
        }
      }
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
  recoverDispute: (i) => real().recoverDispute!(i),
  createPayoutAccount: (i) => real().createPayoutAccount(i),
  payoutOnboardingUrl: (i) => real().payoutOnboardingUrl(i),
  getPayoutAccount: (id) => real().getPayoutAccount(id),
  payoutDashboardUrl: (id) => real().payoutDashboardUrl(id),
  parseWebhook: (raw, headers) => real().parseWebhook(raw, headers),
};
