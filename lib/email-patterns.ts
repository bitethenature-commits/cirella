/**
 * Fondos con geometría para los emails: dibujos de líneas finas (flor de la vida, estrellas, rombos
 * art déco, abanicos…) que se repiten detrás del email, en los colores que elija la dueña. No son
 * fotos: se dibujan aquí, en SVG, con su color de fondo, el color de las líneas y la intensidad.
 *
 * Van en tres sitios: el fondo de alrededor (se repite), dentro de las burbujas (se repite, suave) y
 * un adorno en una esquina de la tarjeta (la geometría se difumina hacia el centro).
 *
 *   · En el panel (editor y miniaturas) se ven con el SVG directamente (patternCss, cornerCss).
 *   · En el email van como imagen PNG (/media/fondo/…, app/media/fondo/[file]/route.ts), porque
 *     Gmail y Outlook no enseñan SVG. Outlook de escritorio enseña solo el color de fondo.
 *
 * Puro: sirve en el servidor y en el navegador.
 */

export const PATTERN_KEYS = ["none", "estrellas", "flor", "triangulos", "rombos", "abanicos", "ondas", "lunas", "panal", "arcos", "puntos"] as const;
export type PatternKey = (typeof PATTERN_KEYS)[number];

export const PATTERN_LABEL: Record<PatternKey, string> = {
  none: "Liso",
  estrellas: "Estrellas",
  flor: "Flor de la vida",
  triangulos: "Triángulos sagrados",
  rombos: "Rombos art déco",
  abanicos: "Abanicos",
  ondas: "Ondas",
  lunas: "Lunas",
  panal: "Panal",
  arcos: "Arcos",
  puntos: "Puntos",
};

export type PatternStrength = "s" | "m" | "l";
export const PATTERN_STRENGTH: Record<PatternStrength, number> = { s: 0.14, m: 0.26, l: 0.42 };
export const STRENGTH_LABEL: Record<PatternStrength, string> = { s: "Suave", m: "Media", l: "Marcada" };

/** Lo que hace falta para dibujar un fondo (encaja con EmailStyle). */
export type PatternLook = { bg: string; pattern: PatternKey; patternColor: string; patternStrength: PatternStrength };

const r2 = (n: number) => Math.round(n * 100) / 100;
const SQ3 = Math.sqrt(3);

type Draw = { stroke: string; fill: string; bg: string };
type Tile = { w: number; h: number; body: (d: Draw) => string };

/** Destello de cuatro puntas centrado en (x, y). */
const sparkle = (x: number, y: number, r: number, d: Draw) =>
  `<path d="M${x} ${r2(y - r)}Q${x} ${y} ${r2(x + r)} ${y}Q${x} ${y} ${x} ${r2(y + r)}Q${x} ${y} ${r2(x - r)} ${y}Q${x} ${y} ${x} ${r2(y - r)}Z" ${d.fill}/>`;
const dot = (x: number, y: number, r: number, d: Draw) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r}" ${d.fill}/>`;
const ring = (x: number, y: number, r: number, d: Draw) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="none" ${d.stroke}/>`;
const line = (x1: number, y1: number, x2: number, y2: number, d: Draw) => `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" ${d.stroke}/>`;
/** Media luna que se abre a la derecha. */
const crescent = (x: number, y: number, r: number, d: Draw) =>
  `<path d="M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}A${r2(r * 0.55)} ${r} 0 0 1 ${x} ${y - r}Z" ${d.fill}/>`;

/** Puntos de una red triangular de lado R (la de la flor de la vida y los triángulos). */
function triLattice(R: number) {
  const hh = (R * SQ3) / 2;
  const out: [number, number][] = [];
  for (let j = -2; j <= 4; j++) for (let i = -2; i <= 3; i++) out.push([i * R + (j % 2 !== 0 ? R / 2 : 0), j * hh]);
  return out;
}

