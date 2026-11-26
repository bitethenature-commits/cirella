/**
 * La foto de cada publicación de la comunidad (a la izquierda en la tarjeta y arriba al abrirla): la portada
 * que eligió la autora; si no, la primera foto del texto; y si no hay, una según el tipo.
 */

const KIND_COVER: Record<string, string> = {
  TEXT: "/demo/hero.webp",
  PODCAST: "/demo/gene-keys.webp",
  AUDIO: "/demo/gene-keys.webp",
  MEDITACION: "/demo/comunidad.webp",
  ASTROWEATHER: "/demo/astrologia.webp",
  MASTERCLASS: "/demo/curso.webp",
  EVENT: "/demo/curso.webp",
  CEREMONIA: "/demo/sesion.webp",
  VIDEO: "/demo/human-design.webp",
  CIRCULO_LUNAR: "/demo/ana-cover.webp",
};

const BODY_IMAGE = /^!\[[^\]\n]{0,300}\]\((\/(?:media|demo)\/[^\s()]{1,300})\)[ \t]*$/m;

export function postCover(p: { kind: string; imageUrl?: string | null; body?: string | null }): { src: string; fromBody: boolean } {
  if (p.imageUrl) return { src: p.imageUrl, fromBody: false };
  const m = p.body?.match(BODY_IMAGE);
  if (m) return { src: m[1], fromBody: true };
  return { src: KIND_COVER[p.kind] ?? KIND_COVER.TEXT, fromBody: false };
}

/** El texto sin la foto que ya sale arriba como portada (para no verla dos veces). */
export function bodyWithoutCover(body: string, cover: { src: string; fromBody: boolean }) {
  if (!cover.fromBody) return body;
  return body.replace(BODY_IMAGE, "").replace(/^\s+/, "");
}
