import { z } from "zod";
import { videoEmbed } from "./video-embed";

/**
 * Bloques de contenido de la portada (Creator.pageDraft/pagePublished.blocks) y de las páginas extra
 * (SitePage.draft/published.blocks): texto con formato, imagen, galería, vídeo, foto y texto, tarjetas,
 * cita, trayectoria y modelo interactivo (carta natal, bodygraph, Gene Keys, ciclo lunar, runas, oráculo o geometría
 * sagrada: components/models). Puro y seguro en el cliente (lo usan el editor, la vista previa, la web pública y el servidor al guardar).
 *
 * Compatibilidad: los bloques guardados antes de existir los tipos no tienen `kind`; se leen como
 * «text» y se pintan exactamente igual que siempre. readBlocks() descarta solo el bloque que no
 * valga (dañado o de una versión futura): nunca deja la página en blanco.
 */

export const HOME_BLOCKS_MAX = 20;
export const PAGE_BLOCKS_MAX = 40;
export const GALLERY_MAX = 12;
/** Tarjetas de un bloque «Tarjetas» y pasos de una «Trayectoria». */
export const CARDS_MAX = 8;
export const TIMELINE_MAX = 12;
/** Texto de un bloque de la portada y de una página extra. */
export const HOME_TEXT_MAX = 2000;
export const PAGE_TEXT_MAX = 10000;
/** Vídeo subido a la página (solo la web personal): hasta 1 GB. */
export const PAGE_VIDEO_MAX = 1024 ** 3;
/** La URL firmada a la que redirige /media/video/… vale 12 h (la redirección se cachea 10 min). */
export const PAGE_VIDEO_URL_TTL_SEC = 43200;