const TILES: Record<Exclude<PatternKey, "none">, Tile> = {
  estrellas: {
    w: 160,
    h: 160,
    body: (d) =>
      [
        [28, 36, 7],
        [112, 22, 4.5],
        [142, 98, 6],
        [66, 124, 5],
        [18, 142, 3],
        [96, 70, 2.5],
        [130, 150, 2.5],
        [52, 80, 2],
      ]
        .map(([x, y, r]) => sparkle(x, y, r, d))
        .join("") +
      [
        [80, 30],
        [40, 110],
        [150, 50],
        [100, 140],
        [10, 70],
      ]
        .map(([x, y]) => dot(x, y, 1, d))
        .join(""),
  },
  flor: { w: 36, h: r2(36 * SQ3), body: (d) => triLattice(36).map(([x, y]) => ring(x, y, 36, d)).join("") },
  triangulos: {
    w: 36,
    h: r2(36 * SQ3),
    body: (d) => {
      const R = 36;
      const hh = (R * SQ3) / 2;
      return triLattice(R)
        .map(([x, y]) => line(x, y, x + R, y, d) + line(x, y, x + R / 2, y + hh, d) + line(x, y, x - R / 2, y + hh, d) + dot(x, y, 1.6, d))
        .join("");
    },
  },
  rombos: {
    w: 48,
    h: 48,
    body: (d) => `<path d="M24 0L48 24L24 48L0 24Z" fill="none" ${d.stroke}/><path d="M24 10L38 24L24 38L10 24Z" fill="none" ${d.stroke}/>` + dot(24, 24, 1.6, d),
  },
  abanicos: {
    w: 48,
    h: 24,
    body: (d) => {
      // Escamas: cada abanico tapa al de detrás con el color de fondo (por eso van en orden).
      const R = 24;
      let out = "";
      for (let j = -2; j <= 3; j++)
        for (let i = -1; i <= 2; i++) {
          const x = i * 2 * R + (j % 2 !== 0 ? R : 0);
          const y = (j * R) / 2;
          out += `<circle cx="${x}" cy="${y}" r="${R}" fill="${d.bg}" ${d.stroke}/>` + ring(x, y, R * 0.75, d) + ring(x, y, R * 0.5, d) + ring(x, y, R * 0.25, d);
        }
      return out;
    },
  },
  ondas: { w: 96, h: 24, body: (d) => `<path d="M0 12Q24 0 48 12T96 12" fill="none" ${d.stroke}/>` },
  lunas: {
    w: 120,
    h: 120,
    body: (d) => crescent(30, 34, 9, d) + crescent(90, 92, 7, d) + sparkle(92, 28, 3.5, d) + sparkle(28, 96, 3, d) + dot(60, 60, 1.2, d) + dot(110, 60, 1, d) + dot(60, 112, 1, d),
  },
  panal: {
    w: 54,
    h: r2(18 * SQ3),
    body: (d) => {
      const s = 18;
      const h = s * SQ3;
      let out = "";
      for (let i = -1; i <= 3; i++)
        for (let j = -1; j <= 2; j++) {
          const cx = i * 1.5 * s;
          const cy = j * h + (Math.abs(i) % 2 === 1 ? h / 2 : 0);
          const pts = [0, 60, 120, 180, 240, 300].map((a) => `${r2(cx + s * Math.cos((a * Math.PI) / 180))} ${r2(cy + s * Math.sin((a * Math.PI) / 180))}`);
          out += `<path d="M${pts.join("L")}Z" fill="none" ${d.stroke}/>`;
        }
      return out;
    },
  },
  arcos: {
    w: 40,
    h: 40,
    body: (d) => {
      const arch = (cx: number, cy: number, r: number) => `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" ${d.stroke}/>`;
      return [16, 10, 4].map((r) => arch(20, 20, r) + arch(0, 40, r) + arch(40, 40, r)).join("");
    },
  },
  puntos: { w: 22, h: 22, body: (d) => dot(11, 11, 1.3, d) },
};

const hex = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : "#000000");

/** Tamaño de la pieza que se repite (en píxeles del email). */
export function patternSize(key: PatternKey): { w: number; h: number } | null {
  const t = key === "none" ? undefined : TILES[key];
  return t ? { w: t.w, h: t.h } : null;
}

/** La pieza que se repite, en SVG, con el fondo pintado. `scale` 2 = el doble de píxeles (pantallas retina). */
export function patternSvg(look: PatternLook, scale = 1): string | null {
  if (look.pattern === "none" || !TILES[look.pattern]) return null;
  const t = TILES[look.pattern];
  const o = PATTERN_STRENGTH[look.patternStrength] ?? PATTERN_STRENGTH.m;
  const c = hex(look.patternColor);
  const bg = hex(look.bg);
  const d: Draw = { stroke: `stroke="${c}" stroke-opacity="${o}" stroke-width="1"`, fill: `fill="${c}" fill-opacity="${o}"`, bg };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(t.w * scale)}" height="${Math.round(t.h * scale)}" viewBox="0 0 ${t.w} ${t.h}" preserveAspectRatio="none"><rect width="${t.w}" height="${t.h}" fill="${bg}"/>${t.body(d)}</svg>`;
}

/** Nombre del PNG de un fondo: fondo-flor-0d0b24-d9bf8c-m.png (todo lo que lo dibuja va en el nombre). */
export function patternFile(look: PatternLook): string | null {
  if (look.pattern === "none") return null;
  return `${look.pattern}-${hex(look.bg).slice(1).toLowerCase()}-${hex(look.patternColor).slice(1).toLowerCase()}-${look.patternStrength}.png`;
}

/** Lee el nombre del PNG (lo que pide la ruta /media/fondo/…); null si no es uno de los nuestros. */
export function parsePatternFile(name: string): PatternLook | null {
  const m = /^([a-z]+)-([0-9a-f]{6})-([0-9a-f]{6})-([sml])\.png$/.exec(name);
  if (!m || m[1] === "none" || !(PATTERN_KEYS as readonly string[]).includes(m[1])) return null;
  return { pattern: m[1] as PatternKey, bg: `#${m[2]}`, patternColor: `#${m[3]}`, patternStrength: m[4] as PatternStrength };
}

