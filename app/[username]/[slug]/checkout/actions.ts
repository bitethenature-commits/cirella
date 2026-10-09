"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bindCheckoutToBrowser, grantPostCheckoutAccess } from "@/lib/checkout-access";
import { prisma } from "@/lib/db";
import { isSlotAvailable } from "@/lib/booking";
import { CheckoutError, createPendingOrder, getPurchasableProduct, startOrderPayment } from "@/lib/orders";

export type CheckoutState = { error?: string; orderId?: string } | undefined;

const schema = z.object({
  productId: z.string().min(1),
  orderId: z.string().optional(),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Revisa tu email"),
  slotStart: z.string().datetime().optional().or(z.literal("")),
  // Solo el simulador pide la tarjeta en nuestra página; con Stripe se paga en la suya.
  method: z.enum(["card", "wallet"]).optional(),
  cardNumber: z.string().max(30).optional(),
  acceptTerms: z.literal("on", { errorMap: () => ({ message: "Acepta las condiciones para continuar" }) }),
});

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, orderId: String(form.get("orderId") ?? "") || undefined };
  const input = parsed.data;
  const jar = await cookies();
  const visitorId = jar.get("cv_id")?.value ?? null;

  let orderId = input.orderId;
  try {
    // Reintento tras un pago rechazado o cancelado: solo reutilizamos el pedido si es exactamente
    // la misma compra (mismo producto, comprador, hueco y precio) y el producto sigue disponible.
    // Si ese pedido tiene el pago pendiente de confirmar, startOrderPayment lo dice en vez de cobrar otra vez.
    const existing = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    const prevSlot = (existing?.metadata as { slotStart?: string } | null)?.slotStart ?? "";
    let reusable =
      !!existing &&
      existing.status !== "PAID" &&
      existing.productId === input.productId &&
      existing.buyerEmail === input.email &&
      prevSlot === (input.slotStart || "");
    if (reusable) {
      const product = await getPurchasableProduct(input.productId);
      reusable = !!product && product.priceCents === existing!.amountCents;
      if (reusable && input.slotStart && !(await isSlotAvailable(product!, input.slotStart)))
        throw new CheckoutError("Ese horario acaba de ocuparse. Elige otro, por favor.");
    }
    if (!reusable) {
      const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { creatorId: true } });
      const lastVisit = visitorId && product
        ? await prisma.analyticsEvent.findFirst({ where: { creatorId: product.creatorId, visitorId, type: "PAGE_VIEW" }, orderBy: { createdAt: "desc" } })
        : null;
      const order = await createPendingOrder({
        productId: input.productId,
        buyerEmail: input.email,
        buyerName: input.name,
        slotStart: input.slotStart || null,
        visitorId,
        source: lastVisit?.source ?? null,
      });
      orderId = order.id;
    }
    const result = await startOrderPayment(orderId!, { method: input.method, cardNumber: input.cardNumber });
    if (result.kind === "failed") return { error: result.error, orderId };

    // Este navegador es el que paga: al volver de la pasarela podrá entrar sin contraseña.
    await bindCheckoutToBrowser(orderId!);
    if (result.kind === "redirect") redirect(result.url);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { creator: true } });
    const thanks = `/${order.creator.username}/gracias?pedido=${order.id}`;
    if (result.kind === "processing") redirect(thanks);

    // Cuenta automática: si el email es nuevo, la compradora queda dentro sin contraseña con
    // una sesión corta y "no verificada"; si la cuenta ya existía y no es quien tiene la sesión,
    // le enviamos un enlace mágico (lib/checkout-access.ts).
    const access = await grantPostCheckoutAccess(order.id, { sameBrowser: true });
    redirect(`${thanks}${access === "magic" ? "&acceso=email" : ""}`);
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message, orderId };
    throw e;
  }
}