export const BLOCK_KINDS = ["text", "image", "gallery", "video", "photoText", "cards", "quote", "timeline", "model", "pills", "moonCircles", "tiers"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_LABEL: Record<BlockKind, string> = {
  text: "Texto",
  image: "Imagen",
  gallery: "Galería",
  video: "Vídeo",
  photoText: "Foto y texto",
  cards: "Tarjetas",
  quote: "Cita",
  timeline: "Trayectoria",
  model: "Modelo interactivo",
  pills: "Enlaces en burbuja",
  moonCircles: "Próximos círculos de la luna",
  tiers: "Niveles de la comunidad",
};

/** Burbujas de un bloque «Enlaces en burbuja». */
export const PILLS_MIN = 1;
export const PILLS_MAX = 4;
/** Modelos que tienen versión rápida (solo el dibujo) y «Calcular con mis datos». */
export const QUICK_MODELS = ["chart", "bodygraph", "geneKeys", "lunar"] as const;
export function hasQuickVersion(m: ModelKind): m is (typeof QUICK_MODELS)[number] {
  return (QUICK_MODELS as readonly string[]).includes(m);
}

/** Modelos del bloque «Modelo interactivo» (components/models). */
export const MODEL_KINDS = ["chart", "bodygraph", "geneKeys", "lunar", "runes", "oracle", "sacred", "geometry", "kundalini", "dimensions"] as const;
export type ModelKind = (typeof MODEL_KINDS)[number];
export const MODEL_LABEL: Record<ModelKind, string> = {
  chart: "Carta natal",
  bodygraph: "Bodygraph (Human Design)",
  geneKeys: "Gene Keys (perfil hologenético)",
  lunar: "Ciclo lunar y calendario",
  runes: "Tirada de runas",
  oracle: "Oráculo",
  sacred: "Filosofía · geometría sagrada",
  geometry: "Frase con geometría sagrada",
  kundalini: "Kundalini: cuerpo sutil y 10 cuerpos",
  dimensions: "Las dimensiones del ser (3D a 12D)",
};
/** Id de una baraja de oráculo propia (cuid) en el bloque «Oráculo». */
export const ORACLE_DECK_ID_RE = /^[a-z0-9]{8,40}$/;
/** Figura de la geometría sagrada (solo el modelo «geometry»: ornamento detrás de una frase). */
export const GEOMETRY_FIGURES = ["enneagram", "metatron", "flower", "vesica", "torus"] as const;
export type GeometryFigure = (typeof GEOMETRY_FIGURES)[number];
export const GEOMETRY_LABEL: Record<GeometryFigure, string> = {
  enneagram: "Eneagrama",
  metatron: "Cubo de Metatrón",
  flower: "Flor de la vida",
  vesica: "Vesica piscis",
  torus: "Toro",
};

// ── Imágenes y vídeos propios ──

const OWN_MEDIA_IMAGE = /^\/media\/([a-z0-9]+)\/[a-f0-9]{20}\.webp$/;
const DEMO_IMAGE = /^\/demo\/[\w-]+\.(?:webp|jpg|png)$/;
const VIDEO_URL = /^\/media\/video\/([a-z0-9]{10,40})\/([a-f0-9]{24}\.(?:mp4|mov|m4v))$/;
const VIDEO_CID = /^[a-z0-9]{10,40}$/;
// También los audios de las publicaciones (lib/posts.ts → PostMedia), que viven en la misma carpeta pública.
const VIDEO_FILE = /^[a-f0-9]{24}\.(mp4|mov|m4v|m4a|mp3|wav)$/;

/**
 * Imagen subida aquí (/media/<creadora>/<20 hex>.webp, la del procesado con variantes) o de la demo.
 * Con `creatorId`, además tiene que ser de esa creadora. Nunca una URL de fuera, data: ni «..».
 */
export function isOwnImageSrc(src: string, creatorId?: string): boolean {
  if (typeof src !== "string" || src.includes("..")) return false;
  if (DEMO_IMAGE.test(src)) return true;
  const m = src.match(OWN_MEDIA_IMAGE);
  return !!m && (!creatorId || m[1] === creatorId);
}

/** Dirección pública y estable de un vídeo subido a la página: responde con una redirección firmada. */
export function pageVideoUrl(creatorId: string, file: string): string {
  return `/media/video/${creatorId}/${file}`;
}

export function isOwnVideoSrc(src: string, creatorId?: string): boolean {
  const m = typeof src === "string" ? src.match(VIDEO_URL) : null;
  return !!m && (!creatorId || m[1] === creatorId);
}

/** Tramos de /media/video/<cid>/<archivo> → clave del almacenamiento (public/video/…), o null. */
export function parsePageVideoPath(segments: string[]): { creatorId: string; file: string; ext: "mp4" | "mov" | "m4v" | "m4a" | "mp3" | "wav"; key: string } | null {
  if (segments.length !== 2) return null;
  const [creatorId, file] = segments;
  if (!VIDEO_CID.test(creatorId)) return null;
  const m = file.match(VIDEO_FILE);
  if (!m) return null;
  return { creatorId, file, ext: m[1] as "mp4" | "mov" | "m4v" | "m4a" | "mp3" | "wav", key: `public/video/${creatorId}/${file}` };
}

/** Error que ve la dueña al pegar un enlace de vídeo, o null si se reconoce (YouTube o Vimeo). */
export function embedProblem(url: string, personal: boolean): string | null {
  if (!url.trim()) return "Pega el enlace del vídeo";
  if (videoEmbed(url)) return null;
  return personal
    ? "Ese enlace no es de YouTube ni de Vimeo. Si el vídeo es tuyo, súbelo con «Subir vídeo»."
    : "Ese enlace no es de YouTube ni de Vimeo. Sube el vídeo a YouTube o Vimeo y pega aquí el enlace.";
}

export function videoOrientation(w: number | null | undefined, h: number | null | undefined): "vertical" | "horizontal" | "cuadrado" | null {
  if (!w || !h) return null;
  if (Math.abs(w - h) / Math.max(w, h) < 0.05) return "cuadrado";
  return h > w ? "vertical" : "horizontal";
}

// ── Esquemas ──

const shortText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const dim = z.number().int().min(1).max(20000);

export const pageImageSchema = z.object({
  src: z.string().max(500).refine((s) => isOwnImageSrc(s), "Una imagen no es tuya o ya no existe: vuelve a subirla"),
  alt: shortText(300).default(""),
  caption: shortText(200).optional(),
  width: dim,
  height: dim,
});
export type PageImage = z.infer<typeof pageImageSchema>;

export const pageVideoSchema = z.object({
  src: z.string().max(200).refine((s) => isOwnVideoSrc(s), "El vídeo no es tuyo o ya no existe: vuelve a subirlo"),
  width: dim.nullable().catch(null),
  height: dim.nullable().catch(null),
  durationSec: z.number().int().min(0).max(86400).nullable().catch(null),
  codec: z.enum(["H264", "HEVC", "OTHER"]).nullable().catch(null),
  sizeBytes: z.number().int().min(0).nullable().catch(null),
});
export type PageVideo = z.infer<typeof pageVideoSchema>;

/**
 * Cómo se ve un bloque en la web: «card» (en su caja), «bare» (suelto sobre el fondo, sin burbuja) o
 * «panel» (panel dorado con la flor de la vida). Ausente = el de la página (cajas, o sueltos en «Sobre mí»).
 */
export const BLOCK_LOOKS = ["card", "bare", "panel"] as const;
export type BlockLook = (typeof BLOCK_LOOKS)[number];
export const BLOCK_LOOK_LABEL: Record<BlockLook, string> = { card: "Tarjeta", bare: "Sin burbuja", panel: "Panel dorado" };

const base = {
  id: z.string().min(1).max(40),
  enabled: z.boolean().default(true),
  look: z.enum(BLOCK_LOOKS).optional().catch(undefined),
  /** Los títulos del bloque (y de sus tarjetas) en dorado. */
  goldTitle: z.boolean().optional().catch(undefined),
  /**
   * Su diseño propio (letras, colores, tarjetas, paneles, botones, fotos), encima del de la página: un `Design`
   * (lib/templates.ts), leído clave a clave con readDesign (lib/page-config.ts) al pintarlo.
   */
  // Su diseño propio (lib/templates.ts → Design); se lee con readDesign (lib/page-config.ts).
  design: z.record(z.string(), z.any()).optional().catch(undefined),
  /** Solo en la portada: la sección delante de la que va («end», al final). Sin él, donde estaba «Bloques». */
  at: z.string().max(40).optional().catch(undefined),
};

function textBlockShape(bodyMax: number) {
  return z.object({
    ...base,
    kind: z.literal("text"),
    title: shortText(80).default(""),
    body: shortText(bodyMax).default(""),
    // Formato del texto (lib/rich-text.ts): ausente o desconocido = bloque de antes (párrafos y
    // enlaces automáticos). Nunca invalida el bloque.
    format: z.literal("MD").optional().catch(undefined),
    buttonLabel: shortText(40).optional(),
    buttonUrl: shortText(500).optional(),
  });
}

const imageBlockShape = z.object({
  ...base,
  kind: z.literal("image"),
  title: shortText(80).default(""),
  image: pageImageSchema.nullable().default(null),
  href: shortText(500).optional(),
});

const galleryBlockShape = z.object({
  ...base,
  kind: z.literal("gallery"),
  title: shortText(80).default(""),
  images: z.array(pageImageSchema).max(GALLERY_MAX, `Máximo ${GALLERY_MAX} imágenes por galería`).default([]),
  layout: z.enum(["carousel", "grid"]).catch("carousel").default("carousel"),
});

const videoBlockShape = z.object({
  ...base,
  kind: z.literal("video"),
  title: shortText(80).default(""),
  caption: shortText(300).optional(),
  embedUrl: shortText(500).optional(),
  upload: pageVideoSchema.nullable().default(null),
  /** Portada propia (imagen subida): el reproductor solo se carga al pulsar ▶. */
  poster: z.string().max(500).refine((s) => isOwnImageSrc(s), "La portada del vídeo no es tuya: vuelve a subirla").nullable().default(null),
});

/** «Foto y texto»: una foto al lado de un título y un texto con formato (en el móvil, una encima del otro). */
function photoTextBlockShape(bodyMax: number) {
  return z.object({
    ...base,
    kind: z.literal("photoText"),
    title: shortText(80).default(""),
    body: shortText(bodyMax).default(""),
    format: z.literal("MD").optional().catch(undefined),
    image: pageImageSchema.nullable().default(null),
    /** Lado de la foto en el ordenador. */
    imageSide: z.enum(["left", "right"]).catch("left").default("left"),
    buttonLabel: shortText(40).optional(),
    buttonUrl: shortText(500).optional(),
  });
}

export const blockCardSchema = z.object({
  image: pageImageSchema.nullable().default(null),
  title: shortText(80).default(""),
  text: shortText(240).default(""),
  href: shortText(500).optional(),
  /** Precio o detalle corto («24 €», «Desde 15 €»): sale en dorado (los regalos de Gifts). */
  price: shortText(40).optional(),
});
export type BlockCard = z.infer<typeof blockCardSchema>;

/** «Tarjetas»: de 1 a 8 tarjetas (imagen, título, texto corto y enlace); la tarjeta entera se puede tocar. */
const cardsBlockShape = z.object({
  ...base,
  kind: z.literal("cards"),
  title: shortText(80).default(""),
  cards: z.array(blockCardSchema).max(CARDS_MAX, `Máximo ${CARDS_MAX} tarjetas por bloque`).default([]),
});

/** «Cita»: una frase destacada y, si se quiere, quién la dijo. */
const quoteBlockShape = z.object({
  ...base,
  kind: z.literal("quote"),
  text: shortText(600).default(""),
  author: shortText(120).optional(),
});

export const timelineItemSchema = z.object({
  /** Etiqueta corta: un año, «Hoy», «2019–2021»… */
  label: shortText(40).default(""),
  title: shortText(100).default(""),
  text: shortText(400).default(""),
});
export type TimelineItem = z.infer<typeof timelineItemSchema>;

/** «Trayectoria»: una línea de tiempo con sus hitos. */
const timelineBlockShape = z.object({
  ...base,
  kind: z.literal("timeline"),
  title: shortText(80).default(""),
  items: z.array(timelineItemSchema).max(TIMELINE_MAX, `Máximo ${TIMELINE_MAX} hitos por trayectoria`).default([]),
});

/**
 * «Modelo interactivo»: uno de los modelos de components/models con un título y una entradilla
 * opcionales (en la geometría sagrada, el título es la frase que va sobre la figura).
 */
const modelBlockShape = z.object({
  ...base,
  kind: z.literal("model"),
  model: z.enum(MODEL_KINDS).catch("chart").default("chart"),
  title: shortText(120).default(""),
  intro: shortText(600).default(""),
  figure: z.enum(GEOMETRY_FIGURES).catch("enneagram").default("enneagram"),
  /**
   * Solo el oráculo: id de una de sus barajas propias (Panel → Barajas). Sin él, la de serie. Si la
   * baraja deja de estar publicada o se borra, también la de serie (lib/oracle-decks.ts).
   */
  deck: z.string().regex(ORACLE_DECK_ID_RE).optional().catch(undefined),
  /**
   * «Versión rápida» (carta natal, bodygraph, Gene Keys y Luna): solo el dibujo con lo mínimo, sin
   * paneles largos ni tablas; «Calcular con mis datos» va debajo de la caja. La versión completa vive
   * en «Mi energía» del área de alumnas. Ausente = la de siempre.
   */
  quick: z.boolean().optional().catch(undefined),
});

export const pillLinkSchema = z.object({
  label: shortText(60).default(""),
  href: shortText(500).default(""),
});
export type PillLink = z.infer<typeof pillLinkSchema>;

/** «Enlaces en burbuja»: de 1 a 4 píldoras alargadas que llevan a otras páginas (comunidad, lecturas, cursos…). */
const pillsBlockShape = z.object({
  ...base,
  kind: z.literal("pills"),
  title: shortText(80).default(""),
  items: z.array(pillLinkSchema).max(PILLS_MAX, `Máximo ${PILLS_MAX} burbujas por bloque`).default([]),
});

/**
 * «Próximos círculos de la luna»: tarjetas pequeñas con los dos próximos círculos publicados (los 2
 * más cercanos: luna nueva, luna llena o eclipse), elegidos solos cada vez que se pinta la página: no hay que tocarlo
 * cuando pasa una luna.
 */
const moonCirclesBlockShape = z.object({
  ...base,
  kind: z.literal("moonCircles"),
  title: shortText(80).default(""),
});

/** La etiqueta del nivel más completo, sin cambiarla. */
export const TIER_BADGE_DEFAULT = "La más elegida";

/**
 * «Niveles de la comunidad» (la página Hacerte miembro): los niveles de su membresía, uno al lado del otro, sacados
 * de lo que tiene publicado (su nombre, su precio, su carta y el diseño de cada tarjeta se guardan en cada nivel:
 * lib/tier-look.ts). Aquí, solo el fondo de ensueño detrás de todos y el texto de la etiqueta del más completo.
 */
const tiersBlockShape = z.object({
  ...base,
  kind: z.literal("tiers"),
  title: shortText(80).default(""),
  /** Un fondo de ensueño detrás de los niveles (bruma, luz y destellos que flotan). */
  stage: z.boolean().optional().catch(undefined),
  badge: shortText(40).default(TIER_BADGE_DEFAULT),
});

export type TextBlock = z.infer<ReturnType<typeof textBlockShape>>;
export type ImageBlock = z.infer<typeof imageBlockShape>;
export type GalleryBlock = z.infer<typeof galleryBlockShape>;
export type VideoBlock = z.infer<typeof videoBlockShape>;
export type PhotoTextBlock = z.infer<ReturnType<typeof photoTextBlockShape>>;
export type CardsBlock = z.infer<typeof cardsBlockShape>;
export type QuoteBlock = z.infer<typeof quoteBlockShape>;
export type TimelineBlock = z.infer<typeof timelineBlockShape>;
export type ModelBlock = z.infer<typeof modelBlockShape>;
export type PillsBlock = z.infer<typeof pillsBlockShape>;
export type MoonCirclesBlock = z.infer<typeof moonCirclesBlockShape>;
export type TiersBlock = z.infer<typeof tiersBlockShape>;
export type ContentBlock = TextBlock | ImageBlock | GalleryBlock | VideoBlock | PhotoTextBlock | CardsBlock | QuoteBlock | TimelineBlock | ModelBlock | PillsBlock | MoonCirclesBlock | TiersBlock;

/** Un bloque de antes (sin `kind`) es un bloque de texto. */
function withKind(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && !("kind" in raw)) return { ...raw, kind: "text" };
  return raw;
}

