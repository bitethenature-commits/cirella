/**
 * Las piezas, los textos y las partes de lo de dentro (el área de alumna, «Mis cursos», los círculos y las
 * membresías por dentro) que la creadora cambia en Mi página (app/panel/canva/area-canva.tsx). Lo que se guarda va
 * en Creator.areaDesign (lib/area-design.ts) y se pinta con una hoja de estilos (areaDesignCss) que manda sobre lo
 * de siempre: cada pieza lleva data-area-piece, cada texto <AreaText> y cada parte data-area-section.
 * Puro: lo usan el servidor, el área y el editor.
 */
import { normalizeHex } from "./colors";

/** Dónde está cada cosa (para agruparlas en el editor y para el orden). */
export type AreaPlace = "membership" | "courses" | "sessions";
export const AREA_PLACES: Record<AreaPlace, string> = {
  membership: "Membresía por dentro",
  courses: "Mis cursos",
  sessions: "Círculos y lecturas",
};

export type AreaPieceDef = {
  key: string;
  label: string;
  where: AreaPlace;
  /** El dibujo que se puede quitar (la flor de la vida, el libro…). */
  figure?: string;
  /** Tiene una luz de color (el brillo lila de la cabecera, el halo del libro…). */
  glow?: boolean;
  /** Pinta su fondo con las variables (--ap-bg, --ap-bg2, --ap-glow): no se le pone el fondo encima. */
  ownBg?: boolean;
};

export const AREA_PIECES: AreaPieceDef[] = [
  { key: "member-hero", label: "Cabecera de la membresía", where: "membership", figure: "La flor de la vida", glow: true },
  { key: "moon-today", label: "La Luna de hoy", where: "membership" },
  { key: "member-card", label: "Tarjeta de miembro", where: "membership" },
  { key: "sacred-card", label: "Tu espacio sagrado", where: "membership" },
  { key: "included-course", label: "Curso incluido", where: "membership" },
  { key: "post-card", label: "Tarjeta de publicación", where: "membership", glow: true, ownBg: true },
  { key: "date-box", label: "La fecha de cada publicación", where: "membership" },
  { key: "courses-empty", label: "Biblioteca vacía", where: "courses", figure: "El libro y sus chispas", glow: true },
  { key: "course-card", label: "Tarjeta de curso", where: "courses" },
  { key: "block-head", label: "Icono de cada apartado", where: "sessions" },
  { key: "moon-circle", label: "Carta de un círculo de la luna", where: "sessions", figure: "La luna y su cielo", glow: true, ownBg: true },
  { key: "moon-pack", label: "Círculo completo (el pack)", where: "sessions" },
  { key: "moon-past", label: "Círculos anteriores", where: "sessions" },
  { key: "session-row", label: "Sesiones y lecturas", where: "sessions" },
];
export const pieceDef = (k: string) => AREA_PIECES.find((p) => p.key === k) ?? null;

