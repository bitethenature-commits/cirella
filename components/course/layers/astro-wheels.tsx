"use client";

import { ANGLE_INFO, ELEMENT_HUE, SIGNS, type AngleKey, type Modality } from "@/components/models/data/astrology";
import type { ComputedProfile } from "@/lib/birth-profile";
import { C, CREAM, GOLD, INK, MUTED, VS, norm, pt, sector, signIndex, type Tap } from "./common";
import { MODALITY_TEXT } from "./texts";
import { Medallion, MineMark, RingSector, WheelBase, WheelDefs, useWheelIds } from "./wheel-kit";

/** Las ruedas de las tres cualidades y de los cuatro ángulos, con el mismo acabado que la carta (wheel-kit). */

export const MODALITY_HUE: Record<Modality, string> = { cardinal: "#B5544F", fijo: "#8A7A4E", mutable: "#6E8C9B" };

export function ModalityWheel({ selected, own, tap }: { selected: string; own: Set<string>; tap: Tap }) {
  const ids = useWheelIds();
  const m = selected as Modality;
  const corners = SIGNS.filter((s) => s.modality === m).map((s) => pt(s.n * 30 + 15, 94));
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label="Las 3 cualidades">
      <WheelDefs ids={ids} />
      <WheelBase ids={ids} />
      {SIGNS.map((s, i) => {
        const lit = s.modality === m;
        const hue = MODALITY_HUE[s.modality];
        const g = pt(i * 30 + 15, 136);
        const n = pt(i * 30 + 15, 112);
        return (
          <RingSector key={s.n} i={i} r1={100} r2={157} fill={lit ? `${hue}40` : `${hue}${i % 2 ? "12" : "1e"}`} on={false} ids={ids} {...tap(s.modality, MODALITY_TEXT[s.modality].name)}>
            {lit && <path d={sector(i * 30 + 1, i * 30 + 29, 155, 158)} fill={hue} pointerEvents="none" />}
            <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="21" fill={lit ? hue : ELEMENT_HUE[s.element]} fillOpacity={lit ? 1 : 0.55} pointerEvents="none">
              {s.glyph + VS}
            </text>
            <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize="5.6" letterSpacing="0.9" fill={INK} fillOpacity={lit ? 0.8 : 0.4} pointerEvents="none">
              {s.name.toUpperCase()}
            </text>
          </RingSector>
        );
      })}
      <circle cx={C} cy={C} r="100" fill="none" stroke={GOLD} strokeOpacity="0.6" strokeWidth="0.8" pointerEvents="none" />
      {/* La cruz de la cualidad: sus cuatro signos, en cuadratura y oposición entre sí. */}
      <g pointerEvents="none">
        <polygon points={corners.map((p) => `${p.x},${p.y}`).join(" ")} fill={`${MODALITY_HUE[m]}14`} stroke={MODALITY_HUE[m]} strokeWidth="1.8" strokeLinejoin="round" filter={`url(#${ids.lift})`} />
        <line x1={corners[0].x} y1={corners[0].y} x2={corners[2].x} y2={corners[2].y} stroke={MODALITY_HUE[m]} strokeWidth="0.7" strokeDasharray="2 3" />
        <line x1={corners[1].x} y1={corners[1].y} x2={corners[3].x} y2={corners[3].y} stroke={MODALITY_HUE[m]} strokeWidth="0.7" strokeDasharray="2 3" />
        {corners.map((p, j) => (
          <circle key={j} cx={p.x} cy={p.y} r="3.6" fill={MODALITY_HUE[m]} stroke="#fff" strokeWidth="1.2" />
        ))}
      </g>
      <Medallion ids={ids} r={40}>
        <text x={C} y={C - 4} textAnchor="middle" dominantBaseline="central" fontSize="15" fontFamily="Georgia, serif" fill={GOLD}>
          {MODALITY_TEXT[m].verb}
        </text>
        <text x={C} y={C + 13} textAnchor="middle" dominantBaseline="central" fontSize="6.5" letterSpacing="1.4" fill={INK} fillOpacity="0.7">
          {(own.has(m) ? "★ " : "") + MODALITY_TEXT[m].name.toUpperCase()}
        </text>
      </Medallion>
    </svg>
  );
}

