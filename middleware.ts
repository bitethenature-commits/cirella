import { NextResponse, type NextRequest } from "next/server";
import { ownerRootRedirect, personalOwnerFromEnv } from "@/lib/personal-routing";

/**
 * Solo actúa en modo personal (SITE_MODE=personal): /<dueña> → «/», que es donde vive su página.
 * Va en el middleware (antes de la caché de páginas) para que nunca se sirva una copia cacheada
 * de /<dueña>. Redirección temporal (307): si un día la web vuelve a ser plataforma, el enlace
 * antiguo sigue funcionando. En modo plataforma no hace nada.
 */
export function middleware(req: NextRequest) {
  const to = ownerRootRedirect(req.nextUrl.pathname, personalOwnerFromEnv(process.env.SITE_MODE, process.env.OWNER_USERNAME));
  if (!to) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = to;
  return NextResponse.redirect(url);
}

// Solo rutas de un segmento (/ana, /panel…): el resto ni pasa por aquí.
export const config = { matcher: ["/:username"] };
