"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, getCurrentUser, sendMagicLink } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutError, createPendingOrder, payOrder } from "@/lib/orders";

export type CheckoutState = { error?: string; orderId?: string } | undefined;

const schema = z.object({
  productId: z.string().min(1),
  orderId: z.string().optional(),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Revisa tu email"),
  slotStart: z.string().datetime().optional().or(z.literal("")),
  method: z.enum(["card", "wallet"]),
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
    // Reintento tras un pago rechazado: reutilizamos el pedido pendiente si es del mismo comprador.
    const existing = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    if (!existing || existing.productId !== input.productId || existing.buyerEmail !== input.email || existing.status === "PAID") {
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
    const result = await payOrder(orderId!, { method: input.method, cardNumber: input.cardNumber });
    if (!result.ok) return { error: result.error, orderId };

    // Cuenta automática: si el email es nuevo, la compradora queda dentro sin contraseña.
    // Si ya existía y no es quien tiene la sesión, le enviamos un enlace mágico (nunca
    // iniciamos sesión en una cuenta existente solo por conocer su email).
    const current = await getCurrentUser();
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { creator: true } });
    let access: "session" | "magic" = "session";
    if (current?.id === result.userId) access = "session";
    else if (result.isNewUser && !current) await createSession(result.userId);
    else {
      access = "magic";
      await sendMagicLink(order.buyerEmail, "/cuenta", { creatorName: order.creator.displayName, creatorId: order.creatorId });
    }
    redirect(`/${order.creator.username}/gracias?pedido=${order.id}${access === "magic" ? "&acceso=email" : ""}`);
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message, orderId };
    throw e;
  }
}
