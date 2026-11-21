"use client";

import { useMemo, useState } from "react";
import { BODY_INFO, ELEMENT_HUE, HOUSES, SIGNS, bodyInHouseText, bodyInSignText, type Element, type Modality } from "@/components/models/data/astrology";
import { longitude, speed, type Point } from "@/lib/astro-calendar";
import { spreadLongitudes } from "@/lib/natal-chart";
import { LAYER_KEYS, TEN_PLANETS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, ROMAN, degIn, listEs, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { WK_GOLD as GOLD, WK_INK as INK } from "./wheel-kit";
import { ELEMENT_TEXT, RETRO } from "./astro2-texts";
import { aspectOf, balanceOf, planetsOf, skyAt, type Planet, type Pos } from "./astro2-calc";
import { SVG, glyph, name } from "./astro2";
import { MODALITY_HUE } from "./astro-wheels";
import { MODALITY_TEXT } from "./texts";
import { WheelBase, WheelDefs, useWheelIds } from "./wheel-kit";

/**
 * Tres capas más de astrología: el balance de elementos y cualidades comparado con otra persona (dos paneles
 * iguales, lado a lado), los retrógrados de cada planeta por años (con la carta de cada fecha y, si se quiere,
 * en doble rueda con la carta de la alumna) y planeta + signo + casa (tres listas para probar todas las
 * combinaciones, con texto automático y el que escriba la dueña para cada planeta en cada signo y en cada casa).
 */

export type Astro3Layer = Extract<AstroLayer, "astro-balance-compare" | "astro-retro-dates" | "astro-combos">;
export const ASTRO3_LAYERS = new Set<string>(["astro-balance-compare", "astro-retro-dates", "astro-combos"]);

const ELEMENTS: Element[] = ["Fuego", "Tierra", "Aire", "Agua"];
const MODALITIES: Modality[] = ["cardinal", "fijo", "mutable"];
const RETRO_PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
const POINT_OF: Record<string, Point> = { mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto" };
const DAY = 86_400_000;
const fmtShort = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
const fmtLong = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const where = (lon: number) => `${degIn(lon)} de ${SIGNS[signIndex(lon)].name}`;
const thisYear = () => new Date().getFullYear();

/* ------------------------------------------------- planeta + signo + casa */

/** Las 1.440 combinaciones («mars|7|3»: Marte, Escorpio, casa 3). */
/** Los cuerpos de planeta + signo + casa: los diez planetas, Quirón y Lilith. */
const COMBO_BODIES = [...TEN_PLANETS, "chiron", "lilith"] as const;
const COMBOS = COMBO_BODIES.flatMap((p) => SIGNS.flatMap((s) => HOUSES.map((h) => `${p}|${s.n}|${h.n}`)));
const parseCombo = (k: string) => {
  const [p, s, h] = k.split("|");
  return { p: p as Planet, s: Number(s), h: Number(h) };
};
/** Los textos de la dueña: «s:mars:7» (Marte en Escorpio) y «h:mars:3» (Marte en casa 3). */
export const comboNoteLabel = (k: string) => {
  const [kind, p, n] = k.split(":");
  return kind === "s" ? `${name(p)} en ${SIGNS[Number(n)].name}` : `${name(p)} en casa ${ROMAN[Number(n) - 1]}`;
};

/* ----------------------------------------------------------- retrógrados */

type RetroPeriod = { start: Date; end: Date; lonStart: number; lonEnd: number };
const retroCache = new Map<string, RetroPeriod[]>();

/** Los retrógrados de un planeta que tocan un año: de su estación retrógrada a su estación directa. */
export function retroPeriods(planet: string, year: number): RetroPeriod[] {
  const key = `${planet}|${year}`;
  const hit = retroCache.get(key);
  if (hit) return hit;
  const body = POINT_OF[planet];
  const from = Date.UTC(year - 1, 5, 1);
  const to = Date.UTC(year + 1, 6, 1);
  const f = (t: number) => speed(body, new Date(t));
  const stations: { at: number; retro: boolean }[] = [];
  const step = 12 * 3_600_000;
  let t0 = from;
  let v0 = f(t0);
  for (let t1 = t0 + step; t1 <= to; t1 += step) {
    const v1 = f(t1);
    if (v0 < 0 !== v1 < 0) {
      let a = t0;
      let b = t1;
      for (let i = 0; i < 30 && b - a > 60_000; i++) {
        const m = (a + b) / 2;
        if (f(m) < 0 === v0 < 0) a = m;
        else b = m;
      }
      stations.push({ at: (a + b) / 2, retro: v1 < 0 });
    }
    t0 = t1;
    v0 = v1;
  }
  const yStart = Date.UTC(year, 0, 1);
  const yEnd = Date.UTC(year + 1, 0, 1);
  const out: RetroPeriod[] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const s = stations[i];
    const e = stations[i + 1];
    if (!s.retro || e.retro) continue;
    if (e.at < yStart || s.at >= yEnd) continue;
    out.push({ start: new Date(s.at), end: new Date(e.at), lonStart: longitude(body, new Date(s.at)), lonEnd: longitude(body, new Date(e.at)) });
  }
  retroCache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ piezas */

export function astro3Keys(layer: Astro3Layer): string[] {
  if (layer === "astro-combos") return COMBOS;
  return LAYER_KEYS[layer];
}

export function astro3Mine(layer: Astro3Layer, { c }: LayerCtx): string[] {
  const ps = planetsOf(c?.chart);
  if (!ps.length) return [];
  switch (layer) {
    case "astro-balance-compare": {
      const b = balanceOf(ps);
      const top = (ks: string[]) => ks.reduce((a, k) => (b[k].length > b[a].length ? k : a), ks[0]);
      return [top(ELEMENTS), top(MODALITIES)];
    }
    case "astro-retro-dates":
      return ps.filter((p) => p.retro && (RETRO_PLANETS as readonly string[]).includes(p.id)).map((p) => p.id);
    case "astro-combos":
      return (c?.chart.bodies ?? []).filter((b) => b.house && (COMBO_BODIES as readonly string[]).includes(b.id)).map((b) => `${b.id}|${signIndex(b.lon)}|${b.house}`);
  }
}

export function astro3Piece(layer: Astro3Layer, key: string, ctx: LayerCtx): SystemPiece {
  const ps = planetsOf(ctx.c?.chart);
  switch (layer) {
    case "astro-balance-compare": {
      const isEl = (ELEMENTS as string[]).includes(key);
      const os = planetsOf(ctx.other?.chart);
      const who = ctx.others?.[ctx.otherIndex ?? 0]?.name ?? "la otra persona";
      const mine = balanceOf(ps)[key] ?? [];
      const theirs = balanceOf(os)[key] ?? [];
      const line = (n: string, l: string[]) => `${n}: ${l.length ? `${l.length} (${listEs(l)})` : "ninguno"}`;
      return {
        glyph: "",
        name: isEl ? key : `${MODALITY_TEXT[key as Modality].name} · ${MODALITY_TEXT[key as Modality].verb}`,
        kicker: SIGNS.filter((s) => (isEl ? s.element === key : s.modality === key)).map((s) => s.name).join(", "),
        meaning: isEl ? ELEMENT_TEXT[key] : MODALITY_TEXT[key as Modality].meaning,
        personal: !ps.length ? null : !os.length ? `${line("Tú", mine)}. Guarda en «Mi energía» los datos de otra persona para comparar.` : `${line("Tú", mine)}.\n${line(who, theirs)}.${mine.length === theirs.length ? "\nAquí estáis igual." : mine.length > theirs.length ? `\nTú pones más de esta energía; ${who} la encuentra en ti.` : `\n${who} pone más de esta energía; tú la encuentras en esa relación.`}`,
      };
    }
    case "astro-retro-dates": {
      const r = RETRO[key];
      const y = thisYear();
      const list = retroPeriods(key, y);
      const natal = ps.find((p) => p.id === key);
      return {
        glyph: glyph(key),
        name: `${name(key)} retrógrado`,
        kicker: r?.how ?? "",
        meaning: `${r?.meaning ?? ""}\n\nEn ${y}: ${list.length ? list.map((p) => `del ${fmtShort(p.start)} al ${fmtShort(p.end)}`).join("; ") : "no se pone retrógrado"}.`,
        personal: natal ? (natal.retro ? `Naciste con ${name(key)} retrógrado. ${r?.natal ?? ""}` : `Tu ${name(key)} natal es directo, en ${where(natal.lon)}.`) : null,
      };
    }
    case "astro-combos": {
      // En el editor, las claves son los textos de la dueña («s:mars:7», «h:mars:3»).
      if (key.includes(":")) return { glyph: glyph(key.split(":")[1]), name: comboNoteLabel(key), kicker: "", meaning: "", personal: null };
      const { p, s, h } = parseCombo(key);
      const body = BODY_INFO[p];
      const sign = SIGNS[s];
      const house = HOUSES[h - 1];
      const noteS = ctx.notes?.[`s:${p}:${s}`]?.trim();
      const noteH = ctx.notes?.[`h:${p}:${h}`]?.trim();
      const mine = ctx.c?.chart.bodies.find((x) => x.id === p);
      const inSign = mine && signIndex(mine.lon) === s;
      const inHouse = mine && mine.house === h;
      return {
        glyph: glyph(p),
        name: `${body.name} en ${sign.name}, casa ${ROMAN[h - 1]}`,
        kicker: `${sign.element} ${sign.modality} · ${house.keyword}`,
        meaning: [bodyInSignText(body, sign), noteS, bodyInHouseText(body, house), noteH].filter(Boolean).join("\n\n"),
        personal: !mine ? null : inSign && inHouse ? `Es tu ${body.name}: en ${sign.name}, casa ${ROMAN[h - 1]}.` : `Tu ${body.name} está en ${sign.name}${mine.house ? `, casa ${ROMAN[mine.house - 1]}` : ""}.${inSign ? " El signo coincide." : ""}${inHouse ? " La casa coincide." : ""}`,
      };
    }
  }
}

/* ----------------------------------------------------------------- dibujos */

export function Astro3Diagram({ layer, selected, mine, tap, ctx }: DiagramProps & { layer: Astro3Layer }) {
  const own = new Set(mine);
  switch (layer) {
    case "astro-balance-compare":
      return <BalanceCompare selected={selected} tap={tap} ctx={ctx} own={own} />;
    case "astro-retro-dates":
      return <RetroDates selected={selected} tap={tap} ctx={ctx} own={own} />;
    case "astro-combos":
      return <Combos selected={selected} tap={tap} ctx={ctx} />;
  }
}

/** Dos balances iguales, lado a lado: el tuyo y el de la otra persona. */
function BalanceCompare({ selected, tap, ctx, own }: { selected: string; tap: Tap; ctx: LayerCtx; own: Set<string> }) {
  const ps = planetsOf(ctx.c?.chart);
  const os = planetsOf(ctx.other?.chart);
  const who = ctx.others?.[ctx.otherIndex ?? 0]?.name;
  return (
    <div>
      {ctx.others && ctx.others.length > 0 ? (
        <div className="mb-2 flex justify-center">
          <select className="input h-9 w-auto text-sm" value={ctx.otherIndex ?? 0} onChange={(e) => ctx.pickOther?.(Number(e.target.value))} aria-label="Con quién comparar">
            {ctx.others.map((o, i) => (
              <option key={i} value={i}>
                Con {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mb-2 text-center text-xs text-muted">Guarda en «Mi energía» los datos de otra persona para comparar.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Bars title="Tú" ps={ps} selected={selected} tap={tap} own={own} />
        <Bars title={who ?? "Otra persona"} ps={os} selected={selected} tap={tap} own={new Set()} />
      </div>
    </div>
  );
}

function Bars({ title, ps, selected, tap, own }: { title: string; ps: Pos[]; selected: string; tap: Tap; own: Set<string> }) {
  const b = balanceOf(ps);
  const rows = [
    ...ELEMENTS.map((e) => ({ key: e as string, label: e as string, color: ELEMENT_HUE[e] })),
    ...MODALITIES.map((m) => ({ key: m as string, label: MODALITY_TEXT[m].name, color: MODALITY_HUE[m] })),
  ];
  return (
    <svg viewBox="0 0 170 330" className="block h-auto w-full select-none" role="group" aria-label={`Balance: ${title}`}>
      <rect x="0.5" y="0.5" width="169" height="329" rx="18" fill="rgb(255 255 255 / .04)" stroke={GOLD} strokeOpacity="0.5" />
      <text x="85" y="24" textAnchor="middle" fontSize="12" fontFamily="Georgia, serif" fill={INK}>
        {title}
      </text>
      <text x="14" y="48" fontSize="6.5" letterSpacing="1.4" fontWeight="700" fill={GOLD}>
        ELEMENTOS
      </text>
      <text x="14" y="212" fontSize="6.5" letterSpacing="1.4" fontWeight="700" fill={GOLD}>
        CUALIDADES
      </text>
      {rows.map((r, i) => {
        const y = i < 4 ? 66 + i * 34 : 230 + (i - 4) * 32;
        const n = b[r.key].length;
        const on = r.key === selected;
        return (
          <g key={r.key} {...tap(r.key, r.label)}>
            <rect x="6" y={y - 13} width="158" height="27" rx="8" fill={on ? "rgb(212 181 122 / .25)" : "transparent"} />
            <text x="14" y={y + 1} dominantBaseline="central" fontSize="9" fontWeight={on || own.has(r.key) ? 700 : 500} fill={INK}>
              {own.has(r.key) ? "★ " : ""}
              {r.label}
            </text>
            <rect x="70" y={y - 5} width="70" height="10" rx="5" fill="rgb(255 255 255 / .1)" />
            {n > 0 && <rect x="70" y={y - 5} width={(Math.min(n, 10) / 10) * 70} height="10" rx="5" fill={r.color} opacity={on ? 1 : 0.75} />}
            <text x="152" y={y + 1} dominantBaseline="central" textAnchor="middle" fontSize="10" fontWeight="700" fill={on ? GOLD : INK}>
              {ps.length ? n : "·"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Los retrógrados por años: el planeta, sus fechas y la carta de cada fecha (o en doble rueda con la tuya). */
function RetroDates({ selected, tap, ctx, own }: { selected: string; tap: Tap; ctx: LayerCtx; own: Set<string> }) {
  const [year, setYear] = useState(thisYear);
  const [pick, setPick] = useState(0);
  const [withChart, setWithChart] = useState(false);
  const periods = useMemo(() => retroPeriods(selected, year), [selected, year]);
  const period = periods[Math.min(pick, periods.length - 1)] ?? null;
  const sky = useMemo(() => (period ? skyAt(period.start) : []), [period]);
  const natal = planetsOf(ctx.c?.chart);
  const both = withChart && natal.length > 0;
  const retroP = sky.find((p) => p.id === selected);
  const hits = both && retroP ? natal.filter((q) => aspectOf(retroP.lon, q.lon, 0.8)) : [];
  const chip = (on: boolean) => ({ background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .06)", color: on ? "#0B0B0D" : undefined, borderColor: on ? "#F0D9A4" : "rgb(200 168 110 / .3)" });
  return (
    <div>
      {/* Los planetas que se ponen retrógrados. */}
      <div className="mb-2 flex flex-wrap justify-center gap-1.5">
        {RETRO_PLANETS.map((p) => (
          <span key={p} {...tap(p, `${name(p)} retrógrado`)} onClickCapture={() => setPick(0)} className="cursor-pointer rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold" style={chip(p === selected)}>
            {own.has(p) ? "★ " : ""}
            {glyph(p)} {name(p)}
          </span>
        ))}
      </div>
      {/* El año y sus fechas. */}
      <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 text-[0.75rem]">
        <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-line" onClick={() => { setYear((y) => y - 1); setPick(0); }} aria-label="Año anterior">
          ‹
        </button>
        <span className="min-w-[3rem] text-center font-semibold tabular-nums">{year}</span>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-line" onClick={() => { setYear((y) => y + 1); setPick(0); }} aria-label="Año siguiente">
          ›
        </button>
        {periods.map((p, i) => (
          <button key={i} type="button" onClick={() => setPick(i)} className="rounded-full border px-2.5 py-1 font-semibold tabular-nums" style={chip(p === period)}>
            {fmtShort(p.start)} – {fmtShort(p.end)}
          </button>
        ))}
        {!periods.length && <span className="text-muted">Ese año no se pone retrógrado.</span>}
      </div>
      {period && (
        <>
          <RetroWheel planet={selected} sky={sky} natal={both ? natal : []} period={period} />
          <p className="mt-1 text-center text-[0.75rem] text-ink/80">
            Del {fmtLong(period.start)} al {fmtLong(period.end)} · de {where(period.lonStart)} a {where(period.lonEnd)}
          </p>
          <div className="mt-2 flex justify-center">
            <button type="button" className="rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold disabled:opacity-50" style={chip(withChart)} onClick={() => setWithChart((w) => !w)} disabled={!natal.length}>
              {withChart ? "Ver solo el cielo de esa fecha" : "Con mi carta"}
            </button>
          </div>
          {both && (
            <p className="mt-1 text-center text-[0.68rem] text-muted">
              Dentro, tu carta · fuera, el cielo del {fmtShort(period.start)}
              {hits.length ? ` · toca tu ${listEs(hits.map((h) => name(h.id)))}` : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Tres listas: planetas, signos y casas. Cada toque cambia una parte de la combinación. */
function Combos({ selected, tap, ctx }: { selected: string; tap: Tap; ctx: LayerCtx }) {
  const { p, s, h } = parseCombo(selected);
  const natal = ctx.c?.chart.bodies.find((x) => x.id === p);
  const btn = (on: boolean, mineHere: boolean) =>
    `flex min-h-9 w-full items-center gap-2 rounded-xl border px-2.5 text-left text-[0.8rem] transition ${on ? "border-gold bg-gold text-[#0B0B0D] font-semibold" : mineHere ? "border-gold/60" : "border-line hover:border-gold/50"}`;
  const col = "space-y-1";
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className={col}>
        <p className="mb-1 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">Planeta</p>
        {COMBO_BODIES.map((q) => (
          <button key={q} type="button" className={btn(q === p, false)} {...tap(`${q}|${s}|${h}`, name(q))}>
            <span className="w-4 text-center">{glyph(q)}</span>
            <span className="truncate">{name(q)}</span>
          </button>
        ))}
      </div>
      <div className={col}>
        <p className="mb-1 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">Signo</p>
        {SIGNS.map((g) => (
          <button key={g.n} type="button" className={btn(g.n === s, !!natal && signIndex(natal.lon) === g.n)} {...tap(`${p}|${g.n}|${h}`, g.name)}>
            <span className="w-4 text-center" style={{ color: g.n === s ? undefined : ELEMENT_HUE[g.element] }}>
              {g.glyph + "︎"}
            </span>
            <span className="truncate">{g.name}</span>
            {!!natal && signIndex(natal.lon) === g.n && <span className="ml-auto text-[0.7rem]">★</span>}
          </button>
        ))}
      </div>
      <div className={col}>
        <p className="mb-1 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">Casa</p>
        {HOUSES.map((x) => (
          <button key={x.n} type="button" className={btn(x.n === h, natal?.house === x.n)} {...tap(`${p}|${s}|${x.n}`, x.name)}>
            <span className="w-6 text-center font-serif">{ROMAN[x.n - 1]}</span>
            <span className="truncate">{x.keyword}</span>
            {natal?.house === x.n && <span className="ml-auto text-[0.7rem]">★</span>}
          </button>
        ))}
      </div>
      <p className="col-span-3 mt-1 text-center text-[0.68rem] text-muted">★ dónde está tu {name(p)} · toca un planeta, un signo y una casa</p>
    </div>
  );
}

/* ----------------------------------------------- la rueda de los retrógrados */

const R_OUT = 160;
const R_SIGN = 145;
const pad2 = (n: number) => String(n).padStart(2, "0");
const dm = (lon: number) => {
  const x = (((lon % 30) + 30) % 30);
  const d = Math.floor(x);
  return { d, m: Math.floor((x - d) * 60) };
};

/**
 * El cielo de una fecha de retrógrado como una carta natal: los signos con sus marcas de grado, cada planeta con
 * su grado y su minuto, todos los aspectos de ese día en el centro (los del retrógrado, más marcados) y el tramo
 * que recorre hacia atrás en oro. Con `natal`, en doble rueda: el cielo fuera y la carta de la alumna dentro, con
 * los aspectos entre los dos.
 */
function RetroWheel({ planet, sky, natal, period }: { planet: string; sky: Pos[]; natal: Pos[]; period: RetroPeriod }) {
  const ids = useWheelIds();
  const two = natal.length > 0;
  const R_GLYPH = two ? 134 : 133;
  const R_DEG = two ? 123 : 121;
  const R_MIN = two ? 116 : 113;
  const R_ASP = two ? 74 : 104;
  /** Su carta (en doble rueda): entre el cielo y el centro. */
  const R_NATAL = 96;
  const R_NATAL_DEG = 85;
  const [hit, setHit] = useState<number | null>(null);
  const shown = useMemo(() => spreadLongitudes(sky.map((p) => p.lon), two ? 9 : 8), [sky, two]);
  const shownN = useMemo(() => spreadLongitudes(natal.map((p) => p.lon), 11), [natal]);

  // Los aspectos de ese día (o, en doble rueda, los del cielo con su carta). Los del retrógrado, delante.
  const lines = useMemo(() => {
    const out: { a: Pos; b: Pos; color: string; dash?: string; strong: boolean; name: string; glyph: string; orb: number }[] = [];
    if (two) {
      for (const p of sky) for (const q of natal) {
        const as = aspectOf(p.lon, q.lon, 0.8);
        if (as) out.push({ a: p, b: q, color: as.type.color, dash: as.type.dash, strong: p.id === planet, name: as.type.name, glyph: as.type.glyph, orb: as.orb });
      }
    } else {
      for (let i = 0; i < sky.length; i++) for (let j = i + 1; j < sky.length; j++) {
        const as = aspectOf(sky[i].lon, sky[j].lon);
        if (as) out.push({ a: sky[i], b: sky[j], color: as.type.color, dash: as.type.dash, strong: sky[i].id === planet || sky[j].id === planet, name: as.type.name, glyph: as.type.glyph, orb: as.orb });
      }
    }
    return out.sort((x, y) => Number(x.strong) - Number(y.strong));
  }, [sky, natal, two, planet]);

  const ticks = useMemo(() => {
    let d = "";
    for (let deg = 0; deg < 360; deg++) {
      const len = deg % 10 === 0 ? 4 : deg % 5 === 0 ? 2.8 : 1.5;
      const p = pt(deg, R_SIGN);
      const q = pt(deg, R_SIGN - len);
      d += `M${p.x.toFixed(2)} ${p.y.toFixed(2)}L${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
    }
    return d;
  }, []);

  const linesKey = lines.length + (two ? "2" : "1") + period.start.getTime();
  const [lastKey, setLastKey] = useState(linesKey);
  if (lastKey !== linesKey) {
    setLastKey(linesKey);
    setHit(null);
  }
  const picked = hit !== null ? lines[hit] : null;
  /** Los dos planetas del aspecto tocado (en doble rueda: el del cielo y el tuyo). */
  const isPickedSky = (id: string) => !!picked && (picked.a.id === id || (!two && picked.b.id === id));
  const isPickedNatal = (id: string) => !!picked && two && picked.b.id === id;
  const arcTo = period.lonStart < period.lonEnd ? period.lonStart + 360 : period.lonStart;
  return (
    <>
    <svg viewBox="0 0 340 340" className={SVG} role="group" aria-label={`${name(planet)} retrógrado`}>
      <WheelDefs ids={ids} />
      <WheelBase ids={ids} r={R_OUT} />
      {/* Los signos y sus grados. */}
      {SIGNS.map((g, i) => {
        const m = pt(i * 30 + 15, (R_OUT + R_SIGN) / 2);
        return (
          <g key={g.n} pointerEvents="none">
            <path d={sector(i * 30, i * 30 + 30, R_SIGN, R_OUT)} fill={`${ELEMENT_HUE[g.element]}${i % 2 ? "1c" : "2a"}`} stroke="rgb(255 255 255 / .14)" strokeWidth="1" />
            <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={ELEMENT_HUE[g.element]}>
              {g.glyph + "︎"}
            </text>
          </g>
        );
      })}
      <path d={ticks} stroke={INK} strokeOpacity="0.35" strokeWidth="0.5" pointerEvents="none" />
      <circle cx={C} cy={C} r={R_SIGN} fill="none" stroke={GOLD} strokeOpacity="0.6" strokeWidth="0.8" />
      {/* El tramo que recorre hacia atrás. */}
      <path d={sector(period.lonEnd, arcTo, R_SIGN - 8, R_SIGN - 4.5)} fill={GOLD} opacity="0.85" />
      {/* El centro de los aspectos. */}
      <circle cx={C} cy={C} r={R_ASP} fill="rgb(255 255 255 / .04)" stroke={GOLD} strokeOpacity="0.45" strokeWidth="0.7" />
      {two && <circle cx={C} cy={C} r={106} fill="none" stroke={GOLD} strokeOpacity="0.35" strokeDasharray="1 3" />}
      {lines.map((l, i) => {
        const p = pt(l.a.lon, R_ASP);
        const q = pt(l.b.lon, R_ASP);
        const on = hit === i;
        const dim = hit !== null && !on;
        return (
          <g key={i} role="button" tabIndex={0} aria-label={`${name(l.a.id)} ${l.name.toLowerCase()} ${name(l.b.id)}`} aria-pressed={on} style={{ cursor: "pointer", outline: "none" }} onClick={() => setHit(on ? null : i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHit(on ? null : i); } }}>
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth="7" />
            {l.strong && !dim && <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={l.color} strokeWidth="5" strokeOpacity="0.18" strokeLinecap="round" pointerEvents="none" />}
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={l.color} strokeWidth={on ? 2.8 : l.strong ? 2.2 : 0.8} strokeOpacity={dim ? 0.15 : on || l.strong ? 1 : 0.5} strokeDasharray={l.dash} pointerEvents="none" />
          </g>
        );
      })}
      {hit !== null && lines[hit] && (() => {
        const l = lines[hit];
        return (
          <g pointerEvents="none">
            <circle cx={pt(l.a.lon, R_ASP).x} cy={pt(l.a.lon, R_ASP).y} r="2.6" fill={l.color} />
            <circle cx={pt(l.b.lon, R_ASP).x} cy={pt(l.b.lon, R_ASP).y} r="2.6" fill={l.color} />
          </g>
        );
      })()}
      {/* El cielo de esa fecha: cada planeta con su grado y su minuto. */}
      {sky.map((p, i) => {
        const on = p.id === planet;
        const disp = shown[i];
        const g = pt(disp, R_GLYPH);
        const z = dm(p.lon);
        const t0 = pt(p.lon, R_SIGN);
        const t1 = pt(p.lon, R_SIGN - 5);
        const lead = pt(disp, R_GLYPH + 7);
        const moved = Math.abs(((disp - p.lon + 540) % 360) - 180) > 0.4;
        const dot = pt(p.lon, R_ASP);
        return (
          <g key={p.id} pointerEvents="none" opacity={picked && !isPickedSky(p.id) ? 0.35 : 1} style={{ transition: "opacity .25s" }}>
            {isPickedSky(p.id) && (
              <>
                <line x1={dot.x} y1={dot.y} x2={g.x} y2={g.y} stroke={picked!.color} strokeWidth="0.9" strokeDasharray="2 2" />
                <circle cx={g.x} cy={g.y} r="11" fill={picked!.color} fillOpacity="0.22" stroke={picked!.color} strokeWidth="1.3" />
              </>
            )}
            <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke={on ? GOLD : INK} strokeWidth={on ? 1.4 : 0.8} />
            {moved && <line x1={t1.x} y1={t1.y} x2={lead.x} y2={lead.y} stroke={INK} strokeOpacity="0.4" strokeWidth="0.4" />}
            <circle cx={dot.x} cy={dot.y} r="1.3" fill={on ? GOLD : INK} opacity="0.75" />
            {on && <circle cx={g.x} cy={g.y} r="9.5" fill="rgb(201 168 106 / .22)" stroke={GOLD} strokeWidth="0.8" />}
            <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 13 : 11} fill={on ? GOLD : INK}>
              {glyph(p.id)}
            </text>
            <text x={pt(disp, R_DEG).x} y={pt(disp, R_DEG).y} textAnchor="middle" dominantBaseline="central" fontSize="6.4" fontWeight={on ? 700 : 500} fill={on ? GOLD : INK} fillOpacity={on ? 1 : 0.8}>
              {z.d}°
            </text>
            <text x={pt(disp, R_MIN).x} y={pt(disp, R_MIN).y} textAnchor="middle" dominantBaseline="central" fontSize="5.2" fill={INK} fillOpacity="0.6">
              {pad2(z.m)}′{p.retro ? "℞" : ""}
            </text>
          </g>
        );
      })}
      {/* Su carta, dentro (en doble rueda). */}
      {two &&
        natal.map((p, i) => {
          const disp = shownN[i];
          const g = pt(disp, R_NATAL);
          const z = dm(p.lon);
          const dot = pt(p.lon, R_ASP);
          return (
            <g key={`n${p.id}`} pointerEvents="none" opacity={picked && !isPickedNatal(p.id) ? 0.35 : 1} style={{ transition: "opacity .25s" }}>
              {isPickedNatal(p.id) && (
                <>
                  <line x1={dot.x} y1={dot.y} x2={g.x} y2={g.y} stroke={picked!.color} strokeWidth="0.9" strokeDasharray="2 2" />
                  <circle cx={g.x} cy={g.y} r="10" fill={picked!.color} fillOpacity="0.22" stroke={picked!.color} strokeWidth="1.3" />
                </>
              )}
              <circle cx={dot.x} cy={dot.y} r="1.2" fill="#B5487A" />
              <circle cx={g.x} cy={g.y} r="7" fill="rgb(11 11 13 / .85)" stroke="rgb(255 255 255 / .22)" strokeWidth="0.5" />
              <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill={INK}>
                {glyph(p.id)}
              </text>
              <text x={pt(disp, R_NATAL_DEG).x} y={pt(disp, R_NATAL_DEG).y} textAnchor="middle" dominantBaseline="central" fontSize="5.4" fill={INK} fillOpacity="0.75">
                {z.d}°{pad2(z.m)}′
              </text>
            </g>
          );
        })}
    </svg>
    <p className="mt-1 min-h-[1.25rem] text-center text-[0.75rem] text-ink/80">
      {hit !== null && lines[hit]
        ? `${glyph(lines[hit].a.id)} ${name(lines[hit].a.id)}${two ? " del cielo" : ""} · ${lines[hit].glyph}︎ ${lines[hit].name.toLowerCase()} · ${glyph(lines[hit].b.id)} ${two ? "tu " : ""}${name(lines[hit].b.id)} · orbe ${Math.floor(lines[hit].orb)}°${pad2(Math.round((lines[hit].orb % 1) * 60) % 60)}′`
        : "Toca una línea de aspecto para destacarla."}
    </p>
    </>
  );
}
