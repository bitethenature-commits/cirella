"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PHASE_GUIDANCE, moonPhase, moonSign, nextPhaseDate, phaseName, type MoonPhaseName } from "./data/moon";
import { MoonDisc } from "./moon-disc";
import { GOLD, INK, ModelFrame, PanelBody, PanelHeading, PanelRow, RangeField, ToolButton, cn, usePrefersReducedMotion } from "./model-kit";

/**
 * El ciclo lunar como mecanismo (portado de la web antigua) y el calendario del mes.
 *
 * Arriba, la geometría Sol–Tierra–Luna vista desde arriba: la Luna siempre está iluminada a la mitad;
 * lo que cambia es cuánto de esa mitad vemos desde la Tierra. Al mover el ciclo, la Luna recorre su
 * órbita y el disco de fase la sigue. Debajo, cada día del mes con su luna; al tocar un día, el modelo
 * se coloca en esa fase.
 *
 * Los datos del cielo (fase de hoy, signo, próximas lunas nueva y llena) salen de lib/astro-calendar.ts,
 * que se carga aparte (es pesado); mientras llega, una aproximación sinódica (data/moon.ts).
 */

const EIGHT: Array<{ phase: number; name: MoonPhaseName }> = [
  { phase: 0, name: "Luna nueva" },
  { phase: 0.125, name: "Creciente" },
  { phase: 0.25, name: "Cuarto creciente" },
  { phase: 0.375, name: "Gibosa creciente" },
  { phase: 0.5, name: "Luna llena" },
  { phase: 0.625, name: "Gibosa menguante" },
  { phase: 0.75, name: "Cuarto menguante" },
  { phase: 0.875, name: "Menguante" },
];

const SYNODIC = 29.530588853;
const DAY = 86_400_000;
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const LONG_DATE = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const SHORT_DATE = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "long" });

type Sky = {
  /** Fase 0…1 (0 = nueva, 0,5 = llena) en un instante. */
  phaseAt: (d: Date) => number;
  signAt: (d: Date) => string;
  nextNew: Date;
  nextFull: Date;
  real: boolean;
};

const meanSky = (now: Date): Sky => ({
  phaseAt: (d) => moonPhase(d).phase,
  signAt: (d) => moonSign(d),
  nextNew: nextPhaseDate(0, now),
  nextFull: nextPhaseDate(0.5, now),
  real: false,
});

