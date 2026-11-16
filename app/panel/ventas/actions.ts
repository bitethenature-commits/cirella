"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockMembership, renewMembership } from "@/lib/membership-renewal";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { CREATOR_REFUND_REASONS, parseRefundAmount, refundableCents } from "@/lib/refund-math";
import { refundOrder } from "@/lib/refunds";
import { tenantDb } from "@/lib/tenant";

export type RefundState = { ok?: string; error?: string } | undefined;

const refundSchema = z.object({
  orderId: z.string().min(1),
  mode: z.enum(["full", "partial"]),
  amount: z.string().max(20).optional(),
  reason: z.enum(CREATOR_REFUND_REASONS, { errorMap: () => ({ message: "Elige un motivo" }) }),
  note: z.string().trim().max(500, "El mensaje es demasiado largo (máx. 500 caracteres)").optional(),
  revoke: z.literal("on").optional(),
});

/** «Reembolsar» desde el detalle del pedido: todo o una parte, con o sin retirar el acceso. */
export async function refundOrderAction(_: RefundState, form: FormData): Promise<RefundState> {
  const { user, creator } = await requireCreator();
  const parsed = refundSchema.safeParse({
    orderId: form.get("orderId"),
    mode: form.get("mode"),
    amount: form.get("amount") ?? undefined,
    reason: form.get("reason"),
    note: form.get("note") ?? undefined,
    revoke: form.get("revoke") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  const d = parsed.data;
  const order = await tenantDb(creator.id).order.findFirst({ where: { id: d.orderId }, include: { refunds: { select: { status: true, amountCents: true } } } });
  if (!order) return { error: "Pedido no encontrado" };
  const reserved = order.refunds.filter((r) => r.status !== "FAILED").reduce((a, r) => a + r.amountCents, 0);
  const amount = parseRefundAmount(d.mode, d.amount ?? "", refundableCents({ amountCents: order.amountCents, reservedCents: reserved }));
  if (!amount.ok) return { error: amount.error };
  const revoke = d.revoke === "on";
  const r = await refundOrder({
    orderId: order.id,
    actor: { kind: "creator", creatorId: creator.id, userId: user.id },
    amountCents: amount.cents,
    reason: d.reason,
    note: d.note || null,
    revokeAccess: revoke,
    cancelBooking: revoke && order.productType === "SESSION",
  });
  for (const path of ["/panel", "/panel/ventas", `/panel/ventas/${order.id}`, "/panel/solicitudes"]) revalidatePath(path);
  if (!r.ok) return { error: r.error };
  const name = (order.buyerName ?? order.buyerEmail).split(" ")[0];
  return {
    ok:
      r.status === "SUCCEEDED"
        ? `Reembolso de ${formatMoney(r.amountCents, order.currency, { decimals: true })} completado. Hemos avisado a ${name}.`
        : "Reembolso en curso. Te avisaremos si la pasarela lo rechaza.",
  };
}

/** Vuelve a Inscripciones con el mismo filtro y un aviso. */
function backToSignups(form: FormData, ok: string): never {
  const back = String(form.get("back") ?? "");
  const url = new URL(back.startsWith("/panel/ventas") ? back : "/panel/ventas", "http://x");
  url.searchParams.set("ok", ok);
  redirect(`${url.pathname}${url.search}`);
}

/** «Ha pagado» en Inscripciones: otro periodo más de la membresía (lib/membership-renewal.ts). */
export async function renewSignupMember(form: FormData) {
  const { creator } = await requireCreator();
  const until = await renewMembership(creator.id, String(form.get("accessId") ?? ""));
  for (const path of ["/panel/ventas", "/panel/comunidad"]) revalidatePath(path);
  backToSignups(form, `Renovada hasta el ${until}. Le hemos enviado un email.`);
}

/** «Denegar acceso» en Inscripciones: no ha pagado, se bloquea ya (con «Ha pagado» vuelve a entrar). */
export async function denySignupMember(form: FormData) {
  const { creator } = await requireCreator();
  await blockMembership(creator.id, String(form.get("accessId") ?? ""));
  for (const path of ["/panel/ventas", "/panel/comunidad"]) revalidatePath(path);
  backToSignups(form, "Acceso denegado. Si paga, pulsa «Ha pagado» y vuelve a entrar.");
}
