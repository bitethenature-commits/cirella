import { env, isProductionLike } from "../env";
import { captureAlert, captureError } from "../monitoring";
import { WebhookSignatureError, type PaymentProvider, type PaymentStatus, type StartPaymentResult } from "./provider";
import {
  approvalLink,
  encodeCustomId,
  mapCapture,
  mapEvent,
  mapOrder,
  toPaypalValue,
  type PaypalCapture,
  type PaypalEvent,
  type PaypalOrder,
  type PaypalRefund,
} from "./paypal-map";

/**
 * PayPal con la cuenta Business de la dueña (solo la web personal): API REST Orders v2.
 *   1. startPayment crea el pedido de PayPal y la compradora sale a PayPal a aprobarlo.
 *   2. Al volver (/api/payments/return?via=paypal&token=…) o con el aviso CHECKOUT.ORDER.APPROVED,
 *      el pago está aprobado pero sin cobrar: lib/payments/events.ts comprueba que el pedido de la
 *      web sigue esperándolo y lo cobra con completeCheckout («capture»). Las dos vías usan la misma
 *      PayPal-Request-Id: PayPal cobra una sola vez y devuelve el mismo resultado a la segunda.
 *   3. Membresías: en el primer pago PayPal guarda la cuenta de la compradora («vault») y cada
 *      renovación es un pedido con ese vault_id que se cobra sin ella delante (chargeSaved). Si la
 *      cuenta de PayPal no tiene activado el guardado, se cobra igual y las renovaciones se pagan
 *      con «Pagar ahora».
 *   4. Avisos (/api/webhooks/paypal): se verifican con PayPal (verify-webhook-signature) y se
 *      traducen en lib/payments/paypal-map.ts.
 * Sin Connect: no hay comisión ni cuentas de cobro. La API se inyecta para probarlo sin red
 * (scripts/unit/paypal.test.ts).
 */

export type PaypalConfig = {
  /** https://api-m.paypal.com (live), https://api-m.sandbox.paypal.com (sandbox) o un PayPal falso en local. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Id del webhook creado en la app de PayPal: sin él no se aceptan avisos. */
  webhookId: string | null;
};

