import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarRange, Check, Gift, History, Inbox, UserPlus, Mail, MessageSquareText, Phone, Sparkles, Undo2, X } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";
import { intakeLines, readIntakeAnswers } from "@/lib/intake";
import { formatPrice } from "@/lib/money";
import { DECLINED, REQUESTED, type RequestMeta } from "@/lib/requests";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { dateKeyInTz, formatDate, formatInTz, formatSessionDate } from "@/lib/tz";
import { Badge, CounterCard, PageHeader, PersonDot } from "../ui";
import { clearRequestSlotAction, confirmRequestAction, declineRequestAction, deleteRequestAction, reopenRequestAction, rescheduleRequestAction } from "./actions";
import { Agenda, type AgendaView } from "./agenda";

type View = "nuevas" | AgendaView;
const VIEWS: View[] = ["nuevas", "proximas", "lecturas", "historial"];

/** El número de cada paso de una solicitud. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[0.72rem] text-cream">{n}</span>
      {children}
    </p>
  );
}

export const metadata: Metadata = { title: "Solicitudes" };

const AGENDA_OK = new Set(["propuesta", "cancelada", "reembolsada", "reembolso_en_curso"]);

const ago = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

/**
 * Solicitudes (lib/requests.ts): lo que las clientas piden desde la web en vez de pagar. Se habla por
 * email; al confirmar recibe el acceso o la reserva. En las sesiones se cambia aquí el día y la hora.
 */
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; ver?: string }> }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const tz = creator.timezone;
  const db = tenantDb(creator.id);
  const now = new Date();
  const [pending, done, upcomingCount, noDateCount, readingsCount] = await Promise.all([
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
    db.booking.count({ where: { status: "CONFIRMED", startAt: { gte: now } } }),
    db.booking.count({ where: { status: "PENDING_SCHEDULE" } }),
    db.order.count({ where: { status: "PAID", productType: "DIGITAL", deliveredAt: null, product: { deliveryMode: "PERSONAL" } } }),
  ]);

  // Quién pide: sus solicitudes juntas y lo que ya tiene contigo (para saber si es la misma persona y qué acceso tiene).
  const emails = [...new Set(pending.map((o) => o.buyerEmail.toLowerCase()))];
  const users = emails.length ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }) : [];
  const accesses = users.length
    ? await db.access.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        orderBy: { createdAt: "desc" },
        select: { userId: true, status: true, expiresAt: true, product: { select: { title: true, emoji: true } } },
      })
    : [];
  const emailOf = new Map(users.map((u) => [u.id, u.email.toLowerCase()]));
  const hasNow = new Map<string, { label: string; until: Date | null; live: boolean }[]>();
  for (const a of accesses) {
    const key = emailOf.get(a.userId);
    if (!key) continue;
    const live = a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now);
    const list = hasNow.get(key) ?? [];
    list.push({ label: `${a.product.emoji ? a.product.emoji + " " : ""}${a.product.title}`, until: a.expiresAt, live });
    hasNow.set(key, list);
  }
  const people = new Map<string, typeof pending>();
  for (const o of pending) {
    const key = o.buyerEmail.toLowerCase();
    people.set(key, [...(people.get(key) ?? []), o]);
  }
  const shortDay = (d: Date) => formatDate(d, { day: "numeric", month: "short" }, tz);

  // La pestaña: la que pide la URL; si no, lo primero que tenga algo que hacer.
  const asked = VIEWS.find((v) => v === sp.ver);
  const view: View =
    asked ??
    (sp.ok && AGENDA_OK.has(sp.ok) ? "proximas" : pending.length ? "nuevas" : upcomingCount + noDateCount ? "proximas" : readingsCount ? "lecturas" : "nuevas");
  const tabs: { key: View; label: string; hint: string; count: number | null; icon: React.ReactNode; alert?: boolean }[] = [
    { key: "nuevas", label: "Nuevas", hint: people.size > 0 && people.size < pending.length ? `De ${people.size} ${people.size === 1 ? "persona" : "personas"}` : "Te las piden desde la web", count: pending.length, icon: <Inbox className="h-5 w-5" />, alert: pending.length > 0 },
    { key: "proximas", label: "Próximas sesiones", hint: noDateCount ? `${noDateCount} sin fecha todavía` : "Ordenadas por días", count: upcomingCount + noDateCount, icon: <CalendarClock className="h-5 w-5" /> },
    { key: "lecturas", label: "Lecturas por enviar", hint: "Las que preparas tú", count: readingsCount, icon: <Sparkles className="h-5 w-5" />, alert: readingsCount > 0 },
    { key: "historial", label: "Historial", hint: "Respondidas y pasadas", count: null, icon: <History className="h-5 w-5" /> },
  ];

  return (
    <div>
      <PageHeader
        title="Solicitudes"
        actions={
          <>
            <Link href="/panel/solicitudes/dar" className="btn btn-primary">
              <UserPlus className="h-4 w-4" /> Dar acceso
            </Link>
            <Link href="/panel/solicitudes/dar/sesion" className="btn btn-outline">
              <Gift className="h-4 w-4" /> Dar una sesión o lectura
            </Link>
            <Link href="/panel/solicitudes/horario" className="btn btn-outline">
              <CalendarRange className="h-4 w-4" /> Tu horario
            </Link>
          </>
        }
        subtitle={pending.length ? `${pending.length} ${pending.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"} · respóndelas por email y confirma cuando esté todo.` : "Lo que te piden desde la web. Lo habláis por email y tú confirmas."}
      />
      {/* Los avisos de la agenda («propuesta», «cancelada»…) los enseña la agenda. */}
      <Flash ok={sp.ok && !AGENDA_OK.has(sp.ok) ? sp.ok : undefined} error={sp.error} />

      {/* Las pestañas: qué tienes que hacer, de un vistazo. */}
      <nav aria-label="Solicitudes" className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tabs.map((t) => (
          <CounterCard key={t.key} href={`/panel/solicitudes?ver=${t.key}`} on={t.key === view} alert={t.alert} icon={t.icon} label={t.label} hint={t.hint} value={t.count} />
        ))}
      </nav>

      {view === "nuevas" && (pending.length === 0 ? (
        <EmptyState icon={<Inbox className="h-5 w-5" />} title="No hay solicitudes pendientes">
          Cuando alguien pida un curso, una sesión o una lectura desde tu web, te llegará un email y la verás aquí. Si alguien te escribe directamente, usa «Dar acceso».
        </EmptyState>
      ) : (
        <div className="grid gap-9">
          {[...people.entries()].map(([key, reqs]) => {
            const who = reqs.find((o) => o.buyerName)?.buyerName ?? null;
            const owns = hasNow.get(key) ?? [];
            const live = owns.filter((a) => a.live);
            const past = owns.filter((a) => !a.live);
            return (
              <section key={key} data-request-person={key}>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <PersonDot name={who} email={reqs[0].buyerEmail} className="h-12 w-12 text-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[1.35rem] font-semibold leading-tight">{who ?? reqs[0].buyerEmail}</p>
                    <p className="truncate text-xs text-muted">{reqs[0].buyerEmail}</p>
                  </div>
                  {reqs.length > 1 && <Badge tone="warning">{reqs.length} solicitudes suyas</Badge>}
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
                  {live.length === 0 && past.length === 0 ? (
                    <span className="text-muted">Es nueva: todavía no tiene nada contigo.</span>
                  ) : (
                    <>
                      <span className="mr-1 text-muted">Ya tiene:</span>
                      {live.map((a, n) => (
                        <Badge key={`v${n}`} tone="success">
                          {a.label}
                          {a.until ? ` · hasta el ${shortDay(a.until)}` : ""}
                        </Badge>
                      ))}
                      {live.length === 0 && <span className="text-muted">nada activo ahora.</span>}
                      {past.length > 0 && (
                        <span className="ml-1 text-muted">
                          Tuvo: {past.map((a) => a.label).join(", ")}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="grid gap-5">
          {reqs.map((o) => {
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
                    <Step n={1}>Quién es y qué te dice</Step>
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
                      <Step n={2}>Día y hora de la sesión</Step>
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
                  <span className="mr-1 grid h-6 w-6 place-items-center rounded-full bg-ink text-[0.72rem] font-semibold text-cream">{isSession ? 3 : 2}</span>
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
                  <DeleteButton action={deleteRequestAction} id={o.id} what={o.productTitle} message={`¿Borrar la solicitud de ${o.buyerName ?? o.buyerEmail}? Desaparece del todo. No se le envía nada. No se puede deshacer.`} />
                </div>
              </article>
            );
          })}
                </div>
              </section>
            );
          })}
        </div>
      ))}

      {view === "historial" && done.length > 0 && (
        <section className="mb-10">
          <h2 className="eyebrow mb-3 !text-ink">Solicitudes ya respondidas</h2>
          <ul className="card divide-y divide-line">
            {done.map((o) => {
              const declined = o.status === DECLINED;
              const booking = o.bookings[0];
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <PersonDot name={o.buyerName} email={o.buyerEmail} className="h-9 w-9 text-sm" />
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
                    <Link href={`/panel/solicitudes/reserva/${booking.id}`} className="btn btn-ghost btn-sm">
                      <CalendarClock className="h-3.5 w-3.5" /> Ver la reserva
                    </Link>
                  ) : o.customer ? (
                    <Link href={`/panel/clientes/${o.customer.id}`} className="btn btn-ghost btn-sm">
                      Ver clienta
                    </Link>
                  ) : null}
                  <DeleteButton action={deleteRequestAction} id={o.id} what={o.productTitle} message={declined ? `¿Borrar la solicitud de ${o.buyerName ?? o.buyerEmail}? Desaparece del todo. No se puede deshacer.` : `¿Borrar la solicitud de ${o.buyerName ?? o.buyerEmail}? Se borra también lo que le diste (acceso o reserva). No se puede deshacer.`} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* La agenda (antes «Reservas»): sesiones próximas, lecturas por enviar e historial. */}
      {view !== "nuevas" && <Agenda sp={sp} view={view} />}
    </div>
  );
}
