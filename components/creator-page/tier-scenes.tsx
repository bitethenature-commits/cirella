import type { CSSProperties } from "react";
import { figurePaths } from "@/lib/sacred-figures";
import type { TierFrame, TierScene } from "@/lib/tier-look";

/**
 * Los paisajes de ensueño y los marcos de las tarjetas de miembro (lib/tier-look.ts), todo dibujado (sin fotos):
 * capas de SVG y CSS (globals.css → «Tarjetas de miembro») con sus colores en variables (--tp-sky, --tpb, --tph…),
 * así cada tarjeta lleva los suyos. Cada capa tiene su profundidad (--d): al mover el ratón por encima, las de
 * delante se mueven más que las del fondo (components/creator-page/tier-motion.tsx), como mirar por una puerta.
 * La luz de cada paisaje sale del icono del nivel (--tp-eye). Sin texto ni eventos; vale en el servidor.
 */

/** Un número «al azar» que siempre sale igual (así el servidor y el navegador pintan lo mismo). */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const r1 = (n: number) => Math.round(n * 10) / 10;
/** La profundidad de una capa (0, quieta; 12, la de más delante). */
const d = (n: number, more?: Record<string, string | number>) => ({ "--d": n, ...more }) as CSSProperties;

// ── Formas ──

/** Copas de árboles o matorrales en fila (de x0 a x1, apoyadas en `base`). */
function canopy(x0: number, x1: number, base: number, high: number, seed: number) {
  let p = `M${x0} ${base}`;
  let x = x0;
  let i = 0;
  while (x < x1) {
    const w = 10 + rnd(seed + i) * 16;
    const h = high * (0.45 + rnd(seed + i + 50) * 0.55);
    const nx = Math.min(x1, x + w);
    p += ` Q${r1(x + w * 0.1)} ${r1(base - h)} ${r1((x + nx) / 2)} ${r1(base - h - 3)} Q${r1(nx - w * 0.1)} ${r1(base - h)} ${r1(nx)} ${r1(base - h * 0.35)}`;
    x = nx;
    i++;
  }
  return `${p} L${x1} ${base} Z`;
}

/**
 * Troncos en perspectiva a los dos lados de un camino: en un lienzo 100 × 100 que va del horizonte (y 0) hasta abajo
 * (y 100). `f`: lo cerca que está cada par (0, en el horizonte; 1, delante del todo). Suben hasta salirse por arriba.
 */
function trunks(fs: number[], seed: number) {
  return fs
    .flatMap((f, i) =>
      [-1, 1].map((side) => {
        const x = 50 + side * (10 + 42 * f) + (rnd(seed + i * 2 + (side > 0 ? 1 : 0)) - 0.5) * 3 * f;
        const w = 0.8 + 8.5 * f;
        const base = 100 * f;
        const lean = (rnd(seed + i + 40) - 0.5) * 2.4;
        const root = 6 * f;
        return `M${r1(x - w * 0.66)} ${r1(base)} Q${r1(x - w * 0.5)} ${r1(base - root * 0.4)} ${r1(x - w * 0.5)} ${r1(base - root)} L${r1(x - w * 0.36 + lean)} -140 L${r1(x + w * 0.36 + lean)} -140 L${r1(x + w * 0.5)} ${r1(base - root)} Q${r1(x + w * 0.5)} ${r1(base - root * 0.4)} ${r1(x + w * 0.66)} ${r1(base)} Z`;
      }),
    )
    .join(" ");
}

/** Un camino hacia la luz (de `top`, casi un punto, a `bottom`): sus bordes y sus filas, más juntas a lo lejos. */
function perspectiveRows(l0: number, r0: number, l1: number, r1x: number, rows: number, joints: number) {
  const t = (k: number) => Math.pow(k / rows, 1.85);
  const at = (tt: number, f: number) => {
    const l = l0 + (l1 - l0) * tt;
    const r = r0 + (r1x - r0) * tt;
    return { x: r1(l + (r - l) * f), y: r1(tt * 100) };
  };
  const lines: { d: string; o: number }[] = [];
  for (let k = 1; k < rows; k++) {
    const a = at(t(k), 0);
    const b = at(t(k), 1);
    lines.push({ d: `M${a.x} ${a.y}L${b.x} ${b.y}`, o: 0.12 + 0.3 * (1 - k / rows) });
  }
  for (let k = 0; k < rows && joints; k++) {
    for (let j = 1; j <= joints; j++) {
      const f = (j - (k % 2 ? 0.5 : 0)) / joints;
      if (f <= 0 || f >= 1) continue;
      const a = at(t(k), f);
      const b = at(t(k + 1), f);
      lines.push({ d: `M${a.x} ${a.y}L${b.x} ${b.y}`, o: 0.08 + 0.2 * (1 - k / rows) });
    }
  }
  return lines;
}

