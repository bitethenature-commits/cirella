import { themeFontsHref, type ResolvedTheme } from "@/lib/templates";

/**
 * Lo que el diseño añade a cada página pública: la hoja de Google Fonts de las letras elegidas (React la sube
 * al <head>) y la foto de fondo, con su transparencia (detrás del contenido y de los fondos con movimiento).
 */
export function DesignFonts({ theme }: { theme: ResolvedTheme }) {
  const href = themeFontsHref(theme);
  return href ? <link rel="stylesheet" href={href} precedence="default" /> : null;
}

export function DesignBackdrop({ theme, contained = false }: { theme: ResolvedTheme; contained?: boolean }) {
  return (
    <>
      <DesignFonts theme={theme} />
      {theme.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.backgroundImageUrl} alt="" aria-hidden className={`cp-bg-photo ${contained ? "absolute" : "fixed"} inset-0 h-full w-full object-cover`} />
      )}
    </>
  );
}
