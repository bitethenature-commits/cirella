/**
 * Los marcos de las tarjetas y de los botones (Panel › Mi página › Diseño). Cada marco es un dibujo en negro
 * que se usa como máscara (globals.css, «Marcos»): se pinta con el color que elija la dueña.
 *
 * Tarjetas: una esquina (dibujada para la de arriba a la izquierda, en 0–100, y volteada para las otras tres)
 * y un borde que se repite a lo largo de cada lado (una baldosa de w×h px). `full`: solo el borde, de punta a
 * punta (sin esquinas). Botones: un adorno a cada lado (dibujado para el izquierdo, en 0–40 × 0–100) o un
 * contorno que sigue la forma del botón.
 */

export type FrameGroup = "nature" | "gold" | "mystic" | "simple";
export const FRAME_GROUPS: Record<FrameGroup, string> = { nature: "Naturaleza", gold: "Dorados clásicos", mystic: "Místicos", simple: "Sencillos" };

type CardFrame = { name: string; group: FrameGroup; corner?: string; edge?: { w: number; h: number; tile: string }; full?: boolean; neon?: boolean };

/* ───── Piezas de dibujo ───── */
const stroke = (w: number, body: string) => `<g fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
const fill = (body: string) => `<g fill="#000">${body}</g>`;
/** Estrella de cuatro puntas. */
const star = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z"/>`;
/** Hoja en (x, y), girada `deg`. */
const leaf = (x: number, y: number, len: number, deg: number) =>
  `<path transform="rotate(${deg} ${x} ${y})" d="M${x} ${y}C${x + len * 0.3} ${y - len * 0.32} ${x + len * 0.75} ${y - len * 0.3} ${x + len} ${y}C${x + len * 0.75} ${y + len * 0.3} ${x + len * 0.3} ${y + len * 0.32} ${x} ${y}Z"/>`;
/** Una fila de hojas a lo largo de una línea (laurel). */
const sprig = (x0: number, y0: number, x1: number, y1: number, n: number, len: number) => {
  const deg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  let out = "";
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = +(x0 + (x1 - x0) * t).toFixed(1);
    const y = +(y0 + (y1 - y0) * t).toFixed(1);
    out += leaf(x, y, len, deg - 40) + leaf(x, y, len, deg + 40);
  }
  return out;
};
const line = (w: number, h: number, y: number, t = 1.2) => `<rect x="0" y="${y}" width="${w}" height="${t}"/>`;

