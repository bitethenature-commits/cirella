import Link from "next/link";
import { CalendarDays, CalendarX, Check, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { canSellType } from "@/lib/plans";
import { tenantDb } from "@/lib/tenant";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatSessionDate } from "@/lib/tz";
import { Badge, Locked, PageHeader } from "../ui";
import { addBlockedDate, removeBlockedDate, setBookingStatus } from "./actions";
import { AvailabilityEditor } from "./availability";

export default async function BookingsPage() {
  const { creator } = await requireCreator();
  if (!canSellType(creator.plan, "SESSION"))
    return (
      <div>
        <PageHeader title="Reservas" />
        <Locked plan="Creator" title="Vende sesiones con reserva" text="Tus clientas pagan y eligen día y hora según tu disponibilidad, con confirmación por email. Con Pro, además, recordatorios automáticos." />
      </div>
    );
  const db = tenantDb(creator.id);
  const now = new Date();
  const [upcoming, pending, past, rules, blocked] = await Promise.all([
    db.booking.findMany({ where: { status: "CONFIRMED", startAt: { gte: now } }, orderBy: { startAt: "asc" }, include: { product: true, customer: true } }),
    db.booking.findMany({ where: { status: "PENDING_SCHEDULE" }, orderBy: { createdAt: "desc" }, include: { product: true, customer: true } }),
    db.booking.findMany({ where: { OR: [{ startAt: { lt: now } }, { status: { in: ["COMPLETED", "CANCELLED"] } }] }, orderBy: { startAt: "desc" }, take: 20, include: { product: true, customer: true } }),
    db.availabilityRule.findMany({ orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    db.blockedDate.findMany({ orderBy: { date: "asc" } }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-10">
      <PageHeader title="Reservas" subtitle={`${upcoming.length} sesiones próximas · ${pending.length} pagadas sin fecha`} />

      <section>
        <h2 className="eyebrow mb-3 !text-ink">Próximas sesiones</h2>
        <div className="space-y-2.5">
          {upcoming.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink text-center leading-none text-cream">
                <div>
                  <p className="text-lg font-semibold">{b.startAt!.toLocaleDateString("es-ES", { day: "numeric", timeZone: creator.timezone })}</p>
                  <p className="mt-0.5 text-[0.62rem] uppercase tracking-wider text-cream/60">{b.startAt!.toLocaleDateString("es-ES", { month: "short", timeZone: creator.timezone }).replace(".", "")}</p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.customer.name ?? b.customer.email}</p>
                <p className="text-sm text-muted">{b.product.title} · {capitalize(formatSessionDate(b.startAt!, creator.timezone))}</p>
                {b.customerNotes && <p className="mt-1 text-xs text-muted">«{b.customerNotes}»</p>}
              </div>
              <div className="flex gap-2">
                {b.meetingUrl && <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Videollamada</a>}
                <form action={setBookingStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="CANCELLED" /><SubmitButton className="btn btn-ghost btn-sm text-rose"><X className="h-4 w-4" /> Cancelar</SubmitButton></form>
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
              <div key={b.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span><strong>{b.customer.name ?? b.customer.email}</strong> · {b.product.title}</span>
                <a href={`mailto:${b.customer.email}`} className="btn btn-ghost btn-sm">Recordar por email</a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="disponibilidad" className="scroll-mt-20">
        <h2 className="eyebrow mb-1 !text-ink">Disponibilidad semanal</h2>
        <p className="mb-4 text-sm text-muted">Las clientas solo verán huecos dentro de estas franjas. La duración, el margen entre sesiones y la antelación mínima se configuran en cada sesión.</p>
        <AvailabilityEditor initial={rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))} timezone={creator.timezone} />
      </section>

      <section>
        <h2 className="eyebrow mb-3 !text-ink">Días bloqueados</h2>
        <form action={addBlockedDate} className="mb-3 flex flex-col gap-2 sm:flex-row">
          <input type="date" name="date" min={today} required className="input h-10 text-sm sm:w-48" />
          <input name="reason" placeholder="Motivo (opcional): vacaciones, retiro…" className="input h-10 flex-1 text-sm" />
          <button className="btn btn-outline btn-sm h-10"><CalendarX className="h-4 w-4" /> Bloquear día</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {blocked.map((d) => (
            <form key={d.id} action={removeBlockedDate} className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
              <input type="hidden" name="id" value={d.id} />
              {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
              {d.reason && <span className="text-muted">· {d.reason}</span>}
              <button className="grid h-6 w-6 place-items-center rounded-full hover:bg-sand" aria-label="Desbloquear"><X className="h-3 w-3" /></button>
            </form>
          ))}
          {blocked.length === 0 && <p className="text-sm text-faint">Ningún día bloqueado.</p>}
        </div>
      </section>

      <section className="card flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-sand"><CalendarDays className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Google Calendar</p>
          <p className="text-sm text-muted">Pronto: sincroniza tus reservas y bloquea huecos ocupados automáticamente. Mientras, tus clientas pueden añadir la sesión a su calendario con un clic.</p>
        </div>
        <Badge>Próximamente</Badge>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3 !text-ink">Historial</h2>
          <div className="card divide-y divide-line">
            {past.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <span className="min-w-0 flex-1"><strong>{b.customer.name ?? b.customer.email}</strong> · {b.product.title}{b.startAt && ` · ${capitalize(formatSessionDate(b.startAt, creator.timezone, false))}`}</span>
                <Badge tone={b.status === "COMPLETED" ? "success" : b.status === "CANCELLED" ? "danger" : "neutral"}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                {b.status === "CONFIRMED" && (
                  <form action={setBookingStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="COMPLETED" /><button className="btn btn-ghost btn-sm"><Check className="h-4 w-4" /> Completada</button></form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs text-muted">¿Necesitas cambiar una sesión? Tus clientas pueden reprogramarla hasta 24 h antes desde su área. <Link href="/panel/automatizaciones" className="underline">Configura los recordatorios</Link>.</p>
    </div>
  );
}
