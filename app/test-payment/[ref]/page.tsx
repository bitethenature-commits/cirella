import { productPath, thanksPath } from "@/lib/public-paths";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Landmark, ShieldCheck, X } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { simulatedBankAllowed } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { bankDecision } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

/** «App del banco» del simulador: la compradora confirma (o no) el pago, como con 3DS real. */
export default async function SimulatedBankPage({ params }: { params: Promise<{ ref: string }> }) {
  const t = await getT();
  if (!simulatedBankAllowed()) notFound();
  const { ref } = await params;
  const order = await prisma.order.findUnique({
    where: { checkoutRef: ref },
    include: { creator: { select: { displayName: true, username: true } }, product: { select: { slug: true, type: true } } },
  });
  if (!order) notFound();
  const open = order.status === "PENDING" || order.status === "PROCESSING";
  return (
    <div className="card p-6 text-center sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink text-cream">
        <Landmark className="h-6 w-6" />
      </div>
      <h1 className="display mt-5 text-[2rem] leading-tight"><Tr s={"Confirma el pago en la app de tu banco"} /></h1>
      <p className="mt-3 text-[0.98rem]">
        <strong>{formatMoney(order.amountCents, order.currency, { decimals: true })}</strong> a {order.creator.displayName} · {order.productTitle}
      </p>
      {order.status === "PROCESSING" && <p className="mt-2 text-sm text-muted"><Tr s={"Tu banco aún no ha respondido: el pago está pendiente."} /></p>}

      {open ? (
        <form action={bankDecision} className="mt-7 space-y-2.5">
          <input type="hidden" name="ref" value={ref} />
          <SubmitButton name="resultado" value="confirmar" className="btn btn-primary btn-lg w-full" pendingLabel={t("Confirmando…")}>
            <ShieldCheck className="h-4 w-4" />{" "}<Tr s={"Confirmar el pago"} /></SubmitButton>
          <SubmitButton name="resultado" value="pendiente" className="btn btn-outline w-full">
            <Clock className="h-4 w-4" />{" "}<Tr s={"El banco tarda (pago pendiente)"} /></SubmitButton>
          <SubmitButton name="resultado" value="cancelar" className="btn btn-ghost w-full">
            <X className="h-4 w-4" />{" "}<Tr s={"Cancelar"} /></SubmitButton>
        </form>
      ) : order.status === "PAID" ? (
        <Link href={`${thanksPath(order.creator.username)}?pedido=${order.id}`} className="btn btn-primary mt-7 w-full"><Tr s={"Ver mi compra"} /></Link>
      ) : (
        <Link href={`${productPath(order.creator.username, order.product, "checkout")}?pedido=${order.id}`} className="btn btn-outline mt-7 w-full"><Tr s={"Volver al checkout"} /></Link>
      )}
      <p className="mt-6 text-xs text-muted"><Tr s={"Con Stripe real, este paso lo hace el banco de la compradora (3D Secure) en su app o por SMS."} /></p>
    </div>
  );
}