export const CARD_FRAMES = {
  none: { name: "Sin marco", group: "simple" },
  // ── Naturaleza ──
  vine: {
    name: "Enredadera",
    group: "nature",
    corner:
      stroke(2.6, `<path d="M4 96C4 56 8 30 20 18S56 4 96 4"/><path d="M20 18c8 10 20 8 22 -2a5 5 0 1 0 -8 -3"/><path d="M14 46c-6 4 -5 12 1 13"/>`) +
      fill(leaf(30, 9, 15, -25) + leaf(56, 5, 14, 20) + leaf(80, 5, 12, -20) + leaf(9, 30, 15, 115) + leaf(5, 56, 14, 70) + leaf(5, 80, 12, 110)),
    edge: { w: 48, h: 14, tile: stroke(1.6, `<path d="M0 7Q12 1 24 7T48 7"/>`) + fill(leaf(10, 5, 9, -35) + leaf(34, 9, 9, 35)) },
  },
  leaves: {
    name: "Hojas",
    group: "nature",
    corner: fill(leaf(4, 4, 58, 8) + leaf(4, 4, 58, 82) + leaf(6, 6, 44, 45) + leaf(40, 6, 26, -12) + leaf(6, 40, 26, 102)),
    edge: { w: 22, h: 10, tile: line(22, 10, 4.4, 1.2) },
  },
  flowers: {
    name: "Flores",
    group: "nature",
    corner:
      fill(
        `<circle cx="22" cy="9" r="8"/><circle cx="34" cy="18" r="8"/><circle cx="29" cy="32" r="8"/><circle cx="15" cy="32" r="8"/><circle cx="10" cy="18" r="8"/>` +
          leaf(38, 30, 30, -10) + leaf(30, 38, 30, 100) + `<circle cx="74" cy="6" r="4"/><circle cx="6" cy="74" r="4"/><circle cx="58" cy="10" r="2.5"/><circle cx="10" cy="58" r="2.5"/>`,
      ),
    edge: { w: 16, h: 10, tile: `<circle cx="8" cy="5" r="1.8"/>` },
  },
  branches: {
    name: "Ramas",
    group: "nature",
    corner:
      stroke(2.4, `<path d="M3 88C6 46 24 12 88 3"/><path d="M14 36L4 28"/><path d="M26 20L22 7"/><path d="M48 9l8 -6"/><path d="M8 58l-6 6"/><path d="M68 5l6 -4"/>`) +
      fill(`<circle cx="4" cy="27" r="3.4"/><circle cx="22" cy="6" r="3.4"/><circle cx="57" cy="3" r="2.6"/><circle cx="2" cy="65" r="2.6"/>` + leaf(36, 12, 12, -30) + leaf(12, 36, 12, 120)),
    edge: { w: 24, h: 8, tile: line(24, 8, 3.4, 1) },
  },
  // ── Dorados clásicos ──
  filigree: {
    name: "Filigrana",
    group: "gold",
    corner: stroke(
      2.2,
      `<path d="M4 72V22Q4 4 22 4H72"/><path d="M12 62V28Q12 12 28 12H62"/><path d="M28 12c10 0 14 8 8 14c-5 5 -12 0 -8 -5"/><path d="M12 28c0 10 8 14 14 8c5 -5 0 -12 -5 -8"/><path d="M72 4c8 0 10 6 6 9"/><path d="M4 72c0 8 6 10 9 6"/>`,
    ),
    edge: { w: 12, h: 10, tile: line(12, 10, 2, 1.2) + line(12, 10, 6.4, 0.8) },
  },
  artdeco: {
    name: "Art déco",
    group: "gold",
    corner: stroke(2, `<path d="M2 64V2H64"/><path d="M10 52V10H52"/><path d="M18 40V18H40"/><path d="M2 2L26 26"/><path d="M26 18v-8M18 26h-8"/>`) + fill(`<path d="M28 28l6 -6l6 6l-6 6z"/>`),
    edge: { w: 18, h: 10, tile: line(18, 10, 2, 1.4) + `<rect x="8" y="4" width="2" height="5"/>` },
  },
  baroque: {
    name: "Barroco",
    group: "gold",
    corner:
      stroke(
        2.6,
        `<path d="M4 84C4 42 10 22 30 10C45 2 62 4 84 4"/><path d="M30 10C24 24 34 34 44 28C52 22 46 12 38 16"/><path d="M10 30C24 24 34 34 28 44C22 52 12 46 16 38"/><path d="M52 4c4 8 12 10 18 6"/><path d="M4 52c8 4 10 12 6 18"/>`,
      ) + fill(`<circle cx="13" cy="13" r="5"/>`),
    edge: { w: 12, h: 10, tile: `<circle cx="6" cy="5" r="2.2"/>` },
  },
  laurel: {
    name: "Laurel",
    group: "gold",
    corner: fill(sprig(12, 8, 86, 6, 5, 9) + sprig(8, 12, 6, 86, 5, 9) + `<circle cx="8" cy="8" r="4.5"/>`),
    edge: { w: 20, h: 8, tile: line(20, 8, 3.4, 1) },
  },
  // ── Místicos ──
  moonstars: {
    name: "Luna y estrellas",
    group: "mystic",
    corner: fill(`<path d="M30 6A21 21 0 1 0 46 40A16 16 0 1 1 30 6Z"/>` + star(66, 9, 7) + star(82, 16, 3.5) + star(9, 66, 7) + star(16, 82, 3.5) + star(54, 32, 3.5)),
    edge: { w: 26, h: 12, tile: `<circle cx="6" cy="6" r="1.2"/>` + star(19, 6, 4) },
  },
  runes: {
    name: "Runas",
    group: "mystic",
    corner: stroke(2.4, `<path d="M3 72V3H72"/><path d="M16 14v24M16 20l9 -6M16 29l9 -6"/><path d="M36 12v18l9 -9v9"/><path d="M12 48l9 8l-9 8"/><path d="M56 12l5 8l5 -8"/>`),
    edge: { w: 20, h: 10, tile: line(20, 10, 4.3, 1.4) + `<rect x="9" y="1" width="1.4" height="8"/>` },
  },
  sun: {
    name: "Sol",
    group: "mystic",
    corner:
      fill(`<circle cx="0" cy="0" r="24"/>`) +
      stroke(
        2.4,
        Array.from({ length: 7 }, (_, i) => {
          const a = ((8 + i * 12.3) * Math.PI) / 180;
          const r2 = i % 2 ? 40 : 52;
          return `<path d="M${(30 * Math.cos(a)).toFixed(1)} ${(30 * Math.sin(a)).toFixed(1)}L${(r2 * Math.cos(a)).toFixed(1)} ${(r2 * Math.sin(a)).toFixed(1)}"/>`;
        }).join(""),
      ),
    edge: { w: 20, h: 8, tile: line(20, 8, 3.4, 1) },
  },
  crystal: {
    name: "Cristales",
    group: "mystic",
    corner: fill(`<path d="M5 5L20 2L28 22L12 30Z"/><path d="M31 3L46 8L41 27L31 20Z"/><path d="M3 32L10 47L27 41L20 31Z"/><path d="M50 4L58 6L55 15Z"/><path d="M4 50L6 58L15 55Z"/>`),
    edge: { w: 22, h: 12, tile: line(22, 12, 5.4, 1) + `<path d="M11 2L14 6L11 10L8 6Z"/>` },
  },
  // ── Sencillos ──
  dotted: { name: "Punteado", group: "simple", full: true, edge: { w: 10, h: 8, tile: `<circle cx="5" cy="4" r="1.7"/>` } },
  dashed: { name: "Rayado", group: "simple", full: true, edge: { w: 14, h: 6, tile: `<rect x="0" y="2" width="8" height="2"/>` } },
  double: { name: "Doble línea", group: "simple", full: true, edge: { w: 10, h: 9, tile: line(10, 9, 1, 1.5) + line(10, 9, 6, 1.5) } },
  corners: { name: "Esquinas", group: "simple", corner: stroke(4, `<path d="M3 58V3H58"/>`) },
  neon: { name: "Neón", group: "simple", neon: true },
} satisfies Record<string, CardFrame>;
export type CardFrameKey = keyof typeof CARD_FRAMES;
export const CARD_FRAME_KEYS = Object.keys(CARD_FRAMES) as [CardFrameKey, ...CardFrameKey[]];

