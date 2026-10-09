import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { REFUND_REASONS, REFUND_STATUS_LABEL, orderFigures, orderStatusLabel, refundableCents, type RefundReason } from "@/lib/refund-math";
import { tenantDb } from "@/lib/tenant";
import { DISPUTE_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { capitalize, formatDateTime, formatSessionDate } from "@/lib/tz";
import { Badge } from "../../ui";
import { RefundForm } from "./refund-form";

const REFUND_TONE: Record<string, "success" | "warning" | "danger"> = { SUCCEEDED: "success", PENDING: "warning", FAILED: "danger" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const o = await tenantDb(creator.id).order.findFirst({
    where: { id },
    include: { product: { select: { emoji: true } }, bookings: true, refunds: { orderBy: { createdAt: "desc" } } },
  });
  if (!o) notFound();
  const f = orderFigures(o);
  const money = (cents: number) => formatMoney(cents, o.currency, { decimals: true });
  const reserved = o.refunds.filter((r) => r.status !== "FAILED").reduce((a, r) => a + r.amountCents, 0);
  const refundable = refundableCents({ amountCents: o.amountCents, reservedCents: reserved });
  const name = (o.buyerName ?? o.buyerEmail).split(" ")[0];
  const booking = o.bookings.find((b) => b.status === "CONFIRMED" || b.status === "PENDING_SCHEDULE") ?? null;
  const effectLabel =
    o.productType === "SESSION"
      ? booking
        ? booking.startAt
          ? `Cancelar la sesión del ${formatSessionDate(booking.startAt, creator.timezone)}`
          : "Cancelar la sesión pendiente de fecha"
        : null
      : o.productType === "MEMBERSHIP"
        ? "Cancelar la membresía y retirar el acceso"
        : `Retirar el acceso a «${o.productTitle}»`;
  const settled = o.status === "PAID" || o.status === "REFUNDED";

  return (
    <div className="max-w-2xl">
      <Link href="/panel/ventas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Ventas</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="display min-w-0 flex-1 text-[2rem] leading-tight">{o.product.emoji} {o.productTitle}</h1>
        <Badge tone={f.partial ? "warning" : o.status === "PAID" ? "success" : o.status === "FAILED" ? "danger" : "neutral"}>{orderStatusLabel(o)}</Badge>
        {o.disputeStatus && <Badge tone={o.disputeStatus === "WON" ? "neutral" : "danger"}>{DISPUTE_STATUS_LABEL[o.disputeStatus]}</Badge>}
      </div>

      <dl className="card mt-5 divide-y divide-line text-sm">
        <Row label="Clienta">
          {o.customerId ? <Link href={`/panel/clientes/${o.customerId}`} className="underline underline-offset-2">{o.buyerName ?? o.buyerEmail}</Link> : o.buyerEmail}
        </Row>
        <Row label="Tipo">{PRODUCT_TYPE_LABEL[o.productType as ProductType] ?? o.productType}</Row>
        {o.paidAt && <Row label="Fecha de pago">{formatDateTime(o.paidAt)}</Row>}
        <Row label="Importe">{money(o.amountCents)}</Row>
        {o.refundedCents > 0 && <Row label="Reembolsado">−{money(o.refundedCents)}</Row>}
        <Row label="Comisión de Cirella">{money(settled ? f.fee : o.platformFeeCents)}</Row>
        <Row label="Recibes"><strong>{settled ? money(f.net) : "—"}</strong></Row>
        {o.paymentRef && <Row label="Referencia del pago"><span className="font-mono text-xs">{o.paymentRef}</span></Row>}
        {o.bookings[0] && (
          <Row label="Sesión">
            {o.bookings[0].startAt ? capitalize(formatSessionDate(o.bookings[0].startAt, creator.timezone)) : "Sin fecha"} ·{" "}
            <Link href={`/panel/reservas/${o.bookings[0].id}`} className="underline underline-offset-2">Ver la reserva</Link>
          </Row>
        )}
      </dl>

      {o.refunds.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3 !text-ink">Reembolsos</h2>
          <ul className="card divide-y divide-line text-sm">
            {o.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold tabular-nums">{money(r.amountCents)}</span>
                  <span className="text-muted"> · {formatDateTime(r.createdAt)} · {r.initiatedBy === "CUSTOMER" ? "Desistimiento de la clienta" : r.initiatedBy === "PROVIDER" ? `${REFUND_REASONS[r.reason as RefundReason] ?? r.reason} (pasarela)` : (REFUND_REASONS[r.reason as RefundReason] ?? r.reason)}</span>
                  {r.note && <span className="block text-xs text-muted">«{r.note}»</span>}
                  {r.status === "FAILED" && r.error && <span className="block text-xs text-rose">{r.error}</span>}
                </span>
                <Badge tone={REFUND_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status] ?? r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="eyebrow mb-3 !text-ink">Reembolsar</h2>
        {settled && o.paymentRef ? (
          <RefundForm
            orderId={o.id}
            name={name}
            refundable={refundable}
            refundableLabel={money(refundable)}
            effectLabel={effectLabel}
            doneText={o.status === "REFUNDED" ? "Este pedido ya está reembolsado por completo." : "Hay un reembolso en curso por el resto del pedido."}
          />
        ) : (
          <p className="text-sm text-muted">Solo se pueden reembolsar pedidos pagados.</p>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
