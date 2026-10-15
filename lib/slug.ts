// Rutas de la plataforma que no pueden usarse como nombre de usuario.
export const RESERVED_USERNAMES = new Set([
  "admin", "api", "panel", "cuenta", "entrar", "registro", "salir", "onboarding",
  "auth", "dev", "media", "checkout", "precios", "ayuda", "soporte", "legal",
  "terminos", "privacidad", "blog", "app", "www", "static", "public", "assets",
  "demo", "explorar", "login", "signup", "settings", "dashboard", "_next",
  "favicon.ico", "robots.txt", "sitemap.xml", "cirella", "plataforma", "pedido",
  "vista-previa", "aviso-legal", "cookies", "facturas", "factura", "contrasena", "pago-simulado",
  "icon.svg", "baja", "novedades",
]);

// Segmentos que no pueden usarse como slug de producto (colisionan con rutas).
// «novedades» es la lista de publicaciones (/<usuaria>/novedades).
export const RESERVED_PRODUCT_SLUGS = new Set(["gracias", "checkout", "opengraph-image", "icon", "cuenta", "entrar", "legal", "novedades"]);

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return "Mínimo 3 caracteres";
  if (username.length > 30) return "Máximo 30 caracteres";
  if (!USERNAME_RE.test(username)) return "Solo letras minúsculas, números, puntos, guiones y guiones bajos";
  if (RESERVED_USERNAMES.has(username)) return "Este nombre está reservado";
  return null;
}

export function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
