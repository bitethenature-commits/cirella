"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  HOUSE_SYSTEM_NAME,
  bodyLongitude,
  computeChart,
  findAspects,
  formatCoord,
  formatOffset,
  localToUtc,
  spreadLongitudes,
  zodiacPos,
  type Aspect,
  type AspectId,
  type AspectPoint,
  type BodyId,
  type ChartBody,
  type ChartPointId,
  type HouseSystem,
  type NodeKind,
} from "@/lib/natal-chart";
import type { BirthProfile } from "@/lib/birth-profile";
import type { CustomChartData, CustomPoint } from "@/lib/lesson-blocks";
import { applyCustom, isHandmade } from "./custom-chart";
import { BirthForm, type BirthData } from "./chart-birth-form";
import {
  ANGLE_INFO,
  ASPECTS,
  ASPECT_BY_ID,
  BODY_INFO,
  ELEMENT_HUE,
  GROUP_LABEL,
  HOUSES,
  SIGNS,
  angleInSignText,
  bodyInHouseText,
  bodyInSignText,
  signOf,
  type AngleKey,
  type Element,
  type Modality,
} from "./data/astrology";
import { CompactSummary, GOLD, INK, LegendDot, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelLink, PanelRow, ToolButton, cn, describeArc, polar, tap, useShown } from "./model-kit";

/**
 * La carta natal de verdad: con la fecha, la hora y el lugar de nacimiento calcula (en el navegador, con
 * lib/natal-chart.ts) las posiciones del Sol a Plutón, Quirón, los nodos y Lilith, el Ascendente y el MC,
 * las casas (Plácidus, signos enteros o iguales) y los aspectos. Se abre con la carta de ejemplo de Cirella y
 * «Calcular mi carta» pide los datos (components/models/chart-birth-form.tsx). Nada se guarda ni se envía.
 *
 * La rueda: signos por fuera (coloreados por elemento), los cuerpos en su grado exacto (los que caen
 * juntos se abren en abanico con una línea hasta su punto), las casas con el grado de cada cúspide, los
 * ejes AC–DC y MC–IC marcados y los aspectos en el centro. Todo se toca y se explica; debajo, la tabla de
 * posiciones, el aspectario y el reparto de elementos y cualidades con el regente de la carta.
 *
 * Con `profile` (lib/birth-profile.ts) la carta es la de ese perfil: sin ejemplo ni formulario.
 */

type Selection =
  | { kind: "sign"; n: number }
  | { kind: "house"; n: number }
  | { kind: "body"; id: BodyId }
  | { kind: "angle"; id: AngleKey }
  | { kind: "aspect"; a: ChartPointId; b: ChartPointId }
  | null;

/** Los glifos como texto (sin esto, iOS pinta ♈ o ♀ como emoji). */
const glyph = (g: string) => `${g}︎`;

const EXAMPLE: BirthData = {
  name: "Cirella",
  date: "1988-11-14",
  time: "07:45",
  timeKnown: true,
  place: {
    label: "Sevilla",
    detail: "Andalucía, España",
    lat: 37.38,
    lon: -5.97,
    tz: "Europe/Madrid",
  },
};

const norm = (x: number) => ((x % 360) + 360) % 360;

/* Radios de la rueda (viewBox de −128 a 128). */
const R_OUT = 100;
const R_SIGN = 85;
const R_GLYPH = 75;
const R_DEG = 65.5;
const R_MIN = 59.5;
const R_HOUSE = 53;
const R_ASP = 43;

/** Los cuerpos que cuentan para elementos y cualidades. */
const CLASSIC: BodyId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
/** Filas del aspectario (el Nodo Sur no: es siempre el opuesto del Norte). */
const GRID_ORDER: ChartPointId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "node", "lilith", "asc", "mc"];
const DEFAULT_ASPECTS: AspectId[] = ["conjunction", "sextile", "square", "trine", "quincunx", "opposition"];

const pad2 = (n: number) => String(n).padStart(2, "0");
/** «14°32′ Escorpio». */
const fmtPos = (lon: number) => {
  const z = zodiacPos(lon);
  return `${z.deg}°${pad2(z.min)}′ ${SIGNS[z.sign].name}`;
};
/** «2°05′». */
const fmtOrb = (deg: number) => {
  const total = Math.round(deg * 60);
  return `${Math.floor(total / 60)}°${pad2(total % 60)}′`;
};

const pointName = (id: ChartPointId) => (id === "asc" ? "Ascendente" : id === "mc" ? "Medio Cielo" : BODY_INFO[id].name);
const pointGlyph = (id: ChartPointId) => (id === "asc" ? "AC" : id === "mc" ? "MC" : glyph(BODY_INFO[id].glyph));
const sameAspect = (x: Aspect, a: ChartPointId, b: ChartPointId) => (x.a === a && x.b === b) || (x.a === b && x.b === a);

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 520px)");
    setNarrow(mq.matches);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

const longDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

/** BirthProfile → los datos del formulario (sin hora: las 12:00 y timeKnown false). */
const profileBirth = (p: BirthProfile): BirthData => ({
  name: p.name,
  date: p.date,
  time: p.time ?? "12:00",
  timeKnown: p.time !== null,
  place: { label: p.place.name, detail: p.place.detail ?? "", lat: p.place.lat, lon: p.place.lon, tz: p.place.tz },
});

/**
 * `ownForm` false: sin «Calcular mi carta» propio (en las páginas de los métodos lo pone el candado de
 * components/models/model-gate.tsx, que pasa el perfil).
 */
/** La carta de partida de una «Carta a mano» (sin ella, la de ejemplo). */
const customBirth = (c: CustomChartData): BirthData =>
  c.base
    ? { name: c.base.name, date: c.base.date, time: c.base.time, timeKnown: c.base.timeKnown, place: { label: c.base.place || "Lugar", detail: "", lat: c.base.lat, lon: c.base.lon, tz: c.base.tz } }
    : EXAMPLE;

/**
 * `custom`: una «Carta a mano» de una lección (lib/lesson-blocks.ts): la carta de partida con los puntos que
 * la dueña colocó a mano, sus casas, nodos y aspectos, y su texto para cada punto. Sin formulario propio.
 */