/** Esquema de un bloque, con los mensajes que ve la dueña al guardar. */
export function contentBlockSchema(o: { bodyMax: number }) {
  return z.preprocess(
    withKind,
    z
      .discriminatedUnion("kind", [
        textBlockShape(o.bodyMax),
        imageBlockShape,
        galleryBlockShape,
        videoBlockShape,
        photoTextBlockShape(o.bodyMax),
        cardsBlockShape,
        quoteBlockShape,
        timelineBlockShape,
        modelBlockShape,
        pillsBlockShape,
        moonCirclesBlockShape,
        tiersBlockShape,
      ]).superRefine((b, ctx) => {
      const issue = (message: string) => ctx.addIssue({ code: "custom", message });
      switch (b.kind) {
        case "text":
          if (!b.title && !b.body) issue("Cada bloque de texto necesita un título o un texto");
          if (b.buttonLabel && !b.buttonUrl) issue(`Falta el enlace del botón «${b.buttonLabel}»`);
          if (b.buttonUrl && !b.buttonLabel) issue("Escribe el texto del botón del bloque de texto");
          break;
        case "image":
          if (!b.image) issue("Falta la imagen de un bloque de imagen");
          break;
        case "gallery":
          if (!b.images.length) issue("Añade al menos una imagen a la galería");
          break;
        case "video":
          if (!b.upload && !b.embedUrl) issue("Falta el vídeo: súbelo o pega un enlace de YouTube o Vimeo");
          else if (b.upload && b.embedUrl) issue("Elige subir el vídeo o pegar un enlace, no las dos cosas");
          else if (b.embedUrl && !videoEmbed(b.embedUrl)) issue("Ese enlace de vídeo no es de YouTube ni de Vimeo");
          break;
        case "photoText":
          if (!b.image) issue("Falta la foto de un bloque «Foto y texto»");
          if (!b.title && !b.body) issue("Cada bloque «Foto y texto» necesita un título o un texto");
          if (b.buttonLabel && !b.buttonUrl) issue(`Falta el enlace del botón «${b.buttonLabel}»`);
          if (b.buttonUrl && !b.buttonLabel) issue("Escribe el texto del botón del bloque «Foto y texto»");
          break;
        case "cards":
          if (!b.cards.length) issue("Añade al menos una tarjeta al bloque de tarjetas");
          if (b.cards.some((c) => !c.title)) issue("Cada tarjeta necesita un título");
          break;
        case "quote":
          if (!b.text) issue("Escribe la frase de la cita");
          break;
        case "timeline":
          if (!b.items.length) issue("Añade al menos un hito a la trayectoria");
          if (b.items.some((i) => !i.title)) issue("Cada hito de la trayectoria necesita un título");
          break;
        case "pills":
          if (b.items.length < PILLS_MIN) issue("Añade al menos una burbuja al bloque «Enlaces en burbuja»");
          if (b.items.some((i) => !i.label)) issue("Cada burbuja necesita su texto");
          if (b.items.some((i) => !i.href)) issue("Cada burbuja necesita su enlace");
          break;
      }
    }),
  ) as unknown as z.ZodType<ContentBlock, unknown>;
}

