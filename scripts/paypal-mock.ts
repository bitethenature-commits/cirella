/**
 * PayPal falso para pruebas en local (PAYPAL_API_URL=http://localhost:<puerto>): la parte de la API
 * REST que usa lib/payments/paypal.ts, con los pedidos en memoria, y una página de «aprobar el pago»
 * que hace de PayPal para la compradora (e2e). Nunca en producción: lib/env.ts lo prohíbe.
 *
 *   npx tsx scripts/paypal-mock.ts 4010        (o startPaypalMock(4010) desde una prueba)
 *
 *   · POST /v1/oauth2/token, POST/GET /v2/checkout/orders, POST …/capture, GET y POST …/refund de
 *     /v2/payments/captures, POST /v1/notifications/verify-webhook-signature (vale la firma
 *     «firma-valida»).
 *   · GET /checkoutnow?token=<pedido>: «Pagar con PayPal» (aprueba y vuelve a return_url con
 *     &token=…&PayerID=…) y «Cancelar» (vuelve a cancel_url).
 *   · Cuentas guardadas (vault): un pedido con vault_id se cobra al crearlo; «VAULT-RECHAZA» falla.
 *   · Email de la compradora «rechaza@…»: el cobro se rechaza (INSTRUMENT_DECLINED).
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import { randomBytes } from "node:crypto";

type Money = { currency_code: string; value: string };
type Order = {
  id: string;
  status: string;
  intent: string;
  purchase_units: { custom_id?: string; description?: string; amount: Money; payments?: { captures: Capture[] } }[];
  payment_source?: { paypal?: Record<string, unknown> };
  returnUrl?: string;
  cancelUrl?: string;
  vault: boolean;
  email?: string;
};
type Capture = { id: string; status: string; amount: Money; custom_id?: string; supplementary_data: { related_ids: { order_id: string } }; refunded: number };

const id = (p: string) => `${p}${randomBytes(6).toString("hex").toUpperCase()}`;

export type PaypalMock = {
  url: string;
  orders: Map<string, Order>;
  /** Respuestas ya dadas por PayPal-Request-Id (PayPal devuelve la misma a la segunda). */
  requests: Map<string, unknown>;
  close(): Promise<void>;
};

function read(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => resolve(s));
  });
}

function captureOf(o: Order): Capture | undefined {
  return o.purchase_units[0].payments?.captures[0];
}

function view(o: Order, base: string) {
  const { returnUrl, cancelUrl, vault, email, ...rest } = o;
  void returnUrl;
  void cancelUrl;
  void email;
  const captured = !!captureOf(o);
  return {
    ...rest,
    purchase_units: o.purchase_units.map((u) => ({ ...u, payments: u.payments ? { captures: u.payments.captures.map(({ refunded, ...c }) => (void refunded, c)) } : undefined })),
    payment_source:
      vault && captured
        ? { paypal: { email_address: o.email, attributes: { vault: { id: `VAULT-${o.id}`, status: "VAULTED", customer: { id: `CUS-${o.id}` } } } } }
        : o.payment_source,
    links: o.status === "PAYER_ACTION_REQUIRED" ? [{ rel: "payer-action", href: `${base}/checkoutnow?token=${o.id}` }] : [],
  };
}

