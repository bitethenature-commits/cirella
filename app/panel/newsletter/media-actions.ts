"use server";

import { storeVideoCover } from "@/lib/images";
import { limitUpload } from "@/lib/limits";
import { publicKey, storage } from "@/lib/storage";
import { fetchVideoThumbnail } from "@/lib/video-thumb";
import { videoEmbed } from "@/lib/video-embed";
import { requireNewsletterOwner } from "./guard";

/**
 * Portadas del bloque «Vídeo» del editor visual (newsletter y emails automáticos): una imagen propia
 * con el ▶ dibujado (lib/images.ts storeVideoCover).
 */
export type CoverResult = { ok: true; cover: string } | { ok: false; error: string };

/** De un enlace de YouTube o Vimeo: se trae su miniatura. */
export async function videoCoverFromLink(link: string): Promise<CoverResult> {
  const { creator } = await requireNewsletterOwner();
  if (!videoEmbed(String(link ?? ""))) return { ok: false, error: "Ese enlace no es de YouTube ni de Vimeo" };
  const gate = await limitUpload(creator.id);
  if (!gate.ok) return { ok: false, error: gate.message };
  const buf = await fetchVideoThumbnail(String(link));
  if (!buf) return { ok: false, error: "No hemos podido traer la miniatura del vídeo: sube una portada tú." };
  try {
    return { ok: true, cover: (await storeVideoCover(creator.id, buf)).url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo preparar la portada" };
  }
}

/**
 * De una imagen recién subida para el email (/media/<ella>/<hex>.jpg|png: una portada elegida a mano
 * o el fotograma sacado del vídeo en el móvil): se le dibuja el ▶.
 */
export async function videoCoverFromImage(image: string): Promise<CoverResult> {
  const { creator } = await requireNewsletterOwner();
  const m = String(image ?? "").match(/^\/media\/([a-z0-9]+)\/([a-f0-9]{20}\.(?:jpg|png))$/);
  if (!m || m[1] !== creator.id) return { ok: false, error: "Vuelve a subir la portada" };
  try {
    const buf = await storage().getBuffer(publicKey(`${m[1]}/${m[2]}`), 25 * 1024 * 1024);
    return { ok: true, cover: (await storeVideoCover(creator.id, buf)).url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo preparar la portada" };
  }
}