/** Lectura tolerante: los bloques que no valen se descartan uno a uno (y como mucho `max`). */
export function readBlocks(raw: unknown, schema: z.ZodType<ContentBlock, unknown>, max: number): ContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: ContentBlock[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (!r.success || seen.has(r.data.id)) continue;
    seen.add(r.data.id);
    out.push(r.data);
    if (out.length >= max) break;
  }
  return out;
}

/** Bloques que se ven: visibles y con algo que mostrar. */
export function visibleBlocks(blocks: ContentBlock[] | undefined): ContentBlock[] {
  return (blocks ?? []).filter((b) => {
    if (!b.enabled) return false;
    switch (b.kind) {
      case "text":
        return !!(b.title.trim() || b.body.trim());
      case "image":
        return !!b.image;
      case "gallery":
        return b.images.length > 0;
      case "video":
        return !!b.upload || (!!b.embedUrl && !!videoEmbed(b.embedUrl));
      case "photoText":
        return !!b.image && !!(b.title.trim() || b.body.trim());
      case "cards":
        return b.cards.length > 0;
      case "quote":
        return !!b.text.trim();
      case "timeline":
        return b.items.length > 0;
      case "pills":
        return b.items.some((i) => i.label.trim() && i.href.trim());
      case "model":
      case "moonCircles":
      case "tiers":
        return true;
    }
  });
}

