import { MOON_KIND_LABEL, type MoonCircleSky } from "@/lib/moon-circle-sky";

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
 * En lugar de la foto de un círculo de la luna: la luna nueva, llena o el eclipse que le toca (de Sol: disco
 * negro con un anillo de fuego dorado; de Luna: la luna roja), el signo en el que
 * está y una frase sobre esa energía, sobre un cielo de noche con estrellas.
 */
export function MoonCircleArt({ sky, compact = false }: { sky: MoonCircleSky; compact?: boolean }) {
  const full = sky.phase === "full";
  const eclipse = sky.phase === "eclipse" ? (sky.body ?? "lunar") : null;
  return (
    <div className="cp-moonart" data-moon={sky.phase} data-eclipse={eclipse ?? undefined} data-compact={compact ? "" : undefined}>
      <svg className="cp-moonart-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r * 0.35} fill="currentColor" opacity={0.35 + (i % 4) * 0.15} />
        ))}
      </svg>
      <p className="cp-moonart-eyebrow">{MOON_KIND_LABEL[sky.phase]}</p>
      {eclipse ? (
        <EclipseMoon body={eclipse} title={sky.title} />
      ) : (
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
      )}
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

/** El eclipse: de Sol, el disco negro de la luna delante con su anillo de fuego dorado; de Luna, la luna roja. */
function EclipseMoon({ body, title }: { body: "solar" | "lunar"; title: string }) {
  const id = `ecl-${body}`;
  return (
    <svg className="cp-moonart-moon" viewBox="-60 -60 120 120" role="img" aria-label={title}>
      <defs>
        {body === "solar" ? (
          <>
            <radialGradient id={`${id}-corona`}>
              <stop offset="62%" stopColor="#ffe6a3" stopOpacity={0.95} />
              <stop offset="72%" stopColor="#e7b24f" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#d9b46a" stopOpacity={0} />
            </radialGradient>
            <radialGradient id={`${id}-disk`} cx="45%" cy="42%" r="70%">
              <stop offset="0%" stopColor="#1c1a30" />
              <stop offset="100%" stopColor="#06050c" />
            </radialGradient>
          </>
        ) : (
          <>
            <radialGradient id={`${id}-halo`}>
              <stop offset="55%" stopColor="#e0663f" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e0663f" stopOpacity={0} />
            </radialGradient>
            <radialGradient id={`${id}-disk`} cx="40%" cy="36%" r="72%">
              <stop offset="0%" stopColor="#f0a070" />
              <stop offset="45%" stopColor="#b8462a" />
              <stop offset="100%" stopColor="#4a1410" />
            </radialGradient>
          </>
        )}
      </defs>
      {body === "solar" ? (
        <>
          <circle r={58} fill={`url(#${id}-corona)`} />
          <circle r={41.5} fill="none" stroke="#fff3cf" strokeWidth={1.4} opacity={0.9} />
          <circle r={40} fill={`url(#${id}-disk)`} />
          {/* El «anillo de diamante»: un punto de luz en el borde. */}
          <circle cx={27} cy={-30} r={2.6} fill="#fffaf0" />
          <circle cx={27} cy={-30} r={6} fill="#ffe6a3" opacity={0.35} />
        </>
      ) : (
        <>
          <circle r={58} fill={`url(#${id}-halo)`} />
          <circle r={40} fill={`url(#${id}-disk)`} />
          {CRATERS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#5a1a12" opacity={0.3} />
          ))}
          {/* La sombra de la Tierra, más oscura por un lado. */}
          <circle cx={-14} cy={10} r={40} fill="#1a0806" opacity={0.28} />
        </>
      )}
    </svg>
  );
}
