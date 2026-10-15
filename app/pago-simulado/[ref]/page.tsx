import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Landmark, ShieldCheck, X } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { bankDecision } from "./actions";

/** «App del banco» del simulador: la compradora confirma (o no) el pago, como con 3DS real. */
export default async function SimulatedBankPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const order = await prisma.order.findUnique({
    where: { checkoutRef: ref },
    include: { creator: { select: { displayName: true, username: true } }, product: { select: { slug: true } } },
  });
  if (!order) notFound();
  const open = order.status === "PENDING" || order.status === "PROCESSING";
  return (
    <div className="card p-6 text-center sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink text-cream">
        <Landmark className="h-6 w-6" />
      </div>
      <h1 className="display mt-5 text-[2rem] leading-tight">Confirma el pago en la app de tu banco</h1>
      <p className="mt-3 text-[0.98rem]">
        <strong>{formatMoney(order.amountCents, order.currency, { decimals: true })}</strong> a {order.creator.displayName} · {order.productTitle}
      </p>
      {order.status === "PROCESSING" && <p className="mt-2 text-sm text-muted">Tu banco aún no ha respondido: el pago está pendiente.</p>}

      {open ? (
        <form action={bankDecision} className="mt-7 space-y-2.5">
          <input type="hidden" name="ref" value={ref} />
          <SubmitButton name="resultado" value="confirmar" className="btn btn-primary btn-lg w-full" pendingLabel="Confirmando…">
            <ShieldCheck className="h-4 w-4" /> Confirmar el pago
          </SubmitButton>
          <SubmitButton name="resultado" value="pendiente" className="btn btn-outline w-full">
            <Clock className="h-4 w-4" /> El banco tarda (pago pendiente)
          </SubmitButton>
          <SubmitButton name="resultado" value="cancelar" className="btn btn-ghost w-full">
            <X className="h-4 w-4" /> Cancelar
          </SubmitButton>
        </form>
      ) : order.status === "PAID" ? (
        <Link href={`/${order.creator.username}/gracias?pedido=${order.id}`} className="btn btn-primary mt-7 w-full">Ver mi compra</Link>
      ) : (
        <Link href={`/${order.creator.username}/${order.product.slug}/checkout?pedido=${order.id}`} className="btn btn-outline mt-7 w-full">Volver al checkout</Link>
      )}
      <p className="mt-6 text-xs text-muted">Con Stripe real, este paso lo hace el banco de la compradora (3D Secure) en su app o por SMS.</p>
    </div>
  );
}
