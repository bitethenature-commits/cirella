import Link from "next/link";
import { ArrowLeft, CalendarX, X } from "lucide-react";
import { TzDriftNotice } from "@/components/booking/tz-drift-notice";
import { requireCreator } from "@/lib/auth";
import { tzCity } from "@/lib/timezones";
import { tenantDb } from "@/lib/tenant";
import { dateKeyInTz, minutesToLabel } from "@/lib/tz";
import { PageHeader } from "../../ui";
import { addBlockedDate, removeBlockedDate, removeOverride } from "../actions";
import { AvailabilityEditor } from "../availability";
import { SpecialHoursForm, TimeBlockForm } from "./special-dates";
import { NatalChartCard } from "./natal-chart-card";
import { formatZodiac } from "@/lib/astro-calendar";
import { loadNatalChart } from "@/lib/calendar-diary";
import { HOUSE_SYSTEM_LABEL, natalHouses } from "@/lib/natal-chart";

const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("es-ES", { ...opts, timeZone: "UTC" }).replace(/\./g, "");
const hours = (a: number, b: number) => `${minutesToLabel(a).replace(/^0/, "")}–${b === 1440 ? "24:00" : minutesToLabel(b).replace(/^0/, "")}`;

/** Tu horario: semanal, fechas especiales (viajes, días sueltos) y lo que bloqueas. */
export default async function SchedulePage() {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const today = dateKeyInTz(new Date(), creator.timezone);
  const [rules, blocked, overrides, chart] = await Promise.all([
    db.availabilityRule.findMany({ orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    db.blockedDate.findMany({ where: { date: { gte: today } }, orderBy: { date: "asc" } }),
    db.availabilityOverride.findMany({ where: { date: { gte: today } }, orderBy: [{ date: "asc" }, { startMinute: "asc" }] }),
    loadNatalChart(creator.id),
  ]);
  const houses = chart ? natalHouses(chart) : null;
  const summary = houses
    ? `Ascendente ${formatZodiac(houses.asc)} · Medio Cielo ${formatZodiac(houses.mc)} · Casas ${HOUSE_SYSTEM_LABEL[houses.system]}${
        houses.system === "porphyry" ? " (Plácidus no se puede calcular por encima del círculo polar)" : ""
      }`
    : null;
  const special = new Map<string, typeof overrides>();
  for (const o of overrides.filter((x) => x.kind === "HOURS")) special.set(o.date, [...(special.get(o.date) ?? []), o]);
  const blocks = overrides.filter((x) => x.kind === "BLOCK");
  return (
    <div className="max-w-3xl space-y-8 pb-10">
      <Link href="/panel/reservas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Reservas</Link>
      <PageHeader title="Tu horario" subtitle="Tus clientas solo ven huecos dentro de tu horario. La duración, el margen y la antelación se configuran en cada sesión." />
      <TzDriftNotice ownerTz={creator.timezone} />

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold">Horario semanal</h2>
        <AvailabilityEditor initial={rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))} timezone={creator.timezone} />
      </section>

      <section id="especiales" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Fechas especiales</h2>
          <p className="mt-1 text-sm text-muted">Para viajes o días sueltos: esos días trabajas en estas horas y no se usa tu horario semanal.</p>
        </div>
        {special.size > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {[...special.entries()].map(([date, rows]) => (
              <li key={date} className="flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{dayLabel(date)}</strong> · {rows.map((r) => hours(r.startMinute, r.endMinute)).join(", ")}
                  {rows[0].timezone !== creator.timezone && ` (hora de ${tzCity(rows[0].timezone)})`}
                  {rows[0].note && <span className="text-muted"> · {rows[0].note}</span>}
                </span>
                <form action={removeOverride}>
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="kind" value="HOURS" />
                  <button className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand" aria-label={`Quitar la fecha especial del ${dayLabel(date, { day: "numeric", month: "long" })}`}><X className="h-4 w-4" /></button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <SpecialHoursForm ownerTz={creator.timezone} today={today} />
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Días y horas bloqueados</h2>
          <p className="mt-1 text-sm text-muted">Vacaciones, un retiro o un recado: ese tiempo no se ofrece a nadie.</p>
        </div>
        <form action={addBlockedDate} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <label className="field-label" htmlFor="bd-from">Bloquear desde</label>
            <input id="bd-from" type="date" name="date" min={today} required className="input h-11 sm:w-44" />
          </div>
          <div>
            <label className="field-label" htmlFor="bd-to">Hasta <span className="font-normal text-muted">(opcional)</span></label>
            <input id="bd-to" type="date" name="to" min={today} className="input h-11 sm:w-44" />
          </div>
          <input name="reason" placeholder="Motivo (opcional): vacaciones, retiro…" className="input h-11 flex-1" />
          <button className="btn btn-outline h-11"><CalendarX className="h-4 w-4" /> Bloquear días</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {blocked.map((d) => (
            <form key={d.id} action={removeBlockedDate} className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
              <input type="hidden" name="id" value={d.id} />
              {dayLabel(d.date)}
              {d.reason && <span className="text-muted">· {d.reason}</span>}
              <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Desbloquear"><X className="h-3 w-3" /></button>
            </form>
          ))}
          {blocks.map((b) => (
            <form key={b.id} action={removeOverride} className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
              <input type="hidden" name="id" value={b.id} />
              {dayLabel(b.date)} · {hours(b.startMinute, b.endMinute)}
              {b.note && <span className="text-muted">· {b.note}</span>}
              <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Desbloquear horas"><X className="h-3 w-3" /></button>
            </form>
          ))}
          {blocked.length === 0 && blocks.length === 0 && <p className="text-sm text-faint">Nada bloqueado.</p>}
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-sm font-semibold">Bloquear unas horas</p>
          <TimeBlockForm today={today} />
        </div>
      </section>

      <section id="carta-natal" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Mi carta natal</h2>
          <p className="mt-1 text-sm text-muted">Para ver en tu calendario por qué casa pasa cada tránsito. Solo la ves tú.</p>
        </div>
        <NatalChartCard initial={chart} summary={summary} />
      </section>
    </div>
  );
}
