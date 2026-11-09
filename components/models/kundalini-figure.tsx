"use client";

import { useId } from "react";
import { CHAKRA_INFO, K_CHAKRAS, type KChakra } from "./data/kundalini";

/**
 * El cuerpo sutil para Kundalini: una figura sentada en meditación con los chakras en la columna, el aura,
 * los canales ida, pingala y sushumna, la serpiente (dormida en la raíz o subiendo), los tres nudos y los
 * tres cierres. Lo usan el modelo principal (components/models/kundalini-model.tsx) y sus modelos por partes.
 */

const CX = 170;
const GOLD = "#E9CC8E";
const STAR = "#FBF6EC";
export const SPINE_TOP = 40;
export const SPINE_BOTTOM = 262;

const BODY = "M158 95L182 95L184 106Q222 110 230 128Q238 160 236 196Q240 222 252 238Q300 250 302 274Q300 296 260 298L80 298Q40 296 38 274Q40 250 88 238Q100 222 104 196Q102 160 110 128Q118 110 156 106Z";

/** Ida (izquierda, side -1) o pingala (derecha, +1): se cruzan en cada chakra, de la raíz al entrecejo. */
function nadiPath(side: 1 | -1) {
  const ys = (["root", "sacral", "solar", "heart", "throat", "third-eye"] as KChakra[]).map((k) => CHAKRA_INFO[k].y);
  let d = `M${CX} ${ys[0]}`;
  for (let i = 0; i < ys.length - 1; i++) {
    const s = (i % 2 ? -1 : 1) * side;
    const my = (ys[i] + ys[i + 1]) / 2;
    d += `Q${CX + s * 40} ${my} ${CX} ${ys[i + 1]}`;
  }
  return d;
}

