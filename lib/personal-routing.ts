/**
 * Rutas del modo personal (SITE_MODE=personal), en funciones puras para el middleware y las pruebas.
 *
 * El middleware no importa lib/site-mode.ts (que arrastra la configuración y React): lee
 * process.env y decide aquí. La regla del modo es la misma que resolveSiteMode: «personal» solo si
 * se pide expresamente; cualquier otro valor es la plataforma.
 */
import { normalizeUsername } from "./slug";

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

/** ¿Este usuario puede tener página pública en esta web? En modo personal, solo la dueña. */
export function isPublicUsernameAllowed(username: string, owner: string | null): boolean {
  if (!owner) return true;
  let u = username;
  try {
    u = decodeURIComponent(username);
  } catch {}
  return normalizeUsername(u) === owner;
}
