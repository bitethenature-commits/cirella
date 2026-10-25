"use client";
import Link from "next/link";
import { Ban, ChevronLeft, ChevronRight, Clock, Loader2, NotebookPen, Sparkles, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { CalendarMonth, DayData } from "@/lib/calendar-diary";
import { ALL_VISIBLE, ASTRO_GROUPS, ASTRO_GROUP_ES, ASTRO_GROUP_HINT, dayMarks, lineVisible, parseVisible, serializeVisible, type Visible } from "@/lib/calendar-marks";
import type { AstroLine } from "@/lib/owner-calendar";
import { saveCalendarNote } from "./calendar-actions";

/**
 * Calendario del mes en Reservas: cada día con sus marcas (sesiones, talleres, nota, lunas, eclipses,
 * conjunciones, estaciones y bloqueos) y, al tocarlo, su hoja: agenda, diario y cielo. En el móvil la
 * hoja sale desde abajo (<dialog> nativo) y en el ordenador, centrada.
 *
 * «Qué mostrar» (planetas, Luna, asteroides, puntos) se guarda en este navegador y filtra las marcas
 * del mes y el cielo del día. Las conjunciones de la Luna y las estaciones de los asteroides no
 * marcan el mes (serían casi a diario): solo salen en el día.
 */
const SHOW_KEY = "cirella:calendario-mostrar";
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAYS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const dayTitle = (key: string) => {
  const s = new Date(`${key}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Notes = Record<string, { body: string; updatedAt: string } | null>;

/** Lo que dice el lector de pantalla de un día: «lunes 26 de octubre: 2 sesiones, luna llena, nota». */
function dayLabel(d: DayData, hasNote: boolean, v: Visible) {
  const marks = dayMarks(d.astro.lines, v);
  const bits: string[] = [];
  if (d.bookings.length) bits.push(plural(d.bookings.length, "sesión", "sesiones"));
  if (d.workshops.length) bits.push(plural(d.workshops.length, "taller", "talleres"));
  if (hasNote) bits.push("nota");
  if (marks.newMoon) bits.push("luna nueva");
  if (marks.fullMoon) bits.push("luna llena");
  if (marks.eclipse) bits.push("eclipse");
  if (marks.conjunctions) bits.push(plural(marks.conjunctions, "conjunción", "conjunciones"));
  if (marks.stations) bits.push(plural(marks.stations, "estación", "estaciones"));
  if (d.blocked) bits.push("día bloqueado");
  else if (d.blockedHours.length) bits.push("horas bloqueadas");
  if (d.special.length) bits.push("fecha especial");
  const [y, m, day] = d.key.split("-").map(Number);
  const wd = WEEKDAYS_LONG[(new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7];
  const date = new Date(`${d.key}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${wd} ${date}${bits.length ? `: ${bits.join(", ")}` : ""}`;
}

export function OwnerCalendar({
  data,
  title,
  todayKey,
  prevHref,
  nextHref,
  todayHref,
  showToday,
  initialDay,
  tzLabel,
}: {
  data: CalendarMonth;
  title: string;
  todayKey: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  showToday: boolean;
  initialDay: string | null;
  tzLabel: string;
}) {
  const [notes, setNotes] = useState<Notes>(() => Object.fromEntries(data.days.map((d) => [d.key, d.note])));
  const [open, setOpen] = useState<string | null>(initialDay && data.days.some((d) => d.key === initialDay) ? initialDay : null);

  const [visible, setVisible] = useState<Visible>(ALL_VISIBLE);
  useEffect(() => {
    try {
      setVisible(parseVisible(localStorage.getItem(SHOW_KEY)));
    } catch {
      /* sin almacenamiento: todo a la vista */
    }
  }, []);
  const toggle = (g: keyof Visible) =>
    setVisible((v) => {
      const next = { ...v, [g]: !v[g] };
      try {
        localStorage.setItem(SHOW_KEY, serializeVisible(next));
      } catch {
        /* sin almacenamiento: solo esta vez */
      }
      return next;
    });

  const day = open ? data.days.find((d) => d.key === open) ?? null : null;
  const idx = day ? data.days.indexOf(day) : -1;

  return (
    <section id="calendario" className="scroll-mt-20" aria-label="Calendario">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="display mr-auto text-[1.6rem] leading-none">{title}</h2>
        <Link href={prevHref} scroll={false} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:bg-sand" aria-label="Mes anterior">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        {/* «Hoy»: en otro mes lleva al actual; en el actual abre el día de hoy. */}
        {showToday ? (
          <Link href={todayHref} scroll={false} className="btn btn-outline btn-sm h-11">
            Hoy
          </Link>
        ) : (
          <button type="button" onClick={() => setOpen(todayKey)} className="btn btn-outline btn-sm h-11">
            Hoy
          </button>
        )}
        <Link href={nextHref} scroll={false} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:bg-sand" aria-label="Mes siguiente">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Qué mostrar">
        <span className="mr-1 text-xs font-semibold text-muted">Qué mostrar</span>
        {ASTRO_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={visible[g]}
            title={ASTRO_GROUP_HINT[g]}
            onClick={() => toggle(g)}
            className={`h-9 rounded-full border px-3 text-xs font-semibold ${visible[g] ? "border-ink bg-ink text-cream" : "border-line bg-white text-muted line-through"}`}
          >
            {ASTRO_GROUP_ES[g]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="grid grid-cols-7 border-b border-line bg-paper text-center text-[0.68rem] font-semibold uppercase tracking-wider text-muted" aria-hidden>
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1.5">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {data.days.map((d, i) => {
            const hasNote = !!notes[d.key];
            const isToday = d.key === todayKey;
            const m = dayMarks(d.astro.lines, visible);
            return (
              <button
                key={d.key}
                type="button"
                data-day={d.key}
                onClick={() => setOpen(d.key)}
                aria-label={dayLabel(d, hasNote, visible)}
                className={`relative flex min-h-[4.25rem] min-w-0 flex-col items-stretch gap-0.5 border-line p-1 text-left hover:bg-sand/60 focus-visible:z-10 sm:min-h-[5.5rem] sm:p-1.5 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${
                  d.inMonth ? "" : "bg-paper/70 text-faint"
                } ${d.blocked ? "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(14_16_36/0.05)_6px_8px)]" : ""}`}
              >
                <span className="flex items-center justify-between gap-0.5">
                  <span className={`grid h-6 min-w-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${isToday ? "bg-ink text-cream" : ""}`}>{Number(d.key.slice(8))}</span>
                  <span className="text-[0.8rem] leading-none" aria-hidden>
                    {m.newMoon ? "🌑" : m.fullMoon ? "🌕" : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[0.66rem] leading-none" aria-hidden>
                  {d.bookings.length > 0 && <span className="rounded-full bg-lavender-deep px-1.5 py-0.5 font-semibold text-white tabular-nums">{d.bookings.length}</span>}
                  {d.workshops.length > 0 && <Users className="h-3 w-3 text-lavender-deep" />}
                  {hasNote && <NotebookPen className="h-3 w-3 text-gold" />}
                  {m.eclipse && <span className="font-semibold text-rose">ECL</span>}
                  {m.conjunctions > 0 && <span className="font-semibold text-ink-3">☌{m.conjunctions > 1 ? m.conjunctions : ""}</span>}
                  {m.stations > 0 && <span className="font-semibold text-rose">℞</span>}
                  {(d.blocked || d.blockedHours.length > 0) && <Ban className="h-3 w-3 text-muted" />}
                  {d.special.length > 0 && <Clock className="h-3 w-3 text-sage" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Leyenda">
        <li className="flex items-center gap-1.5"><span className="rounded-full bg-lavender-deep px-1.5 text-[0.66rem] font-semibold text-white">2</span> Sesiones</li>
        <li className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-lavender-deep" /> Taller</li>
        <li className="flex items-center gap-1.5"><NotebookPen className="h-3.5 w-3.5 text-gold" /> Tu nota</li>
        <li className="flex items-center gap-1.5"><span aria-hidden>🌑</span> Luna nueva</li>
        <li className="flex items-center gap-1.5"><span aria-hidden>🌕</span> Luna llena</li>
        <li className="flex items-center gap-1.5"><span className="font-semibold text-rose">ECL</span> Eclipse</li>
        <li className="flex items-center gap-1.5"><span className="font-semibold text-ink-3">☌</span> Conjunción</li>
        <li className="flex items-center gap-1.5"><span className="font-semibold text-rose">℞</span> Se pone retrógrado o directo</li>
        <li className="flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Bloqueado</li>
        <li className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-sage" /> Fecha especial</li>
      </ul>
      <p className="mt-1.5 text-xs text-faint">
        Horas en tu zona ({tzLabel}). Toca un día para ver todo y escribir tu nota. Las conjunciones de la Luna y las estaciones de los
        asteroides solo salen al abrir el día.
      </p>

      {day && (
        <DaySheet
          key={day.key}
          day={day}
          note={notes[day.key] ?? null}
          visible={visible}
          onSaved={(n) => setNotes((x) => ({ ...x, [day.key]: n }))}
          onClose={() => setOpen(null)}
          onPrev={idx > 0 ? () => setOpen(data.days[idx - 1].key) : null}
          onNext={idx >= 0 && idx < data.days.length - 1 ? () => setOpen(data.days[idx + 1].key) : null}
        />
      )}
    </section>
  );
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function DaySheet({
  day,
  note,
  visible,
  onSaved,
  onClose,
  onPrev,
  onNext,
}: {
  day: DayData;
  note: { body: string; updatedAt: string } | null;
  visible: Visible;
  onSaved: (n: { body: string; updatedAt: string } | null) => void;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(note?.body ?? "");
  const [state, setState] = useState<SaveState>(note ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(!!note);
  const saved = useRef(note?.body ?? "");
  const latest = useRef(text);
  latest.current = text;
  const savedCb = useRef(onSaved);
  savedCb.current = onSaved;

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const save = useCallback(async () => {
    const body = latest.current;
    if (body === saved.current) return;
    setState("saving");
    const r = await saveCalendarNote(day.key, body);
    if (!r.ok) {
      setState("error");
      setError(r.error);
      return;
    }
    saved.current = body;
    setError(null);
    savedCb.current(r.savedAt ? { body, updatedAt: r.savedAt } : null);
    setState(latest.current === body ? "saved" : "dirty");
  }, [day.key]);

  // Se guarda sola 1,2 s después de dejar de escribir (y al cerrar la hoja o cambiar de día).
  useEffect(() => {
    if (text === saved.current) {
      setState((s) => (s === "dirty" ? (saved.current ? "saved" : "idle") : s));
      return;
    }
    setState("dirty");
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [text, save]);
  useEffect(() => () => void save(), [save]);

  const close = () => dialog.current?.close();
  const lines = day.astro.lines.filter((l) => lineVisible(l, visible));
  const positions = day.astro.positions.filter((p) => visible[p.group]);
  // Retrógrados (sin los nodos medios, que siempre lo van).
  const retro = positions.filter((p) => p.retro && p.body !== "Node" && p.body !== "SouthNode").map((p) => `${p.name} ℞`);
  const agendaEmpty = !day.bookings.length && !day.workshops.length && !day.blocked && !day.blockedHours.length && !day.special.length;

  return (
    <dialog
      ref={dialog}
      aria-label={dayTitle(day.key)}
      data-day-sheet={day.key}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92svh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-paper p-0 pb-[env(safe-area-inset-bottom)] text-ink shadow-lift backdrop:bg-ink/40 lg:inset-0 lg:m-auto lg:max-h-[88vh] lg:max-w-2xl lg:rounded-3xl lg:pb-0"
    >
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-line bg-paper/95 px-3 py-2 backdrop-blur">
        <button type="button" disabled={!onPrev} onClick={() => onPrev?.()} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand disabled:opacity-30" aria-label="Día anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-center font-semibold">{dayTitle(day.key)}</h2>
        <button type="button" disabled={!onNext} onClick={() => onNext?.()} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand disabled:opacity-30" aria-label="Día siguiente">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        <section aria-label="Tu agenda">
          <h3 className="eyebrow mb-2 !text-ink">Tu agenda</h3>
          {agendaEmpty && <p className="text-sm text-muted">Nada en tu agenda este día.</p>}
          <ul className="space-y-1.5">
            {day.bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/panel/reservas/${b.id}`} className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2 text-sm hover:bg-sand/50">
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{b.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.client}</span>
                    <span className="block truncate text-xs text-muted">{b.product}{b.status === "COMPLETED" ? " · Completada" : ""}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-faint" />
                </Link>
              </li>
            ))}
            {day.workshops.map((w) => (
              <li key={w.productId}>
                <Link href={`/panel/productos/${w.productId}#asistentes`} className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2 text-sm hover:bg-sand/50">
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{w.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">Taller · {w.title}</span>
                    <span className="block text-xs text-muted">{w.seats}{w.capacity != null ? `/${w.capacity}` : ""} plazas</span>
                  </span>
                  <Users className="h-4 w-4 text-faint" />
                </Link>
              </li>
            ))}
            {day.blocked && (
              <li className="flex items-center gap-2 text-sm text-muted"><Ban className="h-4 w-4" /> Día bloqueado{day.blocked.reason ? ` · ${day.blocked.reason}` : ""}</li>
            )}
            {day.blockedHours.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-muted"><Ban className="h-4 w-4" /> Bloqueado {h}</li>
            ))}
            {day.special.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-muted"><Clock className="h-4 w-4 text-sage" /> Fecha especial: trabajas {h}</li>
            ))}
          </ul>
        </section>

        <section aria-label="Tu diario">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="eyebrow mr-auto !text-ink">Tu diario</h3>
            <span className="text-xs text-muted" role="status" aria-live="polite">
              {state === "saving" ? "Guardando…" : state === "saved" ? "Guardado" : state === "dirty" ? "Sin guardar" : ""}
            </span>
          </div>
          {writing ? (
            <>
              <RichTextEditor
                ariaLabel="Nota del día"
                value={text}
                onChange={setText}
                tools="basic"
                headings
                preview={false}
                tone="account"
                headingLevel={4}
                legacy="paragraphs"
                placeholder="Lo que quieras recordar de este día: intenciones, una tirada, cómo te has sentido…"
                rows={5}
                maxLength={20_000}
              />
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => void save()} disabled={state === "saving" || text === saved.current} className="btn btn-primary btn-sm h-11">
                  {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
                </button>
                {error && <p className="text-sm text-rose">{error}</p>}
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setWriting(true)} className="btn btn-outline h-11 w-full justify-center">
              <NotebookPen className="h-4 w-4" /> Escribir una nota
            </button>
          )}
        </section>

        <section aria-label="El cielo">
          <h3 className="eyebrow mb-2 !text-ink">El cielo</h3>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <AstroItem key={i} line={l} />
            ))}
            {visible.moon && (
              <li className="rounded-2xl border border-line bg-white px-3 py-2 text-sm">
                <span className="block text-[0.68rem] font-semibold uppercase tracking-wider text-muted">La Luna</span>
                {day.astro.moon.enters
                  ? `Luna en ${day.astro.moon.sign} hasta las ${day.astro.moon.enters.time}; después, en ${day.astro.moon.enters.sign}`
                  : `Luna en ${day.astro.moon.sign}`}
              </li>
            )}
          </ul>
          {lines.length === 0 && !visible.moon && <p className="text-sm text-muted">Nada que mostrar con lo que tienes elegido en «Qué mostrar».</p>}
          <p className="mt-3 text-sm">
            <span className="font-semibold">Retrógrados hoy: </span>
            {retro.length ? retro.join(", ") : "ninguno"}
          </p>
          <details className="mt-3 rounded-2xl border border-line bg-white" open>
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-lavender-deep" /> Hoy en el cielo <span className="font-normal text-muted">(a las 12:00)</span>
            </summary>
            <ul className="grid gap-x-4 gap-y-1 px-3 pb-3 text-sm sm:grid-cols-2">
              {positions.map((p) => (
                <li key={p.body}>
                  <span className="font-medium">{p.name}{p.retro ? " ℞" : ""}</span> en {p.where}
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>
    </dialog>
  );
}

function AstroItem({ line }: { line: AstroLine }) {
  const icon = line.kind === "moon" ? (line.detail === "new" ? "🌑" : "🌕") : line.kind === "eclipse" ? "◐" : line.kind === "station" ? "℞" : "☌";
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-line bg-white px-3 py-2 text-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-base" aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{line.label}</span>
        <span className="block">
          {line.text}
          {" "}<span className="text-muted">· {line.time}</span>
        </span>
      </span>
    </li>
  );
}
