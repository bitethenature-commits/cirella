import Link from "next/link";
import { isPersonalMode, peopleLabel } from "@/lib/site-mode";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, Inbox, Mail, Newspaper, UserPlus, X } from "lucide-react";
import { isNoChargeOrder, NO_CHARGE_LABEL, type NoChargeProvider } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { formatMoney, formatPrice } from "@/lib/money";
import { signupsOnly } from "@/lib/commerce";
import { REQUESTED } from "@/lib/requests";
import { tenantDb } from "@/lib/tenant";
import { orderStatusLabel } from "@/lib/refund-math";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatSessionDate, formatDate } from "@/lib/tz";
import { DeleteButton } from "@/components/ui/delete-button";
import { Flash } from "@/components/ui/flash";
import { Badge, Stat } from "../../ui";
import { SignupItem } from "../../ventas/signup-item";
import { listSignups } from "../../ventas/signups-data";
import { deleteCustomerAction } from "../actions";
import { ANSWERED_INCLUDE, ANSWERED_WHERE, AnsweredRow, PENDING_INCLUDE, RequestCard } from "../solicitudes";

/**
 * La ficha de una persona: sus solicitudes (las nuevas, para contestar aquí, y las ya respondidas), sus
 * membresías, sus sesiones y sus inscripciones (a qué tiene acceso y hasta cuándo, con «Ha pagado»,
 * «Denegar acceso» y borrar). En la web que cobra, sus pedidos con el importe.
 */
