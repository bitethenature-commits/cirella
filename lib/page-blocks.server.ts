import "server-only";
import { blockImages, isOwnImageSrc, isOwnVideoSrc, type ContentBlock } from "./page-blocks";
import { cleanRichInput } from "./rich-text";
import { videoEmbed } from "./video-embed";

/**
 * Saneamiento de los bloques al guardar la portada o una página extra (después del esquema):
 *   · imágenes (de imagen, galería, portada de vídeo, foto y texto, y tarjetas): solo de esta
 *     creadora (o de la demo);
 *   · vídeo subido: solo suyo (solo se pueden subir en la web personal: lib/uploads.ts);
 *   · enlace de vídeo: recortado y reconocido (YouTube o Vimeo);
 *   · texto con formato (texto y «Foto y texto»): sin caracteres de control ni imágenes (cleanRichInput).
 */
export function sanitizeBlocks(creatorId: string, blocks: ContentBlock[]): { blocks: ContentBlock[] } | { error: string } {
  const out: ContentBlock[] = [];
  for (const b of blocks) {
    if (blockImages(b).some((src) => !isOwnImageSrc(src, creatorId))) return { error: "Una imagen no es tuya o ya no existe: vuelve a subirla" };
    switch (b.kind) {
      case "text":
      case "photoText":
        out.push(b.format === "MD" ? { ...b, body: cleanRichInput(b.body, { creatorId, images: false }) } : b);
        break;
      case "video": {
        // Un vídeo subido solo puede ser suyo. Solo se suben en la web personal (createUpload lo
        // rechaza en la plataforma); uno que ya estaba en la página se conserva al guardar.
        if (b.upload && !isOwnVideoSrc(b.upload.src, creatorId)) return { error: "El vídeo no es tuyo o ya no existe: vuelve a subirlo" };
        const embedUrl = b.embedUrl?.trim() || undefined;
        if (embedUrl && !videoEmbed(embedUrl)) return { error: "Ese enlace de vídeo no es de YouTube ni de Vimeo" };
        out.push({ ...b, embedUrl });
        break;
      }
      default:
        out.push(b);
    }
  }
  return { blocks: out };
}