/** Los textos que se escriben encima: su nombre y lo que pone si no se ha cambiado. */
export const AREA_TEXTS = {
  "hero.eyebrow": { where: "membership", label: "Encima del nombre", def: "Tu comunidad privada" },
  "moon.title": { where: "membership", label: "La Luna de hoy", def: "La Luna de hoy" },
  "quote.label": { where: "membership", label: "Debajo de la frase", def: "La frase de hoy" },
  "card.member": { where: "membership", label: "Tarjeta: miembro", def: "Miembro" },
  "card.level": { where: "membership", label: "Tarjeta: nivel", def: "Nivel" },
  "card.since": { where: "membership", label: "Tarjeta: desde", def: "Desde" },
  "sacred.title": { where: "membership", label: "Espacio sagrado: título", def: "Tu espacio sagrado" },
  "sacred.text": { where: "membership", label: "Espacio sagrado: texto", def: "Todo lo de aquí es solo para miembros. Tómate tu tiempo: enciende una vela, respira y entra cuando te apetezca." },
  "included.title": { where: "membership", label: "Cursos incluidos", def: "Incluido en tu membresía" },
  "feed.all": { where: "membership", label: "Filtro de todo", def: "Todo" },
  "feed.empty": { where: "membership", label: "Sin publicaciones", def: "Pronto habrá contenido nuevo aquí." },
  "empty.eyebrow": { where: "courses", label: "Biblioteca vacía: arriba", def: "Tu biblioteca te espera" },
  "empty.title": { where: "courses", label: "Biblioteca vacía: título", def: "Aún no hay cursos en tu estantería" },
  "empty.text": { where: "courses", label: "Biblioteca vacía: texto", def: "Cuando empieces uno, vivirá aquí, con tu progreso y tus lecciones guardadas, listo para abrirlo cuando quieras." },
  "empty.button": { where: "courses", label: "Biblioteca vacía: botón", def: "Descubrir los cursos" },
  "others.title": { where: "courses", label: "Otros cursos: título", def: "Otros cursos" },
  "others.text": { where: "courses", label: "Otros cursos: texto", def: "Aún no los tienes. Toca uno para ver de qué trata y cómo conseguirlo." },
  "circles.title": { where: "sessions", label: "Círculos: título", def: "Círculos de la luna" },
  "circles.hint": { where: "sessions", label: "Círculos: texto", def: "Los 2 próximos círculos: luna nueva (sembrar), luna llena (soltar) o eclipse (transformar)." },
  "circle.cta": { where: "sessions", label: "Círculo: botón", def: "Quiero ir" },
  "pack.eyebrow": { where: "sessions", label: "Pack: arriba", def: "Pack · luna nueva y luna llena" },
  "pack.title": { where: "sessions", label: "Pack: título", def: "Círculo completo" },
  "pack.cta": { where: "sessions", label: "Pack: botón", def: "Quiero los dos" },
  "past.eyebrow": { where: "sessions", label: "Anteriores: arriba", def: "Guardados · grabación y workbook" },
  "past.title": { where: "sessions", label: "Anteriores: título", def: "Círculos anteriores" },
  "past.cta": { where: "sessions", label: "Anteriores: botón", def: "Ver" },
  "sessions.title": { where: "sessions", label: "Sesiones: título", def: "Sesiones" },
  "sessions.hint": { where: "sessions", label: "Sesiones: texto", def: "Los encuentros en directo: sesiones individuales (también las lecturas en directo) y talleres." },
  "readings.title": { where: "sessions", label: "Lecturas: título", def: "Lecturas" },
  "readings.hint": { where: "sessions", label: "Lecturas: texto", def: "Tu carta leída para ti: se prepara con calma y te llega cuando está lista." },
} as const satisfies Record<string, { where: AreaPlace; label: string; def: string }>;
export type AreaTextKey = keyof typeof AREA_TEXTS;
export const isAreaTextKey = (k: string): k is AreaTextKey => Object.prototype.hasOwnProperty.call(AREA_TEXTS, k);

/** Las partes de cada página, en su orden de siempre. */
export const AREA_SECTIONS: Record<AreaPlace, { key: string; label: string }[]> = {
  membership: [
    { key: "hero", label: "La cabecera" },
    { key: "card", label: "Tarjeta de miembro y espacio sagrado" },
    { key: "courses", label: "Cursos incluidos" },
    { key: "feed", label: "Las publicaciones" },
    { key: "emails", label: "Avisos por email" },
    { key: "subscription", label: "Tu suscripción" },
  ],
  courses: [
    { key: "mine", label: "Mis cursos" },
    { key: "others", label: "Otros cursos" },
  ],
  sessions: [
    { key: "circles", label: "Círculos de la luna" },
    { key: "sessions", label: "Sesiones" },
    { key: "readings", label: "Lecturas" },
  ],
};

/** Los tipos de publicación a los que se les puede cambiar el color (los antiguos siguen al suyo de ahora). */
export const AREA_KINDS = ["TEXT", "PODCAST", "MEDITACION", "ASTROWEATHER", "MASTERCLASS", "CEREMONIA", "VIDEO", "CIRCULO_LUNAR"] as const;
const KIND_ALIAS: Record<string, string> = { PODCAST: "AUDIO", MASTERCLASS: "EVENT" };

export type PieceRadius = "square" | "soft" | "round";
export type PieceShadow = "none" | "soft" | "glow";
/** El diseño de una pieza: lo que no se elige (null) se queda como siempre. */
export type PieceStyle = {
  bg: string | null;
  bg2: string | null;
  glow: string | null;
  border: string | null;
  text: string | null;
  accent: string | null;
  radius: PieceRadius | null;
  shadow: PieceShadow | null;
  noFigure: boolean;
  hidden: boolean;
};
export const EMPTY_PIECE: PieceStyle = { bg: null, bg2: null, glow: null, border: null, text: null, accent: null, radius: null, shadow: null, noFigure: false, hidden: false };
export const hasPieceStyle = (p: PieceStyle | null | undefined) => !!p && (Object.keys(EMPTY_PIECE) as (keyof PieceStyle)[]).some((k) => p[k] !== EMPTY_PIECE[k]);

