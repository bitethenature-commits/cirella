"use client";

import { useId } from "react";
import { CHAKRA_INFO, K_CHAKRAS, type KChakra } from "./data/kundalini";
import { useT, Tr } from "@/lib/i18n/client";

/**
 * El cuerpo sutil para Kundalini: una figura sentada en meditación con los chakras en la columna (cada uno un loto
 * con sus pétalos), el aura, los canales ida, pingala y sushumna, la serpiente (dormida en la raíz o subiendo), los
 * tres nudos y los tres cierres. Lo usan el modelo principal (components/models/kundalini-model.tsx), sus modelos por
 * partes y las dimensiones del ser.
 */

const CX = 170;
const GOLD = "#E9CC8E";
const STAR = "#FBF6EC";
export const SPINE_TOP = 40;
export const SPINE_BOTTOM = 262;

/** La silueta sentada (postura fácil): la mitad izquierda y su espejo, con curvas suaves. */
const FIGURE =
  "M161 93L160 105C146 108 128 110 118 119C108 128 104 146 103 166C102 186 97 205 90 221C84 235 73 245 62 251C44 259 37 276 52 288C76 302 128 304 170 304" +
  "C212 304 264 302 288 288C303 276 296 259 278 251C267 245 256 235 250 221C243 205 238 186 237 166C236 146 232 128 222 119C212 110 194 108 180 105L179 93Z";
/** Los trazos de dentro: los costados, los antebrazos y las piernas cruzadas. */
const FIGURE_LINES = [
  "M124 128C121 160 122 196 130 226",
  "M216 128C219 160 218 196 210 226",
  "M130 226C112 234 90 243 66 250",
  "M210 226C228 234 250 243 274 250",
  "M84 282C120 270 160 268 206 276",
  "M256 282C220 270 180 268 134 276",
];

/** Los pétalos de cada chakra (la corona, el loto de mil, con veinte). */
export const CHAKRA_PETALS: Record<Exclude<KChakra, "aura">, number> = { root: 4, sacral: 6, solar: 10, heart: 12, throat: 16, "third-eye": 2, crown: 20 };