const ANGLE_LON: Record<AngleKey, number> = { asc: 0, ic: 90, dsc: 180, mc: 270 };

/**
 * Los cuatro ángulos como en una carta impresa: el Ascendente a la izquierda y el zodiaco girado para que
 * cada signo quede donde estaba al nacer (con la hora de la alumna, el Medio Cielo cae en su sitio real).
 */
export function AnglesWheel({ selected, tap, chart }: { selected: string; tap: Tap; chart: ComputedProfile["chart"] | null }) {
  const ids = useWheelIds();
  const a = chart?.angles ?? null;
  const off = a?.asc ?? 0;
  const rel = (k: AngleKey) => (a ? norm(a[k] - off) : ANGLE_LON[k]);
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label="Los 4 ángulos">
      <WheelDefs ids={ids} />
      <WheelBase ids={ids} />
      {/* El zodiaco, girado al Ascendente. */}
      <g pointerEvents="none">
        {SIGNS.map((s, i) => {
          const l = i * 30 - off;
          const mid = pt(l + 15, 148);
          return (
            <g key={s.n}>
              <path d={sector(l, l + 30, 140, 157)} fill={`${ELEMENT_HUE[s.element]}${i % 2 ? "1c" : "2a"}`} stroke="#fff" strokeWidth="1" />
              <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={ELEMENT_HUE[s.element]}>
                {s.glyph + VS}
              </text>
            </g>
          );
        })}
      </g>
      {/* Sobre el horizonte, lo visible; debajo, lo íntimo. */}
      <path d={`M${C - 140} ${C}A140 140 0 0 1 ${C + 140} ${C}Z`} fill="#FFFFFF" fillOpacity="0.75" pointerEvents="none" />
      <path d={`M${C - 140} ${C}A140 140 0 0 0 ${C + 140} ${C}Z`} fill="#EFE6D3" fillOpacity="0.6" pointerEvents="none" />
      <text x={C} y={C - 70} textAnchor="middle" fontSize="6" letterSpacing="1.4" fill={MUTED} pointerEvents="none">
        SOBRE EL HORIZONTE · LO VISIBLE
      </text>
      <text x={C} y={C + 74} textAnchor="middle" fontSize="6" letterSpacing="1.4" fill={MUTED} pointerEvents="none">
        BAJO EL HORIZONTE · LO ÍNTIMO
      </text>
      {/* Los dos ejes. */}
      {(
        [
          ["asc", "dsc"],
          ["mc", "ic"],
        ] as const
      ).map(([x, y]) => {
        const lit = selected === x || selected === y;
        const p = pt(rel(x), 140);
        const q = pt(rel(y), 140);
        return <line key={x} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={lit ? GOLD : "#CFC4AE"} strokeWidth={lit ? 1.8 : 1} pointerEvents="none" />;
      })}
      {(Object.keys(ANGLE_LON) as AngleKey[]).map((k) => {
        const on = selected === k;
        const p = pt(rel(k), 112);
        const lon = a?.[k];
        return (
          <g key={k} {...tap(k, ANGLE_INFO[k].name)}>
            {on && <circle cx={p.x} cy={p.y} r="27" fill={GOLD} opacity="0.35" filter={`url(#${ids.glow})`} />}
            <circle cx={p.x} cy={p.y} r={on ? 22 : 18} fill={on ? `url(#${ids.sel})` : `url(#${ids.med})`} stroke={on ? `url(#${ids.gold})` : "#CFC4AE"} strokeWidth={on ? 2 : 1} filter={`url(#${ids.lift})`} />
            <text x={p.x} y={lon != null ? p.y - 5 : p.y} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" letterSpacing="0.5" fill={on ? GOLD : INK} pointerEvents="none">
              {ANGLE_INFO[k].short}
            </text>
            {lon != null && (
              <text x={p.x} y={p.y + 8} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={on ? CREAM : ELEMENT_HUE[SIGNS[signIndex(lon)].element]} pointerEvents="none">
                {SIGNS[signIndex(lon)].glyph + VS}
              </text>
            )}
          </g>
        );
      })}
      <circle cx={C} cy={C} r="3" fill={GOLD} pointerEvents="none" />
      {a && <MineMark x={pt(rel("asc"), 140).x} y={pt(rel("asc"), 140).y} s={3.5} />}
    </svg>
  );
}
