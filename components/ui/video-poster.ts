"use client";

/**
 * Portada de un vídeo sacada en el navegador de un fotograma (en el iPhone, mientras empieza la
 * subida): <video> con el archivo local, salto a ~1 s y canvas a JPEG (máx. 1280 px de ancho).
 * null si el navegador no puede leerlo (p. ej. HEVC en Chrome de Windows) o si tarda más de 8 s;
 * entonces el vídeo se queda sin portada y se puede subir una a mano.
 */
export async function capturePoster(file: File, atSec = 1): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    return await new Promise<Blob | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 8000);
      const done = (b: Blob | null) => {
        clearTimeout(timer);
        resolve(b);
      };
      video.onerror = () => done(null);
      video.onloadeddata = () => {
        const d = Number.isFinite(video.duration) ? video.duration : atSec * 2;
        video.currentTime = Math.min(atSec, d / 2);
      };
      video.onseeked = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return done(null);
        const scale = Math.min(1, 1280 / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => done(b), "image/jpeg", 0.85);
      };
    });
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