/** La cresta de una nube, una colina o una duna en un lienzo 300 × 40 (abajo, recto: sigue en su cuerpo). */
function cloudTop(seed: number, base = 26, lo = 7, hi = 15) {
  let p = `M0 40 L0 ${base}`;
  let x = 0;
  let i = 0;
  while (x < 300) {
    const w = 18 + rnd(seed + i) * 30;
    const h = lo + rnd(seed + i + 31) * hi;
    const nx = Math.min(300, x + w);
    p += ` C${r1(x + w * 0.05)} ${r1(base - h)} ${r1(nx - w * 0.05)} ${r1(base - h)} ${r1(nx)} ${base}`;
    x = nx;
    i++;
  }
  return `${p} L300 40 Z`;
}

/** Un pino (punta en `base - h`), en capas como un abeto. */
function pine(x: number, base: number, h: number, w: number) {
  const n = 6;
  const right: string[] = [];
  const left: string[] = [];
  for (let k = 1; k <= n; k++) {
    const y = base - h * 0.08 - h * 0.92 * (1 - k / n);
    const half = (w / 2) * (0.22 + 0.78 * (k / n));
    right.push(`${r1(x + half)} ${r1(y)}`);
    if (k < n) right.push(`${r1(x + half * 0.38)} ${r1(y - h * 0.03)}`);
    left.unshift(`${r1(x - half)} ${r1(y)}`);
    if (k < n) left.unshift(`${r1(x - half * 0.38)} ${r1(y - h * 0.03)}`);
  }
  return `M${x} ${r1(base - h)} L${right.join(" L")} L${r1(x + w * 0.05)} ${r1(base - h * 0.08)} L${r1(x + w * 0.05)} ${base} L${r1(x - w * 0.05)} ${base} L${r1(x - w * 0.05)} ${r1(base - h * 0.08)} L${left.join(" L")} Z`;
}

// ── Lo que se calcula una vez ──

