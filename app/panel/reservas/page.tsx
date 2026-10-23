import Link from "next/link";
import { CalendarClock, CalendarDays, CalendarRange, Check, Gift, Plus, Sparkles, Users } from "lucide-react";
import { TzDriftNotice } from "@/components/booking/tz-drift-notice";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { intakeMissing, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { canSellType } from "@/lib/plans";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { addDaysToKey, capitalize, clientTimeNote, dateKeyInTz, formatInTz, formatSessionDate, timeInTz } from "@/lib/tz";
import { Badge, Locked, PageHeader } from "../ui";
import { setBookingStatus } from "./actions";
import { SESSION_CHANGE_NOTICE_HOURS } from "@/lib/legal";

const OK: Record<string, string> = {
  propuesta: "Hemos enviado a la clienta un enlace para elegir otra fecha.",
  cancelada: "Sesión cancelada. Hemos avisado a la clienta.",
  reembolsada: "Sesión cancelada y reembolsada. Hemos avisado a la clienta.",
  reembolso_en_curso: "Sesión cancelada. El reembolso está en curso; te avisaremos si falla.",
};

/** «1 sesión próxima», «3 sesiones próximas». */
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type OrderBits = { intake: unknown; paymentProvider: string; metadata: unknown } | null;

/** Chips de una reserva: regalo / pagada fuera y si tiene sus datos para la lectura. */
function Chips({ order, productIntake }: { order: OrderBits; productIntake: unknown }) {
  const meta = (order?.metadata ?? {}) as { manual?: string };
  const cfg = readIntakeConfig(productIntake);
  const answers = readIntakeAnswers(order?.intake);
  const asks = cfg.birth !== "off" || cfg.questions.length > 0;
  return (
    <>
      {order?.paymentProvider === "manual" && <span className="chip">{meta.manual === "paid_elsewhere" ? "Pagada fuera" : "Regalo"}</span>}
      {asks && (answers && !intakeMissing(cfg, answers) ? <span className="chip">Datos ✓</span> : <span className="chip !bg-[#f8efdc] !text-[#8a6420]">Faltan datos</span>)}
    </>
  );
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  if (!canSellType(creator.plan, "SESSION"))
    return (
      <div>
        <PageHeader title="Reservas" />
        <Locked plan="Creator" title="Vende sesiones con reserva" text="Tus clientas pagan y eligen día y hora según tu disponibilidad, con confirmación por email. Con Pro, además, recordatorios automáticos." />
      </div>
    );
  const db = tenantDb(creator.id);
  const now = new Date();
  const orderBits = { select: { intake: true, paymentProvider: true, metadata: true } } as const;
  const [upcoming, pending, past, readings, rulesCount] = await Promise.all([
    db.booking.findMany({ where: { status: "CONFIRMED", startAt: { gte: now } }, orderBy: { startAt: "asc" }, include: { product: true, customer: true, order: orderBits } }),
    db.booking.findMany({ where: { status: "PENDING_SCHEDULE" }, orderBy: { createdAt: "desc" }, include: { product: true, customer: true, order: orderBits } }),
    db.booking.findMany({
      where: { OR: [{ startAt: { lt: now } }, { status: { in: ["COMPLETED", "CANCELLED"] } }] },
      orderBy: [{ startAt: { sort: "desc", nulls: "last" } }, { cancelledAt: { sort: "desc", nulls: "last" } }],
      take: 20,
      include: { product: true, customer: true, order: { select: { refundedCents: true } } },
    }),
    // Lecturas «Lo preparo yo» pagadas que todavía no ha enviado.
    db.order.findMany({
      where: { status: "PAID", productType: "DIGITAL", deliveredAt: null, product: { deliveryMode: "PERSONAL" } },
      orderBy: { paidAt: "asc" },
      take: 50,
      include: { product: { select: { intake: true } } },
    }),
    db.availabilityRule.count(),
  ]);
  const tz = creator.timezone;
  const todayKey = dateKeyInTz(now, tz);
  const dayTitle = (d: Date) => {
    const k = dateKeyInTz(d, tz);
    if (k === todayKey) return "Hoy";
    if (k === addDaysToKey(todayKey, 1)) return "Mañana";
    return capitalize(formatInTz(d, tz, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""));
  };
  // Las plazas de un taller van juntas en una tarjeta; las sesiones 1:1, por días.
  type Item = { kind: "one"; b: (typeof upcoming)[number] } | { kind: "workshop"; b: (typeof upcoming)[number]; seats: number };
  const items: Item[] = [];
  const workshops = new Map<string, Item & { kind: "workshop" }>();
  for (const b of upcoming) {
    if (!b.groupSeat) items.push({ kind: "one", b });
    else if (workshops.has(b.productId)) workshops.get(b.productId)!.seats++;
    else {
      const w = { kind: "workshop" as const, b, seats: 1 };
      workshops.set(b.productId, w);
      items.push(w);
    }
  }
  const groups: { title: string; items: Item[] }[] = [];
  for (const it of items) {
    const title = dayTitle(it.b.startAt!);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(it);
    else groups.push({ title, items: [it] });
  }
  const sessionsCount = items.length;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Reservas"
        subtitle={`${count(sessionsCount, "sesión próxima", "sesiones próximas")} · ${count(pending.length, "pagada sin fecha", "pagadas sin fecha")}`}
        actions={
          <>
            <Link href="/panel/reservas/nueva" className="btn btn-primary h-11">
              <Gift className="h-4 w-4" /> Dar una sesión o lectura
            </Link>
            <Link href="/panel/reservas/horario" className="btn btn-outline h-11">
              <CalendarRange className="h-4 w-4" /> Tu horario
            </Link>
          </>
        }
      />
      <TzDriftNotice ownerTz={tz} />
      {sp.ok && OK[sp.ok] && <div className="-mb-5"><Flash ok={OK[sp.ok]} /></div>}

      <section>
        <h2 className="eyebrow mb-3 !text-ink">Próximas sesiones</h2>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-sm font-semibold text-muted">{g.title}</h3>
              <div className="space-y-2.5">
                {g.items.map((it) =>
                  it.kind === "workshop" ? (
                    <div key={`w-${it.b.productId}`} className="card flex flex-wrap items-center gap-4 p-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sand"><Users className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">Taller · {it.b.product.title}</p>
                        <p className="text-sm text-muted">
                          {capitalize(formatSessionDate(it.b.startAt!, tz))} · {it.seats}
                          {it.b.product.capacity != null ? `/${it.b.product.capacity}` : ""} plazas
                        </p>
                      </div>
                      <Link href={`/panel/productos/${it.b.productId}#asistentes`} className="btn btn-ghost btn-sm h-11">Asistentes</Link>
                    </div>
                  ) : (
                    <div key={it.b.id} className="card flex flex-wrap items-center gap-4 p-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink text-center leading-none text-cream">
                        <div>
                          <p className="text-lg font-semibold">{timeInTz(it.b.startAt!, tz)}</p>
                          <p className="mt-0.5 text-[0.62rem] uppercase tracking-wider text-cream/60">{formatInTz(it.b.startAt!, tz, { day: "numeric", month: "short" }).replace(".", "")}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{it.b.customer.name ?? it.b.customer.email}</p>
                        <p className="text-sm text-muted">{it.b.product.title} · {capitalize(formatSessionDate(it.b.startAt!, tz))}</p>
                        {clientTimeNote(it.b.startAt!, tz, it.b.customerTimezone) && (
                          <p className="text-xs text-muted">{capitalize(clientTimeNote(it.b.startAt!, tz, it.b.customerTimezone))}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Chips order={it.b.order} productIntake={it.b.product.intake} />
                        </div>
                        {it.b.customerNotes && <p className="mt-1 text-xs text-muted">«{it.b.customerNotes}»</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {it.b.meetingUrl && <a href={it.b.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm h-11">Videollamada</a>}
                        <Link href={`/panel/reservas/${it.b.id}`} className="btn btn-ghost btn-sm h-11"><CalendarClock className="h-4 w-4" /> Cambiar o cancelar</Link>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
          {upcoming.length === 0 && <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Sin sesiones próximas">Cuando alguien reserve aparecerá aquí.</EmptyState>}
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3 !text-ink">Pagadas, pendientes de fecha</h2>
          <div className="card divide-y divide-line">
            {pending.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{b.customer.name ?? b.customer.email}</strong> · {b.product.title}
                  {b.rescheduleRequestedAt && (
                    <span className="chip ml-2">Nueva fecha propuesta · {b.rescheduleRequestedAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: tz })}</span>
                  )}
                  <span className="ml-2 inline-flex gap-1.5"><Chips order={b.order} productIntake={b.product.intake} /></span>
                </span>
                <span className="flex gap-1">
                  <a href={`mailto:${b.customer.email}`} className="btn btn-ghost btn-sm">Recordar por email</a>
                  <Link href={`/panel/reservas/${b.id}`} className="btn btn-ghost btn-sm"><CalendarClock className="h-4 w-4" /> Cambiar o cancelar</Link>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {readings.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3 !text-ink">Lecturas por entregar</h2>
          <div className="card divide-y divide-line">
            {readings.map((o) => {
              const cfg = readIntakeConfig(o.product.intake);
              const missing = intakeMissing(cfg, readIntakeAnswers(o.intake));
              return (
                <Link key={o.id} href={`/panel/ventas/${o.id}#entrega`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm hover:bg-sand/40">
                  <Sparkles className="h-4 w-4 text-muted" />
                  <span className="min-w-0 flex-1">
                    <strong>{o.buyerName ?? o.buyerEmail}</strong> · {o.productTitle}
                    <span className="block text-xs text-muted">Desde el {o.paidAt?.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: tz })}</span>
                  </span>
                  {missing ? <span className="chip !bg-[#f8efdc] !text-[#8a6420]">Faltan datos</span> : (cfg.birth !== "off" || cfg.questions.length > 0) && <span className="chip">Datos ✓</span>}
                  <span className="btn btn-ghost btn-sm">Entregar</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section id="disponibilidad" className="card flex scroll-mt-20 flex-wrap items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-sand"><CalendarRange className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Tu horario</p>
          <p className="text-sm text-muted">
            {rulesCount ? "Tu horario semanal, las fechas especiales (viajes, días sueltos) y los días u horas bloqueados." : "Todavía no tienes horario: tus clientas no verán huecos hasta que lo pongas."}
          </p>
        </div>
        <Link href="/panel/reservas/horario" className="btn btn-outline btn-sm h-11"><Plus className="h-4 w-4" /> {rulesCount ? "Editar horario" : "Poner mi horario"}</Link>
      </section>

      {!isPersonalMode() && (
        <section className="card flex flex-wrap items-center gap-4 p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-sand"><CalendarDays className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Google Calendar</p>
            <p className="text-sm text-muted">Pronto: sincroniza tus reservas y bloquea huecos ocupados automáticamente. Mientras, tus clientas pueden añadir la sesión a su calendario con un clic.</p>
          </div>
          <Badge>Próximamente</Badge>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3 !text-ink">Historial</h2>
          <div className="card divide-y divide-line">
            {past.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <span className="min-w-0 flex-1">
                  <Link href={`/panel/reservas/${b.id}`} className="hover:underline"><strong>{b.customer.name ?? b.customer.email}</strong></Link> · {b.product.title}{b.startAt && ` · ${capitalize(formatSessionDate(b.startAt, tz, false))}`}
                  {b.status === "CANCELLED" && b.cancelReason && <span className="block text-xs text-muted">«{b.cancelReason}»</span>}
                </span>
                <Badge tone={b.status === "COMPLETED" ? "success" : b.status === "CANCELLED" ? "danger" : "neutral"}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                {b.status === "CANCELLED" && (b.order?.refundedCents ?? 0) > 0 && <Badge>Reembolsada</Badge>}
                {b.status === "CONFIRMED" && (
                  <form action={setBookingStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="COMPLETED" /><button className="btn btn-ghost btn-sm"><Check className="h-4 w-4" /> Completada</button></form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs text-muted">Tus clientas pueden cambiar la fecha hasta {SESSION_CHANGE_NOTICE_HOURS} h antes desde su área. Si necesitas cambiarla tú, usa «Cambiar o cancelar». <Link href="/panel/automatizaciones" className="underline">Configura los recordatorios y los avisos</Link>.</p>
    </div>
  );
}
