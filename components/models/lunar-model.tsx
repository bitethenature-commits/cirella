"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Apsis, LunarDay, Lunation, NatalMoon } from "@/lib/lunar-sky";
import { addDaysToKey, dateKeyInTz, formatInTz, timeInTz, zonedTimeToUtc } from "@/lib/tz";
import type { BirthData } from "./chart-birth-form";
import { loadCities, searchCities, toPlace, type CityIndex, type Place } from "./cities";
import { BODY_INFO, ELEMENT_HUE, SIGNS, bodyInSignText } from "./data/astrology";
import { EIGHT_PHASES, FULL_MOON_IN_SIGN, MOON_IN_SIGN, NATAL_PHASE, NEW_MOON_IN_SIGN, PHASE_GUIDANCE, meanMoonLongitude, meanSunLongitude, moonPhase, phaseName, type MoonPhaseName } from "./data/moon";
import { MoonDisc } from "./moon-disc";
import { GOLD, INK, ModelFrame, PanelBody, PanelHeading, PanelRow, RangeField, ToolButton, cn, usePrefersReducedMotion } from "./model-kit";

/**
 * El ciclo lunar: la geometría Sol–Tierra–Luna dentro del zodiaco, el instante elegido explicado, el mes
 * día a día, el año lunar (con su .ics), la Luna natal y la salida y puesta de la Luna.
 *
 *   · Arriba, vista desde el norte de la eclíptica: el Sol siempre a la izquierda, la Tierra en el
 *     centro y la Luna en su órbita; alrededor, el zodiaco girado para que el Sol quede en su grado. La
 *     Luna apunta a su grado real. El deslizador recorre la lunación en curso (de luna nueva a luna
 *     nueva) buscando el instante de cada elongación; el calendario y los botones mueven el instante.
 *   · Las horas son de España (Europe/Madrid, peninsular) salvo la salida y puesta, que van en la hora
 *     de la ciudad elegida.
 *   · El cielo exacto (lib/lunar-sky.ts: astronomy-engine y las tablas) se carga aparte; mientras
 *     llega, una aproximación sinódica (data/moon.ts). El formulario de nacimiento, también aparte.
 *   · Superluna: luna nueva o llena con d ≤ perigeo + 10 % (apogeo − perigeo) de esa vuelta (Nolle);
 *     ver lib/lunar-sky.ts. Nada se guarda ni se envía: el .ics se genera en el navegador.
 */

type SkyLib = typeof import("@/lib/lunar-sky");
const BirthForm = lazy(() => import("./chart-birth-form").then((m) => ({ default: m.BirthForm })));

const TZ = "Europe/Madrid";
const SYNODIC = 29.530588853;
const DAY = 86_400_000;
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MADRID: Place = { label: "Madrid", detail: "Comunidad de Madrid, España", lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid" };
const ECLIPSE_ES = { penumbral: "penumbral", partial: "parcial", annular: "anular", total: "total" } as const;
const KM = new Intl.NumberFormat("es-ES");
const DEC1 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Los glifos como texto (sin esto, iOS los pinta como emoji). */
const glyph = (g: string) => `${g}︎`;
const norm = (x: number) => ((x % 360) + 360) % 360;
const signOf = (lon: number) => Math.floor(norm(lon) / 30) % 12;
const pad2 = (n: number) => String(n).padStart(2, "0");
/** «Géminis 12°04′» (grados y minutos truncados, como en las efemérides). */
const fmtLon = (lon: number) => {
  const total = Math.floor(norm(lon) * 60 + 1e-6);
  const inSign = total % 1800;
  return `${SIGNS[Math.floor(total / 1800) % 12].name} ${Math.floor(inSign / 60)}°${pad2(inSign % 60)}′`;
};
const degIn = (lon: number) => `${Math.floor(norm(lon) % 30)}°`;
const phaseOf = (k: number) => EIGHT_PHASES[k];
const shortDate = (d: Date, tz = TZ) => formatInTz(d, tz, { weekday: "short", day: "numeric", month: "short" });
const when = (d: Date, tz = TZ) => `${shortDate(d, tz)} · ${timeInTz(d, tz)}`;
const longDay = (d: Date) => formatInTz(d, TZ, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const eclipseText = (e: { body: "solar" | "lunar"; type: keyof typeof ECLIPSE_ES }) => `Eclipse ${e.body} ${ECLIPSE_ES[e.type]}`;

/* -------------------------------------------------------------------------- *
 *  El cielo: exacto (cuando ha cargado) o medio
 * -------------------------------------------------------------------------- */

interface SkyState {
  elong: number;
  illum: number;
  moonLon: number;
  sunLon: number;
  distKm: number | null;
}

const meanState = (at: Date): SkyState => {
  const p = moonPhase(at);
  return { elong: p.phase * 360, illum: p.illumination, moonLon: meanMoonLongitude(at), sunLon: meanSunLongitude(at), distKm: null };
};
const stateOf = (lib: SkyLib | null, at: Date): SkyState => (lib ? lib.moonState(at) : meanState(at));
const startOf = (lib: SkyLib | null, at: Date) => (lib ? lib.lunationStart(at) : new Date(at.getTime() - moonPhase(at).phase * SYNODIC * DAY));
const timeAt = (lib: SkyLib | null, elong: number, start: Date) => (lib ? lib.timeAtElongation(elong, start) : new Date(start.getTime() + (norm(elong) / 360) * SYNODIC * DAY));

/** El mes sin efemérides: solo la fase y el signo medios de cada mediodía. */
function meanMonth(y: number, m: number): LunarDay[] {
  const first = `${y}-${pad2(m)}-01`;
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => {
    const key = addDaysToKey(first, i);
    const noon = zonedTimeToUtc(key, 720, TZ);
    return {
      key,
      start: zonedTimeToUtc(key, 0, TZ),
      end: zonedTimeToUtc(addDaysToKey(key, 1), 0, TZ),
      elong: moonPhase(noon).phase * 360,
      sign: signOf(meanMoonLongitude(noon)),
      ingresses: [],
      lunations: [],
      apsides: [],
    };
  });
}

/** Signos por los que pasa la Luna ese día. */
const daySigns = (d: LunarDay) => (d.ingresses.length ? [(d.ingresses[0].sign + 11) % 12, ...d.ingresses.map((i) => i.sign)] : [d.sign]);

/* -------------------------------------------------------------------------- *
 *  Piezas
 * -------------------------------------------------------------------------- */

function SignGlyph({ n, className }: { n: number; className?: string }) {
  const s = SIGNS[n];
  return (
    <span aria-hidden className={className} style={{ color: ELEMENT_HUE[s.element], filter: "brightness(1.25)" }}>
      {glyph(s.glyph)}
    </span>
  );
}

/** «♉ Tauro 12°04′». */
function SignPos({ lon }: { lon: number }) {
  return (
    <span className="whitespace-nowrap">
      <SignGlyph n={signOf(lon)} /> {fmtLon(lon)}
    </span>
  );
}

function Badge({ children, tone = GOLD }: { children: ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em]" style={{ borderColor: `color-mix(in oklab, ${tone} 45%, transparent)`, color: tone }}>
      {children}
    </span>
  );
}