const FAR_LEFT = canopy(0, 128, 70, 34, 3);
const FAR_RIGHT = canopy(172, 300, 70, 34, 9);
const TRUNKS_FAR = trunks([0.05, 0.09, 0.14, 0.2], 2);
const TRUNKS_MID = trunks([0.27, 0.38], 12);
const TRUNKS_NEAR = trunks([0.6, 0.92], 22);
const BUSHES = `${canopy(0, 84, 80, 46, 51)} ${canopy(216, 300, 80, 46, 57)}`;
const PATH_ROWS = perspectiveRows(49.3, 50.7, 14, 86, 13, 4);
const STAIR_ROWS = perspectiveRows(46, 54, 8, 92, 15, 0);
/** Motas de luz que suben. */
const MOTES = Array.from({ length: 10 }, (_, i) => ({ x: r1(8 + rnd(i + 1) * 84), d: r1(rnd(i + 7) * 9), t: r1(9 + rnd(i + 13) * 8), s: r1(2 + rnd(i + 19) * 2.5) }));
/** Escalones que flotan (Mar de nubes), del más lejano al más cercano. */
const STEPS = Array.from({ length: 8 }, (_, i) => {
  const k = 7 - i;
  const f = r1(1 - (k / 7) * 0.84);
  return { f, x: r1(50 + Math.sin(k * 1.25 + 0.6) * 14 * f), delay: r1(rnd(k + 5) * 4) };
});
const CLOUDS = [cloudTop(4), cloudTop(14, 26, 8, 14), cloudTop(24, 26, 9, 15), cloudTop(34, 26, 10, 14)];
const PINES = [pine(10, 160, 150, 34), pine(28, 160, 108, 26), pine(43, 160, 68, 18), pine(290, 160, 158, 36), pine(272, 160, 116, 28), pine(257, 160, 72, 18)].join(" ");
/** Flores que brillan sobre las colinas (Jardín encantado): x en %, f lo cerca que están. */
const BLOOMS = Array.from({ length: 16 }, (_, i) => ({ x: r1(4 + rnd(i + 71) * 92), f: r1(0.12 + rnd(i + 83) * 0.85), t: r1(3 + rnd(i + 97) * 4), delay: r1(rnd(i + 5) * 5) })).filter((b) => b.x < 40 || b.x > 60 || b.f > 0.45);
/** Columnas a los dos lados (Templo de luz), de la más lejana a la más cercana. */
const COLONNADE = [0.22, 0.36, 0.52, 0.72, 1];
/** Peces que cruzan despacio (Fondo del mar). */
const FISH = [
  { y: 30, s: 0.9, t: 34, delay: 0, back: false },
  { y: 46, s: 0.6, t: 46, delay: 15, back: true },
  { y: 22, s: 0.5, t: 52, delay: 30, back: false },
];
/** Algas que se mecen (Fondo del mar): x en %, alto en % del dibujo. */
const KELP = [
  { x: 3, h: 74, delay: 0 },
  { x: 13, h: 52, delay: 1.4 },
  { x: 86, h: 60, delay: 0.7 },
  { x: 95, h: 80, delay: 2.1 },
];
const KELP_PATH = "M10 100 C3 84 17 70 10 54 S3 24 10 0";
const KELP_LEAVES = [80, 64, 48, 32, 16].map((y, i) => ({ x: i % 2 ? 14 : 6, y, a: i % 2 ? 35 : -35 }));
/** Ramas en flor (Cerezos), dibujadas para el lado izquierdo (el derecho, al revés). */
const BLOSSOMS: [number, number, number][] = [
  [58, 31, 5.5], [68, 37, 4.5], [80, 44, 5.5], [93, 47, 4.8], [103, 44, 3.6], [62, 13, 4.4], [70, 8, 3.4], [54, 18, 3.6], [79, 61, 4.6], [74, 67, 3.4], [44, 28, 3.2], [33, 27, 3.8], [21, 32, 3],
];
/** Hojas y flores de la enredadera a lo largo del arco (lienzo 200 × 120, radio 88). */
const ARCH_LEAVES = Array.from({ length: 23 }, (_, i) => {
  const th = Math.PI - (i / 22) * Math.PI;
  const r = 88 + Math.sin(i * 1.7) * 3;
  const tangent = (Math.atan2(-Math.cos(th), -Math.sin(th)) * 180) / Math.PI;
  return { x: r1(100 + r * Math.cos(th)), y: r1(100 - r * Math.sin(th)), a: r1(tangent + (i % 2 ? 40 : -40)), flower: i % 5 === 2 };
});
const VINE = (() => {
  const pts = Array.from({ length: 45 }, (_, i) => {
    const th = Math.PI - (i / 44) * Math.PI;
    const r = 88 + Math.sin(i * 0.9) * 2.5;
    return `${r1(100 + r * Math.cos(th))} ${r1(100 - r * Math.sin(th))}`;
  });
  return `M12 120 L12 100 L${pts.join(" L")} L188 100 L188 120`;
})();
/**
 * La talla del marco (Puerta tallada): cuentas y hojas entre las dos molduras de la banda del arco (de radio 90 a 100
 * en un lienzo 200 × 104: 5 de cada 100 del ancho de la tarjeta). La de arriba del todo, no: ahí va la clave.
 */
const CARVING = Array.from({ length: 29 }, (_, i) => {
  const th = Math.PI - ((i + 0.5) / 29) * Math.PI;
  const tangent = (th * 180) / Math.PI;
  return { x: r1(100 + 94.4 * Math.cos(th)), y: r1(100 - 94.4 * Math.sin(th)), a: r1(90 - tangent), bead: i % 2 === 0, top: Math.abs(i - 14) < 1 };
}).filter((c) => !c.top);

// ── Paisajes ──

