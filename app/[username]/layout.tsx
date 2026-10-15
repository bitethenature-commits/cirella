import { CreatorBrandingProvider, type CreatorBranding } from "@/components/creator-page/branding-context";
import { getPublicCreator } from "@/lib/public";

/**
 * Pasa la identidad visual de la creadora a las páginas de error y de «no encontrado» de su
 * segmento, para que una compradora nunca caiga en una página genérica a mitad de compra.
 * getPublicCreator está envuelto en cache(): la página no repite la consulta. No lee cookies,
 * para no romper la página cacheada.
 */
export default async function CreatorLayout({ children, params }: { children: React.ReactNode; params: Promise<{ username: string }> }) {
  const { username } = await params;
  let branding: CreatorBranding = null;
  try {
    const d = await getPublicCreator(username);
    if (d?.creator.published)
      branding = {
        username: d.creator.username,
        config: { displayName: d.config.displayName, avatarUrl: d.config.avatarUrl, template: d.config.template, theme: d.config.theme },
        allowCustom: d.allowCustom,
      };
  } catch {
    // error.tsx no captura los errores del layout de su propio segmento: sin marca, la página
    // (o su error.tsx) sigue funcionando con el aspecto genérico.
  }
  return <CreatorBrandingProvider value={branding}>{children}</CreatorBrandingProvider>;
}