/** Marca pequeña de eclipse (dos discos que se cruzan). */
function EclipseMark({ size = 9 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="-5 -5 10 10" className="shrink-0">
      <circle r="4" style={{ fill: GOLD }} />
      <circle cx="1.8" cy="-0.6" r="3.6" fill="#16120F" />
    </svg>
  );
}

function SectionTitle({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="cp-eyebrow cp-gold !text-[0.6rem]">{kicker}</p>
        <h4 className="cp-display mt-1 text-[1.4rem] leading-tight">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="cp-line grid h-10 w-10 shrink-0 place-items-center rounded-full border opacity-75 hover:opacity-100">
      {children}
    </button>
  );
}

/** Buscador de ciudad compacto (la lista de GeoNames de la carta natal). */
function CityPicker({ value, onChange }: { value: Place; onChange: (p: Place) => void }) {
  const uid = useId();
  const [index, setIndex] = useState<CityIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const load = () => {
    if (index || failed) return;
    loadCities()
      .then(setIndex)
      .catch(() => setFailed(true));
  };
  const results = useMemo(() => (index && open ? searchCities(index, query, 6) : []), [index, query, open]);
  const choose = (i: number) => {
    if (!index) return;
    onChange(toPlace(index, i));
    setQuery("");
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return setOpen(false);
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active] ?? results[0]);
    }
  };
  const listId = `${uid}-list`;
  return (
    <div className="relative">
      <label htmlFor={`${uid}-q`} className="cp-eyebrow mb-1.5 block !text-[0.6rem]">
        Otra ciudad <span className="normal-case tracking-normal opacity-70">(ahora: {value.label})</span>
      </label>
      <input
        id={`${uid}-q`}
        className="cp-input !h-10 !text-[0.9rem]"
        value={query}
        placeholder={failed ? "Lista no disponible" : "Busca tu ciudad o pueblo"}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onChange={(e) => {
          load();
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results.length ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      {open && index && results.length > 0 && (
        <ul id={listId} role="listbox" className="cp-line absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-[min(var(--r-btn),14px)] border py-1 shadow-xl" style={{ background: "var(--c-bg)" }}>
          {results.map((i, k) => {
            const p = toPlace(index, i);
            return (
              <li
                key={i}
                id={`${listId}-${k}`}
                role="option"
                aria-selected={k === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(k)}
                className={cn("cursor-pointer px-4 py-2 text-[0.88rem] leading-snug", k === active && "bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]")}
              >
                {p.label}
                <span className="cp-muted block text-[0.72rem]">{p.detail}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 *  El modelo
 * -------------------------------------------------------------------------- */

export function LunarModel() {
  const now = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKeyInTz(now, TZ), [now]);
  const [lib, setLib] = useState<SkyLib | null>(null);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(now);
  /** Lunación fija mientras se arrastra el deslizador (si no, la del instante). */
  const [held, setHeld] = useState<Date | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(() => ({ y: Number(todayKey.slice(0, 4)), m: Number(todayKey.slice(5, 7)) }));
  const [year, setYear] = useState(cursor.y);
  const [city, setCity] = useState<Place>(MADRID);
  const [natal, setNatal] = useState<{ birth: BirthData; moon: NatalMoon } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [icsMode, setIcsMode] = useState<"timed" | "allday">("timed");
  const [years, setYears] = useState<Record<number, Lunation[]>>({});
  const raf = useRef(0);
  const monthCache = useRef(new Map<string, LunarDay[]>());
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    let alive = true;
    import("@/lib/lunar-sky")
      .then((m) => alive && setLib(m))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  /** Mueve el instante (y el calendario a su mes). */
  const setMoment = (d: Date) => {
    setPlaying(false);
    setHeld(null);
    setAt(d);
    const key = dateKeyInTz(d, TZ);
    setCursor({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) });
  };

  // Recorrido automático: una lunación en unos doce segundos (sin él si se prefiere menos movimiento).
  useEffect(() => {
    if (!playing || reduced) return;
    setHeld(null);
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      setAt((d) => new Date(d.getTime() + (dt / 12) * SYNODIC * DAY));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, reduced]);

  // Mientras corre, el calendario sigue al instante.
  const dayKey = dateKeyInTz(at, TZ);
  useEffect(() => {
    if (!playing) return;
    setCursor({ y: Number(dayKey.slice(0, 4)), m: Number(dayKey.slice(5, 7)) });
  }, [playing, dayKey]);

  /* ------------------------------------------------------------ el instante */

  const st = useMemo(() => stateOf(lib, at), [lib, at]);
  const anchor = useMemo(() => held ?? startOf(lib, at), [held, lib, at]);
  const name = phaseName(st.elong / 360);
  const guidance = PHASE_GUIDANCE[name];
  const age = (at.getTime() - anchor.getTime()) / DAY;
  const moonSign = signOf(st.moonLon);
  const sunSign = signOf(st.sunLon);

  const nextMain = useMemo(() => (lib ? lib.nextMainLunation(at) : null), [lib, at]);
  /** La lunación de esta vuelta: la nueva que la abrió y la llena que le toca. */
  const cycle = useMemo(() => {
    const full = timeAt(lib, 180, anchor);
    return { newAt: anchor, newLon: stateOf(lib, anchor).moonLon, fullAt: full, fullLon: stateOf(lib, full).moonLon };
  }, [lib, anchor]);
  /** Lo que depende del día (más caro): la luna nueva o llena cercana con superluna y eclipse, el próximo ápside y el próximo eclipse. */
  const around = useMemo(() => {
    if (!lib) return null;
    const mid = zonedTimeToUtc(dayKey, 720, TZ);
    const syzygy = lib.lunationsBetween(new Date(mid.getTime() - 1.6 * DAY), new Date(mid.getTime() + 1.6 * DAY), "syzygy")[0] ?? null;
    const aps = lib.apsidesBetween(new Date(mid.getTime() - 14 * DAY), new Date(mid.getTime() + 16 * DAY));
    const nextAps = aps.find((a) => a.at.getTime() > mid.getTime()) ?? null;
    const prevAps = [...aps].reverse().find((a) => a.at.getTime() <= mid.getTime()) ?? null;
    return { syzygy, nextAps, prevAps, eclipse: lib.nextEclipse(new Date(mid.getTime() - 1.6 * DAY)) };
  }, [lib, dayKey]);

  /* ----------------------------------------------------------- el mes */

  const month = useMemo(() => {
    const key = `${cursor.y}-${cursor.m}-${lib ? "x" : "m"}`;
    let hit = monthCache.current.get(key);
    if (!hit) {
      hit = lib ? lib.lunarMonth(cursor.y, cursor.m, TZ) : meanMonth(cursor.y, cursor.m);
      monthCache.current.set(key, hit);
    }
    return hit;
  }, [cursor, lib]);
  const leading = (new Date(Date.UTC(cursor.y, cursor.m - 1, 1)).getUTCDay() + 6) % 7;
  const step = (delta: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });

  const natalSign = natal ? signOf(natal.moon.moonLon) : null;
  const returns = useMemo(() => {
    if (!lib || !natal || !month.length) return new Map<string, Date>();
    const out = new Map<string, Date>();
    for (const r of lib.lunarReturnsBetween(natal.moon.moonLon, month[0].start, month[month.length - 1].end)) out.set(dateKeyInTz(r, TZ), r);
    return out;
  }, [lib, natal, month]);

  const selectedDay = month.find((d) => d.key === dayKey) ?? null;
  const riseSet = useMemo(() => {
    if (!lib) return null;
    try {
      const b = lib.dayBounds(zonedTimeToUtc(dayKey, 720, TZ), city.tz);
      return { ...lib.moonRiseSet(b.start, b.end, city.lat, city.lon), key: b.key };
    } catch {
      return null;
    }
  }, [lib, dayKey, city]);

  const pickDay = (d: LunarDay) => setMoment(d.key === todayKey ? new Date() : zonedTimeToUtc(d.key, 720, TZ));
  const gridRef = useRef<HTMLDivElement>(null);
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    const buttons = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>("button[data-day]") ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const next = buttons[i + delta];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  /* ----------------------------------------------------------- el año */

  useEffect(() => {
    if (!lib || years[year]) return;
    const id = window.setTimeout(() => setYears((y) => ({ ...y, [year]: lib.lunarYear(year, TZ) })), 30);
    return () => window.clearTimeout(id);
  }, [lib, year, years]);
  const yearList = years[year];

  const downloadIcs = () => {
    if (!lib || !yearList) return;
    const events = yearList.map((l) => {
      const s = signOf(l.moonLon);
      const full = l.k === 4;
      const marks = [l.supermoon ? "superluna" : "", l.eclipse ? eclipseText(l.eclipse).toLowerCase() : ""].filter(Boolean);
      const axis = full ? ` (eje ${SIGNS[s].name}–${SIGNS[(s + 6) % 12].name})` : "";
      return {
        uid: `luna-${l.at.toISOString().replace(/[-:]/g, "").slice(0, 13)}@cirella`,
        at: l.at,
        summary: `${full ? "Luna llena" : "Luna nueva"} en ${fmtLon(l.moonLon)}${marks.length ? ` · ${marks.join(" · ")}` : ""}`,
        description: `Hora exacta en España: ${timeInTz(l.at, TZ)}${axis}.\n${full ? FULL_MOON_IN_SIGN[s] : NEW_MOON_IN_SIGN[s]}`,
      };
    });
    const text = lib.buildLunarIcs(events, { mode: icsMode, name: `Año lunar ${year}` });
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lunas-${year}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ----------------------------------------------------------- la Luna natal */

  const submitBirth = async (birth: BirthData) => {
    const m = lib ?? (await import("@/lib/lunar-sky"));
    setNatal({ birth, moon: m.natalMoon({ date: birth.date, time: birth.time, timeKnown: birth.timeKnown, tz: birth.place.tz }) });
    setFormOpen(false);
  };

  /* ---------------------------------------------------------------- geometría */

  // Vista desde el norte de la eclíptica (las longitudes crecen en sentido contrario a las agujas del
  // reloj); el Sol siempre a la izquierda: la longitud L va al ángulo de pantalla 180° − (L − Sol).
  const R_ORBIT = 50;
  const R_IN = 70;
  const R_OUT = 87;
  const scr = (lon: number) => ((180 - (lon - st.sunLon)) * Math.PI) / 180;
  const pt = (r: number, lon: number) => ({ x: r * Math.cos(scr(lon)), y: r * Math.sin(scr(lon)) });
  const moonPos = pt(R_ORBIT, st.moonLon);
  const sector = (n: number) => {
    const a0 = pt(R_OUT, n * 30);
    const a1 = pt(R_OUT, n * 30 + 30);
    const b1 = pt(R_IN, n * 30 + 30);
    const b0 = pt(R_IN, n * 30);
    // Longitud creciente = ángulo de pantalla decreciente: los arcos de fuera van con sweep 0.
    return `M${a0.x} ${a0.y}A${R_OUT} ${R_OUT} 0 0 0 ${a1.x} ${a1.y}L${b1.x} ${b1.y}A${R_IN} ${R_IN} 0 0 1 ${b0.x} ${b0.y}Z`;
  };
  let ticks = "";
  for (let deg = 0; deg < 360; deg += 5) {
    const a = pt(R_IN, deg);
    const b = pt(R_IN + (deg % 30 === 0 ? 0 : deg % 10 === 0 ? 3 : 1.6), deg);
    if (deg % 30) ticks += `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }
  const moonTip = pt(R_OUT + 2, st.moonLon);
  const moonLabel = pt(R_OUT + 10, st.moonLon);
  const labelAnchor = moonLabel.x < -6 ? "end" : moonLabel.x > 6 ? "start" : "middle";

  const diagram = (
    <div>
      <svg
        viewBox="-142 -106 252 212"
        className="mx-auto block h-auto w-full max-w-[30rem] overflow-visible"
        style={{ color: INK }}
        role="img"
        aria-label={`Sol, Tierra y Luna vistos desde el norte, dentro del zodiaco: ${name}, Luna en ${fmtLon(st.moonLon)}, Sol en ${fmtLon(st.sunLon)}`}
      >
        <defs>
          <radialGradient id="lm-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F7E7A8" />
            <stop offset="60%" stopColor="#E8B23A" />
            <stop offset="100%" stopColor="#C9821C" />
          </radialGradient>
          <radialGradient id="lm-sunglow" cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor="#F3C518" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F3C518" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lm-earth" cx="38%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#7FA9C4" />
            <stop offset="100%" stopColor="#2E4F63" />
          </radialGradient>
          <linearGradient id="lm-rays" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E8B23A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E8B23A" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* La luz del Sol llega siempre desde la izquierda */}
        {[-56, -28, 0, 28, 56].map((y) => (
          <line key={y} x1="-108" y1={y} x2="96" y2={y} stroke="url(#lm-rays)" strokeWidth="0.7" strokeDasharray="3 5" />
        ))}
        <circle cx="-124" cy="0" r="30" fill="url(#lm-sunglow)" />
        <circle cx="-124" cy="0" r="14" fill="url(#lm-sun)" />
        <text x="-124" y="24" textAnchor="middle" fontSize="6" style={{ fill: GOLD }}>
          Sol
        </text>
        <text x="-124" y="32" textAnchor="middle" fontSize="5.2" fill="currentColor" opacity="0.8">
          {degIn(st.sunLon)}
          {glyph(SIGNS[sunSign].glyph)} {SIGNS[sunSign].name}
        </text>

        {/* Zodiaco: coloreado por elemento; resaltado el signo de la Luna */}
        <g>
          {SIGNS.map((s) => {
            const mid = pt((R_IN + R_OUT) / 2, s.n * 30 + 15);
            const on = s.n === moonSign;
            return (
              <g key={s.n}>
                <path d={sector(s.n)} fill={ELEMENT_HUE[s.element]} opacity={on ? 0.42 : 0.14} style={{ transition: "opacity 400ms" }} />
                <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="8.4" fill={ELEMENT_HUE[s.element]} style={{ filter: "brightness(1.3)" }} className="select-none">
                  {glyph(s.glyph)}
                </text>
              </g>
            );
          })}
          {SIGNS.map((s) => {
            const a = pt(R_IN, s.n * 30);
            const b = pt(R_OUT, s.n * 30);
            return <line key={s.n} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: GOLD }} strokeWidth="0.35" opacity="0.55" />;
          })}
          <circle r={R_OUT} fill="none" style={{ stroke: GOLD }} strokeWidth="0.6" opacity="0.7" />
          <circle r={R_IN} fill="none" style={{ stroke: GOLD }} strokeWidth="0.4" opacity="0.5" />
          <path d={ticks} style={{ stroke: GOLD }} strokeWidth="0.3" opacity="0.6" />
        </g>

        {/* El Sol en su grado, sobre el anillo */}
        <path d={`M${-R_OUT - 1} 0l-5 -3v6z`} style={{ fill: GOLD }} opacity="0.9" />

        {/* Órbita y las ocho estaciones */}
        <circle r={R_ORBIT} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="2 4" />
        {EIGHT_PHASES.map((p, k) => {
          const a = ((180 - k * 45) * Math.PI) / 180;
          const near = Math.abs(((st.elong - k * 45 + 540) % 360) - 180) < 8;
          return <circle key={p} cx={R_ORBIT * Math.cos(a)} cy={R_ORBIT * Math.sin(a)} r={near ? 2 : 1.1} style={{ fill: GOLD, transition: "all 400ms" }} opacity={near ? 1 : 0.45} />;
        })}

        {/* Tierra (con su noche hacia la derecha) */}
        <circle r="11" fill="url(#lm-earth)" />
        <path d="M0 -11 a11 11 0 0 1 0 22 z" fill="#0B0908" opacity="0.45" />
        <text y="19" textAnchor="middle" fontSize="5.2" fill="currentColor" opacity="0.75">
          Tierra
        </text>

        {/* La línea de la Luna hasta su grado */}
        <line x1="0" y1="0" x2={moonTip.x} y2={moonTip.y} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="1.5 2" />
        <circle cx={moonTip.x} cy={moonTip.y} r="1.6" fill="#F2EADB" />
        <text x={moonLabel.x} y={moonLabel.y} textAnchor={labelAnchor} dominantBaseline="central" fontSize="5.6" fill="currentColor">
          Luna {degIn(st.moonLon)}
          {glyph(SIGNS[moonSign].glyph)}
        </text>

        {/* La Luna: siempre media iluminada, y la cara iluminada siempre mira al Sol */}
        <g transform={`translate(${moonPos.x} ${moonPos.y})`}>
          <circle r="7" fill="#2A2622" />
          <path d="M0 -7 A7 7 0 0 0 0 7 Z" fill="#F2EADB" />
          <circle r="7" fill="none" style={{ stroke: GOLD }} strokeOpacity="0.6" strokeWidth="0.4" />
        </g>
      </svg>

      {/* Lo que vemos de verdad desde la Tierra */}
      <div className="mt-4 flex flex-col items-center text-center">
        <p className="cp-eyebrow mb-3 !text-[0.6rem]">Visto desde la Tierra</p>
        <MoonDisc phase={st.elong / 360} size={104} />
        <p className="cp-display mt-4 text-[1.25rem] leading-snug">
          Luna en <SignGlyph n={moonSign} /> {SIGNS[moonSign].name} · Sol en <SignGlyph n={sunSign} /> {SIGNS[sunSign].name}
        </p>
        <p className="cp-muted mt-1 text-[0.8rem]">
          {upperFirst(longDay(at))} · {timeInTz(at, TZ)} (hora de España)
        </p>
      </div>

      <div className="mt-5">
        <RangeField
          id="luna-fase"
          label="Mover el ciclo"
          value={Math.min(999, Math.round((st.elong / 360) * 1000))}
          valueText={`Día ${DEC1.format(age)} de la lunación`}
          min={0}
          max={999}
          onChange={(v) => {
            setPlaying(false);
            setHeld(anchor);
            setAt(timeAt(lib, (v / 1000) * 360, anchor));
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <ToolButton onClick={() => setMoment(new Date(at.getTime() - DAY))} title="Un día antes">
            − 1 día
          </ToolButton>
          {!reduced && <ToolButton active={playing} onClick={() => setPlaying((v) => !v)}>{playing ? "Detener" : "Dejar correr el ciclo"}</ToolButton>}
          <ToolButton onClick={() => setMoment(new Date())}>Ahora</ToolButton>
          <ToolButton onClick={() => setMoment(new Date(at.getTime() + DAY))} title="Un día después">
            + 1 día
          </ToolButton>
        </div>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- panel */

  const syz = around?.syzygy;
  const isSuper = !!syz?.supermoon;
  const waxing = st.elong < 180;
  const newSign = signOf(cycle.newLon);
  const fullSign = signOf(cycle.fullLon);
  const distanceNote = (() => {
    if (!around || st.distKm === null) return null;
    const a = around.nextAps;
    if (!a) return null;
    return `${a.kind === "perigee" ? "acercándose al perigeo" : "alejándose hacia el apogeo"}: ${when(a.at)} (${KM.format(Math.round(a.km))} km)`;
  })();

  const panel = (
    <PanelBody id={name}>
      <PanelHeading kicker={`${Math.round(st.illum * 100)} % iluminada · ${waxing ? "creciente" : "menguante"}`} title={name} />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {isSuper && syz && <Badge>Superluna · {syz.k === 0 ? "nueva" : "llena"} del {shortDate(syz.at)}</Badge>}
        {syz?.eclipse && (
          <Badge>
            {eclipseText(syz.eclipse)} · {when(syz.eclipse.at)}
          </Badge>
        )}
      </div>
      <p className="cp-display mt-4 text-[1.3rem] italic leading-snug opacity-85">{guidance.intent}</p>
      <p className="mt-2 text-[0.95rem] leading-relaxed opacity-85">{guidance.practice}</p>

      <div className="cp-line mt-6 rounded-[calc(var(--r-card)*0.7)] border p-5">
        <p className="cp-eyebrow cp-gold">
          La Luna en {SIGNS[moonSign].name} <SignGlyph n={moonSign} />
        </p>
        <p className="mt-3 text-[0.92rem] leading-relaxed opacity-90">{MOON_IN_SIGN[moonSign]}</p>
      </div>

      <dl className="mt-6">
        <PanelRow label="Luna en" value={<SignPos lon={st.moonLon} />} />
        <PanelRow label="Sol en" value={<SignPos lon={st.sunLon} />} />
        <PanelRow label="Iluminación" value={`${Math.round(st.illum * 100)} %`} />
        <PanelRow label="Edad de la Luna" value={`${DEC1.format(age)} días desde la luna nueva`} />
        {nextMain && (
          <PanelRow
            label="Próxima fase exacta"
            value={
              <>
                {phaseOf(nextMain.k)} en <SignPos lon={nextMain.moonLon} />
                <span className="cp-muted block">{when(nextMain.at)}</span>
              </>
            }
          />
        )}
        {st.distKm !== null && (
          <PanelRow
            label="Distancia"
            value={
              <>
                {KM.format(Math.round(st.distKm))} km
                {distanceNote && <span className="cp-muted block">{distanceNote}</span>}
              </>
            }
          />
        )}
        {around?.eclipse && <PanelRow label="Próximo eclipse" value={`${eclipseText(around.eclipse)} · ${when(around.eclipse.at)}`} />}
      </dl>

      {/* La lunación en curso: la nueva que la abrió y su llena */}
      <p className="cp-eyebrow mb-3 mt-7 !text-[0.6rem]">Esta lunación</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { k: 0, at: cycle.newAt, sign: newSign, text: NEW_MOON_IN_SIGN[newSign], title: `Luna nueva en ${SIGNS[newSign].name}`, sub: "Sembrar", on: waxing },
          {
            k: 4,
            at: cycle.fullAt,
            sign: fullSign,
            text: FULL_MOON_IN_SIGN[fullSign],
            title: `Luna llena en ${SIGNS[fullSign].name}`,
            sub: `Eje ${SIGNS[fullSign].name} / ${SIGNS[(fullSign + 6) % 12].name}`,
            on: !waxing,
          },
        ].map((c) => (
          <button
            key={c.k}
            type="button"
            onClick={() => setMoment(c.at)}
            className={cn(
              "rounded-[calc(var(--r-card)*0.6)] border p-4 text-left transition-colors duration-300",
              c.on ? "border-[color-mix(in_oklab,var(--c-gold)_55%,transparent)] bg-[color-mix(in_oklab,var(--c-gold)_8%,transparent)]" : "cp-line opacity-80 hover:opacity-100",
            )}
          >
            <span className="flex items-center gap-2.5">
              <MoonDisc phase={c.k / 8} size={22} glow={false} label={false} />
              <span className="cp-display text-[1.08rem] leading-tight">
                {c.title} <SignGlyph n={c.sign} />
              </span>
            </span>
            <span className="cp-eyebrow cp-gold mt-2 block !text-[0.56rem]">
              {c.sub} · {when(c.at)}
            </span>
            <span className="mt-2 block text-[0.86rem] leading-relaxed opacity-85">{c.text}</span>
          </button>
        ))}
      </div>

      {/* Las ocho estaciones, como accesos directos al instante exacto de esta lunación */}
      <p className="cp-eyebrow mb-3 mt-7 !text-[0.6rem]">Las ocho estaciones de esta lunación</p>
      <div className="grid grid-cols-4 gap-1.5">
        {EIGHT_PHASES.map((p, k) => {
          const on = p === name;
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPlaying(false);
                setHeld(anchor);
                setAt(timeAt(lib, k * 45, anchor));
              }}
              aria-pressed={on}
              aria-label={`${p}: ${PHASE_GUIDANCE[p].intent}`}
              className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors duration-300", on ? "border-[var(--c-gold)] bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]" : "border-transparent")}
            >
              <MoonDisc phase={k / 8} size={26} glow={false} label={false} />
              <span className="cp-muted text-center text-[0.68rem] leading-tight">{PHASE_GUIDANCE[p].intent}</span>
            </button>
          );
        })}
      </div>

      <div className="cp-line mt-6 rounded-[calc(var(--r-card)*0.7)] border p-5">
        <p className="cp-eyebrow cp-gold">Por qué se ve así</p>
        <p className="cp-muted mt-3 text-[0.88rem] leading-relaxed">
          La Luna siempre está iluminada a la mitad: el Sol siempre está a un lado. Lo que cambia es nuestro ángulo de visión: {describeGeometry(st.elong / 360)}
        </p>
      </div>
      {!lib && <p className="cp-faint mt-4 text-[0.72rem]">{failed ? "No se ha podido cargar el cielo exacto: se muestra una aproximación." : "Calculando el cielo exacto…"}</p>}
    </PanelBody>
  );

  /* ---------------------------------------------------------- calendario */

  const dayLabel = (d: LunarDay) => {
    const parts = [`${Number(d.key.slice(8))} de ${MONTHS[cursor.m - 1]}`, phaseName(d.elong / 360), `Luna en ${SIGNS[d.sign].name}`];
    for (const l of d.lunations.filter((l) => l.k % 2 === 0)) parts.push(`${phaseOf(l.k)} exacta a las ${timeInTz(l.at, TZ)}`);
    for (const i of d.ingresses) parts.push(`entra en ${SIGNS[i.sign].name} a las ${timeInTz(i.at, TZ)}`);
    if (d.lunations.some((l) => l.supermoon)) parts.push("superluna");
    for (const l of d.lunations) if (l.eclipse) parts.push(eclipseText(l.eclipse));
    if (natalSign !== null && daySigns(d).includes(natalSign)) parts.push("la Luna pasa por tu signo natal");
    if (returns.has(d.key)) parts.push(`retorno lunar a las ${timeInTz(returns.get(d.key)!, TZ)}`);
    if (d.key === todayKey) parts.push("hoy");
    return parts.join(", ");
  };

  const calendar = (
    <section aria-label="Calendario lunar del mes">
      <div className="mb-4 flex items-center justify-between gap-3">
        <RoundButton label="Mes anterior" onClick={() => step(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </RoundButton>
        <div className="text-center">
          <p className="cp-eyebrow cp-gold !text-[0.58rem]">Hora de España</p>
          <p className="cp-display text-[1.35rem] first-letter:uppercase" aria-live="polite">
            {MONTHS[cursor.m - 1]} {cursor.y}
          </p>
        </div>
        <RoundButton label="Mes siguiente" onClick={() => step(1)}>
          <ChevronRight className="h-4 w-4" />
        </RoundButton>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1" aria-hidden>
        {WEEKDAYS.map((d) => (
          <span key={d} className="cp-faint text-center text-[0.68rem] font-semibold">
            {d}
          </span>
        ))}
      </div>
      <div ref={gridRef} className="grid grid-cols-7 gap-1" onKeyDown={onGridKey}>
        {Array.from({ length: leading }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {month.map((d) => {
          const on = d.key === dayKey;
          const today = d.key === todayKey;
          const main = d.lunations.filter((l) => l.k % 2 === 0);
          const sup = d.lunations.some((l) => l.supermoon);
          const ecl = d.lunations.some((l) => l.eclipse);
          const natalDay = natalSign !== null && daySigns(d).includes(natalSign);
          const ret = returns.get(d.key);
          return (
            <button
              key={d.key}
              type="button"
              data-day={d.key}
              onClick={() => pickDay(d)}
              aria-pressed={on}
              aria-current={today ? "date" : undefined}
              aria-label={dayLabel(d)}
              className={cn(
                "relative flex min-h-[4.6rem] flex-col items-center rounded-lg border px-0.5 pb-1 pt-1 transition-colors duration-300 sm:min-h-[5.2rem]",
                on ? "border-[var(--c-gold)] bg-[color-mix(in_oklab,var(--c-gold)_14%,transparent)]" : main.length ? "border-[color-mix(in_oklab,var(--c-gold)_30%,transparent)]" : "border-transparent hover:border-[color-mix(in_oklab,var(--c-text)_15%,transparent)]",
                natalDay && !on && "bg-[color-mix(in_oklab,#9DB8D6_16%,transparent)]",
              )}
            >
              <span className="flex w-full items-center justify-between px-0.5">
                <span className={cn("text-[0.66rem] tabular-nums leading-none", today ? "cp-gold rounded-full font-bold underline decoration-2 underline-offset-2" : "cp-muted")}>{Number(d.key.slice(8))}</span>
                <span className="flex items-center gap-0.5 leading-none">
                  {ecl && <EclipseMark />}
                  {sup && (
                    <span className="cp-gold text-[0.6rem]" title="Superluna">
                      ✦
                    </span>
                  )}
                  {ret && (
                    <span className="cp-gold text-[0.62rem]" title="Retorno lunar">
                      ☽︎
                    </span>
                  )}
                </span>
              </span>
              <span className="mt-1">
                <MoonDisc phase={d.elong / 360} size={18} glow={false} label={false} />
              </span>
              <SignGlyph n={d.sign} className="mt-0.5 text-[0.78rem] leading-none" />
              {main.map((l) => (
                <span key={l.k} className="cp-gold mt-0.5 text-[0.58rem] font-semibold tabular-nums leading-none">
                  {timeInTz(l.at, TZ)}
                </span>
              ))}
              {d.ingresses.map((i) => (
                <span key={i.at.getTime()} className="cp-muted mt-0.5 whitespace-nowrap text-[0.56rem] tabular-nums leading-none">
                  <span className="hidden sm:inline">→</span>
                  <SignGlyph n={i.sign} />
                  {timeInTz(i.at, TZ)}
                </span>
              ))}
            </button>
          );
        })}
      </div>
      <div className="cp-muted mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.7rem] leading-snug">
        <span>
          <span className="cp-gold font-semibold">15:53</span> fase principal exacta
        </span>
        <span>→♈︎ 09:12 la Luna cambia de signo</span>
        <span className="inline-flex items-center gap-1">
          <EclipseMark /> eclipse
        </span>
        <span>
          <span className="cp-gold">✦</span> superluna
        </span>
        {natal && (
          <span>
            <span className="cp-gold">☽︎</span> retorno lunar ·{" "}
            <span className="inline-block h-2.5 w-3.5 rounded-sm align-middle" style={{ background: "color-mix(in oklab, #9DB8D6 30%, transparent)" }} /> la Luna en tu signo natal
          </span>
        )}
      </div>
    </section>
  );

  /* ---------------------------------------------------------- el día */

  const dayEvents = selectedDay
    ? [
        ...selectedDay.lunations.map((l) => ({
          at: l.at,
          text: (
            <>
              <span className={l.k % 2 === 0 ? "font-semibold" : ""}>{phaseOf(l.k)}</span> en <SignPos lon={l.moonLon} />
              {l.k === 4 && <span className="cp-muted"> · eje con {SIGNS[(signOf(l.moonLon) + 6) % 12].name}</span>}
              {l.supermoon && <span className="cp-gold"> · superluna ({KM.format(Math.round(l.distKm))} km)</span>}
              {l.eclipse && (
                <span className="cp-gold">
                  {" "}
                  · {eclipseText(l.eclipse)} (máximo {timeInTz(l.eclipse.at, TZ)})
                </span>
              )}
            </>
          ),
        })),
        ...selectedDay.ingresses.map((i) => ({
          at: i.at,
          text: (
            <>
              La Luna entra en <SignGlyph n={i.sign} /> {SIGNS[i.sign].name}
            </>
          ),
        })),
        ...selectedDay.apsides.map((a: Apsis) => ({ at: a.at, text: <>{a.kind === "perigee" ? "Perigeo" : "Apogeo"}: la Luna a {KM.format(Math.round(a.km))} km</> })),
        ...(returns.has(selectedDay.key) ? [{ at: returns.get(selectedDay.key)!, text: <>Retorno de tu Luna natal ({fmtLon(natal!.moon.moonLon)})</> }] : []),
      ].sort((a, b) => a.at.getTime() - b.at.getTime())
    : [];

  const dayDetail = (
    <section aria-label="El día elegido" className="cp-line mt-6 border-t pt-6">
      <SectionTitle kicker="El día elegido" title={upperFirst(longDay(at))} />
      {lib && selectedDay ? (
        dayEvents.length ? (
          <ul className="space-y-2">
            {dayEvents.map((e, i) => (
              <li key={i} className="flex gap-3 text-[0.88rem] leading-relaxed">
                <span className="cp-gold w-11 shrink-0 tabular-nums">{timeInTz(e.at, TZ)}</span>
                <span className="opacity-90">{e.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cp-muted text-[0.86rem]">
            La Luna sigue todo el día en <SignGlyph n={selectedDay.sign} /> {SIGNS[selectedDay.sign].name}, sin fases exactas ni cambios de signo.
          </p>
        )
      ) : (
        !lib && <p className="cp-faint text-[0.8rem]">Calculando…</p>
      )}

      <div className="cp-line mt-5 rounded-[calc(var(--r-card)*0.7)] border p-4">
        <p className="cp-eyebrow cp-gold !text-[0.6rem]">Salida y puesta de la Luna · {city.label}</p>
        {riseSet ? (
          <p className="mt-2 text-[0.92rem]">
            {riseSet.rise ? `Sale a las ${timeInTz(riseSet.rise, city.tz)}` : "Ese día no sale"} · {riseSet.set ? `se pone a las ${timeInTz(riseSet.set, city.tz)}` : "ese día no se pone"}
            {city.tz !== TZ && <span className="cp-muted"> (hora local)</span>}
          </p>
        ) : (
          <p className="cp-faint mt-2 text-[0.8rem]">Calculando…</p>
        )}
        <div className="mt-3">
          <CityPicker value={city} onChange={setCity} />
        </div>
      </div>
    </section>
  );

  /* ---------------------------------------------------------- luna natal */

  const natalBlock = (
    <section aria-label="Tu luna natal" className="cp-line mt-8 border-t pt-6">
      <SectionTitle kicker="Personal" title="Tu luna natal">
        {!formOpen && (
          <ToolButton onClick={() => setFormOpen(true)} active={!!natal}>
            {natal ? "Cambiar datos" : "Calcular mi luna"}
          </ToolButton>
        )}
      </SectionTitle>
      {formOpen && (
        <Suspense fallback={<p className="cp-faint text-[0.8rem]">Cargando el formulario…</p>}>
          <BirthForm initial={natal?.birth} onSubmit={(b) => void submitBirth(b)} onCancel={() => setFormOpen(false)} submitLabel="Ver mi luna" />
        </Suspense>
      )}
      {!formOpen && !natal && (
        <p className="cp-muted text-[0.88rem] leading-relaxed">Con tu fecha, hora y lugar de nacimiento: la fase en la que naciste, tu signo lunar y, en el calendario, los días en que la Luna vuelve a tu signo y el momento exacto de tu retorno lunar. Se calcula en tu navegador; no se guarda ni se envía nada.</p>
      )}
      {!formOpen && natal && <NatalCard natal={natal} />}
    </section>
  );

  /* ---------------------------------------------------------- año lunar */

  const yearBlock = (
    <section aria-label={`Año lunar ${year}`}>
      <SectionTitle kicker="Lunas nuevas y llenas" title={`Año lunar ${year}`}>
        <div className="flex items-center gap-2">
          <RoundButton label="Año anterior" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </RoundButton>
          <RoundButton label="Año siguiente" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </RoundButton>
        </div>
      </SectionTitle>
      {yearList ? (
        <ol className="space-y-0">
          {yearList.map((l) => {
            const s = signOf(l.moonLon);
            const full = l.k === 4;
            return (
              <li key={l.at.getTime()} className="cp-line border-t">
                <button type="button" onClick={() => setMoment(l.at)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <MoonDisc phase={l.k / 8} size={20} glow={false} label={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9rem] leading-snug">
                      {full ? "Llena" : "Nueva"} en <SignPos lon={l.moonLon} />
                      {full && <span className="cp-muted hidden text-[0.78rem] sm:inline"> · eje {SIGNS[(s + 6) % 12].name}</span>}
                    </span>
                    <span className="cp-muted block text-[0.78rem] tabular-nums">{when(l.at)}</span>
                    {(l.supermoon || l.eclipse) && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {l.supermoon && <Badge>✦ Superluna</Badge>}
                        {l.eclipse && (
                          <Badge>
                            <span className="mr-1 inline-flex">
                              <EclipseMark />
                            </span>
                            {eclipseText(l.eclipse)}
                          </Badge>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="cp-faint text-[0.8rem]">{lib ? "Calculando el año…" : failed ? "No disponible." : "Calculando el cielo exacto…"}</p>
      )}
      <div className="cp-line mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
        <fieldset className="flex flex-wrap items-center gap-3 text-[0.84rem]">
          <legend className="sr-only">Tipo de evento en el calendario</legend>
          {(
            [
              ["timed", "Con la hora exacta"],
              ["allday", "Día completo"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex min-h-10 cursor-pointer items-center gap-2">
              <input type="radio" name="luna-ics" value={v} checked={icsMode === v} onChange={() => setIcsMode(v)} className="h-4 w-4 accent-[var(--c-gold)]" />
              {label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="cp-btn inline-flex items-center gap-2" onClick={downloadIcs} disabled={!yearList}>
          <Download className="h-4 w-4" aria-hidden /> Descargar .ics
        </button>
      </div>
      <p className="cp-faint mt-3 text-[0.72rem] leading-relaxed">
        Horas de España peninsular (Europe/Madrid; en Canarias, una hora menos). El archivo se crea en tu navegador: sirve para Google Calendar, Apple Calendar u Outlook. Superluna: luna nueva o llena a menos del 10 % del recorrido
        perigeo–apogeo de esa vuelta (criterio de Richard Nolle). Eclipses visibles en algún lugar de la Tierra.
      </p>
    </section>
  );

  return (
    <ModelFrame
      diagram={diagram}
      panel={panel}
      footer={
        <>
          {calendar}
          {dayDetail}
          {natalBlock}
          <div className="cp-line mt-8 border-t pt-6">{yearBlock}</div>
        </>
      }
    />
  );
}

function NatalCard({ natal }: { natal: { birth: BirthData; moon: NatalMoon } }) {
  const { birth, moon } = natal;
  const s = signOf(moon.moonLon);
  const phase: MoonPhaseName = EIGHT_PHASES[moon.phase];
  const crosses = moon.range && signOf(moon.range.from) !== signOf(moon.range.to);
  const [y, m, d] = birth.date.split("-").map(Number);
  const born = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  return (
    <div className="rounded-[calc(var(--r-card)*0.7)] border p-5" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 30%, transparent)", background: "color-mix(in oklab, var(--c-gold) 5%, transparent)" }}>
      <div className="flex items-center gap-4">
        <MoonDisc phase={moon.elong / 360} size={64} glow={false} />
        <div>
          <p className="cp-eyebrow !text-[0.58rem]">
            {birth.name ? `${birth.name} · ` : ""}
            {born}
            {birth.timeKnown ? `, ${birth.time}` : " (sin hora)"} · {birth.place.label}
          </p>
          <p className="cp-display mt-1 text-[1.3rem] leading-tight">
            {phase} · Luna en <SignGlyph n={s} /> {SIGNS[s].name}
          </p>
          <p className="cp-muted mt-1 text-[0.8rem]">
            {fmtLon(moon.moonLon)} · {Math.round(moon.elong)}° del Sol
          </p>
        </div>
      </div>
      <p className="mt-4 text-[0.92rem] leading-relaxed opacity-90">{NATAL_PHASE[phase]}</p>
      <p className="mt-3 text-[0.92rem] leading-relaxed opacity-90">Tu Luna en {SIGNS[s].name}: {lowerFirst(bodyInSignText(BODY_INFO.moon, SIGNS[s]))}</p>
      {moon.range && (
        <p className="cp-muted mt-3 text-[0.8rem] leading-relaxed">
          Sin la hora, se toma el mediodía: ese día la Luna fue de {fmtLon(moon.range.from)} a {fmtLon(moon.range.to)}
          {crosses ? `; cambió de signo, así que tu Luna puede estar en ${SIGNS[signOf(moon.range.from)].name} o en ${SIGNS[signOf(moon.range.to)].name}.` : "."}
        </p>
      )}
      <p className="cp-muted mt-3 text-[0.8rem] leading-relaxed">
        La fase natal se cuenta por octavos del ciclo, a la manera de Rudhyar: cada estación empieza en su ángulo exacto (0°, 45°, 90°…). En el calendario, el fondo marca los días en que la Luna pasa por {SIGNS[s].name} y ☽︎ el
        retorno lunar exacto.
      </p>
    </div>
  );
}

/** En palabras sencillas, dónde está la Luna respecto al Sol. */
function describeGeometry(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "la Luna está entre la Tierra y el Sol. Su mitad iluminada mira hacia el otro lado, así que vemos su cara nocturna.";
  if (phase < 0.22) return "la Luna ha avanzado un poco. Alcanzamos a ver una franja estrecha de la mitad iluminada.";
  if (phase < 0.28) return "la Luna forma un ángulo recto con el Sol. Vemos exactamente la mitad de la mitad iluminada: media cara.";
  if (phase < 0.47) return "el ángulo se abre más. Entra a la vista más de la mitad de la cara luminosa.";
  if (phase < 0.53) return "la Tierra queda entre el Sol y la Luna. Miramos de lleno a su cara iluminada.";
  if (phase < 0.72) return "la Luna sigue su camino y la cara luminosa se va girando poco a poco lejos de nosotras.";
  if (phase < 0.78) return "otro ángulo recto, esta vez desde el otro lado. Media cara, en espejo.";
  return "solo queda un resto de la cara luminosa, antes de que la Luna vuelva a ponerse entre nosotras y el Sol.";
}