export function ChartModel({
  profile,
  ownForm: ownFormProp = true,
  compact = false,
  custom,
  onCustomChange,
}: { profile?: BirthProfile; ownForm?: boolean; compact?: boolean; custom?: CustomChartData; onCustomChange?: (c: CustomChartData) => void } = {}) {
  const ownForm = custom ? false : ownFormProp;
  /** Con `onCustomChange`, la carta a mano se edita sobre la propia rueda: se arrastran los puntos y, al tocarlos, sale su burbuja. */
  const editing = !!custom && !!onCustomChange;
  type Drag = { id: CustomPoint; lon: number; rot: number; x: number; y: number; moved: boolean };
  const [drag, setDragState] = useState<Drag | null>(null);
  // El arrastre también en una referencia: el «soltar» puede llegar antes de que la carta se repinte con el último movimiento.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  // Mientras se arrastra, la carta se pinta con el punto donde va el dedo (sin guardarlo aún).
  const live = useMemo(() => (custom && drag?.moved ? { ...custom, positions: { ...custom.positions, [drag.id]: drag.lon } } : custom), [custom, drag]);
  const customKey = live ? JSON.stringify(live) : "";
  // La carta de partida y sus ajustes (lo que obliga a recalcular la carta), aparte de los puntos movidos.
  const baseKey = custom ? JSON.stringify([custom.base, custom.houseSystem, custom.node, custom.aspects]) : "";
  const [ownBirth, setBirth] = useState<BirthData>(() => (custom ? customBirth(custom) : EXAMPLE));
  const [ownIsExample, setIsExample] = useState(true);
  const profileKey = profile ? JSON.stringify(profile) : "";
  const fromProfile = useMemo(() => (profileKey ? profileBirth(JSON.parse(profileKey) as BirthProfile) : null), [profileKey]);
  const birth = fromProfile ?? ownBirth;
  const isExample = fromProfile ? false : ownIsExample;
  const [formOpen, setFormOpen] = useState(false);
  /** En la hora repetida del cambio de otoño: usar la segunda vez que el reloj la marcó. */
  const [useSecond, setUseSecond] = useState(false);
  const [houseSystem, setHouseSystem] = useState<HouseSystem>(custom?.houseSystem ?? "whole");
  const [nodeKind, setNodeKind] = useState<NodeKind>(custom?.node ?? "mean");
  const [selection, setSelection] = useState<Selection>(null);
  const [enabled, setEnabled] = useState<Set<AspectId>>(() => new Set(custom ? custom.aspects : DEFAULT_ASPECTS));
  // En el editor, la carta a mano cambia mientras se prepara: la carta y sus ajustes la siguen.
  useEffect(() => {
    if (!baseKey || !custom) return;
    setBirth(customBirth(custom));
    setHouseSystem(custom.houseSystem);
    setNodeKind(custom.node);
    setEnabled(new Set(custom.aspects));
  }, [baseKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ref, shown] = useShown<SVGSVGElement>();
  const narrow = useNarrow();

  /* ---------------------------------------------------------------- cálculo */

  const resolved = useMemo(() => {
    const [year, month, day] = birth.date.split("-").map(Number);
    const [hour, minute] = (birth.timeKnown ? birth.time : "12:00").split(":").map(Number);
    const res = localToUtc({ year, month, day, hour, minute }, birth.place.tz);
    const second = useSecond && res.alternative;
    const utc = second ? res.alternative!.utc : res.utc;
    const offset = second ? res.alternative!.offsetMinutes : res.offsetMinutes;
    let moonRange: { from: number; to: number } | undefined;
    if (!birth.timeKnown) {
      const start = localToUtc({ year, month, day, hour: 0, minute: 0 }, birth.place.tz).utc;
      const next = new Date(Date.UTC(year, month - 1, day + 1));
      const end = localToUtc(
        {
          year: next.getUTCFullYear(),
          month: next.getUTCMonth() + 1,
          day: next.getUTCDate(),
          hour: 0,
          minute: 0,
        },
        birth.place.tz,
      ).utc;
      moonRange = {
        from: bodyLongitude("moon", start),
        to: bodyLongitude("moon", new Date(end.getTime() - 60_000)),
      };
    }
    return { res, utc, offset, moonRange };
  }, [birth, useSecond]);

  const baseChart = useMemo(
    () =>
      computeChart({
        utc: resolved.utc,
        timeKnown: birth.timeKnown,
        lat: birth.place.lat,
        lon: birth.place.lon,
        houseSystem,
        node: nodeKind,
      }),
    [resolved.utc, birth.timeKnown, birth.place.lat, birth.place.lon, houseSystem, nodeKind],
  );
  const chart = useMemo(() => (customKey ? applyCustom(baseChart, JSON.parse(customKey) as CustomChartData) : baseChart), [baseChart, customKey]);
  const angles = chart.angles;
  const cusps = chart.houses?.cusps;
  const byId = useMemo(() => new Map(chart.bodies.map((b) => [b.id, b])), [chart]);

  const points = useMemo<AspectPoint[]>(() => {
    const out: AspectPoint[] = chart.bodies.filter((b) => b.id !== "southNode").map((b) => ({ id: b.id, lon: b.lon, speed: b.speed }));
    if (angles) out.push({ id: "asc", lon: angles.asc }, { id: "mc", lon: angles.mc });
    return out;
  }, [chart, angles]);
  const lonOf = (id: ChartPointId) => (id === "asc" ? angles!.asc : id === "mc" ? angles!.mc : byId.get(id)!.lon);

  const aspects = useMemo(() => findAspects(points, enabled), [points, enabled]);

  /** La rueda gira para dejar el Ascendente a la izquierda (sin hora: 0° de Aries). */
  const rot = drag?.moved ? drag.rot : (angles?.asc ?? 0);
  const toScreen = (lon: number) => 270 - (lon - rot);
  const at = (r: number, lon: number) => polar(0, 0, r, toScreen(lon));

  const display = useMemo(
    () =>
      spreadLongitudes(
        chart.bodies.map((b) => b.lon),
        7.6,
      ),
    [chart],
  );

  /* ---------------------------------------------------- arrastrar (edición) */

  /** El punto de la rueda bajo el puntero, en grados de longitud. */
  const lonAtPointer = (svg: SVGSVGElement, clientX: number, clientY: number, r: number) => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    const deg = (Math.atan2(p.y, p.x) * 180) / Math.PI + 90;
    return norm(270 - deg + r);
  };
  const grab = (id: CustomPoint) =>
    editing
      ? {
          onPointerDown: (e: React.PointerEvent<SVGGElement>) => {
            const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
            if (!svg) return;
            e.preventDefault();
            svg.setPointerCapture(e.pointerId);
            const r = angles?.asc ?? 0;
            const lon = id === "asc" ? (angles?.asc ?? 0) : id === "mc" ? (angles?.mc ?? 0) : (byId.get(id === "node" ? "node" : id)?.lon ?? 0);
            setDrag({ id, lon, rot: r, x: e.clientX, y: e.clientY, moved: false });
          },
          style: { cursor: "grab", touchAction: "none" } as const,
        }
      : {};
  const dragHandlers = editing
    ? {
        onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
          const drag = dragRef.current;
          if (!drag) return;
          const moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4;
          if (!moved) return;
          const lon = lonAtPointer(e.currentTarget, e.clientX, e.clientY, drag.rot);
          // Grado y minuto: se redondea al minuto.
          if (lon != null) setDrag({ ...drag, moved: true, lon: Math.round(lon * 60) / 60 % 360 });
        },
        onPointerUp: () => drop.current(),
        onPointerCancel: () => setDrag(null),
      }
    : {};
  // Soltar: se guarda el punto donde quedó y se abre su burbuja. También si se suelta fuera de la rueda.
  const drop = useRef(() => {});
  drop.current = () => {
    const drag = dragRef.current;
    if (!drag || !custom || !onCustomChange) return setDrag(null);
    if (drag.moved) onCustomChange({ ...custom, positions: { ...custom.positions, [drag.id]: drag.lon } });
    setSelection(drag.id === "asc" || drag.id === "mc" ? { kind: "angle", id: drag.id } : { kind: "body", id: drag.id });
    setDrag(null);
  };
  const dragging = !!drag;
  useEffect(() => {
    if (!dragging) return;
    const end = () => drop.current();
    window.addEventListener("pointerup", end);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };
  }, [dragging]);

  /* ------------------------------------------------------------- acciones */

  const select = (s: Selection) => setSelection(s);
  const selBody = selection?.kind === "body" ? selection.id : selection?.kind === "angle" && (selection.id === "asc" || selection.id === "mc") ? selection.id : null;
  const showExample = () => {
    setBirth(EXAMPLE);
    setIsExample(true);
    setUseSecond(false);
    setFormOpen(false);
    setSelection(null);
  };

  const bodyLink = (id: ChartPointId, extra?: ReactNode) => (
    <PanelLink key={id} onClick={() => select(id === "asc" || id === "mc" ? { kind: "angle", id } : { kind: "body", id })}>
      {pointGlyph(id)} {pointName(id)}
      {extra}
    </PanelLink>
  );
  const signLink = (lon: number) => {
    const s = signOf(lon);
    return (
      <PanelLink onClick={() => select({ kind: "sign", n: s.n })}>
        {glyph(s.glyph)} {fmtPos(lon)}
      </PanelLink>
    );
  };
  const houseLink = (n: number) => (
    <PanelLink onClick={() => select({ kind: "house", n })}>
      {HOUSES[n - 1].name} · {HOUSES[n - 1].keyword}
    </PanelLink>
  );
  const aspectList = (id: ChartPointId) => {
    const mine = aspects.filter((a) => a.a === id || a.b === id).sort((x, y) => x.orb - y.orb);
    return (
      <span className="flex flex-col items-end gap-1">
        {mine.map((a) => {
          const other = a.a === id ? a.b : a.a;
          const t = ASPECT_BY_ID[a.type];
          return (
            <PanelLink key={`${a.a}-${a.b}`} color={t.color} onClick={() => select({ kind: "aspect", a: a.a, b: a.b })}>
              {glyph(t.glyph)} {t.name} con {pointName(other)} · {fmtOrb(a.orb)}
            </PanelLink>
          );
        })}
        {!mine.length && <span className="cp-muted">ninguno dentro del orbe</span>}
      </span>
    );
  };

  /* ---------------------------------------------------------------- rueda */

  const ticks = useMemo(() => {
    let d = "";
    for (let deg = 0; deg < 360; deg++) {
      const len = deg % 10 === 0 ? 3.2 : deg % 5 === 0 ? 2.2 : 1.1;
      const a = polar(0, 0, R_SIGN, 270 - (deg - rot));
      const b = polar(0, 0, R_SIGN - len, 270 - (deg - rot));
      d += `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    return d;
  }, [rot]);

  const angleList: AngleKey[] = ["asc", "dsc", "mc", "ic"];
  const isAngleCusp = (lon: number) => !!angles && angleList.some((k) => Math.abs(((lon - angles[k] + 540) % 360) - 180) < 0.01);

  const wheel = (
    <svg
      ref={ref}
      viewBox="-128 -128 256 256"
      className={`cp-model-svg cp-model-draw mx-auto block h-auto w-full max-w-[34rem] overflow-visible ${shown ? "is-shown" : ""}`}
      style={{ color: INK }}
      role="group"
      aria-label={`Carta natal de ${birth.name || "la persona"}: signos, casas, planetas y aspectos`}
      {...dragHandlers}
    >
      <defs>
        <radialGradient id="ch-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: GOLD, stopOpacity: 0.16 }} />
          <stop offset="100%" style={{ stopColor: GOLD, stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <circle r={R_ASP} fill="url(#ch-core)" />

      {/* Signos */}
      <g>
        {SIGNS.map((sign) => {
          const isSelected = selection?.kind === "sign" && selection.n === sign.n;
          const mid = at((R_OUT + R_SIGN) / 2, sign.n * 30 + 15);
          const a = at(R_SIGN, sign.n * 30);
          const b = at(R_OUT, sign.n * 30);
          return (
            <g key={sign.n} {...tap(`Signo ${sign.name}`, () => select({ kind: "sign", n: sign.n }))}>
              <path
                d={describeArc(0, 0, (R_OUT + R_SIGN) / 2, toScreen(sign.n * 30 + 30), toScreen(sign.n * 30))}
                fill="none"
                stroke={ELEMENT_HUE[sign.element]}
                strokeWidth={R_OUT - R_SIGN}
                opacity={isSelected ? 0.5 : 0.16}
                style={{ transition: "opacity 500ms" }}
              />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: GOLD }} strokeWidth="0.35" opacity="0.55" />
              <text
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="8.6"
                fill={ELEMENT_HUE[sign.element]}
                style={{ filter: "brightness(1.25)" }}
                className="pointer-events-none select-none"
              >
                {glyph(sign.glyph)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Anillos y marcas de grado */}
      {[R_OUT, R_SIGN, R_HOUSE, R_ASP].map((r, i) => (
        <circle key={r} r={r} fill="none" style={{ stroke: GOLD }} strokeWidth={i === 0 ? 0.7 : 0.4} opacity={i === 0 ? 0.75 : 0.45} pathLength={1} data-draw="" />
      ))}
      <path d={ticks} style={{ stroke: GOLD }} strokeWidth="0.25" opacity="0.6" className="pointer-events-none" />

      {/* Casas */}
      {cusps && (
        <g>
          {cusps.map((cusp, i) => {
            const next = cusps[(i + 1) % 12];
            const span = norm(next - cusp);
            const house = HOUSES[i];
            const isSelected = selection?.kind === "house" && selection.n === house.n;
            const label = at((R_HOUSE + R_ASP) / 2, cusp + span / 2);
            const inner = at(R_ASP, cusp);
            const outer = at(R_SIGN, cusp);
            const z = zodiacPos(cusp);
            const tag = polar(0, 0, R_OUT + 5.5, toScreen(cusp) - 3.2);
            const anchor = tag.x < -8 ? "end" : tag.x > 8 ? "start" : "middle";
            return (
              <g key={house.n}>
                <g {...tap(`${house.name}, cúspide en ${fmtPos(cusp)}`, () => select({ kind: "house", n: house.n }))}>
                  <path
                    d={describeArc(0, 0, (R_HOUSE + R_ASP) / 2, toScreen(cusp + span), toScreen(cusp))}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={R_HOUSE - R_ASP}
                    opacity={isSelected ? 0.12 : 0.001}
                    style={{ transition: "opacity 500ms" }}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="4.6"
                    fill="currentColor"
                    opacity={isSelected ? 1 : 0.55}
                    className="pointer-events-none select-none"
                  >
                    {house.n}
                  </text>
                </g>
                {!isAngleCusp(cusp) && <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="currentColor" strokeWidth="0.3" opacity="0.4" className="pointer-events-none" />}
                <text x={tag.x} y={tag.y} textAnchor={anchor} dominantBaseline="central" fontSize="4.4" fill="currentColor" opacity="0.7" className="pointer-events-none select-none">
                  {z.deg}°{glyph(SIGNS[z.sign].glyph)}
                  {narrow ? "" : `${pad2(z.min)}′`}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Aspectos */}
      <g>
        {aspects.map((asp) => {
          const t = ASPECT_BY_ID[asp.type];
          const a = at(R_ASP, lonOf(asp.a));
          const b = at(R_ASP, lonOf(asp.b));
          const isSelected = selection?.kind === "aspect" && sameAspect(asp, selection.a, selection.b);
          const related = selBody === asp.a || selBody === asp.b;
          const dim = (selBody !== null && !related) || (selection?.kind === "aspect" && !isSelected);
          return (
            <g key={`${asp.a}-${asp.b}`} onClick={() => select({ kind: "aspect", a: asp.a, b: asp.b })} className="cursor-pointer">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="4" />
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={t.color}
                strokeWidth={isSelected ? 1.3 : 0.35 + asp.strength * 0.6}
                strokeDasharray={t.dash}
                opacity={dim ? 0.08 : 0.35 + asp.strength * 0.55}
                style={{ transition: "opacity 500ms, stroke-width 500ms" }}
              />
            </g>
          );
        })}
      </g>

      {/* Ejes AC–DC y MC–IC */}
      {angles &&
        angleList.map((k) => {
          const lon = angles[k];
          const a = at(R_ASP, lon);
          const b = at(R_OUT + (k === "asc" || k === "mc" ? 11 : 8), lon);
          const label = at(R_OUT + 17, lon);
          const isSelected = selection?.kind === "angle" && selection.id === k;
          return (
            <g key={k} {...tap(`${ANGLE_INFO[k].name}: ${fmtPos(lon)}`, () => select({ kind: "angle", id: k }))} {...(k === "asc" || k === "mc" ? grab(k) : {})}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="5" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: GOLD }} strokeWidth={isSelected ? 1.5 : k === "asc" || k === "mc" ? 1.1 : 0.8} strokeLinecap="round" />
              {(k === "asc" || k === "mc") && <circle cx={b.x} cy={b.y} r="1.4" style={{ fill: GOLD }} />}
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize="5.6" fontWeight="600" style={{ fill: GOLD }} className="select-none">
                {ANGLE_INFO[k].short}
              </text>
            </g>
          );
        })}

      {/* Cuerpos */}
      <g>
        {chart.bodies.map((body, i) => {
          const info = BODY_INFO[body.id];
          const disp = display[i];
          const g = polar(0, 0, R_GLYPH, toScreen(disp));
          const tick0 = at(R_SIGN, body.lon);
          const tick1 = at(R_SIGN - 4.2, body.lon);
          const lead = polar(0, 0, R_GLYPH + 5.4, toScreen(disp));
          const deg = polar(0, 0, R_DEG, toScreen(disp));
          const min = polar(0, 0, R_MIN, toScreen(disp));
          const dot = at(R_ASP, body.lon);
          const hit0 = polar(0, 0, R_MIN - 2, toScreen(disp));
          const hit1 = polar(0, 0, R_GLYPH + 4, toScreen(disp));
          const z = zodiacPos(body.lon);
          const isSelected = selBody === body.id;
          const dim = selBody !== null && !isSelected;
          const moved = Math.abs(((disp - body.lon + 540) % 360) - 180) > 0.4;
          return (
            <g key={body.id} data-pop="" style={{ ["--d" as string]: `${250 + i * 50}ms` }}>
              <g opacity={dim ? 0.4 : 1} style={{ transition: "opacity 400ms" }}>
                {/* La marca del grado exacto (y la línea hasta el glifo, si se ha apartado) y su punto en el círculo de aspectos. */}
                <g className="pointer-events-none">
                  <line x1={tick0.x} y1={tick0.y} x2={tick1.x} y2={tick1.y} style={{ stroke: GOLD }} strokeWidth="0.7" />
                  {moved && <line x1={tick1.x} y1={tick1.y} x2={lead.x} y2={lead.y} stroke="currentColor" strokeWidth="0.25" opacity="0.55" />}
                  <circle cx={dot.x} cy={dot.y} r="0.9" fill="currentColor" opacity="0.7" />
                </g>
                <g {...tap(`${info.name}: ${fmtPos(body.lon)}${body.retro ? ", retrógrado" : ""}${body.house ? `, casa ${body.house}` : ""}`, () => select({ kind: "body", id: body.id }))} {...grab(body.id === "southNode" ? "node" : (body.id as CustomPoint))}>
                  {/* Zona que se toca: del glifo a sus minutos. */}
                  <line x1={hit0.x} y1={hit0.y} x2={hit1.x} y2={hit1.y} stroke="transparent" strokeWidth="8.5" strokeLinecap="round" />
                  {isSelected && (
                    <circle
                      cx={g.x}
                      cy={g.y}
                      r="6"
                      style={{
                        fill: "color-mix(in oklab, var(--c-gold) 22%, transparent)",
                        stroke: GOLD,
                      }}
                      strokeWidth="0.5"
                    />
                  )}
                  <text
                    x={g.x}
                    y={g.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={info.group === "punto" ? 7.2 : 8.4}
                    fill={isSelected ? GOLD : "currentColor"}
                    className="pointer-events-none select-none"
                  >
                    {glyph(info.glyph)}
                  </text>
                  <text x={deg.x} y={deg.y} textAnchor="middle" dominantBaseline="central" fontSize="4.5" fill="currentColor" opacity="0.85" className="pointer-events-none select-none">
                    {z.deg}°
                  </text>
                  {(!narrow || body.retro) && (
                    <text x={min.x} y={min.y} textAnchor="middle" dominantBaseline="central" fontSize="3.9" fill="currentColor" opacity="0.65" className="pointer-events-none select-none">
                      {narrow ? "" : `${pad2(z.min)}′`}
                      {body.retro && <tspan fill="#D0584F">℞</tspan>}
                    </text>
                  )}
                </g>
              </g>
            </g>
          );
        })}
      </g>

      {drag?.moved &&
        (() => {
          const p = polar(0, 0, R_OUT + 22, toScreen(drag.lon));
          return (
            <g className="pointer-events-none select-none">
              <rect x={p.x - 24} y={p.y - 6.5} width="48" height="13" rx="6.5" style={{ fill: GOLD }} />
              <text x={p.x} y={p.y + 0.3} textAnchor="middle" dominantBaseline="central" fontSize="5.6" fontWeight="700" style={{ fill: "var(--c-bg)" }}>
                {fmtPos(drag.lon)}
              </text>
            </g>
          );
        })()}
    </svg>
  );

  /* ------------------------------------------------------------- cabecera */

  const tzNote = (() => {
    const r = resolved.res;
    if (!birth.timeKnown) return null;
    if (r.status === "ambiguous" && r.alternative) {
      const [first, second] = [r.offsetMinutes, r.alternative.offsetMinutes].map(formatOffset);
      return (
        <>
          Esa hora se repitió esa noche (cambio de hora): se usa la {useSecond ? "segunda" : "primera"} vez ({useSecond ? second : first}
          ).{" "}
          <PanelLink onClick={() => setUseSecond(!useSecond)}>
            Usar la {useSecond ? "primera" : "segunda"} ({useSecond ? first : second})
          </PanelLink>
        </>
      );
    }
    if (r.status === "gap")
      return (
        <>
          Esa hora no existió (los relojes se adelantaron esa noche): se lee con el horario de antes del cambio, que equivale a las{" "}
          {new Intl.DateTimeFormat("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: /^[A-Za-z]/.test(birth.place.tz) && !/^(UTC|GMT)/i.test(birth.place.tz) ? birth.place.tz : "UTC",
          }).format(resolved.utc)}{" "}
          del horario nuevo.
        </>
      );
    return null;
  })();

  const notes: ReactNode[] = [];
  if (tzNote) notes.push(tzNote);
  if (!birth.timeKnown) {
    const mr = resolved.moonRange;
    notes.push(
      <>
        Sin hora de nacimiento: la carta se calcula a las 12:00 y no tiene Ascendente, MC ni casas.
        {mr && (
          <>
            {" "}
            Ese día la Luna fue de {fmtPos(mr.from)} a {fmtPos(mr.to)}
            {signOf(mr.from).n !== signOf(mr.to).n ? ": cambió de signo, así que su signo depende de la hora." : "."}
          </>
        )}
      </>,
    );
  }
  if (chart.houses?.fallback) notes.push(chart.houses.fallback);
  if (!byId.has("chiron")) notes.push("Quirón solo se calcula para fechas de 1900 a 2050.");

  const header = (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="cp-eyebrow !text-[0.6rem]">{custom ? (isHandmade(custom) ? "Carta preparada a mano" : "Carta preparada") : isExample ? "Carta de ejemplo" : "Carta calculada"}</p>
          <p className="cp-display mt-1.5 text-[1.5rem] leading-tight">{custom?.name || birth.name || "Tu carta natal"}</p>
          <p className={cn("cp-muted mt-1 text-[0.82rem] leading-relaxed", custom && isHandmade(custom) && "hidden")}>
            {longDate(birth.date)}
            {birth.timeKnown ? `, ${birth.time}` : ", hora desconocida"} · {birth.place.label}
            {birth.place.detail && birth.place.detail !== "Coordenadas" ? ` (${birth.place.detail})` : ""}
          </p>
          <p className={cn("cp-faint mt-0.5 text-[0.72rem]", (compact || (custom && isHandmade(custom))) && "hidden")}>
            {formatCoord(birth.place.lat, "lat")} {formatCoord(birth.place.lon, "lon")} · {birth.timeKnown ? `${formatOffset(resolved.offset)} · ` : ""}
            {resolved.utc.toISOString().slice(0, 16).replace("T", " ")} UTC
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!formOpen && !fromProfile && ownForm && (
            <button type="button" className="cp-btn !min-h-10 !text-[0.85rem]" onClick={() => setFormOpen(true)}>
              {isExample ? "Calcular mi carta" : "Cambiar datos"}
            </button>
          )}
          {!isExample && !formOpen && !fromProfile && ownForm && (
            <button type="button" className="cp-btn-ghost !min-h-10 !text-[0.85rem]" onClick={showExample}>
              Ver el ejemplo
            </button>
          )}
        </div>
      </div>

      {formOpen && !fromProfile && ownForm && (
        <div className="mt-5">
          <BirthForm
            initial={isExample ? undefined : birth}
            onCancel={() => setFormOpen(false)}
            onSubmit={(data) => {
              setBirth(data);
              setIsExample(false);
              setUseSecond(false);
              setFormOpen(false);
              setSelection(null);
            }}
          />
        </div>
      )}

      {notes.length > 0 && !compact && (
        <ul className="mt-4 space-y-2">
          {notes.map((n, i) => (
            <li
              key={i}
              className="border-l-2 pl-3 text-[0.8rem] leading-relaxed opacity-85"
              style={{
                borderColor: "color-mix(in oklab, var(--c-gold) 55%, transparent)",
              }}
            >
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className={cn("mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.8rem]", (compact || custom?.lockSettings) && "hidden")}>
        {angles && (
          <label className="flex items-center gap-2">
            <span className="cp-eyebrow !text-[0.58rem]">Casas</span>
            <select
              aria-label="Sistema de casas"
              value={houseSystem}
              onChange={(e) => setHouseSystem(e.target.value as HouseSystem)}
              className="cp-line min-h-9 rounded-none border-0 border-b bg-transparent pr-1 text-[0.85rem] text-[var(--c-text)] focus:outline-none [&_option]:bg-[var(--c-bg)]"
            >
              {(Object.keys(HOUSE_SYSTEM_NAME) as HouseSystem[]).map((h) => (
                <option key={h} value={h}>
                  {HOUSE_SYSTEM_NAME[h]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2">
          <span className="cp-eyebrow !text-[0.58rem]">Nodos</span>
          <select
            aria-label="Nodos medios o verdaderos"
            value={nodeKind}
            onChange={(e) => setNodeKind(e.target.value as NodeKind)}
            className="cp-line min-h-9 rounded-none border-0 border-b bg-transparent pr-1 text-[0.85rem] text-[var(--c-text)] focus:outline-none [&_option]:bg-[var(--c-bg)]"
          >
            <option value="mean">Medios</option>
            <option value="true">Verdaderos</option>
          </select>
        </label>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- panel */

  // El texto de la dueña para el punto tocado (solo en una «Carta a mano»).
  const selectedPoint: CustomPoint | null =
    selection?.kind === "body" ? (selection.id === "southNode" ? "node" : (selection.id as CustomPoint)) : selection?.kind === "angle" && (selection.id === "asc" || selection.id === "mc") ? selection.id : null;
  const ownerNote = custom && selectedPoint ? custom.notes[selectedPoint] : undefined;

  const panel = (() => {
    if (!selection) {
      return (
        <PanelBody id="idle">
          <PanelIdle title="Toca un planeta, un signo, una casa, un eje o una línea de aspecto.">
            <p>
              Los <strong>signos</strong> describen el cómo; los <strong>planetas</strong>, el qué; las <strong>casas</strong>, el dónde. Y los <strong>aspectos</strong>, cómo hablan las partes entre
              sí.
            </p>
            <p>
              {angles
                ? "El anillo exterior lleva los doce signos; dentro, cada cuerpo en su grado exacto y las casas con el grado de su cúspide. Los ejes dorados son el horizonte (AC–DC) y el meridiano (MC–IC)."
                : "El anillo exterior lleva los doce signos y, dentro, cada cuerpo en su grado exacto. Sin hora no hay casas ni ejes: la rueda empieza en 0° de Aries, a la izquierda."}{" "}
              En el centro, los aspectos: en rojo los tensos, en azul y verde los armónicos.
            </p>
          </PanelIdle>
          <dl className="mt-6">
            {angles && <PanelRow label="Ascendente" value={signLink(angles.asc)} />}
            {angles && <PanelRow label="Medio Cielo" value={signLink(angles.mc)} />}
            <PanelRow label="Sol" value={signLink(byId.get("sun")!.lon)} />
            <PanelRow label="Luna" value={signLink(byId.get("moon")!.lon)} />
            <PanelRow label="Aspectos" value={`${aspects.length} dentro del orbe`} />
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "sign") {
      const s = SIGNS[selection.n];
      const inSign = chart.bodies.filter((b) => signOf(b.lon).n === s.n);
      const cuspsHere = cusps ? cusps.map((c, i) => ({ c, n: i + 1 })).filter(({ c }) => signOf(c).n === s.n) : [];
      return (
        <PanelBody id={`sign-${s.n}`}>
          <PanelHeading kicker={`Signo · ${s.element} · ${s.modality}`} title={`${glyph(s.glyph)} ${s.name}`} tone={ELEMENT_HUE[s.element]} />
          <p className="cp-display mt-4 text-[1.2rem] italic opacity-85">«{s.keyword}»</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{s.meaning}</p>
          <dl className="mt-6">
            <PanelRow label="Elemento" value={s.element} />
            <PanelRow label="Cualidad" value={s.modality} />
            <PanelRow label="Regente" value={bodyLink(s.rulerId, s.traditional ? <span className="cp-muted"> (tradicional: {BODY_INFO[s.traditional].name})</span> : null)} />
            <PanelRow
              label="Ocupado por"
              value={
                inSign.length ? (
                  <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">{inSign.map((b) => bodyLink(b.id))}</span>
                ) : (
                  <span className="cp-muted">nadie, y eso no lo hace menos importante</span>
                )
              }
            />
            {cusps && (
              <PanelRow
                label="Cúspides"
                value={
                  cuspsHere.length ? (
                    <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                      {cuspsHere.map(({ n }) => (
                        <PanelLink key={n} onClick={() => select({ kind: "house", n })}>
                          {HOUSES[n - 1].name}
                        </PanelLink>
                      ))}
                    </span>
                  ) : (
                    <span className="cp-muted">ninguna (signo interceptado)</span>
                  )
                }
              />
            )}
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "house" && cusps) {
      const h = HOUSES[selection.n - 1];
      const cusp = cusps[h.n - 1];
      const cuspSign = signOf(cusp);
      const inHouse = chart.bodies.filter((b) => b.house === h.n);
      const ruler = byId.get(cuspSign.rulerId);
      return (
        <PanelBody id={`house-${h.n}`}>
          <PanelHeading kicker={`Casa · ${h.axis}`} title={h.name} />
          <p className="cp-display mt-4 text-[1.2rem] italic opacity-85">{h.keyword}</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{h.meaning}</p>
          <dl className="mt-6">
            <PanelRow label="Cúspide" value={signLink(cusp)} />
            <PanelRow label="Sistema" value={HOUSE_SYSTEM_NAME[chart.houses!.system]} />
            {ruler && (
              <PanelRow
                label="Regente"
                value={
                  <span>
                    {bodyLink(ruler.id)}
                    <span className="cp-muted">
                      {" "}
                      en {fmtPos(ruler.lon)}
                      {ruler.house ? `, casa ${ruler.house}` : ""}
                    </span>
                  </span>
                }
              />
            )}
            <PanelRow
              label="Ocupada por"
              value={
                inHouse.length ? (
                  <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">{inHouse.map((b) => bodyLink(b.id))}</span>
                ) : (
                  <span className="cp-muted">vacía: no vives ahí, pero igualmente sucede</span>
                )
              }
            />
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "body") {
      const b = byId.get(selection.id);
      if (!b) return null;
      const info = BODY_INFO[b.id];
      const sign = signOf(b.lon);
      const rules = cusps ? cusps.map((c, i) => ({ s: signOf(c), n: i + 1 })).filter(({ s }) => s.rulerId === b.id) : [];
      return (
        <PanelBody id={`body-${b.id}`}>
          <PanelHeading kicker={`${GROUP_LABEL[info.group]}${b.retro ? " · retrógrado" : ""}`} title={`${glyph(info.glyph)} ${info.name}`} />
          <p className="cp-display mt-4 text-[1.2rem] italic opacity-85">{info.keyword}</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{info.meaning}</p>
          <p className="mt-5 border-l-2 pl-4 text-[0.9rem] leading-relaxed opacity-85" style={{ borderColor: ELEMENT_HUE[sign.element] }}>
            <strong>
              {info.name} en {sign.name}.
            </strong>{" "}
            {bodyInSignText(info, sign)}
          </p>
          {b.house && (
            <p
              className="mt-3 border-l-2 pl-4 text-[0.9rem] leading-relaxed opacity-85"
              style={{
                borderColor: "color-mix(in oklab, var(--c-text) 30%, transparent)",
              }}
            >
              <strong>
                {info.name} en la {HOUSES[b.house - 1].name}.
              </strong>{" "}
              {bodyInHouseText(info, HOUSES[b.house - 1])}
            </p>
          )}
          {b.id === "moon" && resolved.moonRange && (
            <p className="cp-muted mt-3 text-[0.82rem] leading-relaxed">
              Sin hora: ese día la Luna fue de {fmtPos(resolved.moonRange.from)} a {fmtPos(resolved.moonRange.to)}. Aquí se muestra a las 12:00.
            </p>
          )}
          <dl className="mt-6">
            <PanelRow
              label="Posición"
              value={
                <span>
                  {signLink(b.lon)}
                  {b.retro && <span style={{ color: "#D0584F" }}> ℞</span>}
                </span>
              }
            />
            {b.house && <PanelRow label="Casa" value={houseLink(b.house)} />}
            <PanelRow
              label="Movimiento"
              value={`${b.retro ? "retrógrado" : b.id === "node" || b.id === "southNode" ? (b.speed < 0 ? "hacia atrás (como siempre)" : "hacia delante") : "directo"} · ${Math.abs(b.speed) < 0.1 ? b.speed.toFixed(3) : b.speed.toFixed(2)}°/día`.replace(
                ".",
                ",",
              )}
            />
            {rules.length > 0 && (
              <PanelRow
                label="Rige"
                value={
                  <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    {rules.map(({ n }) => (
                      <PanelLink key={n} onClick={() => select({ kind: "house", n })}>
                        {HOUSES[n - 1].name}
                      </PanelLink>
                    ))}
                  </span>
                }
              />
            )}
            {b.id !== "southNode" && <PanelRow label="Aspectos" value={aspectList(b.id)} />}
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "angle" && angles) {
      const k = selection.id;
      const lon = angles[k];
      const a = ANGLE_INFO[k];
      const sign = signOf(lon);
      return (
        <PanelBody id={`angle-${k}`}>
          <PanelHeading kicker={`Ángulo · cúspide de la ${HOUSES[a.house - 1].name}`} title={`${a.short} · ${a.name}`} />
          <p className="cp-display mt-4 text-[1.2rem] italic opacity-85">{a.keyword}</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{a.meaning}</p>
          <p className="mt-5 border-l-2 pl-4 text-[0.9rem] leading-relaxed opacity-85" style={{ borderColor: ELEMENT_HUE[sign.element] }}>
            <strong>
              {a.name} en {sign.name}.
            </strong>{" "}
            {angleInSignText(sign)}
          </p>
          <dl className="mt-6">
            <PanelRow label="Posición" value={signLink(lon)} />
            {k === "asc" && (
              <PanelRow
                label="Regente de la carta"
                value={
                  <span className="flex flex-col items-end gap-1">
                    {bodyLink(sign.rulerId)}
                    {sign.traditional && <span className="cp-muted">tradicional: {bodyLink(sign.traditional)}</span>}
                  </span>
                }
              />
            )}
            {(k === "asc" || k === "mc") && <PanelRow label="Aspectos" value={aspectList(k)} />}
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "aspect") {
      const asp = aspects.find((x) => sameAspect(x, selection.a, selection.b));
      if (!asp) return null;
      const t = ASPECT_BY_ID[asp.type];
      const kw = (id: ChartPointId) => (id === "asc" || id === "mc" ? ANGLE_INFO[id].keyword : BODY_INFO[id].keyword).toLowerCase();
      return (
        <PanelBody id={`aspect-${asp.a}-${asp.b}`}>
          <PanelHeading kicker={`Aspecto · ${t.angle}° · ${t.nature}`} title={`${pointName(asp.a)} ${t.name.toLowerCase()} ${pointName(asp.b)}`} tone={t.color} />
          <p className="mt-4 text-[0.95rem] leading-relaxed opacity-85">{t.meaning}</p>
          <p className="mt-5 border-l-2 pl-4 text-[0.9rem] leading-relaxed opacity-80" style={{ borderColor: t.color }}>
            Aquí <strong>{kw(asp.a)}</strong> se encuentra con <strong>{kw(asp.b)}</strong>.
          </p>
          <dl className="mt-6">
            <PanelRow label="Orbe" value={`${fmtOrb(asp.orb)} de ${asp.maxOrb}° posibles`} />
            {asp.applying !== undefined && <PanelRow label="Momento" value={asp.applying ? "se está formando (aplicativo)" : "se está deshaciendo (separativo)"} />}
            <PanelRow label="Participan" value={<span className="flex flex-wrap justify-end gap-x-3 gap-y-1">{[asp.a, asp.b].map((id) => bodyLink(id))}</span>} />
          </dl>
        </PanelBody>
      );
    }
    return null;
  })();

  /* ------------------------------------------------------------- tablas */

  const balance = useMemo(() => {
    const el: Record<Element, BodyId[]> = {
      Fuego: [],
      Tierra: [],
      Aire: [],
      Agua: [],
    };
    const mo: Record<Modality, BodyId[]> = {
      cardinal: [],
      fijo: [],
      mutable: [],
    };
    for (const id of CLASSIC) {
      const b = byId.get(id);
      if (!b) continue;
      const s = signOf(b.lon);
      el[s.element].push(id);
      mo[s.modality].push(id);
    }
    return { el, mo };
  }, [byId]);

  const positionsTable = (
    <div>
      <p className="cp-eyebrow !text-[0.6rem]">Posiciones</p>
      <table className="mt-3 w-full border-collapse text-[0.86rem]">
        <thead>
          <tr className="cp-muted text-left text-[0.62rem] uppercase tracking-[0.14em]">
            <th className="pb-2 font-normal">Cuerpo</th>
            <th className="pb-2 font-normal">Posición</th>
            {cusps && <th className="pb-2 text-right font-normal">Casa</th>}
          </tr>
        </thead>
        <tbody>
          {[
            ...chart.bodies.map((b) => ({ id: b.id as ChartPointId, b })),
            ...(angles
              ? (["asc", "mc"] as const).map((id) => ({
                  id: id as ChartPointId,
                  b: null as ChartBody | null,
                }))
              : []),
          ].map(({ id, b }) => {
            const lon = b ? b.lon : lonOf(id);
            const s = signOf(lon);
            const z = zodiacPos(lon);
            const isSel = selBody === id;
            return (
              <tr
                key={id}
                className={cn("cp-line cursor-pointer border-t transition-colors", isSel && "bg-[color-mix(in_oklab,var(--c-gold)_9%,transparent)]")}
                onClick={() => select(id === "asc" || id === "mc" ? { kind: "angle", id } : { kind: "body", id: id as BodyId })}
              >
                <td className="py-2 pr-2">
                  <button type="button" className="text-left" onClick={(e) => (e.stopPropagation(), select(id === "asc" || id === "mc" ? { kind: "angle", id } : { kind: "body", id: id as BodyId }))}>
                    <span className="inline-block w-6 text-center">{pointGlyph(id)}</span> {pointName(id)}
                  </button>
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  <span
                    style={{
                      color: ELEMENT_HUE[s.element],
                      filter: "brightness(1.25)",
                    }}
                  >
                    {glyph(s.glyph)}
                  </span>{" "}
                  {z.deg}°{pad2(z.min)}′ {s.name}
                  {b?.retro && <span style={{ color: "#D0584F" }}> ℞</span>}
                </td>
                {cusps && <td className="py-2 text-right tabular-nums">{b?.house ? HOUSES[b.house - 1].name.replace("Casa ", "") : ""}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {cusps && (
        <p className="cp-muted mt-3 text-[0.75rem] leading-relaxed">
          Cúspides ({HOUSE_SYSTEM_NAME[chart.houses!.system]}):{" "}
          {cusps.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && " · "}
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => select({ kind: "house", n: i + 1 })}>
                {HOUSES[i].name.replace("Casa ", "")} {zodiacPos(c).deg}°{glyph(signOf(c).glyph)}
                {pad2(zodiacPos(c).min)}′
              </button>
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );

  const gridIds = GRID_ORDER.filter((id) => (id === "asc" || id === "mc" ? !!angles : byId.has(id)));
  const aspectGrid = (
    <div>
      <p className="cp-eyebrow !text-[0.6rem]">Aspectario</p>
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="grid w-full max-w-max" style={{ gridTemplateColumns: `repeat(${gridIds.length}, minmax(1.15rem, 1.45rem))` }} role="table" aria-label="Aspectos entre cada par">
          {gridIds.map((row, i) =>
            gridIds.map((col, j) => {
              if (j > i) return <div key={`${row}-${col}`} />;
              if (j === i)
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    title={pointName(row)}
                    onClick={() => select(row === "asc" || row === "mc" ? { kind: "angle", id: row } : { kind: "body", id: row as BodyId })}
                    className={cn("flex aspect-square items-center justify-center text-[0.8rem]", (row === "asc" || row === "mc") && "!text-[0.5rem] font-semibold tracking-tight", selBody === row && "cp-gold")}
                  >
                    {pointGlyph(row)}
                  </button>
                );
              const asp = aspects.find((x) => sameAspect(x, row, col));
              const t = asp && ASPECT_BY_ID[asp.type];
              const isSel = asp && selection?.kind === "aspect" && sameAspect(asp, selection.a, selection.b);
              return (
                <div
                  key={`${row}-${col}`}
                  className="cp-line aspect-square border-b border-l"
                  style={{
                    borderColor: "color-mix(in oklab, var(--c-text) 12%, transparent)",
                  }}
                >
                  {asp && t && (
                    <button
                      type="button"
                      title={`${pointName(asp.a)} ${t.name.toLowerCase()} ${pointName(asp.b)} · orbe ${fmtOrb(asp.orb)}`}
                      onClick={() => select({ kind: "aspect", a: asp.a, b: asp.b })}
                      className="flex h-full w-full items-center justify-center text-[0.78rem] leading-none"
                      style={{
                        color: t.color,
                        background: isSel ? `color-mix(in oklab, ${t.color} 22%, transparent)` : undefined,
                      }}
                    >
                      {glyph(t.glyph)}
                    </button>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );

  const dominant = (counts: Record<string, BodyId[]>) => {
    const max = Math.max(...Object.values(counts).map((v) => v.length));
    return Object.keys(counts).filter((k) => counts[k].length === max);
  };
  const ascSign = angles ? signOf(angles.asc) : null;
  const balanceBlock = (
    <div>
      <p className="cp-eyebrow !text-[0.6rem]">Elementos y cualidades</p>
      <p className="cp-muted mt-1 text-[0.75rem]">Del Sol a Plutón (diez cuerpos).</p>
      <div className="mt-3 space-y-2">
        {(Object.keys(balance.el) as Element[]).map((el) => (
          <div key={el} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-[0.82rem]">
            <span>{el}</span>
            <span
              className="h-1.5 overflow-hidden rounded-full"
              style={{
                background: "color-mix(in oklab, var(--c-text) 8%, transparent)",
              }}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${balance.el[el].length * 10}%`,
                  background: ELEMENT_HUE[el],
                  transition: "width 600ms",
                }}
              />
            </span>
            <span className="tabular-nums opacity-80">
              {balance.el[el].length} <span className="cp-muted">{balance.el[el].map((id) => glyph(BODY_INFO[id].glyph)).join(" ")}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {(Object.keys(balance.mo) as Modality[]).map((m) => (
          <div key={m} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-[0.82rem]">
            <span className="capitalize">{m}</span>
            <span
              className="h-1.5 overflow-hidden rounded-full"
              style={{
                background: "color-mix(in oklab, var(--c-text) 8%, transparent)",
              }}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${balance.mo[m].length * 10}%`,
                  background: GOLD,
                  transition: "width 600ms",
                }}
              />
            </span>
            <span className="tabular-nums opacity-80">
              {balance.mo[m].length} <span className="cp-muted">{balance.mo[m].map((id) => glyph(BODY_INFO[id].glyph)).join(" ")}</span>
            </span>
          </div>
        ))}
      </div>
      <dl className="mt-5">
        <PanelRow label="Domina" value={`${dominant(balance.el).join(" y ")} · ${dominant(balance.mo).join(" y ")}`} />
        {ascSign && (
          <PanelRow
            label="Regente de la carta"
            value={
              <span className="flex flex-col items-end gap-1">
                <span>
                  {bodyLink(ascSign.rulerId)}
                  <span className="cp-muted"> (regente de {ascSign.name}, el Ascendente)</span>
                </span>
                {byId.get(ascSign.rulerId) && (
                  <span className="cp-muted">
                    en {fmtPos(byId.get(ascSign.rulerId)!.lon)}
                    {byId.get(ascSign.rulerId)!.house ? `, casa ${byId.get(ascSign.rulerId)!.house}` : ""}
                  </span>
                )}
                {ascSign.traditional && <span className="cp-muted">tradicional: {bodyLink(ascSign.traditional)}</span>}
              </span>
            }
          />
        )}
      </dl>
    </div>
  );

  const footer = (
    <div className="space-y-9">
      {positionsTable}
      {aspectGrid}
      {balanceBlock}
      <p className="cp-faint text-[0.7rem] leading-relaxed">
        Zodiaco tropical, posiciones geocéntricas aparentes (astronomy-engine; Quirón, de JPL Horizons). Nodo {nodeKind === "true" ? "verdadero" : "medio"} y Lilith media. Orbes: 10° para el Sol y la
        Luna en conjunción y oposición, 8° el resto de planetas, menos para los puntos y los ángulos.
      </p>
    </div>
  );

  /* --------------------------------------------------- versión rápida */

  const summary = (() => {
    const pos = (lon: number) => `${glyph(signOf(lon).glyph)} ${SIGNS[signOf(lon).n].name}`;
    if (!selection) {
      const parts = [`Sol en ${pos(byId.get("sun")!.lon)}`, `Luna en ${pos(byId.get("moon")!.lon)}`];
      if (angles) parts.push(`Ascendente en ${pos(angles.asc)}`);
      return <CompactSummary key="idle" title={parts.join(" · ")} text="Sol, Luna y Ascendente: el triángulo que más se nota en el día a día." />;
    }
    switch (selection.kind) {
      case "sign": {
        const s = SIGNS[selection.n];
        return <CompactSummary key={`s${s.n}`} tone={ELEMENT_HUE[s.element]} title={`${glyph(s.glyph)} ${s.name} · «${s.keyword}»`} text={s.meaning} />;
      }
      case "house": {
        const h = HOUSES[selection.n - 1];
        return <CompactSummary key={`h${h.n}`} title={`${h.name} · ${h.keyword}`} text={h.meaning} />;
      }
      case "body": {
        const b = byId.get(selection.id);
        if (!b) return null;
        const info = BODY_INFO[b.id];
        return (
          <CompactSummary
            key={`b${b.id}`}
            title={`${glyph(info.glyph)} ${info.name} en ${fmtPos(b.lon)}${b.house ? ` · casa ${b.house}` : ""}${b.retro ? " ℞" : ""}`}
            text={info.keyword}
          />
        );
      }
      case "angle": {
        if (!angles) return null;
        const a = ANGLE_INFO[selection.id];
        return <CompactSummary key={`a${selection.id}`} title={`${a.name} en ${fmtPos(angles[selection.id])}`} text={a.keyword} />;
      }
      case "aspect": {
        const asp = aspects.find((x) => sameAspect(x, selection.a, selection.b));
        if (!asp) return null;
        const t = ASPECT_BY_ID[asp.type];
        return <CompactSummary key={`x${asp.a}${asp.b}`} tone={t.color} title={`${pointName(asp.a)} ${t.name.toLowerCase()} ${pointName(asp.b)} · ${fmtOrb(asp.orb)}`} text={t.nature} />;
      }
    }
  })();

  if (compact)
    return (
      <ModelFrame
        compact
        diagram={
          <div>
            {header}
            <div className="mt-5">{wheel}</div>
          </div>
        }
        legend={
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {(["Fuego", "Tierra", "Aire", "Agua"] as const).map((el) => (
              <LegendDot key={el} color={ELEMENT_HUE[el]} label={el} />
            ))}
          </div>
        }
        panel={null}
        summary={summary}
      />
    );

  return (
    <ModelFrame
      toolbar={
        <div className="flex gap-2">
          {ASPECTS.map((a) => (
            <ToolButton
              key={a.id}
              active={enabled.has(a.id)}
              onClick={() =>
                setEnabled((prev) => {
                  const next = new Set(prev);
                  if (next.has(a.id)) next.delete(a.id);
                  else next.add(a.id);
                  return next;
                })
              }
            >
              <span style={{ color: enabled.has(a.id) ? a.color : undefined }}>{glyph(a.glyph)}</span>
              <span className="ml-1.5">{a.name}</span>
            </ToolButton>
          ))}
        </div>
      }
      diagram={
        <div>
          {header}
          <div className="relative mx-auto mt-6 max-w-[34rem]">
            {wheel}
            {editing && custom && onCustomChange && selectedPoint && !drag && (
              <PointBubble
                point={selectedPoint}
                custom={custom}
                onChange={onCustomChange}
                onClose={() => setSelection(null)}
                lon={selectedPoint === "asc" ? angles?.asc ?? 0 : selectedPoint === "mc" ? angles?.mc ?? 0 : byId.get(selectedPoint)?.lon ?? 0}
                retro={selectedPoint !== "asc" && selectedPoint !== "mc" ? !!byId.get(selectedPoint)?.retro : false}
                at={(() => {
                  const i = chart.bodies.findIndex((b) => b.id === selectedPoint);
                  const lon = selectedPoint === "asc" ? angles?.asc ?? 0 : selectedPoint === "mc" ? angles?.mc ?? 0 : i >= 0 ? display[i] : 0;
                  const p = polar(0, 0, selectedPoint === "asc" || selectedPoint === "mc" ? R_OUT + 12 : R_GLYPH, toScreen(lon));
                  return { x: ((p.x + 128) / 256) * 100, y: ((p.y + 128) / 256) * 100 };
                })()}
              />
            )}
          </div>
          {editing && custom && onCustomChange && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[0.78rem]">
              <span className="cp-muted">Arrastra cualquier punto por la rueda. Tócalo para afinarlo.</span>
              {custom.hidden.length > 0 && (
                <>
                  <span className="cp-muted">· Escondidos:</span>
                  {custom.hidden.map((p) => (
                    <button key={p} type="button" className="cp-btn-ghost !min-h-8 !px-2.5 !text-[0.75rem]" onClick={() => onCustomChange({ ...custom, hidden: custom.hidden.filter((x) => x !== p) })}>
                      {p === "asc" ? "AC" : p === "mc" ? "MC" : glyph(BODY_INFO[p].glyph)} {pointName(p)} · mostrar
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      }
      legend={
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(["Fuego", "Tierra", "Aire", "Agua"] as const).map((el) => (
            <LegendDot key={el} color={ELEMENT_HUE[el]} label={el} />
          ))}
          <LegendDot color={ASPECT_BY_ID.square.color} label="Tensos" />
          <LegendDot color={ASPECT_BY_ID.trine.color} label="Armónicos" />
        </div>
      }
      panel={
        ownerNote ? (
          <div>
            <p className="mb-4 whitespace-pre-line rounded-xl border px-4 py-3 text-[0.92rem] leading-relaxed" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 45%, transparent)", background: "color-mix(in oklab, var(--c-gold) 10%, transparent)" }}>
              {ownerNote}
            </p>
            {panel}
          </div>
        ) : (
          panel
        )
      }
      footer={footer}
    />
  );
}

/** La burbuja de la carta a mano: el punto tocado, con + y − para afinar grado y minuto, retrógrado, si se ve y su texto. */
function PointBubble({
  point,
  custom,
  onChange,
  onClose,
  lon,
  retro,
  at,
}: {
  point: CustomPoint;
  custom: CustomChartData;
  onChange: (c: CustomChartData) => void;
  onClose: () => void;
  lon: number;
  retro: boolean;
  at: { x: number; y: number };
}) {
  const manual = custom.positions[point] != null;
  const canRetro = point !== "asc" && point !== "mc" && point !== "node" && point !== "lilith" && point !== "sun" && point !== "moon";
  const canHide = !["sun", "moon", "asc", "mc"].includes(point);
  const move = (deg: number) => onChange({ ...custom, positions: { ...custom.positions, [point]: norm(Math.round((lon + deg) * 60) / 60) } });
  const reset = () => {
    const positions = { ...custom.positions };
    delete positions[point];
    onChange({ ...custom, positions, retro: custom.retro.filter((x) => x !== point) });
  };
  const setRetro = (on: boolean) =>
    onChange({ ...custom, positions: { ...custom.positions, [point]: lon }, retro: on ? [...custom.retro.filter((x) => x !== point), point] : custom.retro.filter((x) => x !== point) });
  const note = custom.notes[point] ?? "";
  const below = at.y < 50;
  const step = (label: string, deg: number) => (
    <button type="button" className="cp-line grid h-8 w-8 place-items-center rounded-full border text-[0.95rem] leading-none" onClick={() => move(deg)} aria-label={label}>
      {deg > 0 ? "+" : "−"}
    </button>
  );
  return (
    <div
      className="absolute z-10 w-[16rem] rounded-2xl border p-3 text-[0.82rem] shadow-xl"
      style={{
        left: `${Math.min(78, Math.max(22, at.x))}%`,
        top: `${at.y}%`,
        transform: below ? "translate(-50%, 18px)" : "translate(-50%, calc(-100% - 18px))",
        background: "var(--c-bg)",
        borderColor: "color-mix(in oklab, var(--c-gold) 55%, transparent)",
        color: "var(--c-text)",
      }}
      role="dialog"
      aria-label={`Editar ${pointName(point)}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-[1.3rem] leading-none" style={{ color: "var(--c-gold)" }}>
          {point === "asc" ? "AC" : point === "mc" ? "MC" : glyph(BODY_INFO[point].glyph)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{pointName(point)}</p>
          <p className="cp-muted">
            {fmtPos(lon)}
            {manual ? " · a mano" : " · como en la carta"}
          </p>
        </div>
        <button type="button" className="cp-muted -mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-lg" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="cp-muted w-14">Grado</span>
        <span className="flex gap-1.5">
          {step("Un grado menos", -1)}
          {step("Un grado más", 1)}
        </span>
        <span className="cp-muted w-14 text-right">Minuto</span>
        <span className="flex gap-1.5">
          {step("Un minuto menos", -1 / 60)}
          {step("Un minuto más", 1 / 60)}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {canRetro && (
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={retro} onChange={(e) => setRetro(e.target.checked)} /> Retrógrado ℞
          </label>
        )}
        {canHide && (
          <button
            type="button"
            className="underline decoration-dotted underline-offset-2"
            onClick={() => {
              onChange({ ...custom, hidden: [...custom.hidden.filter((x) => x !== point), point] });
              onClose();
            }}
          >
            Esconderlo
          </button>
        )}
        {manual && (
          <button type="button" className="underline decoration-dotted underline-offset-2" onClick={reset}>
            Como en la carta
          </button>
        )}
      </div>
      <textarea
        className="cp-line mt-2.5 min-h-16 w-full rounded-xl border bg-transparent px-2.5 py-2 text-[0.85rem]"
        maxLength={4000}
        value={note}
        placeholder="El texto que lee la alumna al tocarlo"
        onChange={(e) => {
          const notes = { ...custom.notes, [point]: e.target.value };
          if (!e.target.value.trim()) delete notes[point];
          onChange({ ...custom, notes });
        }}
      />
    </div>
  );
}
