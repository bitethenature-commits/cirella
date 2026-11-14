import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mic } from "lucide-react";
import { IntakeEditCard } from "@/components/booking/intake-edit-card";
import { IntakeSummary } from "@/components/booking/intake-summary";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { CopyButton } from "@/components/ui/copy-button";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { intakeAsText, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { formatMoney } from "@/lib/money";
import { refundableCents } from "@/lib/refund-math";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, clientTimeNote, formatSessionDate } from "@/lib/tz";
import { Badge } from "../../ui";
import { clearIntake, setIntakeByOwner } from "../actions";
import { ChangeForm } from "./change-form";
import { MeetingForm } from "./meeting-form";

const OK: Record<string, string> = { dada: "Sesión dada. Le hemos enviado un email." };

/** La reserva: cuándo (en su hora y en la de la clienta), Zoom, datos para la lectura, grabación y cambios. */
export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const b = await tenantDb(creator.id).booking.findFirst({
    where: { id },
    include: { product: true, customer: true, order: { include: { refunds: { select: { status: true, amountCents: true } } } } },
  });
  if (!b) notFound();
  const tz = creator.timezone;
  const name = b.customer.name ?? b.customer.email;
  const firstName = name.split(" ")[0];
  const when = b.startAt ? capitalize(formatSessionDate(b.startAt, tz)) : null;
  const forHer = b.startAt ? clientTimeNote(b.startAt, tz, b.customerTimezone) : "";
  const o = b.order;
  const reserved = o?.refunds.filter((r) => r.status !== "FAILED").reduce((a, r) => a + r.amountCents, 0) ?? 0;
  const refundable = o && o.status === "PAID" && o.paymentRef ? refundableCents({ amountCents: o.amountCents, reservedCents: reserved }) : 0;
  const changeable = b.status === "CONFIRMED" || b.status === "PENDING_SCHEDULE";
  const meta = (o?.metadata ?? {}) as { manual?: string; paidNote?: string };
  const cfg = readIntakeConfig(b.product.intake);
  const answers = readIntakeAnswers(o?.intake);
  const asks = cfg.birth !== "off" || cfg.questions.length > 0;
  const future = b.status === "CONFIRMED" && !!b.startAt && b.startAt > new Date();

  return (
    <div className="max-w-2xl space-y-5 pb-10">
      <Link href="/panel/reservas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Reservas</Link>
      {sp.ok && OK[sp.ok] && <Flash ok={OK[sp.ok]} />}
      <div>
        <p className="text-sm text-muted">{b.product.emoji} {b.product.title}</p>
        <h1 className="display mt-1 text-[2.2rem] leading-tight">{name}</h1>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-semibold">{when ?? "Sin fecha"}</p>
            {forHer && <p className="text-sm text-muted">{capitalize(forHer)}</p>}
          </div>
          <Badge tone={b.status === "CONFIRMED" ? "success" : b.status === "CANCELLED" ? "danger" : "neutral"}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {b.groupSeat && <span className="chip">Taller</span>}
          {o?.paymentProvider === "manual" && <span className="chip">{meta.manual === "paid_elsewhere" ? `Pagada fuera${meta.paidNote ? ` · ${meta.paidNote}` : ""}` : "Regalo"}</span>}
        </div>
        <p className="mt-3 text-sm text-muted">
          <a href={`mailto:${b.customer.email}`} className="underline underline-offset-2">{b.customer.email}</a>
        </p>
        {o && o.paymentProvider !== "manual" && (
          <p className="mt-1 text-sm text-muted">
            Pagó {formatMoney(o.amountCents, o.currency, { decimals: true })}
            {o.refundedCents > 0 && ` · ya reembolsados ${formatMoney(o.refundedCents, o.currency, { decimals: true })}`}
            {" · "}
            <Link href={`/panel/ventas/${o.id}`} className="underline underline-offset-2">Ver el pedido</Link>
          </p>
        )}
        {b.status === "CANCELLED" && b.cancelReason && <p className="mt-2 text-sm text-muted">Motivo: «{b.cancelReason}»</p>}
      </section>

      {changeable && (
        <section className="card p-5">
          <MeetingForm bookingId={b.id} value={b.meetingUrl ?? ""} productUrl={b.product.meetingUrl} name={firstName} canNotify={future} />
        </section>
      )}

      {(asks || answers || b.customerNotes) && o && (
        <>
          <IntakeEditCard
            config={cfg}
            answers={answers}
            locked={false}
            action={setIntakeByOwner}
            hidden={{ orderId: o.id }}
            title="Datos para la lectura"
            forOwner
          />
          {(answers || b.customerNotes) && (
            <section className="card flex flex-wrap items-center gap-2 p-5">
              {b.customerNotes && <p className="w-full text-sm"><span className="text-muted">Notas: </span>«{b.customerNotes}»</p>}
              {answers && <CopyButton text={intakeAsText(answers)} label="Copiar" copiedLabel="Copiado" className="btn btn-outline btn-sm h-11" />}
              {answers && (
                <ConfirmForm action={clearIntake} message={`¿Borrar los datos para la lectura de ${firstName}? No se puede deshacer.`}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="hidden" name="back" value={`/panel/reservas/${b.id}`} />
                  <button className="btn btn-ghost btn-sm h-11 text-rose">Borrar datos</button>
                </ConfirmForm>
              )}
            </section>
          )}
        </>
      )}
      {!o && b.customerNotes && (
        <section className="card p-5">
          <IntakeSummary answers={null} legacyNotes={b.customerNotes} copy={false} />
        </section>
      )}


      <h2 className="display pt-3 text-[1.6rem]">Cambiar o cancelar</h2>
      {changeable ? (
        <ChangeForm
          bookingId={b.id}
          name={firstName}
          when={when}
          refundable={refundable}
          refundLabel={formatMoney(refundable, o?.currency ?? "EUR", { decimals: true })}
          canPropose={!b.groupSeat}
          personal={isPersonalMode()}
        />
      ) : (
        <p className="text-sm text-muted">
          Esta sesión ya está {BOOKING_STATUS_LABEL[b.status].toLowerCase()}.{" "}
          <Link href="/panel/reservas" className="underline underline-offset-2">Volver a reservas</Link>
        </p>
      )}
    </div>
  );
}