/** El cielo de verdad (elongación Sol–Luna, signo y lunas exactas), cargado aparte. */
async function loadRealSky(now: Date): Promise<Sky> {
  const ac = await import("@/lib/astro-calendar");
  const phaseAt = (d: Date) => ((((ac.longitude("Moon", d) - ac.longitude("Sun", d)) % 360) + 360) % 360) / 360;
  const events = ac.moonPhasesBetween(now, new Date(now.getTime() + 40 * DAY));
  const first = (p: "new" | "full") => events.find((e) => e.kind === "moon" && e.phase === p)?.at;
  const fallback = meanSky(now);
  return { phaseAt, signAt: (d) => ac.SIGNS[ac.moonSignAt(d)], nextNew: first("new") ?? fallback.nextNew, nextFull: first("full") ?? fallback.nextFull, real: true };
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function LunarModel() {
  const now = useMemo(() => new Date(), []);
  const [sky, setSky] = useState<Sky>(() => meanSky(now));
  const todayPhase = useMemo(() => sky.phaseAt(now), [sky, now]);
  const [phase, setPhase] = useState(todayPhase);
  /** Día elegido en el calendario (null: el que corresponde a la fase del deslizador). */
  const [picked, setPicked] = useState<Date | null>(now);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const touched = useRef(false);
  const raf = useRef(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    let alive = true;
    loadRealSky(now)
      .then((real) => {
        if (!alive) return;
        setSky(real);
        // Si aún no se ha tocado nada, el modelo se coloca en la fase real de hoy.
        if (!touched.current) setPhase(real.phaseAt(now));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [now]);

  // Recorrido automático: una lunación completa en unos doce segundos.
  useEffect(() => {
    if (!playing || reduced) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setPhase((p) => (p + dt / 12) % 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, reduced]);

  const goTo = (p: number, day: Date | null = null) => {
    touched.current = true;
    setPlaying(false);
    setPhase(p);
    setPicked(day);
  };

  const name = phaseName(phase);
  const guidance = PHASE_GUIDANCE[name];
  const illumination = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const age = phase * SYNODIC;
  const date = picked ?? new Date(now.getTime() + ((phase - todayPhase + 1) % 1) * SYNODIC * DAY);

  // Geometría: el Sol lejos, a la izquierda; la Luna orbita la Tierra. En fase 0 está entre la Tierra
  // y el Sol (nueva); en 0,5, enfrente (llena).
  const orbitR = 62;
  const moonAngle = phase * Math.PI * 2 + Math.PI;
  const moonX = 118 + orbitR * Math.cos(moonAngle);
  const moonY = 100 + orbitR * Math.sin(moonAngle);

  // Calendario del mes (lunes primero), cada día con su luna a mediodía.
  const days = useMemo(() => {
    const total = new Date(cursor.y, cursor.m + 1, 0).getDate();
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(cursor.y, cursor.m, i + 1, 12);
      return { date: d, phase: sky.phaseAt(d) };
    });
  }, [cursor, sky]);
  const leading = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const step = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const diagram = (
    <div>
      <svg viewBox="-12 22 230 160" className="mx-auto block h-auto w-full max-w-[26rem]" style={{ color: INK }} role="img" aria-label={`Sol, Tierra y Luna vistos desde arriba: ${name}`}>
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
            <stop offset="0%" stopColor="#E8B23A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#E8B23A" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* La luz del Sol llega siempre desde la izquierda */}
        {[40, 70, 100, 130, 160].map((y) => (
          <line key={y} x1="16" y1={y} x2="205" y2={y} stroke="url(#lm-rays)" strokeWidth="0.8" strokeDasharray="3 5" />
        ))}
        <circle cx="6" cy="100" r="34" fill="url(#lm-sunglow)" />
        <circle cx="6" cy="100" r="16" fill="url(#lm-sun)" />
        <text x="6" y="128" textAnchor="middle" fontSize="6" style={{ fill: GOLD }}>
          Sol
        </text>

        {/* Órbita */}
        <circle cx="118" cy="100" r={orbitR} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="2 4" />

        {/* Tierra (con su noche hacia la derecha) */}
        <circle cx="118" cy="100" r="12" fill="url(#lm-earth)" />
        <path d="M118 88 a12 12 0 0 1 0 24 z" fill="#0B0908" opacity="0.45" />
        <text x="118" y="121" textAnchor="middle" fontSize="5.5" fill="currentColor" opacity="0.75">
          Tierra
        </text>

        <line x1="118" y1="100" x2={moonX} y2={moonY} stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.5" />

        {/* La Luna: siempre media iluminada, y la cara iluminada siempre mira al Sol */}
        <g transform={`translate(${moonX} ${moonY})`}>
          <circle r="7.5" fill="#2A2622" />
          <path d="M0 -7.5 A7.5 7.5 0 0 0 0 7.5 Z" fill="#F2EADB" />
          <circle r="7.5" fill="none" style={{ stroke: GOLD }} strokeOpacity="0.6" strokeWidth="0.4" />
        </g>
        <text x={moonX} y={moonY - 11} textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.8">
          Luna
        </text>

        {/* Las ocho estaciones */}
        {EIGHT.map((p) => {
          const a = p.phase * Math.PI * 2 + Math.PI;
          const near = Math.abs(((phase - p.phase + 1.5) % 1) - 0.5) < 0.03;
          return <circle key={p.name} cx={118 + orbitR * Math.cos(a)} cy={100 + orbitR * Math.sin(a)} r={near ? 2 : 1.1} style={{ fill: GOLD, transition: "all 400ms" }} opacity={near ? 1 : 0.45} />;
        })}
      </svg>

      {/* Lo que vemos de verdad desde la Tierra */}
      <div className="mt-4 flex flex-col items-center">
        <p className="cp-eyebrow mb-3 !text-[0.6rem]">Visto desde la Tierra</p>
        <MoonDisc phase={phase} size={112} />
      </div>

      <div className="mt-6">
        <RangeField
          id="luna-fase"
          label="Mover el ciclo"
          value={Math.round(phase * 1000)}
          valueText={`Día ${Math.floor(age) + 1} de 29,5`}
          min={0}
          max={999}
          onChange={(v) => goTo(v / 1000)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {!reduced && (
            <ToolButton
              active={playing}
              onClick={() => {
                touched.current = true;
                setPicked(null);
                setPlaying((v) => !v);
              }}
            >
              {playing ? "Detener" : "Dejar correr el ciclo"}
            </ToolButton>
          )}
          <ToolButton onClick={() => goTo(todayPhase, now)}>Hoy</ToolButton>
        </div>
      </div>
    </div>
  );

  const panel = (
    <PanelBody id={name}>
      <PanelHeading kicker={`Fase · ${Math.round(illumination * 100)} % iluminada`} title={name} />
      <p className="cp-display mt-4 text-[1.3rem] italic leading-snug opacity-85">{guidance.intent}</p>
      <p className="mt-2 text-[0.95rem] leading-relaxed opacity-85">{guidance.practice}</p>

      <div className="cp-line mt-6 rounded-[calc(var(--r-card)*0.7)] border p-5">
        <p className="cp-eyebrow cp-gold">Por qué se ve así</p>
        <p className="cp-muted mt-3 text-[0.88rem] leading-relaxed">
          La Luna siempre está iluminada a la mitad: el Sol siempre está a un lado. Lo que cambia es nuestro ángulo de visión: {describeGeometry(phase)}
        </p>
      </div>

      <dl className="mt-6">
        <PanelRow label="Iluminación" value={`${Math.round(illumination * 100)} %`} />
        <PanelRow label="Día del ciclo" value={`${Math.floor(age) + 1} de 29,5`} />
        <PanelRow label="Dirección" value={phase < 0.5 ? "creciente" : "menguante"} />
        <PanelRow label={picked ? "Día" : "Corresponde al"} value={LONG_DATE.format(date)} />
        <PanelRow label="Luna en" value={sky.signAt(date)} />
      </dl>

      {/* Las ocho estaciones, como accesos directos */}
      <p className="cp-eyebrow mb-3 mt-6 !text-[0.6rem]">Las ocho estaciones</p>
      <div className="grid grid-cols-4 gap-1.5">
        {EIGHT.map((p) => {
          const on = p.name === name;
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => goTo(p.phase)}
              aria-pressed={on}
              aria-label={p.name}
              className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors duration-300", on ? "border-[var(--c-gold)] bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]" : "border-transparent")}
            >
              <MoonDisc phase={p.phase} size={26} glow={false} label={false} />
              <span className="cp-muted text-center text-[0.68rem] leading-tight">{PHASE_GUIDANCE[p.name].intent}</span>
            </button>
          );
        })}
      </div>

      <dl className="mt-6">
        <PanelRow label="Próxima luna nueva" value={SHORT_DATE.format(sky.nextNew)} />
        <PanelRow label="Próxima luna llena" value={SHORT_DATE.format(sky.nextFull)} />
      </dl>

      {/* Calendario del mes */}
      <div className="cp-line mt-6 border-t pt-6">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={() => step(-1)} aria-label="Mes anterior" className="cp-line grid h-10 w-10 place-items-center rounded-full border opacity-75 hover:opacity-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="cp-display text-[1.35rem] first-letter:uppercase">
            {MONTHS[cursor.m]} {cursor.y}
          </p>
          <button type="button" onClick={() => step(1)} aria-label="Mes siguiente" className="cp-line grid h-10 w-10 place-items-center rounded-full border opacity-75 hover:opacity-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="cp-faint text-center text-[0.68rem] font-semibold">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leading }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {days.map(({ date: d, phase: p }) => {
            const on = !!picked && sameDay(d, picked);
            const n = phaseName(p);
            const principal = n === "Luna nueva" || n === "Luna llena" || n === "Cuarto creciente" || n === "Cuarto menguante";
            return (
              <button
                key={d.getDate()}
                type="button"
                onClick={() => goTo(p, d)}
                aria-pressed={on}
                aria-label={`${d.getDate()} de ${MONTHS[cursor.m]}: ${n}`}
                className={cn(
                  "relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg border transition-colors duration-300",
                  on ? "border-[var(--c-gold)] bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]" : "border-transparent",
                )}
              >
                <MoonDisc phase={p} size={20} glow={false} label={false} />
                <span className={cn("mt-0.5 text-[0.66rem] tabular-nums", sameDay(d, now) ? "cp-gold font-bold" : "cp-muted")}>{d.getDate()}</span>
                {principal && <span aria-hidden className="absolute right-1 top-1 h-1 w-1 rounded-full" style={{ background: GOLD }} />}
              </button>
            );
          })}
        </div>
        {!sky.real && <p className="cp-faint mt-3 text-[0.72rem]">Calculando el cielo exacto…</p>}
      </div>
    </PanelBody>
  );

  return <ModelFrame diagram={diagram} panel={panel} />;
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
