"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordSimulatedEvent } from "@/lib/payments/events";
import { checkoutReturnPath } from "@/lib/payments/return";
import type { PaymentStatus } from "@/lib/payments/provider";
import { simulatedPaymentMethod, THREE_DS_TEST_CARD } from "@/lib/payments/simulated";

const schema = z.object({ ref: z.string().startsWith("sim_cs_"), resultado: z.enum(["confirmar", "pendiente", "cancelar"]) });

/**
 * Lo que haría el banco: confirmar, dejarlo pendiente o cancelar. Se aplica como un aviso de la
 * pasarela y después se sigue como la vuelta desde Stripe (/api/payments/return), pero aquí mismo:
 * una acción que redirige a una ruta de API perdería la cookie de la sesión de la compradora.
 */
export async function bankDecision(form: FormData) {
  const { ref, resultado } = schema.parse(Object.fromEntries(form));
  const order = await prisma.order.findUnique({
    where: { checkoutRef: ref },
    include: { creator: { select: { payoutAccountId: true } } },
  });
  if (!order) redirect("/");
  if (order.status !== "PENDING" && order.status !== "PROCESSING") redirect(`/pago-simulado/${ref}`);

  const hex = randomBytes(8).toString("hex");
  const base: PaymentStatus = {
    state: "requires_action",
    checkoutRef: ref,
    amountCents: order.amountCents,
    currency: order.currency,
    destinationAccount: order.creator.payoutAccountId,
    metadata: { orderId: order.id },
  };
  const membership = order.productType === "MEMBERSHIP";
  if (resultado === "confirmar") {
    await recordSimulatedEvent("simulado.banco_confirma", {
      kind: "payment",
      status: {
        ...base,
        state: "succeeded",
        ref: `sim_ch_${hex}`,
        customerRef: membership ? `sim_cus_${hex.slice(0, 12)}` : undefined,
        paymentMethodRef: membership ? simulatedPaymentMethod(THREE_DS_TEST_CARD.slice(-4)) : undefined,
      },
    });
    redirect(await checkoutReturnPath(ref));
  }
  if (resultado === "pendiente") {
    await recordSimulatedEvent("simulado.banco_pendiente", { kind: "payment", status: { ...base, state: "processing" } });
    redirect(await checkoutReturnPath(ref));
  }
  await recordSimulatedEvent("simulado.banco_cancela", {
    kind: "payment",
    status: { ...base, state: "canceled", error: "Has cancelado la confirmación en tu banco." },
  });
  redirect(await checkoutReturnPath(ref)); // pedido FAILED → de vuelta al checkout
}