/** La serpiente enroscada: tres vueltas y media alrededor de la raíz. */
function coilPath() {
  const pts: string[] = [];
  for (let t = 0; t <= 7 * Math.PI; t += 0.15) {
    const r = 4 + t * 1.55;
    pts.push(`${(CX + r * Math.cos(t)).toFixed(1)} ${(SPINE_BOTTOM + 12 + r * Math.sin(t) * 0.42).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}
/** La serpiente que sube: ondula suave por el canal central hasta la corona. */
function risePath() {
  const pts: string[] = [];
  for (let y = SPINE_BOTTOM + 8; y >= SPINE_TOP; y -= 3) pts.push(`${(CX + Math.sin((y / 16) * Math.PI) * 5).toFixed(1)} ${y}`);
  return `M${pts.join("L")}`;
}

export type SubtleProps = {
  /** El chakra elegido (brilla). */
  chakra?: KChakra | null;
  /** Los canales que se ven (o «all»). */
  nadis?: ("ida" | "pingala" | "sushumna")[];
  /** El canal elegido (brilla). */
  nadiOn?: "ida" | "pingala" | "sushumna" | null;
  /** La serpiente: dormida, subiendo (con `rise` de 0 a 1) o ya en la corona. */
  serpent?: "coiled" | "rise" | null;
  rise?: number;
  /** Los nudos que se ven y el elegido. */
  knots?: boolean;
  knotOn?: string | null;
  /** Los cierres que brillan. */
  bandhas?: string[];
  /** Ver el aura. */
  aura?: boolean;
  onChakra?: (k: KChakra) => void;
  tapProps?: (k: KChakra) => Record<string, unknown>;
  className?: string;
};

export function SubtleBody({ chakra = null, nadis = ["ida", "pingala", "sushumna"], nadiOn = null, serpent = "coiled", rise = 0, knots = false, knotOn = null, bandhas = [], aura = true, onChakra, tapProps, className }: SubtleProps) {
  const p = `kb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const riseY = SPINE_BOTTOM - (SPINE_BOTTOM - SPINE_TOP) * rise;
  const lit = (k: KChakra) => (serpent === "rise" && rise > 0 && k !== "aura" ? CHAKRA_INFO[k].y >= riseY - 2 : false);
  const knotsAt: [string, number][] = [["brahma", 249], ["vishnu", 158], ["rudra", 70]];
  const bandAt: Record<string, [number, number, number]> = { mula: [268, 46, 10], uddiyana: [196, 58, 22], jalandhara: [100, 22, 8] };
  const bandOn = (k: string) => bandhas.includes(k) || bandhas.includes("maha");
  return (
    <svg viewBox="0 0 340 330" className={className ?? "mx-auto block h-auto w-full max-w-[30rem] select-none"} role="group" aria-label="El cuerpo sutil">
      <defs>
        <radialGradient id={`${p}aura`} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#F4F1EA" stopOpacity="0" />
          <stop offset="85%" stopColor="#F4F1EA" stopOpacity={chakra === "aura" ? 0.22 : 0.08} />
          <stop offset="100%" stopColor="#F4F1EA" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}body`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#3A3470" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1A1640" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id={`${p}snake`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#E2574C" />
          <stop offset="50%" stopColor="#F2C94C" />
          <stop offset="100%" stopColor="#F7E2AE" />
        </linearGradient>
        <filter id={`${p}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {aura && <ellipse cx={CX} cy={172} rx={160} ry={168} fill={`url(#${p}aura)`} stroke={chakra === "aura" ? "#F7E2AE" : "rgb(244 241 234 / .18)"} strokeWidth={chakra === "aura" ? 1.4 : 0.8} strokeDasharray={chakra === "aura" ? undefined : "2 5"} {...(tapProps?.("aura") ?? {})} />}
      {/* La figura sentada. */}
      <circle cx={CX} cy={72} r={24} fill={`url(#${p}body)`} stroke={GOLD} strokeOpacity="0.45" />
      <path d={BODY} fill={`url(#${p}body)`} stroke={GOLD} strokeOpacity="0.45" />
      <circle cx="64" cy="266" r="7" fill="none" stroke={GOLD} strokeOpacity="0.4" />
      <circle cx="276" cy="266" r="7" fill="none" stroke={GOLD} strokeOpacity="0.4" />
      {/* Los cierres. */}
      {Object.entries(bandAt).map(([k, [y, rx, ry]]) =>
        bandOn(k) ? (
          <g key={k} pointerEvents="none">
            <ellipse cx={CX} cy={y} rx={rx} ry={ry} fill="#F2C94C" opacity="0.35" filter={`url(#${p}glow)`} />
            <ellipse cx={CX} cy={y} rx={rx} ry={ry} fill="none" stroke="#F7E2AE" strokeWidth="1.4" className="geo-draw" pathLength={1} />
          </g>
        ) : null,
      )}
      {/* Los canales. */}
      <g fill="none" strokeLinecap="round" pointerEvents="none">
        {nadis.includes("ida") && <path d={nadiPath(-1)} stroke="#A9D3EE" strokeWidth={nadiOn === "ida" ? 2.6 : 1.2} strokeOpacity={nadiOn && nadiOn !== "ida" ? 0.3 : 0.85} />}
        {nadis.includes("pingala") && <path d={nadiPath(1)} stroke="#F08A3C" strokeWidth={nadiOn === "pingala" ? 2.6 : 1.2} strokeOpacity={nadiOn && nadiOn !== "pingala" ? 0.3 : 0.85} />}
        {nadis.includes("sushumna") && <line x1={CX} y1={SPINE_BOTTOM} x2={CX} y2={SPINE_TOP} stroke={GOLD} strokeWidth={nadiOn === "sushumna" ? 3 : 1.4} strokeOpacity={nadiOn && nadiOn !== "sushumna" ? 0.3 : 0.9} />}
      </g>
      {/* La serpiente. */}
      {serpent === "coiled" && <path d={coilPath()} fill="none" stroke={`url(#${p}snake)`} strokeWidth="3.2" strokeLinecap="round" pointerEvents="none" />}
      {serpent === "rise" && (
        <g pointerEvents="none">
          <path d={coilPath()} fill="none" stroke="#E2574C" strokeOpacity={0.5 * (1 - rise)} strokeWidth="2.6" strokeLinecap="round" />
          <path d={risePath()} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - rise} fill="none" stroke={`url(#${p}snake)`} strokeWidth="4.5" strokeLinecap="round" />
          {rise > 0.02 && <circle cx={CX + Math.sin((riseY / 16) * Math.PI) * 5} cy={riseY} r="5" fill="#F7E2AE" />}
        </g>
      )}
      {/* Los nudos. */}
      {knots &&
        knotsAt.map(([k, y]) => (
          <g key={k} pointerEvents="none" opacity={knotOn && knotOn !== k ? 0.45 : 1}>
            <circle cx={CX - 5} cy={y} r="6" fill="none" stroke={knotOn === k ? "#F7E2AE" : GOLD} strokeWidth={knotOn === k ? 2 : 1.2} />
            <circle cx={CX + 5} cy={y} r="6" fill="none" stroke={knotOn === k ? "#F7E2AE" : GOLD} strokeWidth={knotOn === k ? 2 : 1.2} />
            <text x={CX + 22} y={y} dominantBaseline="central" fontSize="8" fontWeight={700} fill={knotOn === k ? "#F7E2AE" : STAR} fillOpacity="0.85">
              {k.toUpperCase()}
            </text>
          </g>
        ))}
      {/* Los chakras. */}
      {K_CHAKRAS.filter((k) => k !== "aura").map((k) => {
        const c = CHAKRA_INFO[k];
        const on = chakra === k || lit(k);
        return (
          <g key={k} {...(tapProps?.(k) ?? (onChakra ? { onClick: () => onChakra(k), style: { cursor: "pointer" } } : {}))}>
            <circle cx={CX} cy={c.y} r="18" fill="transparent" />
            {on && <circle cx={CX} cy={c.y} r="16" fill={c.color} opacity="0.7" filter={`url(#${p}glow)`} />}
            <circle cx={CX} cy={c.y} r={chakra === k ? 10 : 7.5} fill={c.color} fillOpacity={on ? 1 : 0.75} stroke={chakra === k ? "#FFF6DC" : "#100E26"} strokeWidth={chakra === k ? 1.8 : 1} />
          </g>
        );
      })}
    </svg>
  );
}
