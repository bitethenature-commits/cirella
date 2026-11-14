import type { CSSProperties } from "react";
import type { Decor } from "@/lib/templates";

/**
 * El fondo decorativo de una plantilla (detrás de todo). Las que se mueven pintan sus piezas aquí y se animan
 * con CSS (globals.css, «cp-fx»): en la página van fijas a la pantalla; en las miniaturas y vistas previas
 * (`contained`), dentro de su caja. Con «reducir movimiento» se quedan quietas.
 */

/** Cuántas piezas lleva cada fondo con movimiento. */
const COUNT: Partial<Record<Decor, number>> = {
  shooting: 6, golddust: 26, fireflies: 18, petals: 14,
  nebula: 3, leaves: 14, mist: 3, snow: 40, bubbles: 16, candles: 4, rain: 55, caustics: 6, haze: 22,
};
/** Cuánto tarda cada pieza en hacer su recorrido: [mínimo, margen] en segundos. */
const DURATION: Partial<Record<Decor, [number, number]>> = {
  shooting: [7, 8], rain: [0.7, 0.8], snow: [10, 12], nebula: [10, 8], mist: [40, 30], candles: [1.2, 0.8], haze: [14, 12],
};
/** Las velas, a los lados (el centro es para el contenido). */
const CANDLE_X = [5, 12, 88, 95];
/** Fondos que, además, llevan estrellas. */
const STARRY: Decor[] = ["stars", "shooting", "moon", "constellation"];

/** Un número «al azar» pero siempre igual (para que servidor y navegador pinten lo mismo). */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function TemplateDecor({
  decor,
  starOpacity = 0.7,
  contained = false,
  children,
}: {
  decor: Decor;
  starOpacity?: number;
  contained?: boolean;
  children?: React.ReactNode;
}) {
  const n = COUNT[decor] ?? 0;
  const [tMin, tSpan] = DURATION[decor] ?? [12, 14];
  const special = decor === "waves" || decor === "moon" || decor === "constellation" || decor === "mandala";
  return (
    <div className={`cp-decor cp-decor-${decor}`} aria-hidden>
      {STARRY.includes(decor) && <div className="starfield absolute inset-0" style={{ opacity: starOpacity }} />}
      {(n > 0 || special) && (
        <div className="cp-fx" data-contained={contained ? "" : undefined}>
          {decor === "waves" && (
            <>
              <span className="cp-wave" />
              <span className="cp-wave" />
              <span className="cp-wave" />
            </>
          )}
          {decor === "moon" && <span className="cp-moon" />}
          {decor === "constellation" && <Constellations />}
          {decor === "mandala" && <Mandala />}
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              className={decor === "candles" ? "cp-candle" : undefined}
              style={
                {
                  "--x": `${decor === "candles" ? CANDLE_X[i] : (rnd(i, 1) * 100).toFixed(1)}%`,
                  "--y": `${(rnd(i, 2) * 100).toFixed(1)}%`,
                  "--s": (0.6 + rnd(i, 3) * 0.9).toFixed(2),
                  "--dx": (rnd(i, 4) * 2 - 1).toFixed(2),
                  "--t": `${(tMin + rnd(i, 5) * tSpan).toFixed(2)}s`,
                  "--d": `${(-rnd(i, 6) * (decor === "rain" ? 2 : 20)).toFixed(2)}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/** Tres constelaciones (inventadas) que se dibujan y se borran, con sus estrellas brillando. */
const SHAPES: [number, number][][] = [
  [[12, 18], [19, 14], [26, 17], [31, 25], [40, 24], [43, 32], [35, 35]],
  [[62, 12], [68, 20], [74, 13], [80, 21], [87, 14]],
  [[70, 62], [76, 70], [84, 68], [88, 78], [79, 84], [72, 79]],
  [[10, 70], [17, 64], [22, 72], [30, 68]],
];
function Constellations() {
  return (
    <svg className="cp-const" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {SHAPES.map((pts, i) => (
        <g key={i} style={{ "--d": `${-i * 3.5}s` } as CSSProperties}>
          <polyline points={pts.map((p) => p.join(",")).join(" ")} pathLength={1} className="cp-const-line" />
          {pts.map(([x, y], j) => (
            <circle key={j} cx={x} cy={y} r={j % 3 === 0 ? 0.55 : 0.38} className="cp-const-star" style={{ animationDelay: `${-(i * 7 + j) * 0.6}s` }} />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Un mandala de líneas doradas: pétalos, anillos y rayos. */
function Mandala() {
  return (
    <svg className="cp-mandala" viewBox="-100 -100 200 200">
      <g fill="none" stroke="var(--c-gold)" strokeWidth="0.6">
        <circle r="96" />
        <circle r="88" strokeDasharray="1 3" />
        <circle r="62" />
        <circle r="30" />
        <circle r="12" />
        {Array.from({ length: 16 }, (_, i) => (
          <ellipse key={`a${i}`} cx="0" cy="-60" rx="12" ry="28" transform={`rotate(${i * 22.5})`} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={`b${i}`} cx="0" cy="-28" rx="7" ry="16" transform={`rotate(${i * 30 + 15})`} />
        ))}
        {Array.from({ length: 32 }, (_, i) => (
          <line key={`c${i}`} x1="0" y1="-62" x2="0" y2="-88" transform={`rotate(${i * 11.25})`} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`d${i}`} d="M0 -12 Q 8 -21 0 -30 Q -8 -21 0 -12Z" transform={`rotate(${i * 45})`} />
        ))}
      </g>
    </svg>
  );
}
