"use client";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DaySlots } from "@/lib/slots";
import { sameOffset, tzCity, tzOffsetLabel } from "@/lib/timezones";
import { addDaysToKey, capitalize, formatInTz, timeInTz, weekdayOfKey } from "@/lib/tz";
import { browserTimezone, TimezoneSelect } from "./timezone-select";
import { Tr, useT } from "@/lib/i18n/client";

type SlotsResponse = {
  timezone: string;
  ownerTimezone: string;
  durationMin: number;
  horizonDays: number;
  range: { from: string; to: string };
  /** Sesión pagada en la web: primera hora posible (día 15 desde la compra, lib/withdrawal.ts). */
  notBefore?: string | null;
  days: DaySlots[];
};

/**
 * Calendario de huecos (checkout, «Elige fecha» del área de cliente y «Dar una sesión» del panel):
 * un mes de lunes a domingo con los días libres marcados, y las horas libres del día elegido en la zona
 * de quien mira (la de su navegador, que puede cambiar). Debajo, el resumen con su hora y la de la
 * dueña para que nadie pague la hora equivocada.
 *
 * theme «creator»: colores de la página de la creadora (variables --c-*); «app»: los del área y el panel.
 */
export function SlotPicker({
  productId,
  orderId,
  value,
  onChange,
  initialTz,
  onTimezoneChange,
  theme = "app",
  disabled,
  emptyText = "No hay huecos disponibles ahora mismo.",
  viewer = "client",
  bookingId,
  manual,
}: {
  productId: string;
  /** Reserva de quien mira (elegir o cambiar su fecha): el día 15 cuenta desde el pago de su pedido. */
  bookingId?: string;
  /** La dueña da una sesión a mano: sin la regla del día 15. */
  manual?: boolean;
  /** Pedido de este navegador (checkout que se reintenta): su propio pago en curso no le quita la hora. */
  orderId?: string;
  value: string;
  onChange: (iso: string) => void;
  /** Zona con la que empieza (por defecto la del navegador). */
  initialTz?: string;
  onTimezoneChange?: (tz: string) => void;
  theme?: "creator" | "app";
  disabled?: boolean;
  emptyText?: string;
  /** «owner»: la dueña mira su propia agenda (resumen sin «tu hora»). */
  viewer?: "client" | "owner";
}) {
  const t = useT();
  const [tz, setTz] = useState<string>(initialTz ?? "");
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [error, setError] = useState(false);
  const [month, setMonth] = useState<string | null>(null); // YYYY-MM
  const [day, setDay] = useState<string | null>(null);
  const [changingTz, setChangingTz] = useState(false);

  // La zona del navegador solo se conoce en el navegador.
  useEffect(() => {
    if (!tz) {
      const z = browserTimezone("Europe/Madrid");
      setTz(z);
      onTimezoneChange?.(z);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tz) return;
    let alive = true;
    setData(null);
    setError(false);
    const q = new URLSearchParams({ productId, tz });
    if (orderId) q.set("pedido", orderId);
    if (bookingId) q.set("reserva", bookingId);
    if (manual) q.set("manual", "1");
    fetch(`/api/slots?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: SlotsResponse) => {
        if (!alive) return;
        setData(d);
        // El día elegido (o el primero libre) y su mes.
        const chosen = value ? d.days.find((x) => x.slots.some((s) => s.start === value)) : null;
        const first = chosen ?? d.days[0];
        setDay(first?.date ?? null);
        setMonth((first?.date ?? d.range.from).slice(0, 7));
      })
      .catch(() => {
        // 404, 429 (demasiadas peticiones) o sin conexión: se avisa sin romper la página.
        if (!alive) return;
        setData({ timezone: tz, ownerTimezone: tz, durationMin: 0, horizonDays: 0, range: { from: "", to: "" }, days: [] });
        setError(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, tz, orderId, bookingId, manual]);

  const byDate = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d])), [data]);
  const colors =
    theme === "creator"
      ? {
          line: { borderColor: "var(--c-line)" },
          dayOn: { background: "var(--c-accent)", color: "var(--c-accent-text)", borderColor: "transparent" },
          dot: { background: "var(--c-accent)" },
          timeOn: { background: "var(--c-text)", color: "var(--c-bg)", borderColor: "transparent" },
          muted: "cp-muted",
          faint: "cp-faint",
        }
      : {
          line: { borderColor: "var(--color-line)", background: "#fff" },
          dayOn: { background: "var(--color-ink)", color: "var(--color-cream)", borderColor: "transparent" },
          dot: { background: "var(--color-ink)" },
          timeOn: { background: "var(--color-ink)", color: "var(--color-cream)", borderColor: "transparent" },
          muted: "text-muted",
          faint: "text-faint",
        };

  if (!tz || !data)
    return (
      <p className={`${colors.muted} flex items-center gap-2 text-sm`} aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" />{" "}<Tr s={"Cargando disponibilidad…"} /></p>
    );
  if (error) return <p className={`${colors.muted} text-sm`}><Tr s={"No hemos podido cargar los horarios. Recarga la página en unos segundos."} /></p>;

  const zoneFooter = (
    <div className={`${colors.faint} mt-3 text-xs`}>
      {changingTz ? (
        <label className="block">
          <span className="mb-1 block"><Tr s={"Horas en tu zona:"} /></span>
          <TimezoneSelect
            value={tz}
            ariaLabel={t("Zona horaria")}
            className={theme === "creator" ? "cp-input h-11 text-sm" : "input h-11 text-sm"}
            onChange={(z) => {
              setTz(z);
              setChangingTz(false);
              onTimezoneChange?.(z);
            }}
          />
        </label>
      ) : (
        <p>
          {viewer === "owner" ? t("Horas en") : t("Horas en tu zona:")} {tzCity(tz)} ({tzOffsetLabel(tz)}) ·{" "}
          <button type="button" onClick={() => setChangingTz(true)} className="underline underline-offset-2"><Tr s={"Cambiar"} /></button>
        </p>
      )}
    </div>
  );

  // Por qué no hay días antes: la sesión cae siempre fuera de los 14 días para desistir.
  const day15Note = data.notBefore ? (
    <p className={`${colors.muted} mb-3 text-xs leading-relaxed`} data-testid="dia-15"><Tr s={"Fechas a partir del"} />{" "}{formatInTz(new Date(data.notBefore), data.ownerTimezone, { day: "numeric", month: "long" })}<Tr s={": las sesiones que se pagan en la web se reservan desde el día 15 tras la compra, así nunca caen dentro de los 14 días en los que puedes desistir."} /></p>
  ) : null;

  if (data.days.length === 0)
    return (
      <div>
        {day15Note}
        <p className={`${colors.muted} text-sm`}><Tr s={emptyText} /></p>
        {zoneFooter}
      </div>
    );

  const firstMonth = data.days[0].date.slice(0, 7);
  const lastMonth = data.days[data.days.length - 1].date.slice(0, 7);
  const current = month && month >= firstMonth && month <= lastMonth ? month : firstMonth;
  const [y, m] = current.split("-").map(Number);
  const monthStart = `${current}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (weekdayOfKey(monthStart) + 6) % 7; // lunes = 0
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDaysToKey(monthStart, i))];
  const monthLabel = capitalize(new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", month: "long", year: "numeric" }).format(Date.UTC(y, m - 1, 15)));
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const longDay = (key: string) => {
    const [yy, mm, dd] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(Date.UTC(yy, mm - 1, dd));
  };
  const selected = day ? byDate.get(day) : undefined;
  const chosen = value ? new Date(value) : null;
  const owner = data.ownerTimezone;

  return (
    <div className={disabled ? "pointer-events-none opacity-40" : ""}>
      {day15Note}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={current <= firstMonth}
          aria-label={t("Mes anterior")}
          className="grid h-11 w-11 place-items-center rounded-full border transition disabled:opacity-30"
          style={colors.line}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold" aria-live="polite">
          <Tr s={monthLabel} />
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={current >= lastMonth}
          aria-label={t("Mes siguiente")}
          className="grid h-11 w-11 place-items-center rounded-full border transition disabled:opacity-30"
          style={colors.line}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className={`${colors.faint} mt-3 grid grid-cols-7 text-center text-[0.65rem] font-semibold uppercase tracking-wider`} aria-hidden>
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d}><Tr s={d} /></span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label={`Días de ${monthLabel}`}>
        {cells.map((key, i) => {
          if (!key) return <span key={`e${i}`} />;
          const d = byDate.get(key);
          const n = Number(key.slice(8));
          if (!d)
            return (
              <span key={key} className={`${colors.faint} grid h-11 place-items-center text-sm opacity-50`}>
                {n}
              </span>
            );
          const on = day === key;
          const count = d.slots.length;
          return (
            <button
              key={key}
              type="button"
              data-date={key}
              aria-pressed={on}
              aria-label={`${longDay(key)}: ${count} ${count === 1 ? "hora libre" : "horas libres"}`}
              onClick={() => setDay(key)}
              className="relative grid h-11 place-items-center rounded-xl border text-sm font-semibold tabular-nums transition"
              style={on ? colors.dayOn : { ...colors.line }}
            >
              {n}
              {!on && <span className="absolute bottom-1.5 h-1 w-1 rounded-full" style={colors.dot} aria-hidden />}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4">
          <p className={`${colors.muted} mb-2 text-xs`}><Tr s={"Horas libres el"} />{" "}{longDay(selected.date)}</p>
          <div role="radiogroup" aria-label={`Horas libres el ${longDay(selected.date)}`} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selected.slots.map((s) => {
              const on = value === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(s.start)}
                  className="h-11 rounded-xl border text-sm font-medium tabular-nums transition"
                  style={on ? colors.timeOn : colors.line}
                >
                  <Tr s={s.label} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {zoneFooter}
      {chosen && byDate.size > 0 && [...byDate.values()].some((d) => d.slots.some((s) => s.start === value)) && (
        <p className="mt-3 text-sm font-medium" aria-live="polite">
          {capitalize(formatInTz(chosen, tz, { weekday: "long", day: "numeric", month: "long" }))}, {timeInTz(chosen, tz)}
          {viewer === "client" ? t(" (tu hora)") : ` (hora de ${tzCity(tz)})`}
          {!sameOffset(tz, owner, chosen) && (
            <span className={colors.muted}>
              {" "}
              · {timeInTz(chosen, owner)}{" "}<Tr s={"en"} />{" "}{tzCity(owner)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
