import Link from "next/link";
import { Receipt } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { isNoChargeOrder } from "@/lib/access-mode";
import { prisma } from "@/lib/db";
import { requireBuyerFull } from "@/lib/buyer-access";
import { formatMoney } from "@/lib/money";
import { signupsOnly } from "@/lib/commerce";
import { isPersonalMode } from "@/lib/site-mode";
import { channelKindLabel } from "@/lib/channel-kind";
import { orderStatusLabel, toWithdrawalInput, withdrawalEligibility } from "@/lib/refund-math";
import { formatDate } from "@/lib/tz";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { orderTargetPath } from "@/lib/auth-utils";
import { Thumb } from "../ui";
import { withdrawPurchase } from "./actions";

const OK: Record<string, string> = {
  desistido: "Hemos tramitado tu desistimiento. El reembolso llegará a tu tarjeta en 5-10 días hábiles.",
};
const ERROR: Record<string, string> = {
  "no-desistible": "Esta compra ya no se puede desistir. Si tienes dudas, escribe a la creadora.",
  "no-encontrado": "No encontramos esa compra en tu cuenta.",
  pasarela: "No hemos podido hacer el reembolso ahora mismo. Inténtalo más tarde o escribe a la creadora.",
};

export default async function MyPurchases({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireBuyerFull("/cuenta/compras");
  const sp = await searchParams;
  const orders = await prisma.order.findMany({
    where: { buyerEmail: user.email, status: { in: ["PAID", "REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    include: {
      product: true,
      creator: { select: { displayName: true, username: true, timezone: true } },
      bookings: { select: { id: true, status: true, startAt: true } },
      refunds: { select: { status: true } },
    },
  });
  const now = new Date();
  const personal = signupsOnly();
  // Web personal: «Mis canales», con lo que es cada cosa en grande y sin importes ni facturas (siguen
  // en el detalle de cada compra y en el email de compra).
  const channels = isPersonalMode();
  const link = (o: (typeof orders)[number]) =>
    orderTargetPath(o, o.bookings[0]?.id);
  return (
    <div>
      <h1 className="display text-[2.4rem]">{channels ? "Mis canales" : "Mis compras"}</h1>
      <div className="mt-6">
        <Flash ok={sp.ok ? OK[sp.ok] : null} error={sp.error ? ERROR[sp.error] : null} />
      </div>
      <div className="card divide-y divide-line">
        {orders.map((o) => {
          // Gratis o dado a mano: sin importe, factura ni desistimiento (no hubo pago).
          const noCharge = isNoChargeOrder(o);
          const w = noCharge ? { eligible: false as const } : withdrawalEligibility(toWithdrawalInput({ ...o, timezone: o.creator.timezone }), now);
          const amount = formatMoney(o.amountCents - o.refundedCents, o.currency, { decimals: true });
          return (
            <div key={o.id}>
              {channels ? (
                <Link href={link(o)} className="flex items-center gap-4 p-4 transition hover:bg-paper">
                  <Thumb src={o.product.imageUrl} emoji={o.product.emoji} className="h-14 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="display text-[1.6rem] leading-tight">{channelKindLabel({ ...o.product, title: o.productTitle })}</p>
                    <p className="truncate text-sm text-muted">{o.productTitle}</p>
                  </div>
                  {o.status === "REFUNDED" || o.refundedCents > 0 ? <span className="chip shrink-0">Reembolsado</span> : null}
                </Link>
              ) : (
                <>
                  <Link href={link(o)} className="flex items-center gap-4 p-4 transition hover:bg-paper">
                    <Thumb src={o.product.imageUrl} emoji={o.product.emoji} className="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{o.productTitle}</p>
                      <p className="text-xs text-muted">
                        {PRODUCT_TYPE_LABEL[o.productType as ProductType]} · {o.creator.displayName} · {(o.paidAt ? formatDate(o.paidAt, { day: "numeric", month: "short", year: "numeric" }) : undefined)}
                      </p>
                    </div>
                    {noCharge ? (
                      <p className="text-right text-sm font-semibold">Gratis</p>
                    ) : (
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatMoney(o.amountCents, o.currency, { decimals: true })}</p>
                        <p className="text-xs text-muted">
                          {o.refundedCents > 0 && o.status === "PAID" ? `Reembolsado · ${formatMoney(o.refundedCents, o.currency, { decimals: true })}` : orderStatusLabel(o)}
                        </p>
                      </div>
                    )}
                  </Link>
                  {!noCharge && (
                    <div className="-mt-2 px-4 pb-3 pl-20">
                      <Link href={`/cuenta/pedidos/${o.id}#factura`} className="text-xs font-medium text-muted underline underline-offset-2 hover:text-ink">
                        Recibo y factura
                      </Link>
                    </div>
                  )}
                </>
              )}
              {w.eligible && (
                <div className="-mt-1 flex flex-wrap items-center justify-between gap-2 px-4 pb-4 pl-20">
                  <p className="text-xs text-muted">Puedes desistir hasta el {formatDate(w.deadline, { day: "numeric", month: "long" }, o.creator.timezone)} (incluido)</p>
                  <ConfirmForm
                    action={withdrawPurchase}
                    message={`¿Desistir de «${o.productTitle}»? Te devolveremos ${amount}${o.productType === "SESSION" ? " y se cancelará tu sesión" : " y perderás el acceso"}.`}
                  >
                    <input type="hidden" name="orderId" value={o.id} />
                    <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Tramitando…">Desistir</SubmitButton>
                  </ConfirmForm>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {orders.length === 0 && <EmptyState icon={<Receipt className="h-5 w-5" />} title={channels || personal ? "Nada todavía" : "Sin compras todavía"} />}
    </div>
  );
}
