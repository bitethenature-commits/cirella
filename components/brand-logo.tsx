import { Avatar } from "@/components/creator-page/product-art";
import { getSiteBrand } from "@/lib/site-brand";
import { Logo, LogoMark } from "./logo";

/**
 * Logo de las pantallas comunes con la marca del sitio (lib/site-brand.ts): en la plataforma, el
 * de siempre; en modo personal, la foto y el nombre de la página de la dueña. Solo en Server Components.
 */
export async function BrandLogo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  const brand = await getSiteBrand();
  if (!brand.personal) return <Logo href={href} light={light} name={brand.name} />;
  return <Logo href={href} light={light} name={brand.name} mark={<BrandAvatar src={brand.avatarUrl} name={brand.name} className="h-7 w-7 text-[0.6rem]" />} />;
}

/** Símbolo suelto (páginas de error): la foto de la dueña en modo personal o el de la plataforma. */
export async function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  const brand = await getSiteBrand();
  if (!brand.personal) return <LogoMark className={className} />;
  return <BrandAvatar src={brand.avatarUrl} name={brand.name} className={`${className} text-xs`} />;
}

function BrandAvatar({ src, name, className }: { src: string | null; name: string; className: string }) {
  return (
    <span className="inline-flex shrink-0" style={{ ["--c-accent" as string]: "#0E1024", ["--c-accent-text" as string]: "#F6F1E7" }}>
      <Avatar src={src} name={name} className={className} sizes="40px" />
    </span>
  );
}
