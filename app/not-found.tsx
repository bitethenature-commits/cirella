import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { LogoMark } from "@/components/logo";
import { ownerUsername } from "@/lib/site-mode";
import { Tr } from "@/lib/i18n/client";

/**
 * 404 general. Con la marca del sitio: en modo personal, la foto de la dueña (lib/site-brand.ts).
 * Sin connection(): Next pinta este componente dentro de cada página (es el límite de «no
 * encontrado» de la raíz), y una API dinámica aquí rompería las páginas cacheadas (ISR). Los 404
 * de rutas que se pintan al pedirlas (p. ej. otra /<usuaria> en modo personal) leen el modo en ese momento.
 */
export default async function NotFound() {
  let mark: React.ReactNode;
  try {
    mark = await BrandMark({ className: "h-10 w-10" });
  } catch {
    // Sin BD (p. ej. al compilar en Railway, donde el build no llega a la base de datos): en la web
    // personal, el icono de la dueña (/<dueña>/icon se genera al pedirlo); si no, el de la plataforma.
    // /api/cron lo vuelve a generar con su marca tras cada despliegue.
    const owner = ownerUsername();
    // eslint-disable-next-line @next/next/no-img-element
    mark = owner ? <img src={`/${owner}/icon`} alt="" className="h-10 w-10 rounded-full" /> : <LogoMark className="h-10 w-10" />;
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      {mark}
      <h1 className="display mt-6 text-4xl"><Tr s={"No encontramos esta página"} /></h1>
      <p className="mt-3 max-w-sm text-sm text-muted"><Tr s={"Puede que el enlace esté mal escrito o que ya no exista."} /></p>
      <Link href="/" className="btn btn-primary mt-8"><Tr s={"Volver al inicio"} /></Link>
    </main>
  );
}
