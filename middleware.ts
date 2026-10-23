import { NextResponse, type NextRequest } from "next/server";
import { isForeignCreatorPath, ownerRootRedirect, personalOwnerFromEnv } from "@/lib/personal-routing";

/** Usuario que no existe en ninguna web (no tiene forma de usuario): su página siempre es un 404. */
const NOT_FOUND_PATH = "/_no-existe";

/**
 * Solo actúa en modo personal (SITE_MODE=personal). Va en el middleware (antes de la caché de
 * páginas) para que nunca se sirva una copia cacheada:
 *   · /<dueña> → «/», que es donde vive su página. Redirección temporal (307): si un día la web
 *     vuelve a ser plataforma, el enlace antiguo sigue funcionando.
 *   · /<otra usuaria>[/…] → 404 (la página de «no encontrado» de la web).
 * En modo plataforma no hace nada.
 */
export function middleware(req: NextRequest) {
  const owner = personalOwnerFromEnv(process.env.SITE_MODE, process.env.OWNER_USERNAME);
  if (!owner) return NextResponse.next();
  const url = req.nextUrl.clone();
  if (isForeignCreatorPath(req.nextUrl.pathname, owner)) {
    url.pathname = NOT_FOUND_PATH;
    url.search = "";
    return NextResponse.rewrite(url);
  }
  const to = ownerRootRedirect(req.nextUrl.pathname, owner);
  if (!to) return NextResponse.next();
  url.pathname = to;
  return NextResponse.redirect(url);
}

// Todo menos los archivos internos de Next y /api: las rutas de /api no son páginas de nadie y, si
// pasaran por el middleware, Next cortaría su cuerpo a 10 MB (las subidas al disco local y sus partes).
export const config = { matcher: ["/((?!_next/|api/).*)"] };
