/**
 * Editor visual de emails: la newsletter y los emails automáticos (bienvenida, compra, acceso,
 * recordatorios…) se escriben con bloques (portada con foto de fondo, título de color, texto con
 * formato, imagen, botón, destacado, vídeo, dos columnas, redes, separador y espacio) y un estilo
 * general (colores, tipos de letra, esquinas y ancho). Son datos, nunca HTML: lib/email/blocks-html.ts
 * los convierte en HTML de email con todo escapado. Este archivo es puro y sirve también en el
 * navegador (el editor del panel).
 *
 * Seguridad: los colores solo pueden ser #RRGGBB (normalizeHex), los enlaces pasan por safeLinkHref
 * (sin javascript: ni data:), las imágenes solo pueden ser las subidas aquí (/media/…) y los vídeos,
 * de YouTube o Vimeo (lib/video-embed.ts) o subidos aquí (/media/video/…).
 *
 * Compatibilidad: los bloques guardados antes (título, texto, imagen, botón, separador y espacio sin
 * colores ni tipos de letra) se leen tal cual: cada campo nuevo es opcional y, si falta, sale como
 * siempre. Un bloque dañado o de una versión futura se descarta sin tumbar el email.
 *
 * Variables: {nombre} (nombre de quien lo recibe), {mi_nombre} (el de la dueña) y, según el email,
 * {producto} o {fecha}. Si no hay nombre, «Hola, {nombre}» queda en «Hola».
 */
import { z } from "zod";
import { contrastRatio, isHex, MIN_CONTRAST, normalizeHex, textOn } from "./colors";
import { isOwnVideoSrc } from "./page-blocks";
import { safeLinkHref } from "./rich-text";
import { videoEmbed } from "./video-embed";

export const EMAIL_BLOCKS_MAX = 40;
export const EMAIL_TEXT_MAX = 5000;

// ── Tipos de letra ──

/**
 * Tipos de letra del email. Los «seguros» están en casi todos los ordenadores y móviles. Los «web»
 * se cargan con <link> de Google Fonts: los enseñan Apple Mail, el Mail del iPhone y Thunderbird;
 * Gmail y Outlook usan el de reserva (el segundo de la lista), por eso cada uno lleva uno parecido.
 */
export const EMAIL_FONTS = {
  georgia: { label: "Georgia", stack: "Georgia,'Times New Roman',serif", web: null },
  palatino: { label: "Palatino", stack: "'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", web: null },
  helvetica: { label: "Helvetica", stack: "Helvetica,Arial,sans-serif", web: null },
  system: { label: "La del móvil", stack: "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif", web: null },
  trebuchet: { label: "Trebuchet", stack: "'Trebuchet MS',Helvetica,Arial,sans-serif", web: null },
  playfair: { label: "Playfair Display", stack: "'Playfair Display',Georgia,serif", web: "Playfair+Display:ital,wght@0,400;0,700;1,400" },
  cormorant: { label: "Cormorant", stack: "'Cormorant Garamond',Georgia,serif", web: "Cormorant+Garamond:ital,wght@0,500;0,700;1,500" },
  lora: { label: "Lora", stack: "Lora,Georgia,serif", web: "Lora:ital,wght@0,400;0,700;1,400" },
  montserrat: { label: "Montserrat", stack: "Montserrat,Helvetica,Arial,sans-serif", web: "Montserrat:wght@400;600;700" },
} as const;
export type EmailFontKey = keyof typeof EMAIL_FONTS;
export const EMAIL_FONT_KEYS = Object.keys(EMAIL_FONTS) as [EmailFontKey, ...EmailFontKey[]];

// ── Estilo general ──

export type EmailStyle = {
  /** Fondo de alrededor. */
  bg: string;
  /** Fondo de la tarjeta del contenido. */
  content: string;
  /** Texto. */
  text: string;
  /** Títulos. */
  heading: string;
  /** Enlaces dentro del texto. */
  link: string;
  /** Color de los botones y acentos (separadores, destacados nuevos). */
  accent: string;
  headingFont: EmailFontKey;
  bodyFont: EmailFontKey;
  radius: "none" | "s" | "m" | "l";
  width: 520 | 600 | 680;
};