export type AreaParts = {
  texts: Partial<Record<AreaTextKey, string>>;
  pieces: Record<string, PieceStyle>;
  kinds: Record<string, string>;
  order: Partial<Record<AreaPlace, string[]>>;
};
export const EMPTY_AREA_PARTS: AreaParts = { texts: {}, pieces: {}, kinds: {}, order: {} };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const pick = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);

/** Un texto escrito encima: en una línea, sin espacios de más y sin pasarse. */
export const cleanAreaText = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 400);

export function readPiece(raw: unknown): PieceStyle {
  const s = obj(raw);
  return {
    bg: normalizeHex(s.bg),
    bg2: normalizeHex(s.bg2),
    glow: normalizeHex(s.glow),
    border: normalizeHex(s.border),
    text: normalizeHex(s.text),
    accent: normalizeHex(s.accent),
    radius: pick(s.radius, ["square", "soft", "round"] as const),
    shadow: pick(s.shadow, ["none", "soft", "glow"] as const),
    noFigure: s.noFigure === true,
    hidden: s.hidden === true,
  };
}

/** Lo guardado, tolerante: solo las piezas, textos, tipos y partes que existen. */
export function readAreaParts(raw: unknown): AreaParts {
  const src = obj(raw);
  const texts: AreaParts["texts"] = {};
  for (const [k, v] of Object.entries(obj(src.texts))) if (isAreaTextKey(k) && typeof v === "string") texts[k] = cleanAreaText(v);
  const pieces: AreaParts["pieces"] = {};
  for (const [k, v] of Object.entries(obj(src.pieces))) {
    const p = readPiece(v);
    if (pieceDef(k) && hasPieceStyle(p)) pieces[k] = p;
  }
  const kinds: AreaParts["kinds"] = {};
  for (const [k, v] of Object.entries(obj(src.kinds))) {
    const hex = normalizeHex(v);
    if ((AREA_KINDS as readonly string[]).includes(k) && hex) kinds[k] = hex;
  }
  const order: AreaParts["order"] = {};
  for (const place of Object.keys(AREA_SECTIONS) as AreaPlace[]) {
    const list = obj(src.order)[place];
    if (!Array.isArray(list)) continue;
    const known = AREA_SECTIONS[place].map((s) => s.key);
    const keys = [...new Set(list.filter((x): x is string => typeof x === "string" && known.includes(x)))];
    if (keys.length) order[place] = keys;
  }
  return { texts, pieces, kinds, order };
}

/** Las partes de una página en el orden elegido (las que falten, al final, en su orden de siempre). */
export function sectionOrder(place: AreaPlace, parts: AreaParts): string[] {
  const all = AREA_SECTIONS[place].map((s) => s.key);
  const own = (parts.order[place] ?? []).filter((k) => all.includes(k));
  return [...own, ...all.filter((k) => !own.includes(k))];
}

