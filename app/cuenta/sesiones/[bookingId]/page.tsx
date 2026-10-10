import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, CalendarX, Clock, Mail, MessageCircle, Video } from "lucide-react";
import { requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { socialHref } from "@/lib/page-config";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatSessionDate } from "@/lib/tz";
import { CreatorTag, Thumb } from "../../ui";
import { Scheduler } from "./scheduler";

export default async function BookingDetail({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const { user, scoped } = await requireBuyerFor({ bookingId }, `/cuenta/sesiones/${bookingId}`);
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, userId: user.id },
    include: { product: true, creator: true, order: { select: { refundedCents: true, currency: true } } },
  });
  if (!b) notFound();
  const c = creatorBrief(b.creator);
  const canReschedule = b.status === "CONFIRMED" && b.startAt && b.startAt.getTime() - Date.now() > 24 * 3600_000;
  return (
    <div className="max-w-2xl">
      {scoped ? (
        b.orderId && (
          <Link href={`/cuenta/pedidos/${b.orderId}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Tu compra
          </Link>
        )
      ) : (
        <Link href="/cuenta/sesiones" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis sesiones
        </Link>
      )}
      <div className="mt-5 flex items-center gap-4">
        <Thumb src={b.product.imageUrl} emoji={b.product.emoji} className="h-16 w-16" />
        <div>
          <CreatorTag name={c.displayName} avatarUrl={c.avatarUrl} />
          <h1 className="display text-[2.2rem] leading-tight">{b.product.title}</h1>
        </div>
      </div>

      {b.status === "CANCELLED" ? (
        <div className="card mt-6 p-6">
          <span className="chip"><CalendarX className="h-3.5 w-3.5" /> Sesión cancelada</span>
          <p className="mt-3">
            {b.cancelledBy === "CUSTOMER"
              ? "Cancelaste la sesión."
              : `${c.displayName} canceló la sesión${b.startAt ? ` del ${formatSessionDate(b.startAt, c.timezone)}` : ""}.`}
          </p>
          {b.cancelReason && <p className="mt-2 text-sm text-muted">Motivo: «{b.cancelReason}»</p>}
          {b.order && b.order.refundedCents > 0 && (
            <p className="mt-2 text-sm">Te hemos devuelto <strong>{formatMoney(b.order.refundedCents, b.order.currency, { decimals: true })}</strong>.</p>
          )}
        </div>
      ) : b.startAt ? (
        <div className="card mt-6 p-6">
          <span className="chip">{BOOKING_STATUS_LABEL[b.status]}</span>
          <p className="display mt-3 text-[1.9rem] leading-tight">{capitalize(formatSessionDate(b.startAt, c.timezone))}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> {b.product.durationMin ?? 60} minutos · hora de {c.timezone.replace("_", " ")}</li>
            {b.meetingUrl && (
              <li className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-2">Enlace de la videollamada</a>
              </li>
            )}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`/cuenta/sesiones/${b.id}/ics`} className="btn btn-outline btn-sm"><CalendarPlus className="h-4 w-4" /> Añadir a mi calendario</a>
          </div>
          {b.product.instructions && <p className="mt-5 rounded-xl bg-sand/60 px-4 py-3 text-sm">{b.product.instructions}</p>}
        </div>
      ) : (
        <div className="card mt-6 p-6">
          {b.rescheduleRequestedAt ? (
            <>
              <p className="font-semibold">{c.displayName} te propone cambiar la fecha</p>
              <p className="mt-1 text-sm text-muted">
                {b.previousStartAt ? `Tu sesión del ${formatSessionDate(b.previousStartAt, c.timezone)} ha quedado libre. ` : ""}Elige otro hueco:
              </p>
              {b.rescheduleNote && <p className="mt-2 text-sm italic">«{b.rescheduleNote}»</p>}
            </>
          ) : (
            <>
              <p className="font-semibold">Elige el día y la hora de tu sesión</p>
              <p className="mt-1 text-sm text-muted">Tu pago está confirmado. Reserva el hueco que mejor te venga.</p>
            </>
          )}
          <div className="mt-5">
            <Scheduler bookingId={b.id} productId={b.productId} />
          </div>
        </div>
      )}

      {canReschedule && (
        <details className="card mt-4 p-5">
          <summary className="cursor-pointer text-sm font-semibold">Cambiar fecha</summary>
          <p className="mt-2 text-xs text-muted">Puedes cambiarla hasta 24 horas antes.</p>
          <div className="mt-4">
            <Scheduler bookingId={b.id} productId={b.productId} label="Cambiar a esta fecha" />
          </div>
        </details>
      )}

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {c.email && <a href={`mailto:${c.email}`} className="btn btn-ghost btn-sm"><Mail className="h-4 w-4" /> Escribir a {c.displayName}</a>}
        {c.whatsapp && <a href={socialHref("whatsapp", c.whatsapp)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
      </div>
    </div>
  );
}