function Mist({ n, depth }: { n: 1 | 2 | 3; depth: number }) {
  return (
    <span className="tp-l" style={d(depth)}>
      <span className={`tp-mist tp-mist-${n}`} />
    </span>
  );
}

function Stars() {
  return (
    <span className="tp-l" style={d(1)}>
      <span className="tp-stars" />
      <span className="tp-stars tp-stars-2" />
    </span>
  );
}

/**
 * Una cresta con su cuerpo (nubes, colinas, dunas): `y`, dónde empieza bajo el icono; `c`, su color (y `c2`, el de
 * abajo); `ridge`, la línea de luz de la cresta (abierta: sin la raya de abajo).
 */
function Band({ path, y, c, c2, depth, ridge, h = "2.5rem" }: { path: string; y: string; c: string; c2?: string; depth: number; ridge?: string; h?: string }) {
  return (
    <span className="tp-l" style={d(depth)}>
      <span className="tp-band" style={{ "--y": y, "--c": c, "--c2": c2 ?? c, "--h": h } as CSSProperties}>
        <svg viewBox="0 0 300 40" preserveAspectRatio="none">
          <path d={path} />
          {ridge && <path d={ridge} className="tp-ridge-line" vectorEffect="non-scaling-stroke" />}
        </svg>
      </span>
    </span>
  );
}