/** El estilo de siempre: los emails guardados antes de existir el estilo salen igual. */
export const DEFAULT_EMAIL_STYLE: EmailStyle = {
  bg: "#F6F1E7",
  content: "#FFFFFF",
  text: "#3B3950",
  heading: "#0E1024",
  link: "#0E1024",
  accent: "#0E1024",
  headingFont: "georgia",
  bodyFont: "system",
  radius: "l",
  width: 600,
};

export const RADIUS_PX: Record<EmailStyle["radius"], number> = { none: 0, s: 6, m: 12, l: 20 };

export const STYLE_LABEL: Record<EmailStyle["radius"], string> = { none: "Rectas", s: "Poco", m: "Suaves", l: "Redondas" };

// ── Bloques ──

export type Align = "left" | "center" | "right";
export type TitleSize = "s" | "m" | "l" | "xl";
export type SocialNetwork = "instagram" | "tiktok" | "youtube" | "telegram" | "whatsapp" | "web" | "email";
export const SOCIAL_NETWORKS: SocialNetwork[] = ["instagram", "tiktok", "youtube", "telegram", "whatsapp", "web", "email"];
export const SOCIAL_NETWORK_LABEL: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  web: "Web",
  email: "Email",
};

/**
 * «Fondo» de un bloque: una franja de color de todo el ancho del contenido detrás del bloque, con su
 * margen interior (S/M/L) y, si se quiere, esquinas redondeadas. Texto, Botón, Imagen, Vídeo, Dos
 * columnas y Redes. (El Título y el Destacado tienen su propio fondo: `bg`.)
 */
export type Band = { band?: string; bandPad?: "s" | "m" | "l"; bandRound?: boolean };

export type EmailBlock =
  | { id: string; t: "title"; text: string; align: Align; size?: TitleSize; color?: string; bg?: string; font?: EmailFontKey }
  | ({
      id: string;
      t: "text";
      body: string;
      align?: Align;
      color?: string;
      font?: EmailFontKey;
      size?: "s" | "m" | "l";
      /** Color del «resaltar» (==así==) de este texto. */
      highlight?: string;
    } & Band)
  | ({ id: string; t: "image"; url: string; alt: string; href?: string; width: "full" | "narrow"; radius?: "none" | "s" | "l" } & Band)
  | ({ id: string; t: "button"; label: string; href: string; align: Align; style?: "pill" | "filled" | "outline"; bg?: string; color?: string; full?: boolean } & Band)
  | { id: string; t: "divider"; color?: string; style?: "line" | "dashed" | "stars" }
  | { id: string; t: "spacer"; size: "s" | "m" | "l" }
  | {
      id: string;
      t: "hero";
      /** Foto de fondo (subida aquí); vacía = solo el color. */
      image: string;
      alt: string;
      /** Color de la capa sobre la foto y de reserva si el buzón no enseña la foto. */
      overlay: string;
      /** Opacidad de la capa (0–90 %). */
      opacity: number;
      title: string;
      subtitle: string;
      color: string;
      align: "left" | "center";
      height: "s" | "m" | "l";
      font?: EmailFontKey;
      buttonLabel?: string;
      buttonHref?: string;
      buttonBg?: string;
      buttonColor?: string;
    }
  | { id: string; t: "spotlight"; icon: string; title: string; body: string; bg: string; accent: string; border: "left" | "box" | "none"; color?: string }
  | ({
      id: string;
      t: "video";
      /** Enlace de YouTube o Vimeo (o vacío si el vídeo está subido aquí). */
      url: string;
      /** Vídeo subido aquí (/media/video/…), o vacío. */
      src: string;
      /** Portada con el botón ▶ ya dibujado (imagen del email, subida aquí). */
      cover: string;
      title: string;
      caption?: string;
    } & Band)
  | ({
      id: string;
      t: "columns";
      image: string;
      alt: string;
      href?: string;
      side: "left" | "right";
      title: string;
      body: string;
      buttonLabel?: string;
      buttonHref?: string;
    } & Band)
  | ({ id: string; t: "social"; links: Partial<Record<SocialNetwork, string>>; align: Align; color?: string } & Band);

