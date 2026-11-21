"use client";

import { useMemo, useState } from "react";
import { BODY_INFO, ELEMENT_HUE, SIGNS } from "@/components/models/data/astrology";
import { spreadLongitudes } from "@/lib/natal-chart";
import { C, VS, pt, sector, type Tap } from "./common";
import { aspectOf, type Planet, type Pos } from "./astro2-calc";
import { DegreeTicks, WK_GOLD as GOLD, WK_INK as INK, WheelBase, WheelDefs, useWheelIds } from "./wheel-kit";

/**
 * La doble rueda de la sinastría y de los tránsitos, con el aire de la carta natal: los signos con sus grados,
 * una carta por fuera (junto al borde) y otra por dentro (en un anillo abierto), cada planeta con su grado y su
 * minuto, y en el centro todos los aspectos entre las dos. Un aspecto se toca para destacarlo: se marcan sus dos
 * planetas y debajo se lee en palabras. Los del planeta elegido, más vistosos.
 */

const R_OUT = 160;
const R_SIGN = 145;
const O_GLYPH = 134;
const O_DEG = 123;
const O_MIN = 116;
const R_SPLIT = 106;
const I_GLYPH = 95;
const I_DEG = 84;
const R_ASP = 72;
const pad2 = (n: number) => String(n).padStart(2, "0");
const dm = (lon: number) => {
  const x = ((lon % 30) + 30) % 30;
  const d = Math.floor(x);
  return { d, m: Math.floor((x - d) * 60) };
};
const name = (id: string) => BODY_INFO[id as Planet]?.name ?? id;
const glyph = (id: string) => (BODY_INFO[id as Planet]?.glyph ?? "") + VS;

type Line = { a: Pos; b: Pos; color: string; dash?: string; strong: boolean; name: string; glyph: string; orb: number };

