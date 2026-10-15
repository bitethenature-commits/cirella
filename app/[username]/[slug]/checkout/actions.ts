"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { claimOrderSession, holdsCheckout, rememberCheckout } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSlotAvailable } from "@/lib/booking";
import { parseCheckoutConsents } from "@/lib/checkout-consents";
import { requestClient } from "@/lib/client-ip";
import { ensureLegalSnapshot } from "@/lib/legal-snapshot";
import { checkoutGate, noteCheckoutFailure } from "@/lib/limits";
import { captureError } from "@/lib/monitoring";
import { CheckoutError, createPendingOrder, getPurchasableProduct, startOrderPayment } from "@/lib/orders";
import { paymentProvider } from "@/lib/payments";
import { isKnownCountry } from "@/lib/tax/rates";
import { ipCountry } from "@/lib/tax/server";
import { isPlausibleTaxId, normalizeTaxId } from "@/lib/tax/tax-id";
import { currentVisitorId } from "@/lib/visitor";

/** needsCaptcha: el siguiente intento necesita la comprobación de Turnstile (tras varios rechazos). */
export type CheckoutState = { error?: string; orderId?: string; needsCaptcha?: boolean; captchaSiteKey?: string } | undefined;

const schema = z.object({
  productId: z.string().min(1),
  orderId: z.string().optional(),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Revisa tu email"),
  slotStart: z.string().datetime().optional().or(z.literal("")),
  // Solo el simulador pide la tarjeta en nuestra página; con Stripe se paga en la suya.
  method: z.enum(["card", "wallet"]).optional(),
  cardNumber: z.string().max(30).optional(),
  // Las casillas (acceptTerms, waiver, newsletter) las valida parseCheckoutConsents según el producto.
  // IVA: país de residencia y, si pide factura, sus datos fiscales.
  country: z.string().trim().min(2, "Elige tu país").max(5).refine(isKnownCountry, "Elige tu país"),
  wantsInvoice: z.literal("on").optional(),
  billingName: z.string().trim().max(120).optional(),
  billingTaxId: z.string().max(30).optional(),
  billingAddress: z.string().trim().max(300).optional(),
}).superRefine((d, ctx) => {
  if (!d.wantsInvoice) return;
  if ((d.billingName ?? "").length < 2) ctx.addIssue({ code: "custom", path: ["billingName"], message: "Escribe el nombre o la razón social" });
  else if (!isPlausibleTaxId(d.billingTaxId ?? "", d.country)) ctx.addIssue({ code: "custom", path: ["billingTaxId"], message: "Revisa el NIF: no es válido" });
  else if ((d.billingAddress ?? "").length < 8) ctx.addIssue({ code: "custom", path: ["billingAddress"], message: "Escribe la dirección fiscal" });
});

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, orderId: String(form.get("orderId") ?? "") || undefined };
  const input = parsed.data;
  const billing = input.wantsInvoice
    ? { name: input.billingName!, taxId: normalizeTaxId(input.billingTaxId!), address: input.billingAddress! }
    : null;
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { creatorId: true, type: true, deliveryMode: true } });
  if (!product) return { error: "Este producto no está disponible ahora mismo.", orderId: input.orderId || undefined };
  const consents = parseCheckoutConsents(Object.fromEntries(form), product.type, product.deliveryMode);
  if (!consents.ok) return { error: consents.error, orderId: input.orderId || undefined };
  // Límites de intentos y, tras varios rechazos, el captcha (el token no va en el esquema: es de un solo uso).
  const client = await requestClient();
  const gate = await checkoutGate({ email: input.email, ip: client.ip, ipHash: client.ipHash, turnstileToken: String(form.get("turnstileToken") ?? "") || null });
  if (!gate.ok) return { error: gate.message, orderId: input.orderId || undefined, needsCaptcha: gate.needsCaptcha, captchaSiteKey: gate.captchaSiteKey };
  const visitorId = await currentVisitorId(product.creatorId);

  let orderId = input.orderId;
  try {
    // Reintento tras un pago rechazado o cancelado: solo reutilizamos el pedido si es exactamente
    // la misma compra (mismo producto, comprador, hueco y precio) y el producto sigue disponible.
    // Si ese pedido tiene el pago pendiente de confirmar, startOrderPayment lo dice en vez de cobrar otra vez.
    const existing = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    const prevSlot = (existing?.metadata as { slotStart?: string } | null)?.slotStart ?? "";
    // Solo el navegador que hizo el pedido puede reintentarlo: con el id de otra persona (una URL
    // compartida) se crea un pedido nuevo y no se toca el suyo (ni su permiso de compra).
    const ownsExisting = !!existing && (await holdsCheckout(existing.id, existing.claimTokenHash));
    let reusable =
      !!existing &&
      ownsExisting &&
      existing.status !== "PAID" &&
      existing.productId === input.productId &&
      existing.buyerEmail === input.email &&
      prevSlot === (input.slotStart || "") &&
      // El IVA y la factura dependen del país y de los datos fiscales: si cambian, pedido nuevo.
      existing.buyerCountry === input.country &&
      existing.billingTaxId === (billing?.taxId ?? null) &&
      existing.billingName === (billing?.name ?? null) &&
      existing.billingAddress === (billing?.address ?? null);
    if (reusable) {
      const purchasable = await getPurchasableProduct(input.productId);
      reusable = !!purchasable && purchasable.priceCents === existing!.amountCents;
      if (reusable && input.slotStart && !(await isSlotAvailable(purchasable!, input.slotStart)))
        throw new CheckoutError("Ese horario acaba de ocuparse. Elige otro, por favor.");
    }
    if (!reusable) {
      // Se sustituye un pedido de este navegador (cambió el país, los datos fiscales…): su página de
      // pago, si sigue abierta, se cancela para que no se puedan pagar las dos.
      if (existing && ownsExisting && existing.status === "PENDING" && existing.checkoutRef) {
        await paymentProvider()
          .cancelCheckout(existing.checkoutRef)
          .catch((e) => captureError(e, { area: "checkout", extra: { orderId: existing.id } }));
        await prisma.order.updateMany({ where: { id: existing.id, status: "PENDING" }, data: { status: "ABANDONED", recoverySkipped: "sustituido" } });
      }
      const lastVisit = await prisma.analyticsEvent.findFirst({
        where: { creatorId: product.creatorId, visitorId, type: "PAGE_VIEW" },
        orderBy: { createdAt: "desc" },
      });
      const order = await createPendingOrder({
        productId: input.productId,
        buyerEmail: input.email,
        buyerName: input.name,
        slotStart: input.slotStart || null,
        visitorId,
        ipHash: client.ipHash,
        source: lastVisit?.source ?? null,
        buyerCountry: input.country,
        ipCountry: ipCountry(await headers()),
        billing,
      });
      orderId = order.id;
    }
    // Consentimientos con la versión exacta de las condiciones, antes de cualquier cobro: así la
    // entrega por el aviso de la pasarela no necesita nada más. En cada intento se guardan los
    // últimos (un pedido con el pago ya en marcha no se toca).
    const snapshot = await ensureLegalSnapshot(product.creatorId);
    const now = new Date();
    await prisma.order.updateMany({
      where: { id: orderId!, status: { in: ["PENDING", "FAILED", "ABANDONED"] } },
      data: {
        legalSnapshotId: snapshot.id,
        termsAcceptedAt: now,
        waiverKind: consents.consents.waiverKind,
        waiverText: consents.consents.waiverText,
        waiverAcceptedAt: consents.consents.waiverKind ? now : null,
        marketingOptIn: consents.consents.marketingOptIn,
      },
    });
    // Este navegador es el que paga: solo él podrá abrir la sesión limitada al pedido, también al
    // volver de la pasarela o del banco (lib/payments/return.ts).
    await rememberCheckout(orderId!);
    const result = await startOrderPayment(orderId!, { method: input.method, cardNumber: input.cardNumber });
    if (result.kind === "failed") {
      // Solo cuenta el rechazo; un pago que queda pendiente o en la app del banco, no.
      const f = await noteCheckoutFailure({ email: input.email, ipHash: client.ipHash });
      return { error: result.error, orderId, needsCaptcha: f.needsCaptcha, captchaSiteKey: f.captchaSiteKey };
    }
    if (result.kind === "redirect") redirect(result.url);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { creator: true } });
    const thanks = `/${order.creator.username}/gracias?pedido=${order.id}`;
    if (result.kind === "processing") redirect(thanks);

    // La sesión tras pagar solo abre ESTE pedido (24 h) y solo en el navegador que pagó. Para ver
    // el resto de la cuenta se pide un enlace al email; el recibo lleva además un enlace personal.
    await claimOrderSession(order.id);
    redirect(thanks);
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message, orderId };
    throw e;
  }
}
