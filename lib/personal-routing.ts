/**
 * Rutas del modo personal (SITE_MODE=personal), en funciones puras para el middleware y las pruebas.
 *
 * El middleware no importa lib/site-mode.ts (que arrastra la configuración y React): lee
 * process.env y decide aquí. La regla del modo es la misma que resolveSiteMode: «personal» solo si
 * se pide expresamente; cualquier otro valor es la plataforma.
 */
import { normalizeUsername, RESERVED_USERNAMES, SITE_PAGE_SLUG_RE, USERNAME_RE } from "./slug";

/** Usuario de la dueña si la web está en modo personal; null en la plataforma o si falta. */
export function personalOwnerFromEnv(siteMode: string | undefined, ownerUsername: string | undefined): string | null {
  if (siteMode?.trim() !== "personal") return null;
  return normalizeUsername(ownerUsername ?? "") || null;
}

/**
 * En modo personal la página de la dueña vive en la raíz: /<dueña> (con o sin mayúsculas, con o sin
 * barra final) redirige a «/» conservando la query (?utm_source=instagram…). Sus productos, su
 * página legal y sus imágenes (/<dueña>/<algo>) siguen donde estaban. null = no hay que redirigir.
 */
export function ownerRootRedirect(pathname: string, owner: string | null): string | null {
  if (!owner) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  let first: string;
  try {
    first = decodeURIComponent(segments[0]);
  } catch {
    return null;
  }
  return normalizeUsername(first) === owner ? "/" : null;
}

/**
 * En modo personal, las páginas extra de la dueña viven en la raíz: /sobre-mi → /<dueña>/p/sobre-mi
 * (un rewrite: la dirección no cambia). Solo un tramo (con o sin barra final) con forma de dirección
 * de página (SITE_PAGE_SLUG_RE: minúsculas, sin puntos ni guiones bajos), que no sea una ruta de la
 * web (RESERVED_USERNAMES) ni la dueña. El destino siempre es de la dueña: nunca sirve datos de otra
 * usuaria, y si no hay página publicada con esa dirección, la ruta responde 404 como antes.
 * null = no hay que reescribir.
 */
export function ownerPageRewrite(pathname: string, owner: string | null): string | null {
  if (!owner) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1 || !/^\/[^/]+\/?$/.test(pathname)) return null;
  let seg: string;
  try {
    seg = decodeURIComponent(segments[0]);
  } catch {
    return null;
  }
  if (!SITE_PAGE_SLUG_RE.test(seg) || RESERVED_USERNAMES.has(seg) || seg === owner) return null;
  return `/${owner}/p/${seg}`;
}

/**
 * En modo personal, ¿la ruta es la página (o un producto, la página legal, la imagen…) de otra
 * usuaria? Su primer tramo tiene forma de usuario, no es una ruta de la web (RESERVED_USERNAMES) ni
 * la dueña. El middleware la responde con un 404 antes de la caché de páginas: así nunca se sirve
 * una copia cacheada de cuando la web era plataforma (o de otro servidor con la misma compilación).
 */
export function isForeignCreatorPath(pathname: string, owner: string | null): boolean {
  if (!owner) return false;
  const first = pathname.split("/").filter(Boolean)[0];
  if (!first) return false;
  let seg: string;
  try {
    seg = normalizeUsername(decodeURIComponent(first));
  } catch {
    return false;
  }
  return seg !== owner && !RESERVED_USERNAMES.has(seg) && USERNAME_RE.test(seg);
}

/** ¿Este usuario puede tener página pública en esta web? En modo personal, solo la dueña. */
export function isPublicUsernameAllowed(username: string, owner: string | null): boolean {
  if (!owner) return true;
  let u = username;
  try {
    u = decodeURIComponent(username);
  } catch {}
  return normalizeUsername(u) === owner;
}