type ButtonFrame = { name: string; group: FrameGroup; end?: string; outline?: "dotted" | "dashed" | "double"; neon?: boolean };
export const BUTTON_FRAMES = {
  none: { name: "Sin marco", group: "simple" },
  leaves: { name: "Hojas", group: "nature", end: fill(leaf(38, 50, 30, 200) + leaf(38, 50, 26, 160) + leaf(36, 50, 18, 180)) },
  vine: { name: "Enredadera", group: "nature", end: stroke(2.4, `<path d="M38 50C26 50 18 40 22 30a7 7 0 1 1 9 6"/><path d="M38 50C26 50 18 60 22 70a7 7 0 1 0 9 -6"/>`) + fill(leaf(22, 46, 10, 200) + leaf(22, 54, 10, 160)) },
  flower: { name: "Flor", group: "nature", end: fill(`<circle cx="20" cy="40" r="7"/><circle cx="28" cy="48" r="7"/><circle cx="24" cy="58" r="7"/><circle cx="14" cy="58" r="7"/><circle cx="10" cy="48" r="7"/>` + leaf(36, 50, 10, 180)) },
  filigree: { name: "Filigrana", group: "gold", end: stroke(2.2, `<path d="M38 50H26c-10 0 -14 -10 -8 -16c5 -5 12 0 8 5"/><path d="M26 50c-10 0 -14 10 -8 16c5 5 12 0 8 -5"/>`) + fill(`<circle cx="8" cy="50" r="3.5"/>`) },
  artdeco: { name: "Art déco", group: "gold", end: stroke(2, `<path d="M36 22H24L12 50L24 78H36"/><path d="M36 32H28L20 50L28 68H36"/>`) },
  laurel: { name: "Laurel", group: "gold", end: fill(sprig(36, 84, 30, 16, 4, 10)) },
  sparkles: { name: "Destellos", group: "mystic", end: fill(star(18, 50, 16) + star(34, 26, 5) + star(34, 74, 5)) },
  moon: { name: "Luna", group: "mystic", end: fill(`<path d="M24 30A20 20 0 1 0 34 66A15 15 0 1 1 24 30Z"/>`) },
  brackets: { name: "Corchetes", group: "simple", end: stroke(3, `<path d="M36 18H22V82H36"/>`) },
  dotted: { name: "Punteado", group: "simple", outline: "dotted" },
  dashed: { name: "Rayado", group: "simple", outline: "dashed" },
  double: { name: "Doble línea", group: "simple", outline: "double" },
  neon: { name: "Neón", group: "simple", neon: true },
} satisfies Record<string, ButtonFrame>;
export type ButtonFrameKey = keyof typeof BUTTON_FRAMES;
export const BUTTON_FRAME_KEYS = Object.keys(BUTTON_FRAMES) as [ButtonFrameKey, ...ButtonFrameKey[]];