function Forest() {
  return (
    <>
      <span className="tp-sky" />
      <span className="tp-l" style={d(1)}>
        <span className="tp-beams" />
      </span>
      <span className="tp-l" style={d(2)}>
        <svg className="tp-treeline" viewBox="0 0 300 70" preserveAspectRatio="xMidYMax slice">
          <path d={FAR_LEFT} />
          <path d={FAR_RIGHT} />
        </svg>
      </span>
      <span className="tp-l" style={d(3)}>
        <svg className="tp-ground tp-trunks tp-trunks-far" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={TRUNKS_FAR} />
        </svg>
      </span>
      <Mist n={1} depth={3} />
      <span className="tp-l" style={d(5)}>
        <svg className="tp-ground tp-path" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="49.3,0 50.7,0 86,100 14,100" />
          <g>
            <path d="M49.3 0L14 100M50.7 0L86 100" strokeOpacity=".45" vectorEffect="non-scaling-stroke" />
            {PATH_ROWS.map((l, i) => (
              <path key={i} d={l.d} strokeOpacity={l.o} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </svg>
      </span>
      <span className="tp-l" style={d(5)}>
        <svg className="tp-ground tp-trunks tp-trunks-mid" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={TRUNKS_MID} />
        </svg>
      </span>
      <Mist n={2} depth={6} />
      <span className="tp-l" style={d(9)}>
        <svg className="tp-ground tp-trunks tp-trunks-near" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={TRUNKS_NEAR} />
        </svg>
      </span>
      <span className="tp-l" style={d(11)}>
        <svg className="tp-bushes" viewBox="0 0 300 80" preserveAspectRatio="none">
          <path d={BUSHES} />
        </svg>
      </span>
      <Mist n={3} depth={10} />
      <span className="tp-l" style={d(7)}>
        {MOTES.map((m, i) => (
          <span key={i} className="tp-mote" style={{ left: `${m.x}%`, animationDelay: `-${m.d}s`, animationDuration: `${m.t}s`, width: m.s, height: m.s }} />
        ))}
      </span>
      <span className="tp-l" style={d(3)}>
        {[0, 1, 2].map((i) => (
          <svg key={i} className={`tp-bird tp-bird-${i}`} viewBox="0 0 20 10">
            <path d="M1 6 Q5.5 1 10 6 Q14.5 1 19 6" />
          </svg>
        ))}
      </span>
    </>
  );
}

function Clouds() {
  return (
    <>
      <span className="tp-sky" />
      <span className="tp-l" style={d(1)}>
        <span className="tp-sun" />
      </span>
      <Band path={CLOUDS[0]} y="0.2rem" c="var(--tp-cloud-1)" c2="var(--tp-cloud-2)" depth={2} />
      <Band path={CLOUDS[1]} y="4rem" c="var(--tp-cloud-2)" c2="var(--tp-cloud-3)" depth={4} />
      <span className="tp-l" style={d(7)}>
        {STEPS.map((s, i) => (
          <span key={i} className="tp-step" style={{ "--f": s.f, left: `${s.x}%`, animationDelay: `-${s.delay}s` } as CSSProperties} />
        ))}
      </span>
      <Band path={CLOUDS[2]} y="13rem" c="var(--tp-cloud-3)" c2="var(--tp-cloud-4)" depth={9} />
      <Band path={CLOUDS[3]} y="21rem" c="var(--tp-cloud-4)" depth={12} />
    </>
  );
}

function Lake() {
  return (
    <>
      <span className="tp-sky" />
      <Stars />
      <span className="tp-l" style={d(1)}>
        <span className="tp-moon" />
      </span>
      <span className="tp-l" style={d(2)}>
        <span className="tp-water" />
        <span className="tp-glint" />
      </span>
      <span className="tp-l" style={d(3)}>
        <svg className="tp-peaks" viewBox="0 0 300 60" preserveAspectRatio="none">
          <path d="M0 60 L0 30 L18 22 L34 30 L52 12 L70 24 L88 18 L108 34 L126 40 L150 46 L174 40 L192 32 L212 16 L230 26 L248 10 L268 24 L286 18 L300 26 L300 60 Z" />
        </svg>
        <svg className="tp-peaks tp-mirror" viewBox="0 0 300 60" preserveAspectRatio="none">
          <path d="M0 60 L0 30 L18 22 L34 30 L52 12 L70 24 L88 18 L108 34 L126 40 L150 46 L174 40 L192 32 L212 16 L230 26 L248 10 L268 24 L286 18 L300 26 L300 60 Z" />
        </svg>
      </span>
      <span className="tp-l" style={d(5)}>
        <svg className="tp-hills" viewBox="0 0 300 40" preserveAspectRatio="none">
          <path d="M0 40 L0 18 Q30 6 60 16 T120 26 Q150 32 180 26 T240 14 Q270 8 300 16 L300 40 Z" />
        </svg>
      </span>
      <span className="tp-l" style={d(9)}>
        <svg className="tp-pines" viewBox="0 0 300 160" preserveAspectRatio="xMidYMax slice">
          <path d={PINES} />
        </svg>
        <svg className="tp-pines tp-mirror" viewBox="0 0 300 160" preserveAspectRatio="xMidYMax slice">
          <path d={PINES} />
        </svg>
      </span>
    </>
  );
}

function Aurora() {
  return (
    <>
      <span className="tp-sky" />
      <Stars />
      <span className="tp-l" style={d(2)}>
        {[
          "M-20 20 C40 0 80 50 140 30 S240 10 320 40 L320 70 C260 46 200 80 140 64 S40 50 -20 66 Z",
          "M-20 50 C50 30 100 76 160 56 S260 34 320 64 L320 92 C250 72 190 104 130 86 S30 76 -20 96 Z",
          "M-20 4 C60 -6 120 34 180 16 S270 -2 320 18 L320 44 C260 28 190 58 140 40 S40 28 -20 44 Z",
        ].map((p, i) => (
          <svg key={i} className={`tp-aurora tp-aurora-${i}`} viewBox="0 0 300 120" preserveAspectRatio="none">
            <path d={p} />
          </svg>
        ))}
      </span>
      <span className="tp-l" style={d(3)}>
        <svg className="tp-snowpeaks" viewBox="0 0 300 80" preserveAspectRatio="none">
          <path d="M0 80 L0 52 L26 34 L44 46 L70 18 L92 40 L112 30 L134 50 L150 56 L166 50 L186 28 L206 42 L228 12 L252 38 L272 26 L300 44 L300 80 Z" />
          <path className="tp-snowcap" d="M60 30 L70 18 L80 30 L74 28 L70 33 L66 27 Z M218 26 L228 12 L238 26 L232 24 L228 29 L223 23 Z M178 38 L186 28 L194 38 L189 36 L186 40 L182 35 Z M18 42 L26 34 L34 42 L29 40 L26 44 L23 39 Z" />
          <path className="tp-snowline" d="M0 52 L26 34 L44 46 L70 18 L92 40 L112 30 L134 50 L150 56 L166 50 L186 28 L206 42 L228 12 L252 38 L272 26 L300 44" vectorEffect="non-scaling-stroke" />
        </svg>
      </span>
      <span className="tp-l" style={d(5)}>
        <svg className="tp-snownear" viewBox="0 0 300 60" preserveAspectRatio="none">
          <path d="M0 60 L0 30 L30 20 L58 34 L84 24 L110 40 L150 46 L190 40 L216 22 L244 32 L270 18 L300 28 L300 60 Z" />
          <path className="tp-snowline" d="M0 30 L30 20 L58 34 L84 24 L110 40 L150 46 L190 40 L216 22 L244 32 L270 18 L300 28" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="tp-snowfield" />
      </span>
      <span className="tp-l" style={d(9)}>
        <svg className="tp-pines tp-pines-snow" viewBox="0 0 300 160" preserveAspectRatio="xMidYMax slice">
          <path d={PINES} />
        </svg>
      </span>
    </>
  );
}

function Cosmos() {
  return (
    <>
      <span className="tp-sky" />
      <span className="tp-l" style={d(1)}>
        <span className="tp-neb tp-neb-1" />
        <span className="tp-neb tp-neb-2" />
        <span className="tp-neb tp-neb-3" />
      </span>
      <Stars />
      <span className="tp-l" style={d(2)}>
        <span className="tp-flare" />
      </span>
      <span className="tp-l" style={d(4)}>
        <span className="tp-moonlet" />
      </span>
      <span className="tp-l" style={d(7)}>
        <span className="tp-planet" />
      </span>
    </>
  );
}

function Sakura() {
  return (
    <>
      <span className="tp-sky" />
      <span className="tp-l" style={d(1)}>
        <span className="tp-sun" />
      </span>
      <Band path={cloudTop(61, 30, 4, 10)} y="1.6rem" c="var(--tp-hill-1)" depth={2} />
      <span className="tp-l" style={d(3)}>
        <span className="tp-groves" />
      </span>
      <Band path={cloudTop(71, 30, 3, 8)} y="3.4rem" c="var(--tp-hill-2)" c2="var(--tp-hill-3)" depth={5} />
      <span className="tp-l" style={d(10)}>
        {(["l", "r"] as const).map((side) => (
          <svg key={side} className={`tp-branch tp-branch-${side}`} viewBox="0 0 120 80" preserveAspectRatio="xMinYMin meet">
            <path className="tp-bark" d="M-6 30 C20 34 40 26 58 33 S88 50 104 46" strokeWidth="3.4" />
            <path className="tp-bark" d="M30 30 C40 18 52 14 68 9" strokeWidth="1.8" />
            <path className="tp-bark" d="M58 33 C66 44 72 58 80 64" strokeWidth="1.5" />
            {BLOSSOMS.map(([x, y, r], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={r} className="tp-blossom" />
                <circle cx={x - r * 0.25} cy={y - r * 0.25} r={r * 0.35} className="tp-blossom-eye" />
              </g>
            ))}
          </svg>
        ))}
      </span>
    </>
  );
}

function Meadow() {
  return (
    <>
      <span className="tp-sky" />
      <Band path={cloudTop(81, 30, 4, 10)} y="1.4rem" c="var(--tp-hill-1)" depth={2} />
      <Band path={cloudTop(91, 30, 5, 10)} y="4.4rem" c="var(--tp-hill-2)" depth={4} />
      <Band path={cloudTop(101, 30, 6, 12)} y="9rem" c="var(--tp-hill-3)" depth={7} />
      <span className="tp-l" style={d(6)}>
        {BLOOMS.map((b, i) => (
          <span key={i} className="tp-bloom" style={{ "--f": b.f, left: `${b.x}%`, animationDuration: `${b.t}s`, animationDelay: `-${b.delay}s` } as CSSProperties} />
        ))}
      </span>
      <span className="tp-l" style={d(11)}>
        <svg className="tp-grass" viewBox="0 0 300 40" preserveAspectRatio="none">
          <path d="M0 40 L0 30 Q8 14 12 30 Q18 8 24 30 Q30 18 36 30 Q44 4 50 30 Q56 16 62 30 Q70 10 78 30 Q84 20 90 30 L90 40 Z M210 40 L210 30 Q218 12 224 30 Q230 20 236 30 Q244 6 250 30 Q258 16 264 30 Q270 8 278 30 Q286 18 292 30 Q296 22 300 30 L300 40 Z" />
        </svg>
      </span>
    </>
  );
}

function Dunes() {
  const ridge = (y: number) => `M0 ${y} C40 ${y - 14} 80 ${y - 16} 120 ${y - 4} S200 ${y + 6} 240 ${y - 10} S290 ${y - 12} 300 ${y - 6}`;
  const dune = (y: number) => `M0 40 L${ridge(y).slice(1)} L300 40 Z`;
  return (
    <>
      <span className="tp-sky" />
      <Stars />
      <span className="tp-l" style={d(1)}>
        <span className="tp-moon tp-moon-big" />
      </span>
      <Band path={dune(30)} ridge={ridge(30)} y="2.2rem" c="var(--tp-dune-1)" c2="var(--tp-dune-2)" depth={2} />
      <Band path={dune(28)} ridge={ridge(28)} y="5rem" c="var(--tp-dune-2)" c2="var(--tp-dune-3)" depth={4} h="3rem" />
      <Band path={dune(32)} ridge={ridge(32)} y="10rem" c="var(--tp-dune-3)" c2="var(--tp-dune-4)" depth={7} h="3.5rem" />
      <Band path={dune(30)} ridge={ridge(30)} y="17rem" c="var(--tp-dune-4)" depth={11} h="4rem" />
    </>
  );
}

function Sea() {
  return (
    <>
      <span className="tp-sky" />
      <span className="tp-l" style={d(1)}>
        <span className="tp-caustics" />
        <span className="tp-shafts" />
      </span>
      <span className="tp-l" style={d(4)}>
        {FISH.map((f, i) => (
          <span key={i} className={`tp-fish${f.back ? " tp-fish-back" : ""}`} style={{ top: `${f.y}%`, "--s": f.s, animationDuration: `${f.t}s`, animationDelay: `-${f.delay}s` } as CSSProperties}>
            <svg viewBox="0 0 20 10">
              <path d="M0 5 Q6 0 13 5 Q6 10 0 5 Z M12 5 L20 1 L18 5 L20 9 Z" />
            </svg>
          </span>
        ))}
      </span>
      <span className="tp-l" style={d(5)}>
        <svg className="tp-seabed" viewBox="0 0 300 40" preserveAspectRatio="none">
          <path d={cloudTop(111, 24, 3, 9)} />
        </svg>
      </span>
      <span className="tp-l" style={d(9)}>
        {KELP.map((k, i) => (
          <svg key={i} className="tp-kelp" viewBox="0 0 20 100" preserveAspectRatio="none" style={{ left: `${k.x}%`, height: `${k.h}%`, animationDelay: `-${k.delay}s` }}>
            <path d={KELP_PATH} className="tp-kelp-stem" vectorEffect="non-scaling-stroke" />
            {KELP_LEAVES.map((l, j) => (
              <ellipse key={j} cx={l.x} cy={l.y} rx="5" ry="2" transform={`rotate(${l.a} ${l.x} ${l.y})`} />
            ))}
          </svg>
        ))}
      </span>
    </>
  );
}

function Temple() {
  return (
    <>
      <span className="tp-sky" />
      <span className="tp-l" style={d(1)}>
        <span className="tp-rays2" />
      </span>
      <span className="tp-l" style={d(1)}>
        <svg className="tp-flower-of-life" viewBox="-6 -6 212 212" fill="none">
          <path d={figurePaths("flower").join(" ")} />
        </svg>
      </span>
      <span className="tp-l" style={d(5)}>
        <svg className="tp-ground tp-stairs" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="46,0 54,0 92,100 8,100" />
          <g>
            {STAIR_ROWS.map((l, i) => (
              <path key={i} d={l.d} strokeOpacity={l.o} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </svg>
      </span>
      {COLONNADE.map((f, i) => (
        <span key={i} className="tp-l" style={d(Math.round(2 + f * 9))}>
          <span className="tp-colm tp-colm-l" style={{ "--f": f } as CSSProperties} />
          <span className="tp-colm tp-colm-r" style={{ "--f": f } as CSSProperties} />
        </span>
      ))}
    </>
  );
}

const SCENES: Partial<Record<TierScene, () => React.JSX.Element>> = {
  forest: Forest,
  clouds: Clouds,
  lake: Lake,
  aurora: Aurora,
  cosmos: Cosmos,
  sakura: Sakura,
  meadow: Meadow,
  dunes: Dunes,
  sea: Sea,
  temple: Temple,
};

/** ¿Este paisaje se dibuja? (La noche y su foto, no: son el velo de siempre.) */
export const isDrawnScene = (s: TierScene) => !!SCENES[s];

/** El paisaje de una tarjeta, detrás del velo. */
export function TierSceneArt({ scene }: { scene: TierScene }) {
  const Scene = SCENES[scene];
  if (!Scene) return null;
  return (
    <span aria-hidden className="tp-scene">
      <Scene />
    </span>
  );
}

// ── Marcos ──

/** El marco del arco, encima del velo (no se oscurece) y debajo del texto. La línea fina es la de siempre. */
export function TierFrameArt({ frame }: { frame: TierFrame }) {
  if (frame === "fine") return null;
  if (frame === "carved")
    return (
      <span aria-hidden className="tp-frame tp-frame-carved">
        <span className="tp-carve-recess" />
        <svg className="tp-carve" viewBox="0 0 200 104" preserveAspectRatio="xMidYMin meet">
          <path className="tp-carve-band" d="M0 104 L0 100 A100 100 0 0 1 200 100 L200 104 L190 104 L190 100 A90 90 0 0 0 10 100 L10 104 Z" />
          <path className="tp-carve-line" d="M2.4 104 L2.4 100 A97.6 97.6 0 0 1 197.6 100 L197.6 104" vectorEffect="non-scaling-stroke" />
          <path className="tp-carve-line" d="M8.8 104 L8.8 100 A91.2 91.2 0 0 1 191.2 100 L191.2 104" vectorEffect="non-scaling-stroke" />
          {CARVING.map((c, i) =>
            c.bead ? (
              <circle key={i} cx={c.x} cy={c.y} r="1.1" className="tp-carve-bead" />
            ) : (
              <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.a})`} className="tp-carve-leaf">
                <path d="M-2.5 0 Q0 -1.5 2.5 0 Q0 1.5 -2.5 0 Z" />
              </g>
            ),
          )}
          <g className="tp-carve-key">
            <path d="M92 -1 L108 -1 L105 13 L95 13 Z" />
            <circle cx="100" cy="6" r="2.3" className="tp-carve-rose" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={a} cx="100" cy="3.2" rx=".8" ry="1.4" transform={`rotate(${a} 100 6)`} className="tp-carve-petal" />
            ))}
          </g>
        </svg>
        <span className="tp-carve-side tp-carve-l" />
        <span className="tp-carve-side tp-carve-r" />
      </span>
    );
  if (frame === "moon")
    return (
      <span aria-hidden className="tp-frame tp-frame-moon">
        <span className="tp-gate" />
      </span>
    );
  if (frame === "columns")
    return (
      <span aria-hidden className="tp-frame tp-frame-columns">
        <span className="tp-key" />
        <span className="tp-col tp-col-l" />
        <span className="tp-col tp-col-r" />
      </span>
    );
  return (
    <span aria-hidden className="tp-frame tp-frame-vine">
      <svg className="tp-vine-top" viewBox="0 0 200 120" preserveAspectRatio="xMidYMin meet">
        <path d={VINE} className="tp-stem" />
        {ARCH_LEAVES.map((l, i) =>
          l.flower ? (
            <g key={i} transform={`translate(${l.x} ${l.y})`} className="tp-flower">
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy="-2.6" rx="1.5" ry="2.6" transform={`rotate(${a})`} />
              ))}
              <circle r="1.1" className="tp-flower-eye" />
            </g>
          ) : (
            <ellipse key={i} cx={l.x} cy={l.y} rx="5" ry="2.1" transform={`rotate(${l.a} ${l.x} ${l.y})`} className="tp-leaf" />
          ),
        )}
      </svg>
      <span className="tp-vine-side tp-vine-l" />
      <span className="tp-vine-side tp-vine-r" />
    </span>
  );
}