export function BiWheel({
  outer,
  inner,
  focus,
  tapOuter,
  tapInner,
  outerLabel,
  innerLabel,
  orbScale = 0.8,
}: {
  /** Fuera: el cielo de hoy o la otra persona. */
  outer: Pos[];
  /** Dentro: la carta de la alumna. */
  inner: Pos[];
  /** El planeta elegido en el modelo (fuera o dentro): sus aspectos, más vistosos. */
  focus: { side: "outer" | "inner"; id: string } | null;
  tapOuter?: (id: string) => ReturnType<Tap>;
  tapInner?: (id: string) => ReturnType<Tap>;
  /** «del cielo» / «de Mario», y «tu». */
  outerLabel: string;
  innerLabel: string;
  orbScale?: number;
}) {
  const ids = useWheelIds();
  const [hit, setHit] = useState<number | null>(null);
  const shownO = useMemo(() => spreadLongitudes(outer.map((p) => p.lon), 9), [outer]);
  const shownI = useMemo(() => spreadLongitudes(inner.map((p) => p.lon), 11), [inner]);

  const lines = useMemo(() => {
    const out: Line[] = [];
    for (const p of outer)
      for (const q of inner) {
        const as = aspectOf(p.lon, q.lon, orbScale);
        if (!as) continue;
        const strong = !!focus && (focus.side === "outer" ? p.id === focus.id : q.id === focus.id);
        out.push({ a: p, b: q, color: as.type.color, dash: as.type.dash, strong, name: as.type.name, glyph: as.type.glyph, orb: as.orb });
      }
    return out.sort((x, y) => Number(x.strong) - Number(y.strong));
  }, [outer, inner, focus, orbScale]);

  // Al cambiar de planeta o de carta, el aspecto tocado se suelta.
  const key = `${lines.length}|${focus?.side}|${focus?.id}|${outer.map((p) => p.lon.toFixed(1)).join(",")}`;
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setHit(null);
  }
  const picked = hit !== null ? (lines[hit] ?? null) : null;

  const planet = (p: Pos, i: number, side: "outer" | "inner") => {
    const disp = side === "outer" ? shownO[i] : shownI[i];
    const rG = side === "outer" ? O_GLYPH : I_GLYPH;
    const g = pt(disp, rG);
    const z = dm(p.lon);
    const dot = pt(p.lon, R_ASP);
    const on = focus?.side === side && focus.id === p.id;
    const isPicked = !!picked && (side === "outer" ? picked.a.id === p.id : picked.b.id === p.id);
    const tapProps = side === "outer" ? tapOuter?.(p.id) : tapInner?.(p.id);
    const t0 = pt(p.lon, side === "outer" ? R_SIGN : R_SPLIT);
    const t1 = pt(p.lon, (side === "outer" ? R_SIGN : R_SPLIT) - 4.5);
    return (
      <g key={`${side}${p.id}`} opacity={picked && !isPicked ? 0.35 : 1} style={{ transition: "opacity .25s" }} {...(tapProps ?? {})}>
        <circle cx={g.x} cy={g.y} r="10" fill="transparent" />
        {isPicked && (
          <g pointerEvents="none">
            <line x1={dot.x} y1={dot.y} x2={g.x} y2={g.y} stroke={picked!.color} strokeWidth="0.9" strokeDasharray="2 2" />
            <circle cx={g.x} cy={g.y} r="10.5" fill={picked!.color} fillOpacity="0.22" stroke={picked!.color} strokeWidth="1.3" />
          </g>
        )}
        <g pointerEvents="none">
          <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke={on ? GOLD : INK} strokeOpacity={on ? 1 : 0.6} strokeWidth={on ? 1.3 : 0.7} />
          <circle cx={dot.x} cy={dot.y} r="1.3" fill={side === "outer" ? (on ? GOLD : INK) : "#E07AA0"} opacity="0.8" />
          {on && <circle cx={g.x} cy={g.y} r="9" fill="rgb(212 181 122 / .2)" stroke={GOLD} strokeWidth="0.8" />}
          <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={side === "outer" ? (on ? 13 : 11) : on ? 11.5 : 9.5} fill={on ? GOLD : INK}>
            {glyph(p.id)}
          </text>
          {side === "outer" ? (
            <>
              <text x={pt(disp, O_DEG).x} y={pt(disp, O_DEG).y} textAnchor="middle" dominantBaseline="central" fontSize="6.2" fontWeight={on ? 700 : 500} fill={on ? GOLD : INK} fillOpacity={on ? 1 : 0.8}>
                {z.d}°
              </text>
              <text x={pt(disp, O_MIN).x} y={pt(disp, O_MIN).y} textAnchor="middle" dominantBaseline="central" fontSize="5" fill={INK} fillOpacity="0.6">
                {pad2(z.m)}′{p.retro ? "℞" : ""}
              </text>
            </>
          ) : (
            <text x={pt(disp, I_DEG).x} y={pt(disp, I_DEG).y} textAnchor="middle" dominantBaseline="central" fontSize="5.2" fontWeight={on ? 700 : 500} fill={on ? GOLD : INK} fillOpacity={on ? 1 : 0.75}>
              {z.d}°{pad2(z.m)}′
            </text>
          )}
        </g>
      </g>
    );
  };

  return (
    <>
      <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[46rem] select-none" role="group" aria-label="Doble rueda">
        <WheelDefs ids={ids} />
        <WheelBase ids={ids} r={R_OUT} />
        {SIGNS.map((g, i) => {
          const m = pt(i * 30 + 15, (R_OUT + R_SIGN) / 2);
          return (
            <g key={g.n} pointerEvents="none">
              <path d={sector(i * 30, i * 30 + 30, R_SIGN, R_OUT)} fill={`${ELEMENT_HUE[g.element]}${i % 2 ? "1c" : "2a"}`} stroke="rgb(255 255 255 / .14)" strokeWidth="0.8" />
              <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={ELEMENT_HUE[g.element]}>
                {g.glyph + VS}
              </text>
            </g>
          );
        })}
        <DegreeTicks r={R_SIGN} />
        <circle cx={C} cy={C} r={R_SPLIT} fill="none" stroke={GOLD} strokeOpacity="0.4" strokeDasharray="1 3" pointerEvents="none" />
        <circle cx={C} cy={C} r={R_ASP} fill="rgb(255 255 255 / .03)" stroke={GOLD} strokeOpacity="0.5" strokeWidth="0.7" pointerEvents="none" />
        {lines.map((l, i) => {
          const p = pt(l.a.lon, R_ASP);
          const q = pt(l.b.lon, R_ASP);
          const on = hit === i;
          const dim = hit !== null && !on;
          const toggle = () => setHit(on ? null : i);
          return (
            <g
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`${name(l.a.id)} ${outerLabel} ${l.name.toLowerCase()} ${innerLabel} ${name(l.b.id)}`}
              aria-pressed={on}
              style={{ cursor: "pointer", outline: "none" }}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle();
                }
              }}
            >
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth="7" />
              {l.strong && !dim && <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={l.color} strokeWidth="5" strokeOpacity="0.18" strokeLinecap="round" pointerEvents="none" />}
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={l.color} strokeWidth={on ? 2.8 : l.strong ? 2.2 : 0.8} strokeOpacity={dim ? 0.15 : on || l.strong ? 1 : 0.5} strokeDasharray={l.dash} pointerEvents="none" />
            </g>
          );
        })}
        {picked && (
          <g pointerEvents="none">
            <circle cx={pt(picked.a.lon, R_ASP).x} cy={pt(picked.a.lon, R_ASP).y} r="2.6" fill={picked.color} />
            <circle cx={pt(picked.b.lon, R_ASP).x} cy={pt(picked.b.lon, R_ASP).y} r="2.6" fill={picked.color} />
          </g>
        )}
        {outer.map((p, i) => planet(p, i, "outer"))}
        {inner.map((p, i) => planet(p, i, "inner"))}
      </svg>
      <p className="mt-1 min-h-[1.25rem] text-center text-[0.75rem] text-ink/80">
        {picked
          ? `${glyph(picked.a.id)} ${name(picked.a.id)} ${outerLabel} · ${picked.glyph}${VS} ${picked.name.toLowerCase()} · ${glyph(picked.b.id)} ${innerLabel} ${name(picked.b.id)} · orbe ${Math.floor(picked.orb)}°${pad2(Math.round((picked.orb % 1) * 60) % 60)}′`
          : lines.length
            ? "Toca una línea de aspecto para destacarla."
            : "No hay aspectos entre las dos cartas."}
      </p>
    </>
  );
}
