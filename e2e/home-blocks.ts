import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Bloques de la portada para las pruebas. La demo ya no trae ninguno (la sección «Bloques» está
 * vacía): las pruebas que comprueban cómo se pintan los crean aquí, con imágenes y vídeo que la demo
 * ya tiene subidos (la galería de «Sobre mí» y el vídeo de la actualidad «Luna llena: qué soltar»).
 */

type Section = { key: string; enabled: boolean; title?: string };
type Img = { src: string; alt: string; width: number; height: number; caption?: string };

/** Bloque de texto con botón a una web de fuera (el «Cómo trabajo» que traía la demo). */
export const COMO_TRABAJO = {
  id: "sobre-mi",
  kind: "text",
  title: "Cómo trabajo",
  body: "Cada lectura parte de tu carta natal y de tu diseño humano, sin fórmulas genéricas.\n\nTrabajo por videollamada y te envío la grabación y un resumen escrito después de cada sesión.",
  buttonLabel: "Ver mi agenda",
  buttonUrl: "https://calendly.com/ana-luna",
  enabled: true,
};

/** Vídeo subido (con portada), gráfico de los 5 tipos y galería en carrusel de tres imágenes. */
export async function mediaBlocks(prisma: PrismaClient, creatorId: string) {
  const about = await prisma.sitePage.findUniqueOrThrow({ where: { creatorId_slug: { creatorId, slug: "sobre-mi" } } });
  const gallery = ((about.published ?? about.draft) as { blocks: { kind: string; images?: Img[] }[] }).blocks.find((b) => b.kind === "gallery")!.images!;
  const hd = gallery.find((i) => i.alt === "Human Design")!;
  const post = await prisma.post.findFirstOrThrow({ where: { creatorId, slug: "luna-llena-que-soltar" } });
  const media = post.media as { src?: string; poster?: string; width?: number; height?: number; durationSec?: number };
  if (!media.src) throw new Error("La demo no tiene el vídeo subido de «Luna llena» (¿sin ffmpeg al sembrar?)");
  return [
    {
      id: "video-bienvenida",
      kind: "video",
      title: "Bienvenida",
      caption: "Un minuto para conocerme antes de reservar.",
      upload: { src: media.src, width: media.width ?? null, height: media.height ?? null, durationSec: media.durationSec != null ? Math.round(media.durationSec) : null, codec: "H264", sizeBytes: null },
      poster: media.poster ?? post.imageUrl,
      enabled: true,
    },
    {
      id: "grafico-luna",
      kind: "image",
      title: "",
      image: { ...hd, alt: "Los 5 tipos de Human Design: Manifestador, Generador, Generador Manifestante, Proyector y Reflector", caption: "Mi guía rápida de los 5 tipos" },
      href: "/ana/lectura-human-design",
      enabled: true,
    },
    { id: "galeria-lecturas", kind: "gallery", title: "Así son mis lecturas", layout: "carousel", images: gallery.map(({ caption: _c, ...i }) => i), enabled: true },
  ];
}

/** La página con esos bloques añadidos y la sección «Bloques» visible. */
export function withHomeBlocks(page: Prisma.JsonValue, blocks: unknown[]): Prisma.InputJsonValue {
  const cfg = structuredClone(page ?? {}) as { sections?: Section[]; blocks?: unknown[] };
  const sections = cfg.sections ?? [];
  cfg.sections = sections.some((s) => s.key === "blocks") ? sections.map((s) => (s.key === "blocks" ? { ...s, enabled: true } : s)) : [...sections, { key: "blocks", enabled: true }];
  cfg.blocks = [...(cfg.blocks ?? []), ...blocks];
  return cfg as Prisma.InputJsonValue;
}
