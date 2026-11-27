import Link from "next/link";
import { CalendarClock, Check, Mail, MessageSquareText, Phone, Undo2, X } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DeleteButton } from "@/components/ui/delete-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { intakeLines, readIntakeAnswers } from "@/lib/intake";
import { formatPrice } from "@/lib/money";
import { DECLINED, type RequestMeta } from "@/lib/requests";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { dateKeyInTz, formatInTz, formatSessionDate } from "@/lib/tz";
import { Badge, PersonDot } from "../ui";
import { clearRequestSlotAction, confirmRequestAction, declineRequestAction, deleteRequestAction, reopenRequestAction, rescheduleRequestAction } from "../solicitudes/actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

/** Lo que hace falta de cada solicitud pendiente (lib/requests.ts). */
export const PENDING_INCLUDE = {
  product: { select: { title: true, type: true, groupSession: true, eventStartAt: true, durationMin: true, currency: true, billingInterval: true } },
} satisfies Prisma.OrderInclude;
export type PendingRequest = Prisma.OrderGetPayload<{ include: typeof PENDING_INCLUDE }>;

/** Las ya respondidas: descartadas o confirmadas (las confirmadas son pedidos «manual» con request: true). */
export const ANSWERED_WHERE = (creatorId: string) =>
  ({ creatorId, OR: [{ status: DECLINED }, { status: "PAID", paymentProvider: "manual", metadata: { path: ["request"], equals: true } }] }) satisfies Prisma.OrderWhereInput;
export const ANSWERED_INCLUDE = { bookings: { select: { id: true }, take: 1 }, customer: { select: { id: true } } } satisfies Prisma.OrderInclude;
export type AnsweredRequest = Prisma.OrderGetPayload<{ include: typeof ANSWERED_INCLUDE }>;

export const ago = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

/** El número de cada paso de una solicitud. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[0.72rem] text-cream">{n}</span>
      {children}
    </p>
  );
}

/** A dónde vuelve cada botón (la pestaña de Clientes o la ficha de la persona). */
const Back = ({ to }: { to: string }) => <input type="hidden" name="back" value={to} />;

/**
 * Una solicitud por contestar, en 3 pasos: quién es y qué dice, el día y la hora (solo sesiones) y
 * Confirmar / Escribir / Descartar / Borrar. Sale en Clientes › Nuevas y en la ficha de la persona.
 */
