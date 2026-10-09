import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { refundableCents } from "@/lib/refund-math";
import { tenantDb } from "@/lib/tenant";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatSessionDate } from "@/lib/tz";
import { Badge } from "../../ui";
import { ChangeForm } from "./change-form";

export default async function BookingChangePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const b = await tenantDb(creator.id).booking.findFirst({
    where: { id },
    include: { product: true, customer: true, order: { include: { refunds: { select: { status: true, amountCents: true } } } } },
  });
  if (!b) notFound();
  const name = b.customer.name ?? b.customer.email;
  const firstName = name.split(" ")[0];
  const when = b.startAt ? capitalize(formatSessionDate(b.startAt, creator.timezone)) : null;
  const o = b.order;
  const reserved = o?.refunds.filter((r) => r.status !== "FAILED").reduce((a, r) => a + r.amountCents, 0) ?? 0;
  const refundable = o && o.status === "PAID" && o.paymentRef ? refundableCents({ amountCents: o.amountCents, reservedCents: reserved }) : 0;
  const changeable = b.status === "CONFIRMED" || b.status === "PENDING_SCHEDULE";

  return (
    <div className="max-w-2xl">
      <Link href="/panel/reservas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Reservas</Link>
      <h1 className="display mt-4 text-[2.2rem] leading-tight">Cambiar o cancelar</h1>

      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-muted">{b.product.emoji} {b.product.title}</p>
          </div>
          <Badge tone={b.status === "CONFIRMED" ? "success" : b.status === "CANCELLED" ? "danger" : "neutral"}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
        </div>
        <p className="mt-3 text-sm">{when ?? "Sin fecha"}</p>
        {o && (
          <p className="mt-1 text-sm text-muted">
            Pagó {formatMoney(o.amountCents, o.currency, { decimals: true })}
            {o.refundedCents > 0 && ` · ya reembolsados ${formatMoney(o.refundedCents, o.currency, { decimals: true })}`}
            {" · "}
            <Link href={`/panel/ventas/${o.id}`} className="underline underline-offset-2">Ver el pedido</Link>
          </p>
        )}
        {b.status === "CANCELLED" && b.cancelReason && <p className="mt-2 text-sm text-muted">Motivo: «{b.cancelReason}»</p>}
      </section>

      {changeable ? (
        <ChangeForm
          bookingId={b.id}
          name={firstName}
          when={when}
          refundable={refundable}
          refundLabel={formatMoney(refundable, o?.currency ?? "EUR", { decimals: true })}
        />
      ) : (
        <p className="mt-6 text-sm text-muted">
          Esta sesión ya está {BOOKING_STATUS_LABEL[b.status].toLowerCase()}.{" "}
          <Link href="/panel/reservas" className="underline underline-offset-2">Volver a reservas</Link>
        </p>
      )}
    </div>
  );
}
