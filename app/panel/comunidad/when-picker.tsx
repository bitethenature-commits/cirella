"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

export type PickerMoon = { title: string; date: string; time: string };

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Los días van como «2026-11-15» y se cuentan en UTC: así no les afecta la zona del ordenador.
const toDate = (key: string) => new Date(`${key}T00:00:00Z`);
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (key: string, n: number) => toKey(new Date(toDate(key).getTime() + n * 86_400_000));
const weekday = (key: string) => toDate(key).getUTCDay();
const pretty = (key: string) => {
  const d = toDate(key);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
};

/**
 * Cuándo sale una publicación programada: un calendario en negro y oro (con las lunas marcadas) y la hora
 * que ella quiera. Escribe en `name` «AAAA-MM-DDTHH:MM» (hora de la dueña).
 */
export function WhenPicker({
  name,
  value,
  onChange,
  minAt,
  moonDates,
  cityLabel,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  /** Ahora, en la zona de la dueña («AAAA-MM-DDTHH:MM»). */
  minAt: string;
  moonDates: PickerMoon[];
  cityLabel: string;
}) {
  const today = minAt.slice(0, 10);
  const day = value.slice(0, 10) || "";
  const time = value.slice(11, 16) || "";
  const [month, setMonth] = useState(() => (day || today).slice(0, 7));
  const set = (d: string, t: string) => onChange(d ? `${d}T${t}` : "");
  const moonOn = useMemo(() => new Map(moonDates.map((m) => [m.date, m])), [moonDates]);

  const first = `${month}-01`;
  const start = addDays(first, -((weekday(first) + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = cells.slice(35).every((k) => !k.startsWith(month)) ? cells.slice(0, 35) : cells;
  const shift = (n: number) => {
    const d = toDate(first);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(toKey(d).slice(0, 7));
  };
  const [y, m] = month.split("-").map(Number);
  const canBack = month > today.slice(0, 7);

  return (
    <div className="when-picker grid gap-5 sm:grid-cols-[minmax(0,19rem)_1fr] sm:items-start">
      <input type="hidden" name={name} value={day && /^\d{2}:\d{2}$/.test(time) ? `${day}T${time}` : ""} />

      <div className="rounded-[1.6rem] border border-[#d4b57a]/35 bg-[#0b0a1c] p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/.9)]">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} disabled={!canBack} className="grid h-9 w-9 place-items-center rounded-full text-[#d4b57a] hover:bg-[#d4b57a]/10 disabled:opacity-25" aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="display text-[1.35rem] font-light capitalize text-[#f1ebdf]">
            {MONTHS[m - 1]} <span className="text-[#d4b57a]">{y}</span>
          </p>
          <button type="button" onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-full text-[#d4b57a] hover:bg-[#d4b57a]/10" aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span aria-hidden className="mb-2 block h-px bg-gradient-to-r from-transparent via-[#d4b57a]/50 to-transparent" />
        <div className="grid grid-cols-7 text-center text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[#d4b57a]/70" aria-hidden>
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1.5">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.map((k) => {
            const inMonth = k.startsWith(month);
            const moon = moonOn.get(k);
            const on = k === day;
            return (
              <button
                key={k}
                type="button"
                disabled={k < today}
                onClick={() => set(k, time || "09:00")}
                aria-pressed={on}
                aria-label={`${pretty(k)}${moon ? ` · ${moon.title}` : ""}`}
                title={moon?.title}
                className={`relative grid aspect-square place-items-center rounded-full font-serif text-[0.98rem] tabular-nums transition disabled:opacity-20 ${
                  on
                    ? "bg-gradient-to-br from-[#f7e5b8] to-[#c9a45f] font-semibold text-[#2a1e0c] shadow-[0_0_18px_rgb(212_181_122/.55)]"
                    : k === today
                      ? "text-[#f0d9a4] ring-1 ring-[#d4b57a]/60"
                      : "text-[#f1ebdf]/85 hover:bg-[#d4b57a]/12 hover:text-[#f0d9a4]"
                } ${inMonth ? "" : "opacity-35"}`}
              >
                {Number(k.slice(8))}
                {moon && <span className="absolute -bottom-0.5 text-[0.55rem] leading-none" aria-hidden>{moon.title.startsWith("Eclipse") ? "🌘" : moon.title.startsWith("Luna nueva") ? "🌑" : "🌕"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[#d4b57a]">
            <Clock className="h-3.5 w-3.5" /> La hora
          </span>
          <input
            type="time"
            value={time}
            disabled={!day}
            onChange={(e) => set(day, e.target.value)}
            aria-label="Hora"
            className="mt-2 h-14 w-full max-w-[11rem] rounded-2xl border border-[#d4b57a]/40 bg-[#0b0a1c] px-4 font-serif text-[1.6rem] text-[#f1ebdf] outline-none transition [color-scheme:dark] focus:border-[#d4b57a] disabled:opacity-40"
          />
        </label>
        <p className="rounded-2xl border border-[#d4b57a]/20 bg-[#d4b57a]/[.06] px-4 py-3 text-sm text-[#f1ebdf]/85" aria-live="polite">
          {day && time ? (
            <>
              Saldrá el <strong className="font-semibold text-[#f0d9a4]">{pretty(day)}</strong> a las <strong className="font-semibold text-[#f0d9a4]">{time}</strong>
              <span className="mt-0.5 block text-xs text-[#a7a2c2]">Hora de {cityLabel}. Hasta entonces, nadie más la ve.</span>
            </>
          ) : (
            <span className="text-[#a7a2c2]">Elige el día en el calendario y luego la hora.</span>
          )}
        </p>
      </div>
    </div>
  );
}
