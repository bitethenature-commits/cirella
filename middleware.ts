import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER, localePath, PANEL_DEFAULT_LOCALE, PANEL_LOCALE_COOKIE, splitLocale } from "@/lib/i18n/config";
import { isForeignCreatorPath, legacyRedirect, ownerPageRewrite, ownerRootRedirect, personalOwnerFromEnv, SITE_PATH_HEADER } from "@/lib/personal-routing";

/** Usuario que no existe en ninguna web (no tiene forma de usuario): su página siempre es un 404. */
const NOT_FOUND_PATH = "/_no-existe";

/**
 * Va en el middleware (antes de la caché de páginas) para que nunca se sirva una copia cacheada:
 *   · Direcciones de antes (en español o con el usuario de la dueña delante) → la nueva, en inglés (308):
 *     lib/personal-routing.ts → legacyRedirect. También en la plataforma (/<usuaria>/cursos → /<usuaria>/courses).
 * Solo en modo personal (SITE_MODE=personal):
 *   · /<dueña> → «/», que es donde vive su página. Redirección temporal (307): si un día la web
 *     vuelve a ser plataforma, el enlace antiguo sigue funcionando.
 *   · /aboutme, /courses, /courses/<curso>, /area/login… → la ruta interna de la dueña, sin cambiar la dirección
 *     (ownerPageRewrite). Si no hay nada publicado con esa dirección, es el mismo 404 que antes.
 *   · /<otra usuaria>/… → 404 (la página de «no encontrado» de la web).
 */
/** Una página que se abre (no un archivo, una foto subida ni un envío): las que siguen el idioma elegido. */
function isPagePath(path: string) {
  if (/^\/(media|demo|uploads)\//.test(path)) return false;
  return !/\.[a-z0-9]{2,5}$/i.test(path);
}

/** El panel y lo de la dueña: en el idioma que elige en el panel (su propia cookie), no en el de la web. */
const isOwnerTool = (path: string) => /^\/(panel|admin|onboarding|vista-previa)(\/|$)/.test(path);

export function middleware(req: NextRequest) {
  const owner = personalOwnerFromEnv(process.env.SITE_MODE, process.env.OWNER_USERNAME);
  // Idiomas (lib/i18n/config.ts): /en/… y /es/… son la misma página en inglés o en español; sin nada, alemán.
  const { locale: prefixed, path } = splitLocale(req.nextUrl.pathname);
  const chosen = req.cookies.get(LOCALE_COOKIE)?.value;
  // Sin idioma delante pero con otro elegido antes: a la misma página en su idioma.
  if (!prefixed && isLocale(chosen) && chosen !== DEFAULT_LOCALE && req.method === "GET" && isPagePath(path) && !isOwnerTool(path)) {
    const to = req.nextUrl.clone();
    to.pathname = localePath(path, chosen);
    return NextResponse.redirect(to, 307);
  }
  const panelChosen = req.cookies.get(PANEL_LOCALE_COOKIE)?.value;
  const locale = prefixed ?? (isOwnerTool(path) ? (isLocale(panelChosen) ? panelChosen : PANEL_DEFAULT_LOCALE) : DEFAULT_LOCALE);
  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, locale);
  // Recuerda el idioma de la dirección (así los enlaces sin idioma delante siguen en él).
  const remember = (res: NextResponse) => {
    if (prefixed && chosen !== prefixed) res.cookies.set(LOCALE_COOKIE, prefixed, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  };
  const redirectTo = (target: string, status?: number) => {
    const to = req.nextUrl.clone();
    // Puede llevar el ancla de un desplegable de la portada («/#portal»).
    const [p, hash] = target.split("#");
    to.pathname = localePath(p, locale);
    if (hash) to.hash = hash;
    return remember(NextResponse.redirect(to, status));
  };

  const legacy = legacyRedirect(path, owner);
  if (legacy) return redirectTo(legacy, 308);
  const url = req.nextUrl.clone();
  const pass = () => {
    if (!prefixed) return remember(NextResponse.next({ request: { headers } }));
    url.pathname = path;
    return remember(NextResponse.rewrite(url, { request: { headers } }));
  };
  if (!owner) return pass();
  const page = ownerPageRewrite(path, owner);
  if (page) {
    // Conserva la query (?utm_source=instagram…) y cuenta a la página por qué dirección se llegó.
    url.pathname = page;
    headers.set(SITE_PATH_HEADER, path);
    return remember(NextResponse.rewrite(url, { request: { headers } }));
  }
  if (isForeignCreatorPath(path, owner)) {
    url.pathname = NOT_FOUND_PATH;
    url.search = "";
    return remember(NextResponse.rewrite(url, { request: { headers } }));
  }
  const to = ownerRootRedirect(path, owner);
  if (!to) return pass();
  return redirectTo(to);
}

// Todo menos los archivos internos de Next y /api: las rutas de /api no son páginas de nadie y, si
// pasaran por el middleware, Next cortaría su cuerpo a 10 MB (las subidas al disco local y sus partes).
export const config = { matcher: ["/((?!_next/|api/).*)"] };
