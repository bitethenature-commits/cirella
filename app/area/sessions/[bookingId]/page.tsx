import { isPersonalMode } from "@/lib/site-mode";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, CalendarX, Clock, Mail, Video } from "lucide-react";
import { requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatSessionDate, sessionWhen } from "@/lib/tz";
import { IntakeEditCard } from "@/components/booking/intake-edit-card";
import { MediaView } from "@/components/media/media-view";
import { asksIntake, intakeMissing, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { intakeLocked } from "@/lib/intake-lock";
import { meetingLabel } from "@/lib/meeting-url";
import { tzCity } from "@/lib/timezones";
import { saveIntake } from "../../actions";
import { MethodTag, Thumb } from "../../ui";
import { Scheduler } from "./scheduler";
import { SESSION_CHANGE_NOTICE_HOURS } from "@/lib/legal";
import { Tr } from "@/lib/i18n/client";
import { localTx } from "@/lib/i18n/content";
import { getT } from "@/lib/i18n/server";

export default async function BookingDetail({ params }: { params: Promise<{ bookingId: string }> }) {
  const t = await getT();
  const { bookingId } = await params;
  const { user, scoped } = await requireBuyerFor({ bookingId }, `/area/sessions/${bookingId}`);
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, userId: user.id },
    include: {
      product: true,
      creator: true,
      order: { select: { id: true, status: true, refundedCents: true, currency: true, intake: true, deliveredAt: true } },
    },
  });
  if (!b) notFound();
  const c = creatorBrief(b.creator);
  const tx = await localTx(b.creatorId);
  const canReschedule = !b.groupSeat && b.status === "CONFIRMED" && b.startAt && b.startAt.getTime() - Date.now() > SESSION_CHANGE_NOTICE_HOURS * 3600_000;
  // Su hora: la zona que eligió al reservar (o la de la creadora en las reservas de antes).
  const zone = b.customerTimezone ?? c.timezone;
  const cfg = readIntakeConfig(b.product.intake);
  const answers = readIntakeAnswers(b.order?.intake);
  const showIntake = !!b.order && b.order.status === "PAID" && b.status !== "CANCELLED" && asksIntake(b.product.type, b.product.deliveryMode, cfg);
  const locked = !!b.order && intakeLocked({ deliveredAt: b.order.deliveredAt, bookings: [b] });
  return (
    <div className="max-w-2xl">
      {scoped ? (
        b.orderId && (
          <Link href={`/area/orders/${b.orderId}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Tu compra"} /></Link>
        )
      ) : (
        <Link href="/area/sessions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {isPersonalMode() ? t("Círculos y lecturas") : t("Mis sesiones")}
        </Link>
      )}
      <div className="mt-5 flex items-center gap-4">
        <Thumb src={b.product.imageUrl} emoji={b.product.emoji} className="h-16 w-16" />
        <div>
          <MethodTag product={b.product} />
          <h1 className="display text-[2.2rem] leading-tight">{b.product.title}</h1>
        </div>
      </div>

      {b.status === "CANCELLED" ? (
        <div className="card mt-6 p-6">
          <span className="chip"><CalendarX className="h-3.5 w-3.5" />{" "}<Tr s={"Sesión cancelada"} /></span>
          <p className="mt-3">
            {b.cancelledBy === "CUSTOMER"
              ? t("Cancelaste la sesión.")
              : `${c.displayName} canceló la sesión${b.startAt ? ` del ${sessionWhen(b.startAt, b.customerTimezone, c.timezone)}` : ""}.`}
          </p>
          {b.cancelReason && <p className="mt-2 text-sm text-muted"><Tr s={"Motivo: «"} /><Tr s={b.cancelReason} />»</p>}
          {b.order && b.order.refundedCents > 0 && (
            <p className="mt-2 text-sm"><Tr s={"Te hemos devuelto"} />{" "}<strong>{formatMoney(b.order.refundedCents, b.order.currency, { decimals: true })}</strong>.</p>
          )}
        </div>
      ) : b.startAt ? (
        <div className="card mt-6 p-6">
          <span className="chip"><Tr s={BOOKING_STATUS_LABEL[b.status]} /></span>
          {b.groupSeat && <span className="chip ml-1"><Tr s={"Taller"} /></span>}
          <p className="display mt-3 text-[1.9rem] leading-tight">{capitalize(formatSessionDate(b.startAt, zone))}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> {b.product.durationMin ?? 60}{" "}<Tr s={"minutos · hora de"} />{" "}{tzCity(zone)}</li>
            {b.meetingUrl && (
              <li className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-2">{meetingLabel(b.meetingUrl)}</a>
              </li>
            )}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`/area/sessions/${b.id}/ics`} className="btn btn-outline btn-sm"><CalendarPlus className="h-4 w-4" />{" "}<Tr s={"Añadir a mi calendario"} /></a>
          </div>
          {b.product.instructions && <p className="mt-5 rounded-xl bg-sand/60 px-4 py-3 text-sm">{tx(b.product.instructions)}</p>}
        </div>
      ) : (
        <div className="card mt-6 p-6">
          {b.rescheduleRequestedAt ? (
            <>
              <p className="font-semibold">{c.displayName}{" "}<Tr s={"te propone cambiar la fecha"} /></p>
              <p className="mt-1 text-sm text-muted">
                {b.previousStartAt ? `Tu sesión del ${sessionWhen(b.previousStartAt, b.customerTimezone, c.timezone)} ha quedado libre. ` : ""}<Tr s={"Elige otro hueco:"} /></p>
              {b.rescheduleNote && <p className="mt-2 text-sm italic">«<Tr s={b.rescheduleNote} />»</p>}
            </>
          ) : (
            <>
              <p className="font-semibold"><Tr s={"Elige el día y la hora de tu sesión"} /></p>
              <p className="mt-1 text-sm text-muted"><Tr s={"Tu pago está confirmado. Reserva el hueco que mejor te venga."} /></p>
            </>
          )}
          <div className="mt-5">
            <Scheduler bookingId={b.id} productId={b.productId} initialTz={b.customerTimezone ?? undefined} />
          </div>
        </div>
      )}

      {canReschedule && (
        <details className="card mt-4 p-5">
          <summary className="cursor-pointer text-sm font-semibold"><Tr s={"Cambiar fecha"} /></summary>
          <p className="mt-2 text-xs text-muted"><Tr s={"Puedes cambiarla hasta"} />{" "}{SESSION_CHANGE_NOTICE_HOURS}{" "}<Tr s={"horas antes."} /></p>
          <div className="mt-4">
            <Scheduler bookingId={b.id} productId={b.productId} label={t("Cambiar a esta fecha")} initialTz={b.customerTimezone ?? undefined} />
          </div>
        </details>
      )}

      {showIntake && b.order && (
        <div className="mt-4">
          <IntakeEditCard
            config={cfg}
            answers={answers}
            locked={locked}
            lockedText={`Si algo no está bien, escribe a ${c.displayName}.`}
            action={saveIntake}
            hidden={{ orderId: b.order.id }}
            missing={intakeMissing(cfg, answers)}
            ownerName={c.displayName}
          />
        </div>
      )}

      {b.status !== "CANCELLED" && (
        <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm text-muted"><Tr s={"La grabación y el material, si los hay, te llegan por email."} /></p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {c.email && <a href={`mailto:${c.email}`} className="btn btn-ghost btn-sm"><Mail className="h-4 w-4" />{" "}<Tr s={"Escribir a"} />{" "}{c.displayName}</a>}
      </div>
    </div>
  );
}
