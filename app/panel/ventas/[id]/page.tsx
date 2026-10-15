import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserMinus } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { isNoChargeOrder, NO_CHARGE_LABEL, type NoChargeProvider } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { orderBreakdown } from "@/lib/order-breakdown";
import { orderRef } from "@/lib/order-ref";
import { REFUND_REASONS, REFUND_STATUS_LABEL, orderStatusLabel, refundableCents, type RefundReason } from "@/lib/refund-math";
import { tenantDb } from "@/lib/tenant";
import { DISPUTE_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { capitalize, formatDateTime, formatSessionDate } from "@/lib/tz";
import { revokeAccess } from "../../productos/actions";
import { Badge } from "../../ui";
import { RefundForm } from "./refund-form";

const REFUND_TONE: Record<string, "success" | "warning" | "danger"> = { SUCCEEDED: "success", PENDING: "warning", FAILED: "danger" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const o = await tenantDb(creator.id).order.findFirst({
    where: { id },
    include: {
      product: { select: { emoji: true } },
      bookings: true,
      refunds: { orderBy: { createdAt: "desc" } },
      // IVA devuelto con cada reembolso, tal y como quedó en el libro.
      transactions: { where: { type: "REFUND", refundId: { not: null } }, select: { amountCents: true, taxCents: true } },
    },
  });
  if (!o) notFound();
  if (isNoChargeOrder(o)) return <SignupDetail creatorId={creator.id} orderId={o.id} />;
  // Cada línea del desglose sale de lo guardado; «Recibes» es exactamente su resta.
  const f = orderBreakdown(o, o.transactions);
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
  const settled = f.settled;

  return (
    <div className="max-w-2xl">
      <Link href="/panel/ventas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Ventas</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="display min-w-0 flex-1 text-[2rem] leading-tight">{o.product.emoji} {o.productTitle}</h1>
        <Badge tone={o.status === "PAID" && o.refundedCents > 0 ? "warning" : o.status === "PAID" ? "success" : o.status === "FAILED" ? "danger" : "neutral"}>{orderStatusLabel(o)}</Badge>
        {o.disputeStatus && <Badge tone={o.disputeStatus === "WON" ? "neutral" : "danger"}>{DISPUTE_STATUS_LABEL[o.disputeStatus]}</Badge>}
      </div>

      <dl className="card mt-5 divide-y divide-line text-sm">
        <Row label="Clienta">
          {o.customerId ? <Link href={`/panel/clientes/${o.customerId}`} className="underline underline-offset-2">{o.buyerName ?? o.buyerEmail}</Link> : o.buyerEmail}
        </Row>
        <Row label="Pedido"><span className="font-mono text-xs">{orderRef(o.id)}</span></Row>
        <Row label="Tipo">{PRODUCT_TYPE_LABEL[o.productType as ProductType] ?? o.productType}</Row>
        {o.paidAt && <Row label="Fecha de pago">{formatDateTime(o.paidAt)}</Row>}
        <Row label="Importe" hint={f.saleTax > 0 ? "IVA incluido" : undefined}>{money(o.amountCents)}</Row>
        {settled ? (
          <>
            {f.refunded > 0 && <Row label="Reembolsado">−{money(f.refunded)}</Row>}
            {o.taxSeller === "PLATFORM" && f.saleTax > 0 && (
              <Row
                label="IVA que ingresa Cirella"
                hint={f.refundedTax > 0 ? `${money(f.saleTax)} de la venta − ${money(f.refundedTax)} devuelto` : "Cirella vende este producto y declara su IVA"}
              >
                −{money(f.platformTax)}
              </Row>
            )}
            <Row label="Comisión de Cirella" hint={f.refundedFee > 0 ? `${money(f.saleFee)} − ${money(f.refundedFee)} devuelta con el reembolso` : undefined}>
              −{money(f.fee)}
            </Row>
            <Row label="Recibes" hint={o.taxSeller !== "PLATFORM" && f.tax > 0 ? `Incluye ${money(f.tax)} de IVA que declaras tú` : undefined}>
              <strong>{money(f.net)}</strong>
            </Row>
          </>
        ) : (
          <Row label="Recibes">—</Row>
        )}
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

/** Una inscripción (pedido de 0 €): sin importes, comisión ni reembolsos; se puede quitar el acceso. */
async function SignupDetail({ creatorId, orderId }: { creatorId: string; orderId: string }) {
  const db = tenantDb(creatorId);
  const o = await db.order.findFirstOrThrow({
    where: { id: orderId },
    include: { product: { select: { emoji: true } }, customer: { select: { id: true, userId: true, marketingOptIn: true } } },
  });
  const access = o.customer ? await db.access.findFirst({ where: { userId: o.customer.userId, productId: o.productId } }) : null;
  const active = !!access && access.status === "ACTIVE" && (!access.expiresAt || access.expiresAt > new Date());
  return (
    <div className="max-w-2xl">
      <Link href="/panel/ventas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Inscripciones</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="display min-w-0 flex-1 text-[2rem] leading-tight">{o.product.emoji} {o.productTitle}</h1>
        <Badge tone={active ? "success" : "neutral"}>{active ? "Con acceso" : "Acceso retirado"}</Badge>
      </div>
      <dl className="card mt-5 divide-y divide-line text-sm">
        <Row label="Persona">
          {o.customerId ? <Link href={`/panel/clientes/${o.customerId}`} className="underline underline-offset-2">{o.buyerName ?? o.buyerEmail}</Link> : o.buyerEmail}
        </Row>
        <Row label="Email">{o.buyerEmail}</Row>
        <Row label="Tipo">{PRODUCT_TYPE_LABEL[o.productType as ProductType] ?? o.productType}</Row>
        {o.paidAt && <Row label="Fecha">{formatDateTime(o.paidAt)}</Row>}
        <Row label="Origen">{NO_CHARGE_LABEL[o.paymentProvider as NoChargeProvider] ?? o.paymentProvider}</Row>
        <Row label="Importe">Gratis</Row>
        <Row label="Novedades por email">{o.customer?.marketingOptIn ? "Sí, marcó la casilla" : "No"}</Row>
        <Row label="Referencia"><span className="font-mono text-xs">{orderRef(o.id)}</span></Row>
      </dl>
      <section className="mt-8 flex flex-wrap items-center gap-3">
        {active && (
          <ConfirmForm action={revokeAccess} message={`¿Quitar el acceso a ${o.buyerName ?? o.buyerEmail}? Su enlace dejará de funcionar.`}>
            <input type="hidden" name="orderId" value={o.id} />
            <input type="hidden" name="productId" value={o.productId} />
            <button className="btn btn-outline btn-sm"><UserMinus className="h-4 w-4" /> Quitar acceso</button>
          </ConfirmForm>
        )}
        <Link href={`/panel/productos/${o.productId}#accesos`} className="btn btn-ghost btn-sm">Ver el producto</Link>
      </section>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-muted">
        {label}
        {hint && <span className="block text-xs text-faint">{hint}</span>}
      </dt>
      <dd className="min-w-0 text-right tabular-nums">{children}</dd>
    </div>
  );
}
