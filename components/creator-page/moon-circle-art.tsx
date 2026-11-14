import type { MoonCircleSky } from "@/lib/moon-circle-sky";

/** Estrellas fijas (siempre las mismas: nada cambia entre el servidor y el navegador). */
const STARS: [number, number, number][] = [
  [8, 6, 0.6], [22, 14, 0.4], [41, 4, 0.5], [63, 10, 0.7], [84, 7, 0.4], [93, 19, 0.5], [12, 27, 0.5], [76, 24, 0.4],
  [5, 46, 0.4], [95, 41, 0.6], [17, 62, 0.5], [88, 58, 0.4], [9, 78, 0.6], [30, 86, 0.4], [70, 82, 0.5], [92, 90, 0.6],
  [52, 95, 0.4], [36, 70, 0.3], [60, 66, 0.3], [48, 22, 0.3],
];

/** Cráteres suaves de la luna llena (cx, cy, r en un disco de radio 40). */
const CRATERS: [number, number, number][] = [
  [-14, -12, 8], [10, -18, 5], [16, 4, 9], [-8, 14, 6], [-22, 6, 4], [4, 22, 4], [22, -6, 3.5],
];

/**
 * En lugar de la foto de un círculo de la luna: la luna nueva o llena que le toca, el signo en el que
 * está y una frase sobre esa energía, sobre un cielo de noche con estrellas.
 */
export function MoonCircleArt({ sky }: { sky: MoonCircleSky }) {
  const full = sky.phase === "full";
  return (
    <div className="cp-moonart" data-moon={sky.phase}>
      <svg className="cp-moonart-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r * 0.35} fill="currentColor" opacity={0.35 + (i % 4) * 0.15} />
        ))}
      </svg>
      <p className="cp-moonart-eyebrow">{full ? "Luna llena" : "Luna nueva"}</p>
      <svg className="cp-moonart-moon" viewBox="-60 -60 120 120" role="img" aria-label={sky.title}>
        <defs>
          <radialGradient id={`halo-${sky.phase}`}>
            <stop offset="55%" stopColor={full ? "#f6e7c1" : "#d9b46a"} stopOpacity={full ? 0.35 : 0.18} />
            <stop offset="100%" stopColor={full ? "#f6e7c1" : "#d9b46a"} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`disk-${sky.phase}`} cx="40%" cy="38%" r="70%">
            {full ? (
              <>
                <stop offset="0%" stopColor="#fffaf0" />
                <stop offset="60%" stopColor="#ecdfc0" />
                <stop offset="100%" stopColor="#c9b78f" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#24213f" />
                <stop offset="75%" stopColor="#12101f" />
                <stop offset="100%" stopColor="#0a0914" />
              </>
            )}
          </radialGradient>
        </defs>
        <circle r={58} fill={`url(#halo-${sky.phase})`} />
        <circle r={40} fill={`url(#disk-${sky.phase})`} />
        {full ? (
          CRATERS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#b9a780" opacity={0.28} />)
        ) : (
          <>
            {/* Luna nueva: apenas un filo de luz dorada y la luz cenicienta. */}
            <circle r={40} fill="none" stroke="#d9b46a" strokeOpacity={0.55} strokeWidth={0.6} />
            <path d="M 28 -28 A 40 40 0 0 1 28 28 A 46 46 0 0 0 28 -28 Z" fill="#d9b46a" opacity={0.45} />
          </>
        )}
      </svg>
      <p className="cp-moonart-glyph" aria-hidden>
        {sky.glyph}
        {"︎"}
      </p>
      <p className="cp-moonart-sign">{sky.sign}</p>
      <div className="cp-moonart-rule" aria-hidden>
        <span />
        <i>✦</i>
        <span />
      </div>
      <p className="cp-moonart-phrase">{sky.phrase}</p>
    </div>
  );
}