/** Bloque recién añadido y sin rellenar: se quita al guardar en vez de dar error. */
export function isEmptyBlock(b: ContentBlock): boolean {
  switch (b.kind) {
    case "text":
      return !(b.title.trim() || b.body.trim() || b.buttonLabel?.trim() || b.buttonUrl?.trim());
    case "image":
      return !b.image;
    case "gallery":
      return !b.images.length;
    case "video":
      return !b.upload && !b.embedUrl?.trim();
    case "photoText":
      return !(b.image || b.title.trim() || b.body.trim() || b.buttonLabel?.trim() || b.buttonUrl?.trim());
    case "cards":
      return !(b.title.trim() || b.cards.some((c) => c.image || c.title.trim() || c.text.trim() || c.href?.trim()));
    case "quote":
      return !(b.text.trim() || b.author?.trim());
    case "timeline":
      return !(b.title.trim() || b.items.some((i) => i.label.trim() || i.title.trim() || i.text.trim()));
    case "pills":
      return !(b.title.trim() || b.items.some((i) => i.label.trim() || i.href.trim()));
    // Un modelo (y los círculos, que se eligen solos) siempre tiene algo que enseñar, aunque no lleve título.
    case "model":
    case "moonCircles":
    case "tiers":
      return false;
  }
}

