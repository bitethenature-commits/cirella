/**
 * Rutas del modo personal (SITE_MODE=personal), en funciones puras para el middleware y las pruebas.
 *
 * El middleware no importa lib/site-mode.ts (que arrastra la configuración y React): lee
 * process.env y decide aquí. La regla del modo es la misma que resolveSiteMode: «personal» solo si
 * se pide expresamente; cualquier otro valor es la plataforma.
 */
import { PRODUCT_SECTIONS } from "./public-paths";
import { FOLD_SEGMENT, isSectionSegment, LEGACY_SECTION_PATH } from "./site-sections";
import { normalizeUsername, RESERVED_USERNAMES, SITE_PAGE_SLUG_RE, USERNAME_RE } from "./slug";

/**
 * La dirección que pidió el navegador, para las páginas a las que se llega por un rewrite (la del producto la usa
 * para llevar a su sección: app/[username]/[slug]/page.tsx). Sin ella, se llegó directamente a la ruta interna.
 */
export const SITE_PATH_HEADER = "x-site-path";

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

/** Los tramos de una ruta, ya decodificados; null si alguno está mal escrito. */
function segmentsOf(pathname: string): string[] | null {
  try {
    return pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
}

/** Lo que hay después del producto: pagar o pedir (una sesión o una lectura). */
const PRODUCT_SUBPAGES = new Set(["checkout", "request"]);
/** Páginas de la dueña en la raíz además de las de la portada. */
const OWNER_ROOT_PAGES = new Set(["legal", "thanks"]);

/**
 * En modo personal todo vive en la raíz, sin el usuario de la dueña (un rewrite: la dirección no cambia; el
 * destino siempre es de la dueña, nunca de otra usuaria):
 *   · /news, /courses, /1on1… (lib/site-sections.ts), /legal y /thanks → /<dueña>/<lo mismo>
 *   · /news/<publicación> → /<dueña>/news/<publicación>
 *   · /courses/<curso>, /sessions/<sesión>, /membership/<nivel>, /readings/<lectura> (lib/public-paths.ts), con
 *     /checkout o /request detrás → /<dueña>/<producto>[/…]. Si el tipo no es el de la sección, el producto
 *     lleva a la suya (app/[username]/[slug]/page.tsx).
 *   · /area/login → /<dueña>/login (entrar al área de alumna con la marca de la web)
 *   · /aboutme → /<dueña>/p/aboutme: las páginas extra. Solo un tramo con forma de dirección de página
 *     (SITE_PAGE_SLUG_RE) que no sea una ruta de la web (RESERVED_USERNAMES) ni la dueña; si no hay página
 *     publicada con esa dirección, la ruta responde 404.
 * null = no hay que reescribir.
 */
export function ownerPageRewrite(pathname: string, owner: string | null): string | null {
  if (!owner) return null;
  const segments = segmentsOf(pathname);
  if (!segments?.length) return null;
  const [first, second, third] = segments;
  if (segments.length === 1 && (isSectionSegment(first) || OWNER_ROOT_PAGES.has(first))) return `/${owner}/${first}`;
  if (segments.length === 2 && (first === "news" || first === "portal" || first === "gifts") && SITE_PAGE_SLUG_RE.test(second)) return `/${owner}/${first}/${second}`;
  if (segments.length === 2 && first === "area" && second === "login") return `/${owner}/login`;
  if (PRODUCT_SECTIONS.includes(first) && SITE_PAGE_SLUG_RE.test(second ?? "")) {
    if (segments.length === 2) return `/${owner}/${second}`;
    if (segments.length === 3 && PRODUCT_SUBPAGES.has(third)) return `/${owner}/${second}/${third}`;
    return null;
  }
  if (segments.length !== 1 || !/^\/[^/]+\/?$/.test(pathname)) return null;
  if (!SITE_PAGE_SLUG_RE.test(first) || RESERVED_USERNAMES.has(first) || first === owner) return null;
  return `/${owner}/p/${first}`;
}

/**
 * Direcciones de antes (en español, o con el usuario de la dueña delante en la web personal): llevan para siempre
 * (308) a la nueva, en inglés. En la web personal:
 *   · /cursos, /comunidad, /actualidades, /novedades… → /courses, /membership, /news…  (y /actualidades/<x> → /news/<x>)
 *   · /<dueña>/<página> → /<página>; /<dueña>/entrar → /area/login; /<dueña>/p/<página> → /<página>
 * En la plataforma, lo mismo detrás de /<usuaria>: /<usuaria>/cursos → /<usuaria>/courses,
 * /<usuaria>/entrar → /<usuaria>/login, /<usuaria>/<producto>/solicitar → /<usuaria>/<producto>/request.
 * Los productos de la dueña (/<dueña>/<producto>) los lleva a su sección la página del producto (sabe su tipo).
 * null = no hay que redirigir.
 */
export function legacyRedirect(pathname: string, owner: string | null): string | null {
  const segments = segmentsOf(pathname);
  if (!segments?.length) return null;
  const [first, second, third] = segments;
  if (owner) {
    // Actualidades, Portal, Ofertas y Gifts no tienen página: viven en su desplegable de la portada.
    if (segments.length === 1 && FOLD_SEGMENT[first]) return `/#${FOLD_SEGMENT[first]}`;
    if (segments.length === 1 && LEGACY_SECTION_PATH[first]) return `/${LEGACY_SECTION_PATH[first]}`;
    if (segments.length === 2 && (first === "actualidades" || first === "novedades") && SITE_PAGE_SLUG_RE.test(second)) return `/news/${second}`;
  }
  const user = normalizeUsername(first);
  if (segments.length < 2 || !USERNAME_RE.test(user) || RESERVED_USERNAMES.has(user)) return null;
  // Web personal: la dueña sin su usuario delante.
  if (owner && user === owner) {
    if (segments.length === 2 && FOLD_SEGMENT[second]) return `/#${FOLD_SEGMENT[second]}`;
    if (segments.length === 2 && (isSectionSegment(second) || OWNER_ROOT_PAGES.has(second))) return `/${second}`;
    if (segments.length === 3 && (second === "portal" || second === "gifts") && SITE_PAGE_SLUG_RE.test(third)) return `/${second}/${third}`;
    if (segments.length <= 3 && LEGACY_SECTION_PATH[second]) {
      const en = LEGACY_SECTION_PATH[second];
      if (segments.length === 2) return `/${en}`;
      return en === "news" && SITE_PAGE_SLUG_RE.test(third) ? `/news/${third}` : null;
    }
    if (segments.length === 3 && second === "news" && SITE_PAGE_SLUG_RE.test(third)) return `/news/${third}`;
    if (segments.length === 2 && (second === "entrar" || second === "login")) return "/area/login";
    if (segments.length === 2 && second === "gracias") return "/thanks";
    if (segments.length === 3 && second === "p" && SITE_PAGE_SLUG_RE.test(third)) return `/${third}`;
    return null;
  }
  // Plataforma (y otras usuarias en la web personal, que luego dan 404): solo cambia la palabra.
  if (segments.length === 2 && FOLD_SEGMENT[second]) return `/${first}#${FOLD_SEGMENT[second]}`;
  if (segments.length <= 3 && LEGACY_SECTION_PATH[second]) {
    const en = LEGACY_SECTION_PATH[second];
    if (segments.length === 2) return `/${first}/${en}`;
    return en === "news" && SITE_PAGE_SLUG_RE.test(third) ? `/${first}/news/${third}` : null;
  }
  if (segments.length === 2 && second === "entrar") return `/${first}/login`;
  if (segments.length === 2 && second === "gracias") return `/${first}/thanks`;
  if (segments.length === 3 && third === "solicitar" && SITE_PAGE_SLUG_RE.test(second)) return `/${first}/${second}/request`;
  return null;
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
