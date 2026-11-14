import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Check, Inbox, UserPlus, Mail, MessageSquareText, Phone, Undo2, X } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { intakeLines, readIntakeAnswers } from "@/lib/intake";
import { formatPrice } from "@/lib/money";
import { DECLINED, REQUESTED, type RequestMeta } from "@/lib/requests";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { dateKeyInTz, formatInTz, formatSessionDate } from "@/lib/tz";
import { Badge, PageHeader } from "../ui";
import { clearRequestSlotAction, confirmRequestAction, declineRequestAction, reopenRequestAction, rescheduleRequestAction } from "./actions";

export const metadata: Metadata = { title: "Solicitudes" };

const ago = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

/**
 * Solicitudes (lib/requests.ts): lo que las clientas piden desde la web en vez de pagar. Se habla por
 * email; al confirmar recibe el acceso o la reserva. En las sesiones se cambia aquí el día y la hora.
 */
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const tz = creator.timezone;
  const [pending, done] = await Promise.all([
    prisma.order.findMany({
      where: { creatorId: creator.id, status: REQUESTED },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { title: true, type: true, groupSession: true, eventStartAt: true, durationMin: true, currency: true, billingInterval: true } } },
    }),
    prisma.order.findMany({
      where: { creatorId: creator.id, OR: [{ status: DECLINED }, { status: "PAID", paymentProvider: "manual", metadata: { path: ["request"], equals: true } }] },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { bookings: { select: { id: true }, take: 1 }, customer: { select: { id: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Solicitudes"
        actions={
          <Link href="/panel/solicitudes/dar" className="btn btn-primary">
            <UserPlus className="h-4 w-4" /> Dar acceso
          </Link>
        }
        subtitle={pending.length ? `${pending.length} ${pending.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"} · respóndelas por email y confirma cuando esté todo.` : "Lo que te piden desde la web. Lo habláis por email y tú confirmas."}
      />
      <Flash ok={sp.ok} error={sp.error} />

      {pending.length === 0 ? (
        <EmptyState icon={<Inbox className="h-5 w-5" />} title="No hay solicitudes pendientes">
          Cuando alguien pida un curso, una sesión o una lectura desde tu web, te llegará un email y la verás aquí. Si alguien te escribe directamente, usa «Dar acceso».
        </EmptyState>
      ) : (
        <div className="grid gap-5">
          {pending.map((o) => {
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
              <article key={o.id} className="card overflow-hidden" data-request={o.id}>
                <div className="flex flex-wrap items-start gap-3 border-b border-line p-5">
                  <span className="panel-emblem h-11 w-11 shrink-0">
                    {isSession ? <CalendarClock className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">
                      {workshop ? "Taller" : PRODUCT_TYPE_LABEL[o.productType as ProductType]} · {ago(o.createdAt)}
                    </p>
                    <h2 className="display text-[1.35rem] leading-tight">{o.productTitle}</h2>
                    {price && <p className="text-sm font-semibold">{price}</p>}
                  </div>
                  <Badge tone="warning">Pendiente</Badge>
                </div>

                <div className="grid gap-5 p-5 md:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">{o.buyerName ?? "Sin nombre"}</p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted" />
                      <a href={mailto} className="underline-offset-2 hover:underline">{o.buyerEmail}</a>
                    </p>
                    {meta.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted" />
                        <a href={`tel:${meta.phone.replace(/\s+/g, "")}`} className="underline-offset-2 hover:underline">{meta.phone}</a>
                      </p>
                    )}
                    {meta.message && <p className="whitespace-pre-line rounded-xl bg-sand px-3 py-2.5 text-[0.92rem]">{meta.message}</p>}
                    {lines.length > 0 && (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1 text-[0.85rem]">
                        {lines.map((l) => (
                          <div key={l.label} className="contents">
                            <dt className="text-muted">{l.label}</dt>
                            <dd className="whitespace-pre-line">{l.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {o.marketingOptIn && <p className="text-xs text-muted">Quiere recibir tus novedades.</p>}
                  </div>

                  {isSession && (
                    <div className="space-y-3">
                      <p className="field-label">Día y hora</p>
                      {workshop ? (
                        <p className="text-sm font-semibold">{o.product.eventStartAt ? formatSessionDate(o.product.eventStartAt, tz) : "Sin fecha"}</p>
                      ) : (
                        <>
                          <p className="text-sm">
                            {slot ? (
                              <strong>{formatSessionDate(slot, tz)}</strong>
                            ) : (
                              <span className="text-muted">Sin hora: prefiere hablarla por email.</span>
                            )}
                          </p>
                          <form action={rescheduleRequestAction} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="orderId" value={o.id} />
                            <label className="text-xs text-muted">
                              Día
                              <input type="date" name="date" required defaultValue={slot ? dateKeyInTz(slot, tz) : ""} className="input mt-1 h-10 w-40" />
                            </label>
                            <label className="text-xs text-muted">
                              Hora
                              <input type="time" name="time" required step={300} defaultValue={slot ? formatInTz(slot, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : ""} className="input mt-1 h-10 w-28" />
                            </label>
                            <SubmitButton className="btn btn-outline btn-sm h-10" pendingLabel="Guardando…">
                              {slot ? "Cambiar" : "Poner hora"}
                            </SubmitButton>
                          </form>
                          {slot && (
                            <form action={clearRequestSlotAction}>
                              <input type="hidden" name="orderId" value={o.id} />
                              <button className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">Quitar la hora (que la elija ella al confirmar)</button>
                            </form>
                          )}
                          <p className="text-xs text-muted">Hora de tu zona ({tz}). Mientras está pendiente, esa hora no se ofrece a nadie más.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-sand/40 px-5 py-3">
                  <ConfirmForm
                    action={confirmRequestAction}
                    message={`¿Confirmar la solicitud de ${o.buyerName ?? o.buyerEmail}? Recibirá ${isSession ? "la reserva" : "el acceso"} y un email ahora mismo.`}
                  >
                    <input type="hidden" name="orderId" value={o.id} />
                    <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Confirmando…">
                      <Check className="h-4 w-4" /> Confirmar y dar {isSession ? "la reserva" : "el acceso"}
                    </SubmitButton>
                  </ConfirmForm>
                  <a href={mailto} className="btn btn-outline btn-sm">
                    <Mail className="h-4 w-4" /> Escribir a {first}
                  </a>
                  <span className="flex-1" />
                  <ConfirmForm action={declineRequestAction} message="¿Descartar esta solicitud? Su hora quedará libre. No se le envía nada.">
                    <input type="hidden" name="orderId" value={o.id} />
                    <SubmitButton className="btn btn-ghost btn-sm text-muted" pendingLabel="Descartando…">
                      <X className="h-4 w-4" /> Descartar
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <section className="mt-10">
          <h2 className="display mb-3 text-[1.4rem]">Ya respondidas</h2>
          <ul className="card divide-y divide-line">
            {done.map((o) => {
              const declined = o.status === DECLINED;
              const booking = o.bookings[0];
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {o.buyerName ?? o.buyerEmail} · <span className="text-muted">{o.productTitle}</span>
                    </p>
                    <p className="text-xs text-muted">{ago(o.createdAt)}</p>
                  </div>
                  {declined ? <Badge>Descartada</Badge> : <Badge tone="success">Confirmada</Badge>}
                  {declined ? (
                    <form action={reopenRequestAction}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <button className="btn btn-ghost btn-sm">
                        <Undo2 className="h-3.5 w-3.5" /> Recuperar
                      </button>
                    </form>
                  ) : booking ? (
                    <Link href={`/panel/reservas/${booking.id}`} className="btn btn-ghost btn-sm">
                      <CalendarClock className="h-3.5 w-3.5" /> Ver la reserva
                    </Link>
                  ) : o.customer ? (
                    <Link href={`/panel/clientes/${o.customer.id}`} className="btn btn-ghost btn-sm">
                      Ver clienta
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
