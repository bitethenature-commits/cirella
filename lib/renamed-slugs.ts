/**
 * Las direcciones que pasaron del español al inglés (2026-11). Las usa el cambio de la base de datos
 * (scripts/english-slugs.ts) y, para que los enlaces de antes sigan funcionando (Instagram, emails ya enviados…),
 * la ficha del producto y la página extra: si no hay nada con la dirección de antes, llevan a la nueva.
 * Funciones puras.
 */

const PRODUCTS: Record<string, string> = {
  "curso-conocete-tu-energia": "know-your-energy",
  "mini-curso-tu-carta-en-3-pasos": "natal-chart-in-3-steps",
  "gene-keys-secuencia-de-activacion": "gene-keys-activation",
  "tu-carta-y-tu-energia": "chart-and-energy",
  "human-design-desde-cero": "human-design-basics",
  "tu-diseno-y-tus-llaves": "design-and-keys",
  "especial-tu-ano-lunar": "lunar-year",
  "lectura-de-tu-ano": "year-reading",
  "lectura-astrologia": "astrology",
  "luna-completa": "full-moon",
  "lectura-human-design": "human-design-reading",
  "lectura-de-human-design": "human-design-reading",
  "revolucion-solar": "solar-return",
  "sesion-1-1": "one-on-one",
  "esencia": "essence",
  "plena": "full",
  "guia-bio-instagram": "instagram-bio-guide",
  "meditacion-dormir": "sleep-meditation",
  "programa-respira-21": "breathe-21",
  "yoga-terapeutico": "therapeutic-yoga",
  "workbook-mensaje": "message-workbook",
};

const PAGES: Record<string, string> = {
  "sobre-mi": "aboutme",
  "astrologia": "astrology",
  "metodo-gene-keys": "gene-keys",
  "mi-energia": "energy",
  "luna": "moon",
  "preguntas-frecuentes": "faq",
};

const POSTS: Record<string, string> = {
  "eclipse-de-octubre": "october-eclipse",
  "luna-llena-que-soltar": "full-moon-letting-go",
  "nueva-lectura-de-gene-keys": "new-gene-keys-reading",
  "nuevo-circulo-lunar": "moon-circle-open",
};

/** El nombre nuevo de un producto (los de la demo y los que se crean solos: «nuevo-curso-3», «circulo-luna-nueva-<fecha>»…); null si no cambió. */
export function renamedProductSlug(old: string): string | null {
  if (PRODUCTS[old]) return PRODUCTS[old];
  const auto: [RegExp, string][] = [
    [/^nuevo-curso(-\d+)?$/, "new-course"],
    [/^nueva-sesion(-\d+)?$/, "new-session"],
    [/^nueva-membresia(-\d+)?$/, "new-membership"],
    [/^nueva-lectura(-\d+)?$/, "new-reading"],
    [/^nuevo-producto-digital(-\d+)?$/, "new-product"],
    [/^nuevo-taller-en-directo(-\d+)?$/, "new-live-workshop"],
    [/^nuevo-circulo-de-la-luna(-\d+)?$/, "new-circle"],
  ];
  for (const [re, base] of auto) {
    const m = re.exec(old);
    if (m) return `${base}${m[1] ?? ""}`;
  }
  const moon = /^circulo-luna-(nueva|llena)-(\d{4}-\d{2}-\d{2})$/.exec(old);
  if (moon) return `${moon[1] === "nueva" ? "new-moon" : "full-moon"}-${moon[2]}`;
  return null;
}

/** El nombre nuevo de una página extra; null si no cambió. */
export function renamedPageSlug(old: string): string | null {
  return PAGES[old] ?? null;
}

/** El nombre nuevo de una publicación; null si no cambió. */
export function renamedPostSlug(old: string): string | null {
  return POSTS[old] ?? null;
}