export async function RequestCard({ o, tz, back }: { o: PendingRequest; tz: string; back: string }) {
  const t = await getT();
  const meta = (o.metadata ?? {}) as RequestMeta;
  const slot = meta.slotStart ? new Date(meta.slotStart) : null;
  const isSession = o.productType === "SESSION";
  const workshop = isSession && o.product.groupSession;
  const answers = readIntakeAnswers(o.intake);
  const lines = answers ? intakeLines(answers) : [];
  const price = meta.priceCents ? formatPrice(meta.priceCents, o.product.currency, o.product.billingInterval) : null;
  const mailto = `mailto:${o.buyerEmail}?subject=${encodeURIComponent(`Tu solicitud: ${o.productTitle}`)}`;
  const first = (o.buyerName ?? "").split(" ")[0] || "ella";
  return (
    <article className="card overflow-hidden" data-request={o.id}>
      <div className="flex flex-wrap items-start gap-3 border-b border-line p-5">
        <span className="panel-emblem h-11 w-11 shrink-0">{isSession ? <CalendarClock className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {workshop ? t("Taller") : PRODUCT_TYPE_LABEL[o.productType as ProductType]} · {ago(o.createdAt)}
          </p>
          <h2 className="display text-[1.35rem] leading-tight"><Tr s={o.productTitle} /></h2>
          {price && <p className="text-sm font-semibold">{price}</p>}
        </div>
        <Badge tone="warning"><Tr s={"Pendiente"} /></Badge>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <Step n={1}><Tr s={"Quién es y qué te dice"} /></Step>
          <p className="font-semibold"><Tr s={o.buyerName ?? t("Sin nombre")} /></p>
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted" />
            <a href={mailto} className="underline-offset-2 hover:underline"><Tr s={o.buyerEmail} /></a>
          </p>
          {meta.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted" />
              <a href={`tel:${meta.phone.replace(/\s+/g, "")}`} className="underline-offset-2 hover:underline"><Tr s={meta.phone} /></a>
            </p>
          )}
          {meta.message && <p className="whitespace-pre-line rounded-xl bg-sand px-3 py-2.5 text-[0.92rem]"><Tr s={meta.message} /></p>}
          {lines.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1 text-[0.85rem]">
              {lines.map((l) => (
                <div key={l.label} className="contents">
                  <dt className="text-muted"><Tr s={l.label} /></dt>
                  <dd className="whitespace-pre-line"><Tr s={l.value} /></dd>
                </div>
              ))}
            </dl>
          )}
          {o.marketingOptIn && <p className="text-xs text-muted"><Tr s={"Quiere recibir tus novedades."} /></p>}
        </div>

        {isSession && (
          <div className="space-y-3">
            <Step n={2}><Tr s={"Día y hora de la sesión"} /></Step>
            {workshop ? (
              <p className="text-sm font-semibold">{o.product.eventStartAt ? formatSessionDate(o.product.eventStartAt, tz) : t("Sin fecha")}</p>
            ) : (
              <>
                <p className="text-sm">{slot ? <strong>{formatSessionDate(slot, tz)}</strong> : <span className="text-muted"><Tr s={"Sin hora: prefiere hablarla por email."} /></span>}</p>
                <form action={rescheduleRequestAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <Back to={back} />
                  <label className="text-xs text-muted"><Tr s={"Día"} /><input type="date" name="date" required defaultValue={slot ? dateKeyInTz(slot, tz) : ""} className="input mt-1 h-10 w-40" />
                  </label>
                  <label className="text-xs text-muted"><Tr s={"Hora"} /><input type="time" name="time" required step={300} defaultValue={slot ? formatInTz(slot, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : ""} className="input mt-1 h-10 w-28" />
                  </label>
                  <SubmitButton className="btn btn-outline btn-sm h-10" pendingLabel={t("Guardando…")}>
                    {slot ? t("Cambiar") : t("Poner hora")}
                  </SubmitButton>
                </form>
                {slot && (
                  <form action={clearRequestSlotAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <Back to={back} />
                    <button className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"><Tr s={"Quitar la hora (que la elija ella al confirmar)"} /></button>
                  </form>
                )}
                <p className="text-xs text-muted"><Tr s={"Hora de tu zona ("} /><Tr s={tz} /><Tr s={"). Mientras está pendiente, esa hora no se ofrece a nadie más."} /></p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-sand/40 px-5 py-3">
        <span className="mr-1 grid h-6 w-6 place-items-center rounded-full bg-ink text-[0.72rem] font-semibold text-cream">{isSession ? 3 : 2}</span>
        <ConfirmForm action={confirmRequestAction} message={`¿Confirmar la solicitud de ${o.buyerName ?? o.buyerEmail}? Recibirá ${isSession ? "la reserva" : "el acceso"} y un email ahora mismo.`}>
          <input type="hidden" name="orderId" value={o.id} />
          <Back to={back} />
          <SubmitButton className="btn btn-primary btn-sm" pendingLabel={t("Confirmando…")}>
            <Check className="h-4 w-4" />{" "}<Tr s={"Confirmar y dar"} />{" "}{isSession ? t("la reserva") : t("el acceso")}
          </SubmitButton>
        </ConfirmForm>
        <a href={mailto} className="btn btn-outline btn-sm">
          <Mail className="h-4 w-4" />{" "}<Tr s={"Escribir a"} />{" "}<Tr s={first} />
        </a>
        <span className="flex-1" />
        <ConfirmForm action={declineRequestAction} message={t("¿Descartar esta solicitud? Su hora quedará libre. No se le envía nada.")}>
          <input type="hidden" name="orderId" value={o.id} />
          <Back to={back} />
          <SubmitButton className="btn btn-ghost btn-sm text-muted" pendingLabel={t("Descartando…")}>
            <X className="h-4 w-4" />{" "}<Tr s={"Descartar"} /></SubmitButton>
        </ConfirmForm>
        <DeleteButton action={deleteRequestAction} id={o.id} what={o.productTitle} fields={{ back }} message={`¿Borrar la solicitud de ${o.buyerName ?? o.buyerEmail}? Desaparece del todo. No se le envía nada. No se puede deshacer.`} />
      </div>
    </article>
  );
}

/**
 * Una solicitud ya respondida (Confirmada o Descartada), con Recuperar / Ver la reserva / Ver su ficha y
 * Borrar. En la ficha de la persona no hace falta su nombre ni «Ver su ficha» (`inFicha`).
 */
export function AnsweredRow({ o, back, inFicha = false }: { o: AnsweredRequest; back: string; inFicha?: boolean }) {
  const declined = o.status === DECLINED;
  const booking = o.bookings[0];
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      {!inFicha && <PersonDot name={o.buyerName} email={o.buyerEmail} className="h-9 w-9 text-sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {inFicha ? (
            o.productTitle
          ) : (
            <>
              <Tr s={o.buyerName ?? o.buyerEmail} /> · <span className="text-muted"><Tr s={o.productTitle} /></span>
            </>
          )}
        </p>
        <p className="text-xs text-muted">{ago(o.createdAt)}</p>
      </div>
      {declined ? <Badge><Tr s={"Descartada"} /></Badge> : <Badge tone="success"><Tr s={"Confirmada"} /></Badge>}
      {declined ? (
        <form action={reopenRequestAction}>
          <input type="hidden" name="orderId" value={o.id} />
          <Back to={back} />
          <button className="btn btn-ghost btn-sm">
            <Undo2 className="h-3.5 w-3.5" />{" "}<Tr s={"Recuperar"} /></button>
        </form>
      ) : booking ? (
        <Link href={`/panel/solicitudes/reserva/${booking.id}`} className="btn btn-ghost btn-sm">
          <CalendarClock className="h-3.5 w-3.5" />{" "}<Tr s={"Ver la reserva"} /></Link>
      ) : o.customer && !inFicha ? (
        <Link href={`/panel/clientes/${o.customer.id}`} className="btn btn-ghost btn-sm"><Tr s={"Ver su ficha"} /></Link>
      ) : null}
      <DeleteButton
        action={deleteRequestAction}
        id={o.id}
        what={o.productTitle}
        fields={{ back }}
        message={declined ? `¿Borrar la solicitud de ${o.buyerName ?? o.buyerEmail}? Desaparece del todo. No se puede deshacer.` : `¿Borrar la solicitud de ${o.buyerName ?? o.buyerEmail}? Se borra también lo que le diste (acceso o reserva). No se puede deshacer.`}
      />
    </li>
  );
}