const uri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const box = (inner: string, vb = "0 0 100 100") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;
/** El borde que se repite: un SVG sin viewBox (1 unidad = 1 px) con la baldosa en patrón. */
const edgeSvg = (e: { w: number; h: number; tile: string }, transform = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><pattern id="p" width="${e.w}" height="${e.h}" patternUnits="userSpaceOnUse"${transform ? ` patternTransform="${transform}"` : ""}>${e.tile}</pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`;

/** Las capas de máscara de un marco de tarjeta (`size`: lado de cada esquina en px). null: sin máscara. */
export function cardFrameMask(key: CardFrameKey, size: number): string | null {
  const f = CARD_FRAMES[key] as CardFrame;
  if (!f || (!f.corner && !f.edge)) return null;
  const layers: string[] = [];
  const S = `${size}px`;
  if (f.corner) {
    const flips = ["", "translate(100 0) scale(-1 1)", "translate(0 100) scale(1 -1)", "translate(100 100) scale(-1 -1)"];
    const pos = ["left top", "right top", "left bottom", "right bottom"];
    flips.forEach((t, i) => layers.push(`${uri(box(`<g transform="${t}">${f.corner}</g>`))} ${pos[i]} / ${S} ${S} no-repeat`));
  }
  if (f.edge) {
    const e = f.edge;
    const k = f.full ? 1 : Math.max(0.6, size / 56);
    const h = Math.round(e.h * k);
    const scaled = { w: Math.round(e.w * k), h, tile: `<g transform="scale(${k.toFixed(3)})">${e.tile}</g>` };
    const gap = f.corner ? `calc(100% - ${Math.round(size * 1.5)}px)` : "100%";
    layers.push(`${uri(edgeSvg(scaled))} center top / ${gap} ${h}px no-repeat`);
    layers.push(`${uri(edgeSvg(scaled, `scale(1 -1)`))} center bottom / ${gap} ${h}px no-repeat`);
    layers.push(`${uri(edgeSvg(scaled, "rotate(90)"))} left center / ${h}px ${gap} no-repeat`);
    layers.push(`${uri(edgeSvg(scaled, "rotate(-90)"))} right center / ${h}px ${gap} no-repeat`);
  }
  return layers.join(", ");
}

/** Las capas de máscara de los adornos de un botón (izquierdo y, volteado, derecho). null: sin adornos. */
export function buttonFrameMask(key: ButtonFrameKey): string | null {
  const f = BUTTON_FRAMES[key] as ButtonFrame;
  if (!f?.end) return null;
  const left = uri(box(f.end, "0 0 40 100"));
  const right = uri(box(`<g transform="translate(40 0) scale(-1 1)">${f.end}</g>`, "0 0 40 100"));
  return `${left} left center / auto 100% no-repeat, ${right} right center / auto 100% no-repeat`;
}

/** El tipo de marco de botón (para el CSS): adornos a los lados, contorno o neón. */
export function buttonFrameKind(key: ButtonFrameKey): "ends" | "dotted" | "dashed" | "double" | "neon" | null {
  const f = BUTTON_FRAMES[key] as ButtonFrame;
  if (!f) return null;
  if (f.end) return "ends";
  if (f.outline) return f.outline;
  if (f.neon) return "neon";
  return null;
}
