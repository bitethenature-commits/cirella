import "server-only";
import { appUrl } from "@/lib/env";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { getPublicCreator } from "@/lib/public";
import { ownerUsername } from "@/lib/site-mode";

/**
 * Datos comunes de /<usuaria>/novedades y de cada publicación: la creadora publicada (en modo
 * personal, solo la dueña; el layout también lo comprueba, pero la página se pinta a la vez) y las
 * direcciones de su página. null = 404.
 */
export async function novedadesData(username: string) {
  if (!isPublicUsernameAllowed(username, ownerUsername())) return null;
  const data = await getPublicCreator(username);
  if (!data?.creator.published) return null;
  const u = data.creator.username;
  return {
    ...data,
    /** Portada de la creadora: la raíz en la web personal. */
    homeHref: data.personal ? "/" : `/${u}`,
    listHref: `/${u}/novedades`,
    listUrl: `${appUrl()}/${u}/novedades`,
    /** Imagen para redes de la página de la creadora (la de una publicación sin foto). */
    ogImageUrl: `${appUrl()}/${u}/opengraph-image`,
    /** Nombre del sitio en las tarjetas de redes. */
    siteName: data.personal ? data.config.displayName : data.platformName,
  };
}
