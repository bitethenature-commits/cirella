import "server-only";
import { appUrl } from "@/lib/env";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { getPublicCreator } from "@/lib/public";
import { sectionPagePath, type SectionPage } from "@/lib/site-sections";
import { ownerUsername } from "@/lib/site-mode";

/**
 * Datos comunes de las páginas de la portada (/<usuaria>/actualidades, /portal, /comunidad, /cursos,
 * /lecturas, /sesiones; en la web personal, en la raíz): la creadora publicada (en modo personal,
 * solo la dueña; el layout también lo comprueba, pero la página se pinta a la vez) y las direcciones de
 * su página. null = 404.
 */
export async function sectionPageData(username: string) {
  if (!isPublicUsernameAllowed(username, ownerUsername())) return null;
  const data = await getPublicCreator(username);
  if (!data?.creator.published) return null;
  const u = data.creator.username;
  const path = (page: SectionPage) => sectionPagePath(u, page, data.personal);
  return {
    ...data,
    /** Portada de la creadora: la raíz en la web personal. */
    homeHref: data.personal ? "/" : `/${u}`,
    path,
    url: (page: SectionPage) => `${appUrl()}${path(page)}`,
    listHref: path("actualidades"),
    listUrl: `${appUrl()}${path("actualidades")}`,
    /** Imagen para redes de la página de la creadora (la de una publicación sin foto). */
    ogImageUrl: `${appUrl()}/${u}/opengraph-image`,
    /** Nombre del sitio en las tarjetas de redes. */
    siteName: data.personal ? data.config.displayName : data.platformName,
  };
}
