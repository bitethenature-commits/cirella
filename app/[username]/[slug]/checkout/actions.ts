"use server";

import { effectivePriceCents } from "@/lib/offers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { claimOrderSession, holdsCheckout, rememberCheckout } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { isGroupSession, isSlotAvailable } from "@/lib/booking";
import { asksIntake, parseIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { canonicalTimezone } from "@/lib/timezones";
import { parseCheckoutConsents } from "@/lib/checkout-consents";
import { requestClient } from "@/lib/client-ip";
import { ensureLegalSnapshot } from "@/lib/legal-snapshot";
import { checkoutGate, noteCheckoutFailure } from "@/lib/limits";
import { captureError } from "@/lib/monitoring";
import { CheckoutError, createPendingOrder, getPurchasableProduct, startOrderPayment } from "@/lib/orders";
import { NO_ONLINE_PAYMENTS, chooseCheckoutProvider, paidCheckoutOpen, paymentProviderByKey } from "@/lib/payments";
import { currentVisitorId } from "@/lib/visitor";

/** needsCaptcha: el siguiente intento necesita la comprobación de Turnstile (tras varios rechazos). */
/** field: campo con el error (datos para la lectura), para enfocarlo. */
export type CheckoutState = { error?: string; field?: string; orderId?: string; needsCaptcha?: boolean; captchaSiteKey?: string } | undefined;

const schema = z.object({
  productId: z.string().min(1),
  orderId: z.string().optional(),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Revisa tu email"),
  slotStart: z.string().datetime().optional().or(z.literal("")),
  // Zona horaria del navegador (sesiones): la clienta verá su hora en los emails y en su área.
  buyerTz: z.string().max(64).optional(),
  // Pasarela elegida (tarjeta o PayPal) cuando la web tiene varias.
  payWith: z.string().max(20).optional(),
  // Solo el simulador pide la tarjeta en nuestra página; con Stripe se paga en la suya.
  method: z.enum(["card", "wallet"]).optional(),
  cardNumber: z.string().max(30).optional(),
  // Las casillas (acceptTerms, waiver, newsletter) las valida parseCheckoutConsents según el producto.
});

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  // Web personal o sin pasarela: ni pedido ni límites de intentos, solo el aviso.
  if (!paidCheckoutOpen()) return { error: NO_ONLINE_PAYMENTS };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, orderId: String(form.get("orderId") ?? "") || undefined };
  const input = parsed.data;
  const payWith = chooseCheckoutProvider(input.payWith);
  if (!payWith) return { error: "Ese método de pago no está disponible. Elige otro.", orderId: input.orderId || undefined };
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { creatorId: true, type: true, deliveryMode: true, intake: true, groupSession: true },
  });
  if (!product) return { error: "Este producto no está disponible ahora mismo.", orderId: input.orderId || undefined };
  // Datos para la lectura (nacimiento y preguntas de la dueña): se validan aquí, con su configuración.
  const intakeCfg = readIntakeConfig(product.intake);
  const intake = asksIntake(product.type, product.deliveryMode, intakeCfg) ? parseIntakeAnswers(intakeCfg, Object.fromEntries(form)) : ({ ok: true, value: null } as const);
  if (!intake.ok) return { error: intake.error, field: intake.field, orderId: input.orderId || undefined };
  // Un taller tiene fecha fija: no se elige hueco.
  const slotStart = isGroupSession(product) ? "" : input.slotStart || "";
  const buyerTz = canonicalTimezone(input.buyerTz);
  // Casilla obligatoria del desistimiento: renuncia en lo digital, reconocimiento en los talleres y
  // empezar ya en las membresías (lib/legal.ts → waiverKindFor). Vale para tarjeta y PayPal: el pago
  // lo vuelve a comprobar.
  const consents = parseCheckoutConsents(Object.fromEntries(form), product.type, product.deliveryMode, { groupSession: product.groupSession });
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
      // Otro método de pago (de tarjeta a PayPal o al revés): pedido nuevo, y el anterior se cancela.
      existing.paymentProvider === payWith &&
      prevSlot === slotStart;
    if (reusable) {
      const purchasable = await getPurchasableProduct(input.productId);
      // El precio de ahora (con la oferta si sigue activa): si la oferta empezó o terminó, pedido nuevo.
      reusable = !!purchasable && effectivePriceCents(purchasable) === existing!.amountCents;
      // Su propio pedido no le quita la hora que ya tenía guardada.
      if (reusable && slotStart && !(await isSlotAvailable(purchasable!, slotStart, { ignoreOrderId: existing!.id })))
        throw new CheckoutError("Ese horario acaba de ocuparse. Elige otro, por favor.");
    }
    if (!reusable) {
      // Se sustituye un pedido de este navegador (cambió el hueco, el método de pago…): su página de pago, si sigue abierta, se cancela para que no se puedan pagar las dos.
      // PayPal no deja cancelar: el pedido queda «sustituido» y un pago que se apruebe después en esa
      // pestaña no se cobra (lib/payments/events.ts).
      if (existing && ownsExisting && (existing.status === "PENDING" || existing.status === "ABANDONED") && existing.checkoutRef) {
        if (existing.status === "PENDING")
          await paymentProviderByKey(existing.paymentProvider)
            .cancelCheckout(existing.checkoutRef)
            .catch((e) => captureError(e, { area: "checkout", extra: { orderId: existing.id } }));
        await prisma.order.updateMany({ where: { id: existing.id, status: { in: ["PENDING", "ABANDONED"] } }, data: { status: "ABANDONED", recoverySkipped: "sustituido" } });
      }
      const lastVisit = await prisma.analyticsEvent.findFirst({
        where: { creatorId: product.creatorId, visitorId, type: "PAGE_VIEW" },
        orderBy: { createdAt: "desc" },
      });
      const order = await createPendingOrder({
        productId: input.productId,
        buyerEmail: input.email,
        buyerName: input.name,
        slotStart: slotStart || null,
        buyerTimezone: buyerTz,
        intake: intake.value,
        visitorId,
        ipHash: client.ipHash,
        source: lastVisit?.source ?? null,
        paymentMethod: payWith,
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
        waiverVersion: consents.consents.waiverVersion,
        waiverAcceptedAt: consents.consents.waiverKind ? now : null,
        marketingOptIn: consents.consents.marketingOptIn,
        // Corregir los datos de nacimiento al reintentar no obliga a hacer otro pedido.
        intake: intake.value ? (intake.value as unknown as Prisma.InputJsonObject) : Prisma.DbNull,
        intakeUpdatedAt: intake.value ? now : null,
      },
    });
    if (buyerTz)
      await prisma.$executeRaw`
        UPDATE "Order" SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('buyerTz', ${buyerTz}::text)
        WHERE "id" = ${orderId!} AND "productType" = 'SESSION' AND "status" IN ('PENDING', 'FAILED', 'ABANDONED')`;
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