export function startPaypalMock(port: number): Promise<PaypalMock> {
  const orders = new Map<string, Order>();
  const captures = new Map<string, { order: Order; capture: Capture }>();
  const requests = new Map<string, unknown>();
  const base = `http://localhost:${port}`;

  const doCapture = (o: Order) => {
    const unit = o.purchase_units[0];
    const declined = o.email?.startsWith("rechaza@");
    if (declined) return { status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] } };
    const c: Capture = { id: id("CAP"), status: "COMPLETED", amount: unit.amount, custom_id: unit.custom_id, supplementary_data: { related_ids: { order_id: o.id } }, refunded: 0 };
    unit.payments = { captures: [c] };
    o.status = "COMPLETED";
    captures.set(c.id, { order: o, capture: c });
    return { status: 201, body: view(o, base) };
  };

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    const raw = await read(req);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const html = (body: string) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><meta charset="utf-8"><title>PayPal (prueba)</title><body style="font-family:system-ui;padding:24px">${body}</body>`);
    };
    const reqId = String(req.headers["paypal-request-id"] ?? "");
    const once = (status: number, body: unknown) => {
      if (reqId) requests.set(reqId, { status, body });
      send(status, body);
    };
    if (reqId && requests.has(reqId)) {
      const r = requests.get(reqId) as { status: number; body: unknown };
      return send(r.status, r.body);
    }
    const m = (re: RegExp) => re.exec(url.pathname);
    try {
      if (req.method === "GET" && url.pathname === "/health") return send(200, { ok: true });
      if (req.method === "POST" && url.pathname === "/v1/oauth2/token") return send(200, { access_token: "TOKEN-PRUEBA", expires_in: 32400 });

      if (req.method === "POST" && url.pathname === "/v2/checkout/orders") {
        const b = JSON.parse(raw || "{}");
        const pp = b.payment_source?.paypal ?? {};
        const o: Order = {
          id: id("ORDER"),
          status: "PAYER_ACTION_REQUIRED",
          intent: b.intent,
          purchase_units: b.purchase_units,
          returnUrl: pp.experience_context?.return_url,
          cancelUrl: pp.experience_context?.cancel_url,
          vault: !!pp.attributes?.vault,
          email: pp.email_address,
        };
        orders.set(o.id, o);
        // Cuenta guardada: se cobra al crear el pedido, sin la compradora delante.
        if (pp.vault_id) {
          if (pp.vault_id === "VAULT-RECHAZA") return once(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] });
          const r = doCapture(o);
          return once(r.status, r.body);
        }
        return once(201, view(o, base));
      }

      let hit = m(/^\/v2\/checkout\/orders\/([^/]+)$/);
      if (req.method === "GET" && hit) {
        const o = orders.get(hit[1]);
        return o ? send(200, view(o, base)) : send(404, { name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }] });
      }
      hit = m(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/);
      if (req.method === "POST" && hit) {
        const o = orders.get(hit[1]);
        if (!o) return send(404, { name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }] });
        if (o.status === "COMPLETED") return once(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] });
        if (o.status !== "APPROVED") return once(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_NOT_APPROVED" }] });
        const r = doCapture(o);
        return once(r.status, r.body);
      }
      hit = m(/^\/v2\/payments\/captures\/([^/]+)$/);
      if (req.method === "GET" && hit) {
        const c = captures.get(hit[1]);
        if (!c) return send(404, { name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }] });
        const { refunded, ...rest } = c.capture;
        void refunded;
        return send(200, rest);
      }
      hit = m(/^\/v2\/payments\/captures\/([^/]+)\/refund$/);
      if (req.method === "POST" && hit) {
        const c = captures.get(hit[1]);
        if (!c) return send(404, { name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }] });
        const b = JSON.parse(raw || "{}");
        const total = Math.round(Number(c.capture.amount.value) * 100);
        const amount = b.amount ? Math.round(Number(b.amount.value) * 100) : total - c.capture.refunded;
        if (amount <= 0 || c.capture.refunded + amount > total) return once(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "CAPTURE_FULLY_REFUNDED" }] });
        c.capture.refunded += amount;
        c.capture.status = c.capture.refunded >= total ? "REFUNDED" : "PARTIALLY_REFUNDED";
        return once(201, { id: id("REFUND"), status: "COMPLETED", amount: { currency_code: c.capture.amount.currency_code, value: (amount / 100).toFixed(2) }, custom_id: b.custom_id });
      }
      if (req.method === "POST" && url.pathname === "/v1/notifications/verify-webhook-signature") {
        const b = JSON.parse(raw || "{}");
        return send(200, { verification_status: b.transmission_sig === "firma-valida" ? "SUCCESS" : "FAILURE" });
      }

      // Página de PayPal para la compradora (e2e).
      if (req.method === "GET" && url.pathname === "/checkoutnow") {
        const o = orders.get(url.searchParams.get("token") ?? "");
        if (!o) return html("<p>Pedido desconocido</p>");
        const u = o.purchase_units[0];
        return html(
          `<h1>PayPal (prueba)</h1><p>${u.description ?? ""}: ${u.amount.value} ${u.amount.currency_code}</p>` +
            `<form method="post" action="/approve?token=${o.id}"><button>Pagar con PayPal</button></form>` +
            `<form method="post" action="/cancel?token=${o.id}"><button>Cancelar y volver</button></form>`,
        );
      }
      if (req.method === "POST" && (url.pathname === "/approve" || url.pathname === "/cancel")) {
        const o = orders.get(url.searchParams.get("token") ?? "");
        if (!o) return html("<p>Pedido desconocido</p>");
        if (url.pathname === "/approve") o.status = "APPROVED";
        const back = new URL((url.pathname === "/approve" ? o.returnUrl : o.cancelUrl) ?? "/");
        back.searchParams.set("token", o.id);
        if (url.pathname === "/approve") back.searchParams.set("PayerID", "PAYER-PRUEBA");
        res.writeHead(303, { Location: back.toString() });
        return res.end();
      }
      send(404, { name: "RESOURCE_NOT_FOUND" });
    } catch (e) {
      send(500, { name: "INTERNAL_SERVER_ERROR", message: String(e) });
    }
  });
  return new Promise((resolve) =>
    server.listen(port, () =>
      resolve({ url: base, orders, requests, close: () => new Promise<void>((r) => server.close(() => r())) }),
    ),
  );
}

// Arranque directo (e2e): npx tsx scripts/paypal-mock.ts 4010
if (process.argv[1]?.endsWith("paypal-mock.ts")) {
  const port = Number(process.argv[2] ?? 4010);
  void startPaypalMock(port).then((m) => console.log(`PayPal falso en ${m.url}`));
}
