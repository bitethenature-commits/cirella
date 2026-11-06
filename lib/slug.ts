// Rutas de la plataforma que no pueden usarse como nombre de usuario.
export const RESERVED_USERNAMES = new Set([
  "admin", "api", "panel", "cuenta", "entrar", "registro", "salir", "onboarding",
  "auth", "dev", "media", "checkout", "precios", "ayuda", "soporte", "legal",
  "terminos", "privacidad", "blog", "app", "www", "static", "public", "assets",
  "demo", "explorar", "login", "signup", "settings", "dashboard", "_next",
  "favicon.ico", "robots.txt", "sitemap.xml", "cirella", "plataforma", "pedido",
  "vista-previa", "aviso-legal", "cookies", "facturas", "factura", "contrasena", "pago-simulado",
  "icon.svg", "baja", "novedades",
  // Páginas de la web de la dueña en la raíz (web personal): lib/site-sections.ts.
  "actualidades", "portal", "comunidad", "cursos", "lecturas", "sesiones", "uno-a-uno",
]);

// Segmentos que no pueden usarse como slug de producto (colisionan con rutas).
// «actualidades» es la lista de publicaciones (/<usuaria>/actualidades; «novedades», su dirección de antes,
// redirige allí), «p», las páginas extra (/<usuaria>/p/<página>), y el resto, las páginas de la portada
// nueva (lib/site-sections.ts).
export const RESERVED_PRODUCT_SLUGS = new Set([
  "gracias", "checkout", "opengraph-image", "icon", "cuenta", "entrar", "legal", "novedades", "p",
  "actualidades", "portal", "comunidad", "cursos", "lecturas", "sesiones", "uno-a-uno",
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