/** La figura sentada, para dibujarla dentro de otro dibujo (las dimensiones del ser). */
export function SeatedFigure({ p, opacity = 1 }: { p: string; opacity?: number }) {
  return (
    <g pointerEvents="none" opacity={opacity}>
      <ellipse cx={CX} cy={70} rx={21} ry={24} fill={`url(#${p}body)`} stroke={`url(#${p}fline)`} strokeOpacity="0.6" strokeWidth="0.9" />
      <path d={FIGURE} fill={`url(#${p}body)`} stroke={`url(#${p}fline)`} strokeOpacity="0.6" strokeWidth="0.9" strokeLinejoin="round" />
      <g fill="none" stroke={GOLD} strokeOpacity="0.22" strokeWidth="0.7" strokeLinecap="round">
        {FIGURE_LINES.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {[64, 276].map((x) => (
        <g key={x}>
          <circle cx={x} cy={251} r="5.5" fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="0.8" />
          <circle cx={x} cy={251} r="1.4" fill={GOLD} fillOpacity="0.7" />
        </g>
      ))}
    </g>
  );
}

/** Los degradados de la figura (con el prefijo `p`): el cuerpo, su filo, el aura, la serpiente y la columna de luz. */
export function FigureDefs({ p, auraOn = false }: { p: string; auraOn?: boolean }) {
  return (
    <>
      <radialGradient id={`${p}aura`} cx="50%" cy="50%" r="50%">
        <stop offset="50%" stopColor="#F4F1EA" stopOpacity="0" />
        <stop offset="82%" stopColor="#F4F1EA" stopOpacity={auraOn ? 0.2 : 0.07} />
        <stop offset="100%" stopColor="#F4F1EA" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}body`} cx="50%" cy="38%" r="70%">
        <stop offset="0%" stopColor="#3A352F" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#151517" stopOpacity="0.45" />
      </radialGradient>
      <linearGradient id={`${p}fline`} gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="310">
        <stop offset="0%" stopColor="#FBEFCF" />
        <stop offset="100%" stopColor="#B8955A" />
      </linearGradient>
      <linearGradient id={`${p}snake`} gradientUnits="userSpaceOnUse" x1="0" y1={SPINE_BOTTOM + 20} x2="0" y2={SPINE_TOP}>
        <stop offset="0%" stopColor="#E2574C" />
        <stop offset="50%" stopColor="#F2C94C" />
        <stop offset="100%" stopColor="#FFF3D2" />
      </linearGradient>
      <linearGradient id={`${p}spine`} gradientUnits="userSpaceOnUse" x1="0" y1={SPINE_BOTTOM} x2="0" y2={SPINE_TOP - 4}>
        <stop offset="0%" stopColor="#E2574C" />
        <stop offset="14%" stopColor="#F08A3C" />
        <stop offset="30%" stopColor="#F2C94C" />
        <stop offset="50%" stopColor="#6FBF73" />
        <stop offset="68%" stopColor="#5AA9E6" />
        <stop offset="86%" stopColor="#6C6FD8" />
        <stop offset="100%" stopColor="#B58AE0" />
      </linearGradient>
      <filter id={`${p}glow`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id={`${p}hair`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </>
  );
}

/** Un chakra como un loto pequeño: el centro de su color y sus pétalos alrededor. */
export function ChakraLotus({ k, x = CX, y, on = false, big = false, p }: { k: Exclude<KChakra, "aura">; x?: number; y: number; on?: boolean; big?: boolean; p: string }) {
  const c = CHAKRA_INFO[k];
  const n = CHAKRA_PETALS[k];
  const core = big ? 7.5 : 5.5;
  const len = k === "third-eye" ? (big ? 13 : 10) : big ? 7.5 : 6;
  const r0 = core + 0.8;
  const dd = Math.min(32, 130 / n);
  const pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(x + r * Math.cos(a)).toFixed(2)} ${(y + r * Math.sin(a)).toFixed(2)}`;
  };
  const petals = Array.from({ length: n }, (_, j) => {
    const th = (k === "third-eye" ? 0 : -90) + j * (360 / n);
    return `M${pt(r0, th - dd)}Q${pt(r0 + len * 0.8, th - dd * 0.95)} ${pt(r0 + len, th)}Q${pt(r0 + len * 0.8, th + dd * 0.95)} ${pt(r0, th + dd)}`;
  });
  return (
    <g pointerEvents="none">
      {on && <circle cx={x} cy={y} r={core + len + 6} fill={c.color} opacity="0.55" filter={`url(#${p}glow)`} />}
      <g fill={c.color} fillOpacity={on ? 0.42 : 0.2} stroke={c.color} strokeOpacity={on ? 1 : 0.75} strokeWidth={on ? 0.8 : 0.6} strokeLinejoin="round">
        {petals.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <circle cx={x} cy={y} r={core} fill={c.color} fillOpacity={on ? 1 : 0.82} stroke={big ? "#FFF6DC" : "#0B0B0D"} strokeOpacity={big ? 0.9 : 0.6} strokeWidth={big ? 1.2 : 0.8} />
      <circle cx={x - core * 0.3} cy={y - core * 0.35} r={core * 0.38} fill="#fff" opacity={on ? 0.45 : 0.25} />
    </g>
  );
}

/** Ida (izquierda, side -1) o pingala (derecha, +1): se cruzan en cada chakra, de la raíz al entrecejo. */
function nadiPath(side: 1 | -1) {
  const ys = (["root", "sacral", "solar", "heart", "throat", "third-eye"] as KChakra[]).map((k) => CHAKRA_INFO[k].y);
  let d = `M${CX} ${ys[0]}`;
  for (let i = 0; i < ys.length - 1; i++) {
    const s = (i % 2 ? -1 : 1) * side;
    const my = (ys[i] + ys[i + 1]) / 2;
    d += `C${CX + s * 44} ${(ys[i] + my) / 2 + 2} ${CX + s * 44} ${(my + ys[i + 1]) / 2 - 2} ${CX} ${ys[i + 1]}`;
  }
  return d;
}

/** La serpiente enroscada: tres vueltas y media alrededor de la raíz. */
function coilPath() {
  const pts: string[] = [];
  for (let t = 0; t <= 7 * Math.PI; t += 0.12) {
    const r = 4 + t * 1.55;
    pts.push(`${(CX + r * Math.cos(t)).toFixed(1)} ${(SPINE_BOTTOM + 12 + r * Math.sin(t) * 0.4).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}
/** La serpiente que sube: ondula suave por el canal central hasta la corona. */
function risePath() {
  const pts: string[] = [];
  for (let y = SPINE_BOTTOM + 8; y >= SPINE_TOP; y -= 2.5) pts.push(`${(CX + Math.sin((y / 16) * Math.PI) * 5).toFixed(1)} ${y}`);
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
  const t = useT();
  const p = `kb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const riseY = SPINE_BOTTOM - (SPINE_BOTTOM - SPINE_TOP) * rise;
  const lit = (k: KChakra) => (serpent === "rise" && rise > 0 && k !== "aura" ? CHAKRA_INFO[k].y >= riseY - 2 : false);
  const knotsAt: [string, number][] = [["brahma", 249], ["vishnu", 158], ["rudra", 70]];
  const bandAt: Record<string, [number, number, number]> = { mula: [268, 46, 10], uddiyana: [196, 58, 22], jalandhara: [100, 22, 8] };
  const bandOn = (k: string) => bandhas.includes(k) || bandhas.includes("maha");
  const auraOn = chakra === "aura";
  const sushOn = nadis.includes("sushumna");
  return (
    <svg viewBox="0 0 340 330" className={className ?? "mx-auto block h-auto w-full max-w-[30rem] select-none"} role="group" aria-label={t("El cuerpo sutil")}>
      <defs>
        <FigureDefs p={p} auraOn={auraOn} />
      </defs>
      {aura && (
        <g {...(tapProps?.("aura") ?? {})}>
          <ellipse cx={CX} cy={170} rx={158} ry={156} fill={`url(#${p}aura)`} />
          <ellipse cx={CX} cy={170} rx={158} ry={156} fill="none" stroke={auraOn ? "#F7E2AE" : "rgb(244 241 234 / .2)"} strokeWidth={auraOn ? 1.2 : 0.6} strokeDasharray={auraOn ? undefined : "1 5"} strokeLinecap="round" />
          {auraOn && <ellipse cx={CX} cy={170} rx={150} ry={148} fill="none" stroke="#F7E2AE" strokeOpacity="0.35" strokeWidth="0.6" />}
        </g>
      )}
      <SeatedFigure p={p} />
      {/* La columna de luz: los colores de los chakras, muy suaves. */}
      <line x1={CX} y1={SPINE_BOTTOM} x2={CX} y2={SPINE_TOP} stroke={`url(#${p}spine)`} strokeWidth="7" strokeLinecap="round" opacity="0.22" filter={`url(#${p}hair)`} pointerEvents="none" />
      {/* Los cierres. */}
      {Object.entries(bandAt).map(([k, [y, rx, ry]]) =>
        bandOn(k) ? (
          <g key={k} pointerEvents="none">
            <ellipse cx={CX} cy={y} rx={rx} ry={ry} fill="#F2C94C" opacity="0.32" filter={`url(#${p}glow)`} />
            <ellipse cx={CX} cy={y} rx={rx} ry={ry} fill="none" stroke="#F7E2AE" strokeWidth="1.2" className="geo-draw" pathLength={1} />
          </g>
        ) : null,
      )}
      {/* Los canales. */}
      <g fill="none" strokeLinecap="round" pointerEvents="none">
        {nadis.includes("ida") && (
          <>
            {nadiOn === "ida" && <path d={nadiPath(-1)} stroke="#A9D3EE" strokeWidth="5" opacity="0.45" filter={`url(#${p}hair)`} />}
            <path d={nadiPath(-1)} stroke="#A9D3EE" strokeWidth={nadiOn === "ida" ? 2 : 1} strokeOpacity={nadiOn && nadiOn !== "ida" ? 0.28 : 0.85} />
          </>
        )}
        {nadis.includes("pingala") && (
          <>
            {nadiOn === "pingala" && <path d={nadiPath(1)} stroke="#F08A3C" strokeWidth="5" opacity="0.45" filter={`url(#${p}hair)`} />}
            <path d={nadiPath(1)} stroke="#F08A3C" strokeWidth={nadiOn === "pingala" ? 2 : 1} strokeOpacity={nadiOn && nadiOn !== "pingala" ? 0.28 : 0.85} />
          </>
        )}
        {sushOn && (
          <>
            {nadiOn === "sushumna" && <line x1={CX} y1={SPINE_BOTTOM} x2={CX} y2={SPINE_TOP} stroke="#F7E2AE" strokeWidth="6" opacity="0.5" filter={`url(#${p}hair)`} />}
            <line x1={CX} y1={SPINE_BOTTOM} x2={CX} y2={SPINE_TOP} stroke={GOLD} strokeWidth={nadiOn === "sushumna" ? 2.2 : 1.1} strokeOpacity={nadiOn && nadiOn !== "sushumna" ? 0.3 : 0.9} />
          </>
        )}
      </g>
      {/* La serpiente. */}
      {serpent === "coiled" && (
        <g pointerEvents="none">
          <path d={coilPath()} fill="none" stroke="#E2574C" strokeWidth="5" opacity="0.3" filter={`url(#${p}hair)`} />
          <path d={coilPath()} fill="none" stroke={`url(#${p}snake)`} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}
      {serpent === "rise" && (
        <g pointerEvents="none">
          <path d={coilPath()} fill="none" stroke="#E2574C" strokeOpacity={0.5 * (1 - rise)} strokeWidth="2.2" strokeLinecap="round" />
          <path d={risePath()} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - rise} fill="none" stroke="#F7E2AE" strokeWidth="8" opacity="0.35" filter={`url(#${p}hair)`} />
          <path d={risePath()} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - rise} fill="none" stroke={`url(#${p}snake)`} strokeWidth="3.6" strokeLinecap="round" />
          {rise > 0.02 && (
            <>
              <circle cx={CX + Math.sin((riseY / 16) * Math.PI) * 5} cy={riseY} r="11" fill="#F7E2AE" opacity="0.45" filter={`url(#${p}glow)`} />
              <circle cx={CX + Math.sin((riseY / 16) * Math.PI) * 5} cy={riseY} r="4.2" fill="#FFF3D2" />
            </>
          )}
        </g>
      )}
      {/* Los nudos: dos anillos entrelazados. */}
      {knots &&
        knotsAt.map(([k, y]) => {
          const on = knotOn === k;
          return (
            <g key={k} pointerEvents="none" opacity={knotOn && !on ? 0.45 : 1}>
              {on && <circle cx={CX} cy={y} r="16" fill="#F7E2AE" opacity="0.35" filter={`url(#${p}glow)`} />}
              <ellipse cx={CX - 5} cy={y} rx="7" ry="5.5" fill="none" stroke={on ? "#FFF3D2" : GOLD} strokeWidth={on ? 1.6 : 1} />
              <ellipse cx={CX + 5} cy={y} rx="7" ry="5.5" fill="none" stroke={on ? "#FFF3D2" : GOLD} strokeWidth={on ? 1.6 : 1} />
              <text x={CX + 24} y={y} dominantBaseline="central" fontSize="9" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={on ? "#F7E2AE" : STAR} fillOpacity="0.85" stroke="#0B0B0D" strokeWidth="3" paintOrder="stroke">
                <Tr s={k} />
              </text>
            </g>
          );
        })}
      {/* Los chakras. */}
      {K_CHAKRAS.filter((k): k is Exclude<KChakra, "aura"> => k !== "aura").map((k) => {
        const c = CHAKRA_INFO[k];
        const on = chakra === k || lit(k);
        return (
          <g key={k} {...(tapProps?.(k) ?? (onChakra ? { onClick: () => onChakra(k), style: { cursor: "pointer" } } : {}))}>
            <circle cx={CX} cy={c.y} r="18" fill="transparent" />
            <ChakraLotus k={k} y={c.y} on={on} big={chakra === k} p={p} />
          </g>
        );
      })}
    </svg>
  );
}