/** Bloques que admiten «Fondo» (Band). */
export const BAND_BLOCKS = ["text", "button", "image", "video", "columns", "social"] as const;

/** Color del resaltado si no elige ninguno: amarillo suave. */
export const DEFAULT_HIGHLIGHT = "#FCEFB4";

export type EmailBlockType = EmailBlock["t"];
export type EmailDesign = { v: 1; blocks: EmailBlock[]; style?: EmailStyle };

export const BLOCK_LABEL: Record<EmailBlockType, string> = {
  hero: "Portada",
  title: "Título",
  text: "Texto",
  image: "Imagen",
  button: "Botón",
  spotlight: "Destacado",
  video: "Vídeo",
  columns: "Dos columnas",
  social: "Redes sociales",
  divider: "Separador",
  spacer: "Espacio",
};

const id = z.string().trim().min(1).max(40);
const href = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || !!safeLinkHref(v), "Revisa la dirección del enlace");
/** Color opcional: cualquier cosa que no sea un hex se descarta (sale el de siempre). */
const optColor = z.preprocess((v) => (v == null || v === "" ? undefined : (normalizeHex(v) ?? undefined)), z.string().optional());
/** Color obligatorio con su valor por defecto si llega algo que no es un hex. */
const color = (fallback: string) => z.preprocess((v) => normalizeHex(v) ?? fallback, z.string());
const font = z.enum(EMAIL_FONT_KEYS).optional().catch(undefined);
const align3 = z.enum(["left", "center", "right"]);
const imagePath = (msg = "Sube la imagen desde aquí") => z.string().trim().max(300).refine((v) => !v || !!emailImagePath(v), msg);
const shortText = (max: number, msg?: string) => z.string().trim().max(max, msg ?? `Máximo ${max} caracteres`);

const band = {
  band: optColor,
  bandPad: z.enum(["s", "m", "l"]).optional().catch(undefined),
  bandRound: z.boolean().optional().catch(undefined),
};

