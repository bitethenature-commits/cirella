"use client";

import { SIGNS, signOf } from "@/components/models/data/astrology";
import { KEY_BY_N } from "@/components/models/data/gene-keys";
import { GATE_BY_N } from "@/components/models/data/human-design";
import { EIGHT_PHASES, PHASE_GUIDANCE } from "@/components/models/data/moon";
import { energySynthesis, energyToday, type EnergyToday } from "@/lib/energy-today";
import { activationsAt } from "@/lib/human-design-calc";
import type { AstroLayer } from "@/lib/lesson-blocks";
import { moonState, SPAIN_TZ } from "@/lib/lunar-sky";
import { addDaysToKey, dateKeyInTz, zonedTimeToUtc } from "@/lib/tz";
import { VS, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { MoonDefs, MoonGlobe } from "./moon";
import { NIGHT_GOLD, NightPanel, STAR, usePrefix } from "./night";

/**
 * Tu energía de hoy, por partes: «Tu semana». Siete días seguidos (desde hoy, o desde el día que elijas con
 * las flechas), uno por pieza: la Luna (fase y signo), la llave del día de Gene Keys, la puerta del Sol en
 * Human Design y, con la carta de la alumna, el tránsito más fuerte del día y lo que toca de su diseño.
 */

export type DayLayer = Extract<AstroLayer, `day-${string}`>;
export const isDayLayer = (l: string): l is DayLayer => l.startsWith("day-");

/** El mediodía (hora de España) del día `n` desde hoy. */
function dayAt(n: number) {
  const key = addDaysToKey(dateKeyInTz(new Date(), SPAIN_TZ), n);
  return { key, at: zonedTimeToUtc(key, 12 * 60, SPAIN_TZ) };
}

type Sky = { key: string; at: Date; phaseIndex: number; elong: number; moonSign: number; gate: number; line: number; e: EnergyToday | null };
const cache = new Map<string, Sky>();
function skyOf(n: number, c: LayerCtx["c"]): Sky {
  const { key, at } = dayAt(n);
  const id = `${key}|${c?.profile.date ?? ""}|${c?.profile.time ?? ""}|${c?.profile.place?.name ?? ""}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const s = moonState(at);
  const t = activationsAt(at);
  const sky: Sky = { key, at, phaseIndex: Math.floor(s.elong / 45) % 8, elong: s.elong, moonSign: signOf(s.moonLon).n, gate: t.sun.gate, line: t.sun.line, e: c ? energyToday(c, at) : null };
  if (cache.size > 200) cache.clear();
  cache.set(id, sky);
  return sky;
}

const fmt = (at: Date, o: Intl.DateTimeFormatOptions) => at.toLocaleDateString("es-ES", { timeZone: SPAIN_TZ, ...o });
const up = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function dayKeys(): string[] {
  return ["d0", "d1", "d2", "d3", "d4", "d5", "d6"];
}

export function dayMine(): string[] {
  return [];
}

export function dayPiece(_layer: DayLayer, key: string, { c, shift }: LayerCtx): SystemPiece {
  const n = (shift ?? 0) + Number(key.slice(1));
  const s = skyOf(n, c);
  const phase = EIGHT_PHASES[s.phaseIndex];
  const g = PHASE_GUIDANCE[phase];
  const k = KEY_BY_N.get(s.gate)!;
  const gate = GATE_BY_N.get(s.gate)!;
  const when = n === 0 ? "Hoy" : n === 1 ? "Mañana" : n === -1 ? "Ayer" : null;
  const date = up(fmt(s.at, { weekday: "long", day: "numeric", month: "long" }));
  const parts: string[] = [];
  parts.push(`🌙 Luna: ${phase} en ${SIGNS[s.moonSign].name}. ${g.intent}. ${g.practice}${s.e?.moon.houseText ? `\n${s.e.moon.houseText}` : ""}`);
  parts.push(`🔑 Gene Keys: la Llave ${k.n} (línea ${s.line}). De ${low(k.shadow)} a ${low(k.gift)}; su siddhi, ${low(k.siddhi)}.${s.e?.gk.spheres.length ? ` Coincide con tu ${s.e.gk.spheres.map((x) => x.name).join(" y tu ")}.` : ""}`);
  const ch = s.e?.hd.channels[0];
  const res = s.e?.hd.resonant[0];
  parts.push(
    `◈ Human Design: el Sol en la puerta ${s.gate}.${s.line} (${gate.name}): ${low(gate.theme)}${ch ? `\nSe define de paso tu canal ${ch.channel.a}-${ch.channel.b} (${ch.channel.name}).` : res ? `\nSuena una puerta tuya: la ${res.gate} (${res.name}).` : ""}`,
  );
  const top = s.e?.astro.transits[0];
  if (s.e) parts.push(`☉ Astrología: ${top ? `${top.title}${top.orb < 1 ? " (casi exacto)" : ""}. ${top.text} ${top.tip}` : "Sin aspectos exactos a tu carta: un día tranquilo de fondo."}`);
  return {
    glyph: "",
    name: when ? `${when} · ${date}` : date,
    kicker: `${phase} en ${SIGNS[s.moonSign].name} · Llave ${k.n} · Sol en la puerta ${s.gate}.${s.line}`,
    meaning: parts.join("\n\n"),
    personal: s.e ? `${energySynthesis(s.e).overall} ${s.e.moon.relation}` : null,
  };
}

/* ------------------------------------------------------------ el dibujo */

export function DayDiagram({ selected, keys, tap, ctx }: DiagramProps & { layer: DayLayer }) {
  const p = usePrefix();
  const sh = ctx.shift ?? 0;
  const days = keys.map((k) => ({ k, n: sh + Number(k.slice(1)), s: skyOf(sh + Number(k.slice(1)), ctx.c) }));
  const first = days[0].s.at;
  const last = days[days.length - 1].s.at;
  const label = `${fmt(first, { day: "numeric", month: "short" })} – ${fmt(last, { day: "numeric", month: "short" })}`;
  const btn = "grid h-8 min-w-8 place-items-center rounded-full border border-line px-2 text-[0.85rem]";
  const W = 340 / 7;
  return (
    <NightPanel>
      <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 text-[0.85rem]">
        <button type="button" className={btn} onClick={() => ctx.setShift?.(sh - 7)} aria-label="Semana anterior">
          «
        </button>
        <button type="button" className={btn} onClick={() => ctx.setShift?.(sh - 1)} aria-label="Día anterior">
          ‹
        </button>
        <span className="min-w-[9rem] text-center font-semibold tabular-nums">{label}</span>
        <button type="button" className={btn} onClick={() => ctx.setShift?.(sh + 1)} aria-label="Día siguiente">
          ›
        </button>
        <button type="button" className={btn} onClick={() => ctx.setShift?.(sh + 7)} aria-label="Semana siguiente">
          »
        </button>
        {sh !== 0 && (
          <button type="button" className="rounded-full border border-line px-2.5 py-1 text-[0.72rem]" onClick={() => ctx.setShift?.(0)}>
            Hoy
          </button>
        )}
      </div>
      <svg viewBox="0 0 340 196" className="mx-auto block h-auto w-full max-w-[46rem] select-none" role="group" aria-label="Tu semana">
        <MoonDefs p={p} />
        <defs>
          <linearGradient id={`${p}dcard`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#2A2456" />
            <stop offset="100%" stopColor="#130F2E" />
          </linearGradient>
          <linearGradient id={`${p}dcardOn`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#FBE7B0" />
            <stop offset="55%" stopColor="#D9AE5C" />
            <stop offset="100%" stopColor="#9C7330" />
          </linearGradient>
        </defs>
        {days.map(({ k, n, s }, i) => {
          const on = k === selected;
          const x = W / 2 + i * W;
          const ink = on ? "#2A1E0C" : STAR;
          const today = n === 0;
          return (
            <g key={k} {...tap(k, fmt(s.at, { weekday: "long", day: "numeric", month: "long" }))}>
              {on && <rect x={x - W / 2 - 2} y="2" width={W + 4} height="192" rx="12" fill={`url(#${p}goldglow)`} />}
              <rect x={x - W / 2 + 2.5} y="8" width={W - 5} height="180" rx="9" fill={on ? `url(#${p}dcardOn)` : `url(#${p}dcard)`} stroke={on ? "#FFF1C8" : today ? NIGHT_GOLD : "rgb(233 204 142 / .35)"} strokeWidth={on || today ? 1.4 : 0.8} />
              <text x={x} y="24" textAnchor="middle" fontSize="7" fontWeight={700} letterSpacing="1" fill={ink} fillOpacity={on ? 1 : 0.7} pointerEvents="none">
                {today ? "HOY" : fmt(s.at, { weekday: "short" }).replace(".", "").toUpperCase()}
              </text>
              <text x={x} y="44" textAnchor="middle" fontSize="18" fontFamily="Georgia, serif" fill={on ? "#2A1E0C" : NIGHT_GOLD} pointerEvents="none">
                {fmt(s.at, { day: "numeric" })}
              </text>
              <MoonGlobe p={p} cx={x} cy={76} r={13} phase={s.elong / 360} />
              <text x={x} y="104" textAnchor="middle" dominantBaseline="central" fontSize="13" fill={ink} pointerEvents="none">
                {SIGNS[s.moonSign].glyph + VS}
              </text>
              <line x1={x - 14} y1="120" x2={x + 14} y2="120" stroke={on ? "#7A5A26" : NIGHT_GOLD} strokeOpacity="0.4" />
              <text x={x} y="136" textAnchor="middle" fontSize="6" letterSpacing="0.6" fill={ink} fillOpacity="0.7" pointerEvents="none">
                LLAVE
              </text>
              <text x={x} y="150" textAnchor="middle" fontSize="13" fontFamily="Georgia, serif" fill={ink} pointerEvents="none">
                {s.gate}
              </text>
              <text x={x} y="170" textAnchor="middle" fontSize="7.5" fill={ink} fillOpacity="0.75" pointerEvents="none">
                {s.e?.astro.transits.length ? `${s.e.astro.transits.length} ✦` : `${s.gate}.${s.line}`}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[0.68rem]" style={{ color: "rgb(251 246 236 / .6)" }}>
        Luna y su signo · la llave del día (y la puerta del Sol) · {ctx.c ? "✦ tránsitos a tu carta" : "puerta.línea del Sol"}
      </p>
    </NightPanel>
  );
}
