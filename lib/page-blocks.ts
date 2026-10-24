import { z } from "zod";
import { videoEmbed } from "./video-embed";

/**
 * Bloques de contenido de la portada (Creator.pageDraft/pagePublished.blocks) y de las páginas extra
 * (SitePage.draft/published.blocks): texto con formato, imagen, galería y vídeo. Puro y seguro en el
 * cliente (lo usan el editor, la vista previa, la web pública y el servidor al guardar).
 *
 * Compatibilidad: los bloques guardados antes de existir los tipos no tienen `kind`; se leen como
 * «text» y se pintan exactamente igual que siempre. readBlocks() descarta solo el bloque que no
 * valga (dañado o de una versión futura): nunca deja la página en blanco.
 */

export const HOME_BLOCKS_MAX = 20;
export const PAGE_BLOCKS_MAX = 40;
export const GALLERY_MAX = 12;
/** Texto de un bloque de la portada y de una página extra. */
export const HOME_TEXT_MAX = 2000;
export const PAGE_TEXT_MAX = 10000;
/** Vídeo subido a la página (solo la web personal): hasta 1 GB. */
export const PAGE_VIDEO_MAX = 1024 ** 3;
/** La URL firmada a la que redirige /media/video/… vale 12 h (la redirección se cachea 10 min). */
export const PAGE_VIDEO_URL_TTL_SEC = 43200;

export const BLOCK_KINDS = ["text", "image", "gallery", "video"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_LABEL: Record<BlockKind, string> = {
  text: "Texto",
  image: "Imagen",
  gallery: "Galería",
  video: "Vídeo",
};

// ── Imágenes y vídeos propios ──

const OWN_MEDIA_IMAGE = /^\/media\/([a-z0-9]+)\/[a-f0-9]{20}\.webp$/;
const DEMO_IMAGE = /^\/demo\/[\w-]+\.(?:webp|jpg|png)$/;
const VIDEO_URL = /^\/media\/video\/([a-z0-9]{10,40})\/([a-f0-9]{24}\.(?:mp4|mov|m4v))$/;
const VIDEO_CID = /^[a-z0-9]{10,40}$/;
const VIDEO_FILE = /^[a-f0-9]{24}\.(mp4|mov|m4v)$/;

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
export function parsePageVideoPath(segments: string[]): { creatorId: string; file: string; ext: "mp4" | "mov" | "m4v"; key: string } | null {
  if (segments.length !== 2) return null;
  const [creatorId, file] = segments;
  if (!VIDEO_CID.test(creatorId)) return null;
  const m = file.match(VIDEO_FILE);
  if (!m) return null;
  return { creatorId, file, ext: m[1] as "mp4" | "mov" | "m4v", key: `public/video/${creatorId}/${file}` };
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

const base = { id: z.string().min(1).max(40), enabled: z.boolean().default(true) };

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

export type TextBlock = z.infer<ReturnType<typeof textBlockShape>>;
export type ImageBlock = z.infer<typeof imageBlockShape>;
export type GalleryBlock = z.infer<typeof galleryBlockShape>;
export type VideoBlock = z.infer<typeof videoBlockShape>;
export type ContentBlock = TextBlock | ImageBlock | GalleryBlock | VideoBlock;

/** Un bloque de antes (sin `kind`) es un bloque de texto. */
function withKind(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && !("kind" in raw)) return { ...raw, kind: "text" };
  return raw;
}

/** Esquema de un bloque, con los mensajes que ve la dueña al guardar. */
export function contentBlockSchema(o: { bodyMax: number }) {
  return z.preprocess(
    withKind,
    z.discriminatedUnion("kind", [textBlockShape(o.bodyMax), imageBlockShape, galleryBlockShape, videoBlockShape]).superRefine((b, ctx) => {
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
      }
    }),
  ) as unknown as z.ZodType<ContentBlock, z.ZodTypeDef, unknown>;
}

/** Lectura tolerante: los bloques que no valen se descartan uno a uno (y como mucho `max`). */
export function readBlocks(raw: unknown, schema: z.ZodType<ContentBlock, z.ZodTypeDef, unknown>, max: number): ContentBlock[] {
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
  }
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
  }
}

/** Todas las imágenes de un bloque (para el saneamiento). */
export function blockImages(b: ContentBlock): string[] {
  switch (b.kind) {
    case "image":
      return b.image ? [b.image.src] : [];
    case "gallery":
      return b.images.map((i) => i.src);
    case "video":
      return b.poster ? [b.poster] : [];
    default:
      return [];
  }
}