const blockSchema = z.discriminatedUnion("t", [
  z.object({
    id,
    t: z.literal("title"),
    text: shortText(140, "El título es demasiado largo"),
    align: align3.catch("left"),
    size: z.enum(["s", "m", "l", "xl"]).optional().catch(undefined),
    color: optColor,
    bg: optColor,
    font,
  }),
  z.object({
    id,
    t: z.literal("text"),
    body: z.string().max(EMAIL_TEXT_MAX, `Máximo ${EMAIL_TEXT_MAX} caracteres por texto`),
    align: align3.optional().catch(undefined),
    color: optColor,
    font,
    size: z.enum(["s", "m", "l"]).optional().catch(undefined),
    highlight: optColor,
    ...band,
  }),
  z.object({
    id,
    t: z.literal("image"),
    url: imagePath(),
    alt: z.string().trim().max(200).catch(""),
    href: href.optional(),
    width: z.enum(["full", "narrow"]).catch("full"),
    radius: z.enum(["none", "s", "l"]).optional().catch(undefined),
    ...band,
  }),
  z.object({
    id,
    t: z.literal("button"),
    label: shortText(40, "El botón admite 40 caracteres"),
    href,
    align: align3.catch("center"),
    style: z.enum(["pill", "filled", "outline"]).optional().catch(undefined),
    bg: optColor,
    color: optColor,
    full: z.boolean().optional().catch(undefined),
    ...band,
  }),
  z.object({ id, t: z.literal("divider"), color: optColor, style: z.enum(["line", "dashed", "stars"]).optional().catch(undefined) }),
  z.object({ id, t: z.literal("spacer"), size: z.enum(["s", "m", "l"]).catch("m") }),
  z.object({
    id,
    t: z.literal("hero"),
    image: imagePath("Sube la foto de fondo desde aquí").catch(""),
    alt: z.string().trim().max(200).catch(""),
    overlay: color("#0E1024"),
    opacity: z.number().int().min(0).max(90).catch(40),
    title: shortText(120, "El título de la portada admite 120 caracteres"),
    subtitle: shortText(240, "El subtítulo admite 240 caracteres"),
    color: color("#FFFFFF"),
    align: z.enum(["left", "center"]).catch("center"),
    height: z.enum(["s", "m", "l"]).catch("m"),
    font,
    buttonLabel: shortText(40, "El botón admite 40 caracteres").optional(),
    buttonHref: href.optional(),
    buttonBg: optColor,
    buttonColor: optColor,
  }),
  z.object({
    id,
    t: z.literal("spotlight"),
    // Un emoji o un símbolo (✨, ☾, ★): pocos caracteres, sin < ni > (se escapa igualmente).
    icon: z.string().trim().max(8).transform((v) => v.replace(/[<>&"']/g, "")).catch(""),
    title: shortText(120, "El título del destacado admite 120 caracteres"),
    body: z.string().max(2000, "El texto del destacado admite 2000 caracteres"),
    bg: color("#F4EFFC"),
    accent: color("#6B58C4"),
    border: z.enum(["left", "box", "none"]).catch("left"),
    color: optColor,
  }),
  z.object({
    id,
    t: z.literal("video"),
    url: z
      .string()
      .trim()
      .max(500)
      .refine((v) => !v || !!videoEmbed(v), "Ese enlace no es de YouTube ni de Vimeo"),
    src: z
      .string()
      .trim()
      .max(200)
      .refine((v) => !v || isOwnVideoSrc(v), "Vuelve a subir el vídeo"),
    cover: imagePath("Sube la portada del vídeo desde aquí"),
    title: shortText(120, "El título del vídeo admite 120 caracteres"),
    caption: shortText(200).optional(),
    ...band,
  }),
  z.object({
    id,
    t: z.literal("columns"),
    image: imagePath(),
    alt: z.string().trim().max(200).catch(""),
    href: href.optional(),
    side: z.enum(["left", "right"]).catch("left"),
    title: shortText(120, "El título admite 120 caracteres"),
    body: z.string().max(2000, "El texto admite 2000 caracteres"),
    buttonLabel: shortText(40, "El botón admite 40 caracteres").optional(),
    buttonHref: href.optional(),
    ...band,
  }),
  z.object({
    id,
    t: z.literal("social"),
    links: z.record(z.enum(SOCIAL_NETWORKS as [SocialNetwork, ...SocialNetwork[]]), shortText(300)).catch({}),
    align: align3.catch("center"),
    color: optColor,
    ...band,
  }),
]);

const styleSchema = z.object({
  bg: color(DEFAULT_EMAIL_STYLE.bg),
  content: color(DEFAULT_EMAIL_STYLE.content),
  text: color(DEFAULT_EMAIL_STYLE.text),
  heading: color(DEFAULT_EMAIL_STYLE.heading),
  link: color(DEFAULT_EMAIL_STYLE.link),
  accent: color(DEFAULT_EMAIL_STYLE.accent),
  headingFont: z.enum(EMAIL_FONT_KEYS).catch(DEFAULT_EMAIL_STYLE.headingFont),
  bodyFont: z.enum(EMAIL_FONT_KEYS).catch(DEFAULT_EMAIL_STYLE.bodyFont),
  radius: z.enum(["none", "s", "m", "l"]).catch(DEFAULT_EMAIL_STYLE.radius),
  width: z.union([z.literal(520), z.literal(600), z.literal(680)]).catch(DEFAULT_EMAIL_STYLE.width),
});

/** El estilo guardado, completo (lo que falte o no valga, como siempre). */
export function readStyle(raw: unknown): EmailStyle {
  const r = styleSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  return r.success ? (r.data as EmailStyle) : { ...DEFAULT_EMAIL_STYLE };
}

const designSchema = z.object({ v: z.literal(1).catch(1), blocks: z.array(z.unknown()).max(EMAIL_BLOCKS_MAX, `Máximo ${EMAIL_BLOCKS_MAX} bloques`), style: z.unknown().optional() });

/** Quita los campos opcionales vacíos (undefined) para guardar JSON limpio. */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Comprobaciones que dependen de varios campos (el vídeo necesita un enlace o un archivo). */
function blockProblem(b: EmailBlock): string | null {
  if (b.t === "video" && b.url && b.src) return "Un vídeo es o un enlace o un archivo subido, no los dos";
  if (b.t === "hero" && b.buttonHref && !safeLinkHref(b.buttonHref)) return "Revisa la dirección del botón de la portada";
  return null;
}

function withStyle(blocks: EmailBlock[], style: unknown): EmailDesign {
  return style && typeof style === "object" ? { v: 1, blocks, style: readStyle(style) } : { v: 1, blocks };
}

/**
 * Lo guardado en la BD (tolerante): un bloque dañado o de una versión futura se descarta sin tumbar
 * el email. null si no hay diseño.
 */
export function readDesign(raw: unknown): EmailDesign | null {
  if (!raw || typeof raw !== "object") return null;
  const blocks = Array.isArray((raw as { blocks?: unknown }).blocks) ? ((raw as { blocks: unknown[] }).blocks as unknown[]) : [];
  const out: EmailBlock[] = [];
  for (const b of blocks.slice(0, EMAIL_BLOCKS_MAX)) {
    const r = blockSchema.safeParse(b);
    if (r.success && !blockProblem(r.data as EmailBlock)) out.push(clean(r.data) as EmailBlock);
  }
  return withStyle(out, (raw as { style?: unknown }).style);
}

/** Lo que llega del editor al guardar (estricto: dice qué falla). */
export function parseDesignStrict(raw: unknown): { ok: true; value: EmailDesign } | { ok: false; error: string } {
  const d = designSchema.safeParse(raw);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Diseño no válido" };
  const blocks: EmailBlock[] = [];
  for (const b of d.data.blocks) {
    const r = blockSchema.safeParse(b);
    if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Hay un bloque que no se entiende" };
    const problem = blockProblem(r.data as EmailBlock);
    if (problem) return { ok: false, error: problem };
    blocks.push(clean(r.data) as EmailBlock);
  }
  return { ok: true, value: withStyle(blocks, d.data.style) };
}

/** Imagen de un email: solo las subidas aquí (/media/…) o las de la demo. */
export function emailImagePath(url: string): string | null {
  return /^\/media\/[a-z0-9]+\/[a-f0-9]{20}\.(?:webp|jpg|png)$/.test(url) || /^\/demo\/[\w-]+\.(?:webp|jpg|png)$/.test(url) ? url : null;
}

/** Página pública «ver vídeo» de un vídeo subido aquí (/media/video/… → /media/ver/…), o null. */
export function videoWatchPath(src: string): string | null {
  const m = src.match(/^\/media\/video\/([a-z0-9]{10,40})\/([a-f0-9]{24}\.(?:mp4|mov|m4v))$/);
  return m ? `/media/ver/${m[1]}/${m[2]}` : null;
}

/** Color hex válido o el de reserva (para pintar: nunca llega al HTML otra cosa). */
export const hexOr = (v: string | undefined | null, fallback: string) => (isHex(v) ? v.toUpperCase() : fallback);

let seq = 0;
/** Id de un bloque nuevo (solo identifica el bloque dentro de su email). */
export function newBlockId(): string {
  seq = (seq + 1) % 1e6;
  return `b${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function newBlock(t: EmailBlockType, style: EmailStyle = DEFAULT_EMAIL_STYLE): EmailBlock {
  const bid = newBlockId();
  switch (t) {
    case "title":
      return { id: bid, t, text: "", align: "left" };
    case "text":
      return { id: bid, t, body: "" };
    case "image":
      return { id: bid, t, url: "", alt: "", width: "full" };
    case "button":
      return { id: bid, t, label: "", href: "", align: "center" };
    case "divider":
      return { id: bid, t };
    case "spacer":
      return { id: bid, t, size: "m" };
    case "hero":
      return { id: bid, t, image: "", alt: "", overlay: style.accent, opacity: 40, title: "", subtitle: "", color: "#FFFFFF", align: "center", height: "m" };
    case "spotlight":
      return { id: bid, t, icon: "✨", title: "", body: "", bg: "#F4EFFC", accent: "#6B58C4", border: "left" };
    case "video":
      return { id: bid, t, url: "", src: "", cover: "", title: "" };
    case "columns":
      return { id: bid, t, image: "", alt: "", side: "left", title: "", body: "" };
    case "social":
      return { id: bid, t, links: {}, align: "center" };
  }
}

/** Primer borrador de una newsletter nueva. */
export function defaultCampaignDesign(o: { siteUrl: string }): EmailDesign {
  return {
    v: 1,
    blocks: [
      { id: "titulo", t: "title", text: "Hola, {nombre}", align: "left" },
      { id: "texto", t: "text", body: "Escribe aquí lo que quieras contarle este mes.\n\nUn abrazo,\n{mi_nombre}" },
      { id: "boton", t: "button", label: "Ver mi página", href: o.siteUrl, align: "center" },
    ],
  };
}

/** Texto de un bloque (para «solo imágenes», el extracto y las pruebas). */
function blockText(b: EmailBlock): string {
  switch (b.t) {
    case "title":
      return b.text;
    case "text":
      return b.body;
    case "button":
      return b.label;
    case "hero":
      return [b.title, b.subtitle, b.buttonLabel ?? ""].filter(Boolean).join("\n");
    case "spotlight":
      return [b.title, b.body].filter(Boolean).join("\n");
    case "video":
      return [b.title, b.caption ?? ""].filter(Boolean).join("\n");
    case "columns":
      return [b.title, b.body, b.buttonLabel ?? ""].filter(Boolean).join("\n");
    default:
      return "";
  }
}

/** Texto plano del diseño (para «solo imágenes», el extracto y las pruebas). */
export function designText(d: EmailDesign): string {
  return d.blocks.map(blockText).filter(Boolean).join("\n").replace(/==/g, "");
}

/** Colores de texto y fondo de cada bloque (para avisar de poco contraste). */
export function blockContrastPairs(b: EmailBlock, s: EmailStyle): { what: string; fg: string; bg: string; large?: boolean }[] {
  // Con «Fondo», lo que va encima se lee contra la franja, no contra la tarjeta.
  const under = "band" in b && b.band ? hexOr(b.band, s.content) : s.content;
  switch (b.t) {
    case "title":
      return [{ what: "el título", fg: hexOr(b.color, s.heading), bg: hexOr(b.bg, s.content), large: (b.size ?? "m") !== "s" }];
    case "text": {
      const fg = hexOr(b.color, s.text);
      const out = [{ what: "el texto", fg, bg: under }];
      if (b.body.includes("==")) out.push({ what: "el texto resaltado", fg, bg: hexOr(b.highlight, DEFAULT_HIGHLIGHT) });
      return out;
    }
    case "button": {
      const c = buttonColors(b, s);
      return [{ what: "el botón", fg: c.fg, bg: c.outline ? under : c.bg }];
    }
    case "hero":
      // Con foto, la capa no es opaca: se mira contra la capa (lo que se ve si no carga la foto).
      return [{ what: "el texto de la portada", fg: b.color, bg: b.overlay, large: true }];
    case "spotlight":
      return [{ what: "el texto del destacado", fg: hexOr(b.color, s.text), bg: b.bg }];
    case "columns":
      return b.band ? [{ what: "el texto de las columnas", fg: s.text, bg: under }] : [];
    case "video":
      return b.band ? [{ what: "el enlace del vídeo", fg: s.accent, bg: under }] : [];
    case "social":
      return [{ what: "los enlaces a tus redes", fg: hexOr(b.color, s.accent), bg: under }];
    default:
      return [];
  }
}

/** Colores de un botón: el suyo o el acento del estilo; el texto, el que mejor se lee si no lo elige. */
export function buttonColors(b: { style?: "pill" | "filled" | "outline"; bg?: string; color?: string }, s: EmailStyle) {
  const bg = hexOr(b.bg, s.accent);
  const outline = (b.style ?? "pill") === "outline";
  const fg = outline ? hexOr(b.color, bg) : hexOr(b.color, textOn(bg, "#0E1024", "#F6F1E7"));
  return { bg, fg, outline };
}

/** Avisos con arreglo fácil, antes de enviar. */
export function lintDesign(d: EmailDesign, subject?: string): string[] {
  const out: string[] = [];
  const s = d.style ?? DEFAULT_EMAIL_STYLE;
  if (subject !== undefined && !subject.trim()) out.push("Falta el asunto.");
  if (!d.blocks.length) out.push("El email está vacío: añade un texto.");
  const pictures = d.blocks.filter((b) => b.t === "image" || b.t === "hero" || b.t === "video" || b.t === "columns");
  if (pictures.length && designText(d).replace(/\s|\{[a-z_]+\}/g, "").length < 40)
    out.push("Tu email es casi solo imágenes: añade un texto para que no acabe en spam.");
  if (d.blocks.some((b) => (b.t === "image" && !b.url) || (b.t === "columns" && !b.image))) out.push("Hay un bloque de imagen sin imagen.");
  if (d.blocks.some((b) => (b.t === "image" && b.url && !b.alt.trim()) || (b.t === "columns" && b.image && !b.alt.trim()) || (b.t === "hero" && b.image && !b.alt.trim())))
    out.push("Falta el texto alternativo de una imagen (lo leen quienes no ven imágenes).");
  if (d.blocks.some((b) => b.t === "button" && (!b.label.trim() || !b.href.trim()))) out.push("Hay un botón sin texto o sin enlace.");
  if (d.blocks.some((b) => (b.t === "hero" || b.t === "columns") && !!b.buttonLabel?.trim() !== !!b.buttonHref?.trim())) out.push("Hay un botón sin texto o sin enlace.");
  if (d.blocks.some((b) => b.t === "video" && !b.url && !b.src)) out.push("Hay un bloque de vídeo sin vídeo: pega un enlace de YouTube o Vimeo o súbelo.");
  if (d.blocks.some((b) => b.t === "video" && (b.url || b.src) && !b.cover)) out.push("Falta la portada de un vídeo: sin ella sale un recuadro oscuro con ▶.");
  if (d.blocks.some((b) => b.t === "social" && !Object.values(b.links).some((v) => v?.trim()))) out.push("El bloque de redes sociales está vacío.");
  if (contrastRatio(s.text, s.content) < MIN_CONTRAST) out.push("El color del texto apenas se distingue del fondo: elige uno más oscuro o más claro.");
  const seen = new Set<string>();
  for (const b of d.blocks)
    for (const pair of blockContrastPairs(b, s)) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      if (ratio < (pair.large ? 3 : MIN_CONTRAST) && !seen.has(pair.what)) {
        seen.add(pair.what);
        out.push(`Poco contraste en ${pair.what} (${ratio.toFixed(1).replace(".", ",")}:1): cuesta leerlo. Prueba un color más oscuro o más claro.`);
      }
    }
  return [...new Set(out)];
}

/** Variables que se pueden escribir en los textos de un email. */
export type EmailVars = Partial<Record<"nombre" | "mi_nombre" | "producto" | "fecha", string | null>>;

export const VARIABLE_HELP: Record<keyof EmailVars, string> = {
  nombre: "el nombre de quien lo recibe",
  mi_nombre: "tu nombre",
  producto: "el producto",
  fecha: "la fecha y hora de la sesión",
};

/**
 * Sustituye las variables en un texto YA ESCAPADO para HTML: los valores se escapan aquí. Sin
 * nombre, «Hola, {nombre}» queda en «Hola».
 */
export function applyVars(html: string, vars: EmailVars, escape: (s: string) => string): string {
  return html.replace(/(,?\s*)\{(nombre|mi_nombre|producto|fecha)\}/g, (_, lead: string, k: keyof EmailVars) => {
    const v = vars[k]?.trim();
    if (v) return `${lead}${escape(v)}`;
    return k === "nombre" ? "" : lead;
  });
}
