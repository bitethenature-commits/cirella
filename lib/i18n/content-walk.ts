/**
 * Recorrer los textos que ella escribe dentro de un JSON (la portada, una página del Canva…): para recogerlos y
 * traducirlos (lib/i18n/content.ts) y para cambiarlos por los de cada idioma al enseñar la web. Las dos cosas usan
 * las mismas reglas, así nunca se cambia algo que no se recogió. Puro y seguro en el navegador.
 *
 * Solo cuenta lo que es texto para leer: nada de enlaces, fotos, colores, identificadores ni diseño.
 */

/** Campos que nunca son texto para leer (o que van aparte). */
const SKIP_EXACT = new Set([
  "id",
  "key",
  "kind",
  "type",
  "variant",
  "layout",
  "align",
  "style",
  "template",
  "mode",
  "target",
  "anchor",
  "code",
  "mime",
  "format",
  "author",
  "displayName",
  "theme",
  "pageThemes",
  "pieces",
  "sectionThemes",
  "designs",
  "design",
  "look",
  "socials",
  "socialOrder",
  "video",
  "audio",
  "embed",
  "media",
  "upload",
  "stage",
  "model",
  "deck",
  "figure",
  "codec",
  "at",
]);
const SKIP_END = ["url", "urls", "image", "images", "color", "colour", "font", "icon", "emoji", "href", "src", "poster", "frame", "look", "slug", "email", "size", "side", "id", "ids"];

export function skipKey(key: string): boolean {
  if (SKIP_EXACT.has(key)) return true;
  const k = key.toLowerCase();
  return SKIP_END.some((end) => k.endsWith(end));
}

/** ¿Es un texto para leer? (no un enlace, un color, un número ni una palabra técnica en minúsculas). */
export function isHumanText(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 20000) return false;
  if (!/\p{L}/u.test(t)) return false;
  if (/^(https?:|www\.|\/|#|mailto:|tel:)/i.test(t)) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  if (/^[a-z0-9_.:-]+$/.test(t)) return false;
  return true;
}

type Skip = (key: string) => boolean;

/** Cada texto para leer de un JSON (en orden, con repetidos). */
export function walkTexts(value: unknown, visit: (s: string) => void, skip: Skip = skipKey): void {
  const go = (v: unknown, key?: string) => {
    if (key !== undefined && skip(key)) return;
    if (typeof v === "string") {
      if (isHumanText(v)) visit(v.trim());
    } else if (Array.isArray(v)) {
      for (const x of v) go(x);
    } else if (v && typeof v === "object" && !(v instanceof Date)) {
      for (const [k, x] of Object.entries(v)) go(x, k);
    }
  };
  go(value);
}

/** El mismo JSON con cada texto para leer cambiado (por su traducción). Lo demás, igual. */
export function mapTexts<T>(value: T, tx: (s: string) => string, skip: Skip = skipKey): T {
  const go = (v: unknown, key?: string): unknown => {
    if (key !== undefined && skip(key)) return v;
    if (typeof v === "string") return isHumanText(v) ? tx(v) : v;
    if (Array.isArray(v)) return v.map((x) => go(x));
    if (v && typeof v === "object" && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, go(x, k)]));
    return v;
  };
  return go(value) as T;
}

/** Un texto suelto (un título, una descripción…): traducido si es texto para leer. */
export function txField<T extends string | null | undefined>(s: T, tx: (s: string) => string): T {
  return (typeof s === "string" && isHumanText(s) ? tx(s) : s) as T;
}