export function paypalConfig(): PaypalConfig {
  const e = env();
  const baseUrl =
    (!isProductionLike() && e.PAYPAL_API_URL) || (e.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
  if (!e.PAYPAL_CLIENT_ID || !e.PAYPAL_CLIENT_SECRET) throw new Error("Faltan PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), clientId: e.PAYPAL_CLIENT_ID, clientSecret: e.PAYPAL_CLIENT_SECRET, webhookId: e.PAYPAL_WEBHOOK_ID ?? null };
}

/** Respuesta HTTP mínima (la de fetch). Las pruebas pasan una función falsa con esta forma. */
export type PaypalHttp = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; text(): Promise<string> }>;

/** Error de la API: `issue` es el código de PayPal (ORDER_ALREADY_CAPTURED, INSTRUMENT_DECLINED…). */
export class PaypalApiError extends Error {
  constructor(
    readonly status: number,
    readonly issue: string | null,
    readonly debugId: string | null,
    message: string,
  ) {
    super(message);
    this.name = "PaypalApiError";
  }
}

type ApiErrorBody = { name?: string; message?: string; debug_id?: string; details?: { issue?: string }[]; error?: string; error_description?: string };

/** Cliente REST con el token OAuth en caché (dura horas; se renueva un minuto antes). */
export function createPaypalApi(cfg: PaypalConfig, http: PaypalHttp = (url, init) => fetch(url, { ...init, cache: "no-store" })) {
  let token: { value: string; until: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.until > Date.now()) return token.value;
    const res = await http(`${cfg.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const body = JSON.parse((await res.text()) || "{}") as { access_token?: string; expires_in?: number } & ApiErrorBody;
    if (res.status !== 200 || !body.access_token)
      throw new PaypalApiError(res.status, body.error ?? null, null, `PayPal no ha aceptado las claves (${res.status}): ${body.error_description ?? body.error ?? "sin detalle"}`);
    token = { value: body.access_token, until: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 60) * 1000 };
    return token.value;
  }

  async function request<T>(method: "GET" | "POST", path: string, opts: { body?: unknown; rawBody?: string; requestId?: string } = {}): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId.slice(0, 108);
    const res = await http(`${cfg.baseUrl}${path}`, {
      method,
      headers,
      body: opts.rawBody ?? (opts.body === undefined ? (method === "POST" ? "{}" : undefined) : JSON.stringify(opts.body)),
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : {};
    if (res.status >= 200 && res.status < 300) return json as T;
    if (res.status === 401) token = null;
    const e = json as ApiErrorBody;
    throw new PaypalApiError(res.status, e.details?.[0]?.issue ?? e.name ?? null, e.debug_id ?? null, `PayPal ${method} ${path} → ${res.status} ${e.details?.[0]?.issue ?? e.name ?? ""}: ${e.message ?? ""}`);
  }

  return {
    createOrder: (body: unknown, requestId: string) => request<PaypalOrder>("POST", "/v2/checkout/orders", { body, requestId }),
    getOrder: (id: string) => request<PaypalOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`),
    captureOrder: (id: string) => request<PaypalOrder>("POST", `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { requestId: `capture:${id}` }),
    getCapture: (id: string) => request<PaypalCapture>("GET", `/v2/payments/captures/${encodeURIComponent(id)}`),
    refundCapture: (id: string, body: unknown, requestId: string) =>
      request<PaypalRefund>("POST", `/v2/payments/captures/${encodeURIComponent(id)}/refund`, { body, requestId }),
    verifyWebhook: (rawBody: string) => request<{ verification_status?: string }>("POST", "/v1/notifications/verify-webhook-signature", { rawBody }),
  };
}

export type PaypalApi = ReturnType<typeof createPaypalApi>;

const UNAVAILABLE = "No hemos podido conectar con PayPal. Inténtalo de nuevo en unos minutos.";
const DECLINED = "PayPal no ha podido cobrar el pago. Prueba con otra tarjeta o cuenta de PayPal.";
const NOT_ON_PAYPAL = "PayPal no gestiona cuentas de cobro: cobra con la cuenta de la dueña de la web.";

/** El guardado de cuentas («vault») no está activado en esta cuenta de PayPal. */
const isVaultUnavailable = (e: unknown) => e instanceof PaypalApiError && /VAULT/i.test(e.issue ?? "");

/**
 * Pedido ya cobrado, o cobrándose ahora mismo por la otra vía (la vuelta y el aviso a la vez con la
 * misma PayPal-Request-Id): se lee su estado. Si aún no está cobrado, la otra vía lo entregará.
 */
const isAlreadyCaptured = (e: unknown) => e instanceof PaypalApiError && (e.issue === "ORDER_ALREADY_CAPTURED" || e.issue === "PREVIOUS_REQUEST_IN_PROGRESS");

/** La compradora tiene que elegir otra forma de pago en PayPal (tarjeta rechazada, saldo…). */
const isDeclined = (e: unknown) => e instanceof PaypalApiError && (e.issue === "INSTRUMENT_DECLINED" || e.issue === "PAYER_ACTION_REQUIRED" || e.issue === "TRANSACTION_REFUSED");

export function createPaypalProvider(api: PaypalApi = createPaypalApi(paypalConfig()), cfg: Pick<PaypalConfig, "webhookId"> = paypalConfig()): PaymentProvider {
  /** Cobra un pedido aprobado. Idempotente: si ya estaba cobrado, devuelve su estado. */
  async function capture(orderId: string): Promise<PaymentStatus> {
    try {
      return mapOrder(await api.captureOrder(orderId));
    } catch (e) {
      if (isAlreadyCaptured(e)) {
        await new Promise((r) => setTimeout(r, 1500));
        return mapOrder(await api.getOrder(orderId));
      }
      if (isDeclined(e)) return { ...mapOrder(await api.getOrder(orderId)), state: "failed", error: DECLINED };
      throw e;
    }
  }

  return {
    key: "paypal",
    label: "PayPal",
    collectsCardOnSite: false,

    async startPayment(i) {
      if (i.destinationAccount) return { state: "failed", error: UNAVAILABLE }; // PayPal nunca reparte con Connect
      const owner = i.orderId ?? i.subscriptionId ?? "x";
      const order = (vault: boolean) => ({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: encodeCustomId(i.metadata),
            description: i.description.slice(0, 127),
            soft_descriptor: i.statementSuffix?.slice(0, 22),
            amount: { currency_code: i.currency.toUpperCase(), value: toPaypalValue(i.amountCents, i.currency) },
          },
        ],
        payment_source: {
          paypal: {
            email_address: i.customerEmail,
            experience_context: {
              locale: "es-ES",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              // PayPal añade «&token=<pedido>&PayerID=…» a la vuelta: {REF} queda vacío.
              return_url: i.returnUrl.replace("{REF}", ""),
              cancel_url: i.cancelUrl,
            },
            ...(vault
              ? {
                  attributes: {
                    vault: { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" },
                    ...(i.customerRef ? { customer: { id: i.customerRef } } : {}),
                  },
                }
              : {}),
          },
        },
      });
      const requestId = `checkout:${owner}:${Date.now()}`;
      try {
        let created: PaypalOrder;
        try {
          created = await api.createOrder(order(i.saveForFutureUse), requestId);
        } catch (e) {
          if (!i.saveForFutureUse || !isVaultUnavailable(e)) throw e;
          // Sin guardado en esta cuenta de PayPal: se cobra igual; las renovaciones, con «Pagar ahora».
          captureAlert("PayPal no permite guardar la cuenta de la compradora: las renovaciones con PayPal serán manuales", {
            area: "payments",
            level: "warning",
            fingerprint: ["paypal-sin-vault"],
            extra: { owner, issue: (e as PaypalApiError).issue },
          });
          created = await api.createOrder(order(false), `${requestId}:sin-vault`);
        }
        const url = approvalLink(created);
        if (!url) throw new Error("PayPal no ha devuelto el enlace de pago");
        // PayPal deja aprobar un pedido durante horas; el pedido de la web cuenta como abandonado a los 31 min, como con Stripe.
        return { state: "requires_action", checkoutRef: created.id, redirectUrl: url, expiresAt: new Date(Date.now() + 31 * 60_000) } satisfies StartPaymentResult;
      } catch (e) {
        captureError(e, { area: "payments", tags: { op: "checkout", pasarela: "paypal" }, extra: { owner } });
        return { state: "failed", error: UNAVAILABLE };
      }
    },

    async getPaymentStatus(ref) {
      // ref es el pedido de PayPal (checkoutRef) o, si ya se cobró, el cobro (paymentRef).
      try {
        return mapOrder(await api.getOrder(ref));
      } catch (e) {
        if (!(e instanceof PaypalApiError && e.status === 404)) throw e;
        return mapCapture(await api.getCapture(ref));
      }
    },

    completeCheckout: capture,

    async cancelCheckout() {
      // PayPal no permite anular un pedido sin cobrar: caduca solo. Si aun así se aprueba y se cobra,
      // el guardián lo trata como un segundo cobro y lo devuelve (lib/payments/events.ts).
    },

    async chargeSaved(i) {
      if (i.destinationAccount) return { state: "failed", error: UNAVAILABLE };
      if (!i.paymentMethodRef)
        return { state: "failed", error: "Tu membresía se paga con PayPal: renuévala desde tu cuenta con «Pagar ahora»." };
      try {
        const created = await api.createOrder(
          {
            intent: "CAPTURE",
            purchase_units: [
              {
                custom_id: encodeCustomId({ ...i.metadata, kind: "renewal" }),
                description: i.description.slice(0, 127),
                soft_descriptor: i.statementSuffix?.slice(0, 22),
                amount: { currency_code: i.currency.toUpperCase(), value: toPaypalValue(i.amountCents, i.currency) },
              },
            ],
            payment_source: { paypal: { vault_id: i.paymentMethodRef } },
          },
          i.idempotencyKey,
        );
        // Con una cuenta guardada PayPal cobra al crear el pedido; si no, se cobra aquí.
        const s = created.status === "COMPLETED" ? mapOrder(created) : created.status === "APPROVED" ? await capture(created.id) : mapOrder(created);
        if (s.state === "succeeded") return { state: "succeeded", ref: s.ref!, customerRef: i.customerRef ?? undefined, paymentMethodRef: i.paymentMethodRef };
        if (s.state === "processing") return { state: "processing", ref: s.ref!, checkoutRef: created.id };
        return { state: "failed", ref: s.ref, error: "PayPal ha rechazado la renovación." };
      } catch (e) {
        if (e instanceof PaypalApiError && e.status === 422)
          return { state: "failed", error: "PayPal ha rechazado la renovación." };
        captureError(e, { area: "payments", tags: { op: "renovacion", pasarela: "paypal" }, extra: { subscriptionId: i.subscriptionId } });
        return { state: "failed", error: UNAVAILABLE };
      }
    },

    async refund(i) {
      try {
        // Un reembolso parcial necesita la moneda: si no viene, la del cobro.
        const currency = i.amountCents != null ? (i.currency ?? (await api.getCapture(i.paymentRef)).amount?.currency_code ?? "EUR") : null;
        const re = await api.refundCapture(
          i.paymentRef,
          {
            ...(i.amountCents != null && currency ? { amount: { currency_code: currency.toUpperCase(), value: toPaypalValue(i.amountCents, currency) } } : {}),
            // Así el aviso del reembolso encuentra nuestro Refund aunque llegue antes que la respuesta.
            ...(i.metadata?.refundId ? { custom_id: `re|${i.metadata.refundId}` } : {}),
          },
          i.idempotencyKey,
        );
        if (re.status === "FAILED" || re.status === "CANCELLED") return { ok: false, error: "PayPal ha rechazado el reembolso." };
        return { ok: true, refundRef: re.id, status: re.status === "COMPLETED" ? "succeeded" : "pending" };
      } catch (e) {
        captureError(e, { area: "payments", tags: { op: "reembolso", pasarela: "paypal" }, extra: { paymentRef: i.paymentRef } });
        if (e instanceof PaypalApiError && e.issue === "CAPTURE_FULLY_REFUNDED") return { ok: false, error: "Este cobro ya está devuelto entero en PayPal." };
        return { ok: false, error: e instanceof PaypalApiError ? `PayPal: ${e.issue ?? e.status}` : UNAVAILABLE };
      }
    },

    async createPayoutAccount() {
      throw new Error(NOT_ON_PAYPAL);
    },
    async payoutOnboardingUrl() {
      throw new Error(NOT_ON_PAYPAL);
    },
    async getPayoutAccount() {
      throw new Error(NOT_ON_PAYPAL);
    },
    async payoutDashboardUrl() {
      return null;
    },

    async parseWebhook(rawBody, headers) {
      const h = (k: string) => headers.get(k) ?? "";
      if (!cfg.webhookId || !h("paypal-transmission-sig")) throw new WebhookSignatureError("Aviso sin firma");
      // Se pregunta a PayPal si el aviso es suyo. El cuerpo va tal cual llegó (sin volver a
      // serializarlo): PayPal firma esos bytes exactos.
      const check = await api.verifyWebhook(
        `{"auth_algo":${JSON.stringify(h("paypal-auth-algo"))},"cert_url":${JSON.stringify(h("paypal-cert-url"))},` +
          `"transmission_id":${JSON.stringify(h("paypal-transmission-id"))},"transmission_sig":${JSON.stringify(h("paypal-transmission-sig"))},` +
          `"transmission_time":${JSON.stringify(h("paypal-transmission-time"))},"webhook_id":${JSON.stringify(cfg.webhookId)},"webhook_event":${rawBody}}`,
      );
      if (check.verification_status !== "SUCCESS") throw new WebhookSignatureError("La firma del aviso no es válida");
      const evt = JSON.parse(rawBody) as PaypalEvent;
      const updates = mapEvent(evt);
      // Un cobro sin custom_id (no debería pasar): se busca en su pedido. Si falla la llamada, lanza
      // un error que no es de firma: processWebhook responde 500 y PayPal reintenta.
      for (const u of updates)
        if (u.kind === "payment" && !u.status.metadata.orderId && !u.status.metadata.subscriptionId && u.status.checkoutRef) {
          const o = await api.getOrder(u.status.checkoutRef);
          u.status.metadata = mapOrder(o).metadata;
        }
      return { eventId: evt.id, type: evt.event_type, accountId: null, updates };
    },
  };
}

let instance: PaymentProvider | undefined;
const real = () => (instance ??= createPaypalProvider());

/** Se crea al primer uso: `next build` y las webs sin PayPal no necesitan sus claves. */
export const paypalProvider: PaymentProvider = {
  key: "paypal",
  label: "PayPal",
  collectsCardOnSite: false,
  startPayment: (i) => real().startPayment(i),
  getPaymentStatus: (ref) => real().getPaymentStatus(ref),
  completeCheckout: (ref) => real().completeCheckout!(ref),
  cancelCheckout: (ref) => real().cancelCheckout(ref),
  chargeSaved: (i) => real().chargeSaved(i),
  refund: (i) => real().refund(i),
  createPayoutAccount: (i) => real().createPayoutAccount(i),
  payoutOnboardingUrl: (i) => real().payoutOnboardingUrl(i),
  getPayoutAccount: (id) => real().getPayoutAccount(id),
  payoutDashboardUrl: (id) => real().payoutDashboardUrl(id),
  parseWebhook: (raw, headers) => real().parseWebhook(raw, headers),
};