const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, transparent)`;
/** :not(#ap) sube la fuerza de la regla por encima de la de los colores del área (que van con clases). */
const sel = (k: string) => `[data-area-piece="${k}"]:not(#ap)`;
const RADIUS: Record<PieceRadius, string> = { square: ".45rem", soft: "1.1rem", round: "2.2rem" };

function pieceCss(def: AreaPieceDef, p: PieceStyle, editing: boolean): string {
  const s = sel(def.key);
  const out: string[] = [];
  const d: string[] = [];
  if (p.bg) {
    const bg2 = p.bg2 ?? p.bg;
    d.push(`--ap-bg:${p.bg}`, `--ap-bg2:${bg2}`, `--ap-shade1:${mix(p.bg, 30)}`, `--ap-shade2:${mix(bg2, 88)}`);
    if (!def.ownBg) d.push(`background:${p.bg2 ? `linear-gradient(160deg, ${p.bg}, ${p.bg2})` : p.bg} !important`);
  }
  if (p.glow) d.push(`--ap-glow:${mix(p.glow, 45)}`);
  if (p.text) d.push(`color:${p.text} !important`, `--color-ink:${p.text}`, `--color-muted:${mix(p.text, 72)}`);
  if (p.accent) d.push(`--color-gold:${p.accent}`, `--ap-accent:${p.accent}`, `--color-lavender:${mix(p.accent, 55)}`, `--color-lavender-deep:${p.accent}`);
  if (p.border) d.push(`border:1px solid ${p.border} !important`);
  if (p.radius) d.push(`border-radius:${RADIUS[p.radius]} !important`);
  const ring = p.bg ? `inset 0 0 0 5px ${p.bg}, inset 0 0 0 6px ${mix(p.accent ?? "var(--color-gold)", 30)}, ` : "";
  if (p.shadow === "none") d.push("box-shadow:none !important");
  else if (p.shadow === "soft") d.push(`box-shadow:${ring}0 24px 50px -28px rgb(0 0 0 / .75) !important`);
  else if (p.shadow === "glow") d.push(`box-shadow:${ring}0 0 46px -10px ${mix(p.glow ?? p.accent ?? "var(--color-gold)", 70)} !important`);
  else if (p.bg) d.push(`box-shadow:${ring}0 30px 60px -40px rgb(0 0 0 / .8) !important`);
  if (p.hidden) d.push(editing ? "opacity:.35 !important" : "display:none !important");
  if (d.length) out.push(`${s}{${d.join(";")}}`);
  if (p.noFigure && def.figure) out.push(`${s} [data-ap-figure]{display:none !important}`);
  return out.join("\n");
}

/** Lo que se elige al tocar: una pieza («post-card») o el color de un tipo de publicación («kind:CEREMONIA»). */
export const kindPick = (k: string) => `kind:${k}`;
export const pickedKind = (sel: string | null | undefined) => {
  const k = sel?.startsWith("kind:") ? sel.slice(5) : null;
  return k && (AREA_KINDS as readonly string[]).includes(k) ? k : null;
};

/**
 * La hoja de estilos de lo de dentro: los colores de cada tipo de publicación, el orden de las partes y el
 * diseño de cada pieza. Dentro del Canva (edit), además, las marcas: lo que se puede tocar, lo tocado y los textos
 * que se escriben encima. Solo lleva colores ya comprobados (#RRGGBB) y nombres de la lista: es seguro meterla tal cual en <style>.
 */
export function areaDesignCss(parts: AreaParts, opts: { edit?: boolean; selected?: string | null } = {}): string {
  const out: string[] = [];
  const kinds = Object.entries(parts.kinds).flatMap(([k, hex]) => {
    const light = `color-mix(in oklab, ${hex} 45%, white)`;
    return [k, ...(KIND_ALIAS[k] ? [KIND_ALIAS[k]] : [])].flatMap((name) => [`--kind-${name}:${hex}`, `--kind-${name}-l:${light}`]);
  });
  if (kinds.length) out.push(`:root{${kinds.join(";")}}`);
  for (const place of Object.keys(AREA_SECTIONS) as AreaPlace[]) {
    const keys = sectionOrder(place, parts);
    keys.forEach((k, i) => out.push(`[data-area-section="${place}:${k}"]{order:${(i + 1) * 2}}`));
    // Los avisos de la membresía (pago, fecha de fin…) siempre justo debajo de la cabecera.
    if (place === "membership") out.push(`[data-area-section="membership:notices"]{order:${(keys.indexOf("hero") + 1) * 2 + 1}}`);
  }
  const editing = !!opts.edit;
  for (const def of AREA_PIECES) {
    const p = parts.pieces[def.key];
    if (p) out.push(pieceCss(def, p, editing));
  }
  if (editing) {
    out.push(
      // Los enlaces vacíos que tapan una tarjeta entera no deben quitar el clic a lo de dentro.
      `:is(a,button):empty:not([data-area-ui] *){pointer-events:none}`,
      `:is([data-area-piece],[data-area-kind]){cursor:pointer}`,
      `:is([data-area-piece],[data-area-kind]):hover:not(:has(:is([data-area-piece],[data-area-kind]):hover)){outline:2px dashed rgb(212 181 122 / .9);outline-offset:4px}`,
      `[data-area-text]{outline:1px dashed rgb(212 181 122 / .45);outline-offset:3px;border-radius:4px;cursor:text;min-width:1ch}`,
      `[data-area-text]:hover{outline-color:rgb(212 181 122 / .95)}`,
      `[data-area-text]:focus{outline:2px solid #E9CC8E;background:rgb(212 181 122 / .1)}`,
      `[data-area-text]:empty::before{content:"(vacío)";opacity:.5}`,
    );
    const kind = pickedKind(opts.selected);
    if (kind) out.push(`[data-area-kind="${kind}"]{outline:2px solid #E9CC8E !important;outline-offset:3px;border-radius:999px}`);
    else if (opts.selected && pieceDef(opts.selected)) out.push(`[data-area-piece="${opts.selected}"]{outline:2px solid #E9CC8E !important;outline-offset:4px}`);
  }
  return out.join("\n");
}