/** Dirección del PNG para el email (absoluta: la pide el buzón). */
export function patternUrl(baseUrl: string, look: PatternLook): string | null {
  const f = patternFile(look);
  return f ? new URL(`/media/fondo/${f}`, baseUrl).toString() : null;
}

/** Estilos CSS del fondo para el panel (el SVG tal cual, al momento). */
export function patternCss(look: PatternLook): { backgroundColor: string; backgroundImage?: string; backgroundSize?: string } {
  const svg = patternSvg(look);
  const size = patternSize(look.pattern);
  if (!svg || !size) return { backgroundColor: look.bg };
  return { backgroundColor: look.bg, backgroundImage: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`, backgroundSize: `${size.w}px ${size.h}px` };
}

// ── Adorno en una esquina de la tarjeta ──

export const CORNER_POSITIONS = ["tr", "tl", "br", "bl"] as const;
export type CornerPos = (typeof CORNER_POSITIONS)[number];
export const CORNER_LABEL: Record<CornerPos, string> = { tl: "Arriba izquierda", tr: "Arriba derecha", bl: "Abajo izquierda", br: "Abajo derecha" };
const CORNER_CSS: Record<CornerPos, string> = { tl: "left top", tr: "right top", bl: "left bottom", br: "right bottom" };
/** Lado del cuadrado del adorno (en píxeles del email). */
export const CORNER_SIZE = 220;

/** El adorno de la esquina: el color de la tarjeta (lo tapan los abanicos), la geometría, las líneas y la esquina. */
export type CornerLook = { bg: string; pattern: PatternKey; patternColor: string; patternStrength: PatternStrength; pos: CornerPos };

/** El adorno: la geometría repetida dentro de un cuadrado transparente que se difumina desde la esquina. */
export function cornerSvg(look: CornerLook, scale = 1): string | null {
  if (look.pattern === "none" || !TILES[look.pattern]) return null;
  const t = TILES[look.pattern];
  const o = PATTERN_STRENGTH[look.patternStrength] ?? PATTERN_STRENGTH.m;
  const c = hex(look.patternColor);
  const d: Draw = { stroke: `stroke="${c}" stroke-opacity="${o}" stroke-width="1"`, fill: `fill="${c}" fill-opacity="${o}"`, bg: hex(look.bg) };
  const S = CORNER_SIZE;
  const cx = look.pos === "tr" || look.pos === "br" ? S : 0;
  const cy = look.pos === "bl" || look.pos === "br" ? S : 0;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S * scale}" height="${S * scale}" viewBox="0 0 ${S} ${S}">` +
    `<defs><pattern id="p" width="${t.w}" height="${t.h}" patternUnits="userSpaceOnUse" x="${cx}" y="${cy}">${t.body(d)}</pattern>` +
    `<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${S}"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="m"><rect width="${S}" height="${S}" fill="url(#g)"/></mask></defs>` +
    `<rect width="${S}" height="${S}" fill="url(#p)" mask="url(#m)"/></svg>`
  );
}

/** Nombre del PNG del adorno: esquina-flor-17143a-d9bf8c-m-tr.png. */
export function cornerFile(look: CornerLook): string | null {
  if (look.pattern === "none") return null;
  return `esquina-${look.pattern}-${hex(look.bg).slice(1).toLowerCase()}-${hex(look.patternColor).slice(1).toLowerCase()}-${look.patternStrength}-${look.pos}.png`;
}

export function parseCornerFile(name: string): CornerLook | null {
  const m = /^esquina-([a-z]+)-([0-9a-f]{6})-([0-9a-f]{6})-([sml])-(tr|tl|br|bl)\.png$/.exec(name);
  if (!m || m[1] === "none" || !(PATTERN_KEYS as readonly string[]).includes(m[1])) return null;
  return { pattern: m[1] as PatternKey, bg: `#${m[2]}`, patternColor: `#${m[3]}`, patternStrength: m[4] as PatternStrength, pos: m[5] as CornerPos };
}

export function cornerUrl(baseUrl: string, look: CornerLook): string | null {
  const f = cornerFile(look);
  return f ? new URL(`/media/fondo/${f}`, baseUrl).toString() : null;
}

/** CSS del adorno para el panel (encima del color de la tarjeta). */
export function cornerCss(look: CornerLook): { backgroundImage?: string; backgroundPosition?: string; backgroundRepeat?: string; backgroundSize?: string } {
  const svg = cornerSvg(look);
  if (!svg) return {};
  return { backgroundImage: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`, backgroundPosition: CORNER_CSS[look.pos], backgroundRepeat: "no-repeat", backgroundSize: `${CORNER_SIZE}px ${CORNER_SIZE}px` };
}

/** Lo mismo en CSS de email (para el atributo style). */
export function cornerEmailCss(url: string, pos: CornerPos): string {
  return `background-image:url('${url}');background-position:${CORNER_CSS[pos]};background-repeat:no-repeat;background-size:${CORNER_SIZE}px ${CORNER_SIZE}px`;
}