export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const tz = creator.timezone;
  const db = tenantDb(creator.id);
  const c = await db.customer.findFirst({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { startAt: { sort: "desc", nulls: "last" } }, include: { product: true } },
      subscriptions: { include: { product: true } },
    },
  });
  if (!c) notFound();
  const personal = signupsOnly();
  const here = `/panel/clientes/${c.id}`;
  // Las solicitudes no tienen ficha propia: son suyas las que llegaron con su email.
  const sameEmail = { buyerEmail: { equals: c.email, mode: "insensitive" as const } };
  const [pending, answered, signups, subscriber] = await Promise.all([
    db.order.findMany({ where: { status: REQUESTED, ...sameEmail }, orderBy: { createdAt: "desc" }, include: PENDING_INCLUDE }),
    db.order.findMany({ where: { ...ANSWERED_WHERE(creator.id), ...sameEmail }, orderBy: { createdAt: "desc" }, take: 30, include: ANSWERED_INCLUDE }),
    personal ? listSignups(creator.id, { since: null, customerId: c.id, timeZone: tz }) : null,
    // Su página de la newsletter (la newsletter solo existe en la web personal).
    isPersonalMode() ? db.subscriber.findFirst({ where: { email: c.email.toLowerCase() }, select: { id: true, status: true } }) : null,
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/panel/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {peopleLabel()}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-ink text-xl text-cream">{(c.name ?? c.email)[0].toUpperCase()}</div>
        <div className="flex-1">
          <h1 className="display text-[2.2rem] leading-tight">{c.name ?? c.email}</h1>
          <p className="text-sm text-muted">
            {c.email} · {personal ? "desde" : "clienta desde"} {formatDate(c.createdAt, { day: "numeric", month: "long", year: "numeric" }, tz)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {c.marketingOptIn
              ? `Acepta novedades por email${c.marketingOptInAt ? ` desde el ${formatDate(c.marketingOptInAt, { day: "numeric", month: "long", year: "numeric" }, tz)}` : ""}`
              : "No ha aceptado recibir novedades"}
          </p>
        </div>
        <a href={`mailto:${c.email}`} className="btn btn-outline btn-sm">
          <Mail className="h-4 w-4" /> Escribir
        </a>
        <Link href={`/panel/solicitudes/dar?email=${encodeURIComponent(c.email)}`} className="btn btn-primary btn-sm">
          <UserPlus className="h-4 w-4" /> Dar acceso
        </Link>
        {isPersonalMode() &&
          (subscriber ? (
            <Link href={`/panel/newsletter/suscriptoras/${subscriber.id}`} className="btn btn-outline btn-sm" title={subscriber.status === "CONFIRMED" ? "Suscrita a tu newsletter" : "Está en tu lista, pero no la recibe"}>
              <Newspaper className="h-4 w-4" /> Newsletter
              {subscriber.status === "CONFIRMED" ? <Check className="h-4 w-4 text-[#2f8a5b]" strokeWidth={3} /> : <X className="h-4 w-4 text-[#B4473C]" strokeWidth={3} />}
            </Link>
          ) : (
            // Sin alta en la newsletter no hay página: solo se apunta ella (hace falta su consentimiento).
            <span className="btn btn-outline btn-sm cursor-default opacity-60" title="No está en tu newsletter. Solo se puede apuntar ella.">
              <Newspaper className="h-4 w-4" /> Newsletter <X className="h-4 w-4 text-[#B4473C]" strokeWidth={3} />
            </span>
          ))}
        <DeleteButton action={deleteCustomerAction} id={c.id} variant="button" what={c.name ?? c.email} message={`¿Borrar a ${c.name ?? c.email} con todas sus ventas, inscripciones, reservas y accesos? Deja de entrar en lo que tenía. No se puede deshacer.`} />
      </div>
      <div className="mt-4">
        <Flash ok={sp.ok} error={sp.error} />
      </div>
      {!personal && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Total gastado" value={formatMoney(c.totalSpentCents)} accent />
          <Stat label="Compras" value={c.ordersCount} />
          <Stat label="Última compra" value={(c.lastPurchaseAt ? formatDate(c.lastPurchaseAt, { day: "numeric", month: "short" }, tz) : undefined) ?? "—"} />
        </div>
      )}

      {/* Sus solicitudes: las nuevas se contestan aquí mismo. */}
      {pending.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Inbox className="h-4 w-4" /> {pending.length === 1 ? "Solicitud por contestar" : `${pending.length} solicitudes por contestar`}
          </h2>
          <div className="grid gap-5">
            {pending.map((o) => (
              <RequestCard key={o.id} o={o} tz={tz} back={here} />
            ))}
          </div>
        </section>
      )}
      <section className="card mt-6 overflow-hidden">
        <h2 className="px-5 pt-5 font-semibold">Solicitudes</h2>
        {answered.length > 0 ? (
          <ul className="mt-2 divide-y divide-line">
            {answered.map((o) => (
              <AnsweredRow key={o.id} o={o} back={here} inFicha />
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-5 pt-2 text-sm text-muted">{pending.length ? "Todavía no le has contestado ninguna." : "No te ha pedido nada desde la web."}</p>
        )}
      </section>

      {c.subscriptions.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="font-semibold">Membresías</h2>
          {c.subscriptions.map((s) => (
            <p key={s.id} className="mt-2 flex items-center justify-between text-sm">
              <span>
                {s.product.title} · {formatPrice(s.priceCents, "EUR", s.interval)}
              </span>
              <Badge tone={s.status === "ACTIVE" ? (s.cancelAtPeriodEnd ? "warning" : "success") : "neutral"}>
                {s.status === "ACTIVE" ? (s.cancelAtPeriodEnd ? "Cancela al final del periodo" : "Activa") : "Finalizada"}
              </Badge>
            </p>
          ))}
        </section>
      )}
      {c.bookings.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="font-semibold">Sesiones</h2>
          {c.bookings.map((b) => (
            <p key={b.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
              <Link href={`/panel/solicitudes/reserva/${b.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                <CalendarClock className="h-4 w-4 shrink-0 text-muted" />
                <span className="truncate">
                  {b.product.title} · {b.startAt ? capitalize(formatSessionDate(b.startAt, tz)) : "sin fecha"}
                </span>
              </Link>
              <Badge>{BOOKING_STATUS_LABEL[b.status]}</Badge>
            </p>
          ))}
        </section>
      )}
      {signups ? (
        <section className="card mt-4 overflow-hidden">
          <h2 className="px-5 pt-5 font-semibold">Inscripciones</h2>
          {signups.rows.length > 0 ? (
            <ul className="mt-2 divide-y divide-line">
              {signups.rows.map((r) => (
                <SignupItem key={r.orderId} r={r} back={here} timezone={tz} />
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-5 pt-2 text-sm text-muted">Todavía no tiene nada. Con «Dar acceso» le das un curso, la membresía o lo que quieras.</p>
          )}
        </section>
      ) : (
        <section className="card mt-4 p-5">
          <h2 className="font-semibold">Pedidos</h2>
          {c.orders.map((o) => (
            <p key={o.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                <Link href={`/panel/ventas/${o.id}`} className="hover:underline">
                  {o.productTitle}
                </Link>{" "}
                <span className="text-muted">· {formatDate(o.createdAt, { day: "numeric", month: "short" }, tz)}</span>
              </span>
              {isNoChargeOrder(o) ? (
                <span className="shrink-0 text-muted">Gratis · {NO_CHARGE_LABEL[o.paymentProvider as NoChargeProvider]}</span>
              ) : (
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(o.amountCents, o.currency, { decimals: true })} <span className="font-normal text-muted">{orderStatusLabel(o)}</span>
                </span>
              )}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