/**
 * Lo que se guarda: sin los bloques recién añadidos y vacíos, y sin las tarjetas ni los hitos que se
 * quedaron en blanco dentro de un bloque (no dan error al guardar).
 */
export function withoutEmptyBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks
    .map((b): ContentBlock => {
      if (b.kind === "cards") return { ...b, cards: b.cards.filter((c) => c.image || c.title.trim() || c.text.trim() || c.href?.trim()) };
      if (b.kind === "timeline") return { ...b, items: b.items.filter((i) => i.label.trim() || i.title.trim() || i.text.trim()) };
      if (b.kind === "pills") return { ...b, items: b.items.filter((i) => i.label.trim() || i.href.trim()) };
      return b;
    })
    .filter((b) => !isEmptyBlock(b));
}

export function newBlock(kind: BlockKind, id: string): ContentBlock {
  switch (kind) {
    case "text":
      return { id, kind, title: "", body: "", format: "MD", enabled: true };
    case "image":
      return { id, kind, title: "", image: null, enabled: true };
    case "gallery":
      return { id, kind, title: "", images: [], layout: "carousel", enabled: true };
    case "video":
      return { id, kind, title: "", upload: null, poster: null, enabled: true };
    case "photoText":
      return { id, kind, title: "", body: "", format: "MD", image: null, imageSide: "left", enabled: true };
    case "cards":
      return { id, kind, title: "", cards: [newCard()], enabled: true };
    case "quote":
      return { id, kind, text: "", enabled: true };
    case "timeline":
      return { id, kind, title: "", items: [newTimelineItem()], enabled: true };
    case "model":
      return { id, kind, model: "chart", title: "", intro: "", figure: "enneagram", quick: true, enabled: true };
    case "pills":
      return { id, kind, title: "", items: [newPill()], enabled: true };
    case "moonCircles":
      return { id, kind, title: "", enabled: true };
    case "tiers":
      return { id, kind, title: "", badge: TIER_BADGE_DEFAULT, enabled: true };
  }
}

export const newPill = (): PillLink => ({ label: "", href: "" });

export const newCard = (): BlockCard => ({ image: null, title: "", text: "" });
export const newTimelineItem = (): TimelineItem => ({ label: "", title: "", text: "" });

/** Todas las imágenes de un bloque (para el saneamiento). */
export function blockImages(b: ContentBlock): string[] {
  switch (b.kind) {
    case "image":
      return b.image ? [b.image.src] : [];
    case "gallery":
      return b.images.map((i) => i.src);
    case "video":
      return b.poster ? [b.poster] : [];
    case "photoText":
      return b.image ? [b.image.src] : [];
    case "cards":
      return b.cards.flatMap((c) => (c.image ? [c.image.src] : []));
    default:
      return [];
  }
}
