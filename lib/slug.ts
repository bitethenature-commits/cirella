// Rutas de la plataforma que no pueden usarse como nombre de usuario.
export const RESERVED_USERNAMES = new Set([
  "admin", "api", "panel", "cuenta", "entrar", "registro", "salir", "onboarding",
  "auth", "dev", "media", "checkout", "precios", "ayuda", "soporte", "legal",
  "terminos", "privacidad", "blog", "app", "www", "static", "public", "assets",
  "demo", "explorar", "login", "signup", "settings", "dashboard", "_next",
  "favicon.ico", "robots.txt", "sitemap.xml", "cirella", "plataforma", "pedido",
  "vista-previa", "aviso-legal", "cookies", "contrasena", "pago-simulado",
  "icon.svg", "baja", "novedades",
  // Las direcciones en inglés de la web (2026-11): área de alumna, entrar, legal, bajas, pagos de prueba…
  "area", "password", "logout", "thanks", "legal-notice", "privacy", "terms", "unsubscribe", "newsletter", "test-payment",
  // Páginas de la web de la dueña en la raíz (web personal): lib/site-sections.ts (y sus nombres de antes).
  "news", "portal", "offers", "membership", "courses", "readings", "sessions", "1on1", "gifts",
  "actualidades", "ofertas", "comunidad", "cursos", "lecturas", "sesiones", "uno-a-uno",
  // Los idiomas delante de la dirección (lib/i18n/config.ts): /en/…, /es/… (y /de por si acaso).
  "de", "en", "es",
]);

// Segmentos que no pueden usarse como slug de producto (colisionan con rutas de /<usuaria>/…).
// «news» es la lista de publicaciones (/<usuaria>/news; «actualidades» y «novedades», sus direcciones de antes,
// redirigen allí), «p», las páginas extra (/<usuaria>/p/<página>), y el resto, las páginas de la portada
// nueva (lib/site-sections.ts).
export const RESERVED_PRODUCT_SLUGS = new Set([
  "thanks", "checkout", "opengraph-image", "icon", "login", "legal", "p", "area",
  "news", "portal", "offers", "membership", "courses", "readings", "sessions", "1on1", "gifts",
  "gracias", "cuenta", "entrar", "novedades", "actualidades", "ofertas", "comunidad", "cursos", "lecturas", "sesiones", "uno-a-uno",
]);

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Dirección de una página extra (lib/site-pages.ts): minúsculas, números y guiones, sin puntos ni guiones bajos. */
export const SITE_PAGE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
}

/** Reservados por ser la marca de la plataforma, no una ruta: la web personal (sin plataforma) sí puede usarlos. */
export const BRAND_USERNAMES = new Set(["cirella", "plataforma"]);

/** `personal`: usuario de la dueña de una web personal (puede llamarse como la marca de la plataforma). */
export function validateUsername(username: string, opts: { personal?: boolean } = {}): string | null {
  if (username.length < 3) return "Mínimo 3 caracteres";
  if (username.length > 30) return "Máximo 30 caracteres";
  if (!USERNAME_RE.test(username)) return "Solo letras minúsculas, números, puntos, guiones y guiones bajos";
  if (RESERVED_USERNAMES.has(username) && !(opts.personal && BRAND_USERNAMES.has(username))) return "Este nombre está reservado";
  return null;
}

export function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
