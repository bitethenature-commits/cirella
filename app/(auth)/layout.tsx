import { BrandLogo } from "@/components/brand-logo";
import { getSiteBrand } from "@/lib/site-brand";

// Pantallas de cada visita (leen la sesión y la marca de la BD): nunca se generan al compilar, así
// el build no necesita la base de datos (en Railway, por ejemplo, no llega a ella durante el build).
export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = await getSiteBrand();
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex min-w-0 flex-col px-5 pb-10 pt-6 sm:px-10">
        <BrandLogo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-fade-up">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink text-cream lg:block">
        {brand.personal ? (
          // Modo personal: sin la publicidad de la plataforma ni las fotos de la demo.
          <>
            <div className="starfield absolute inset-0 opacity-60" />
            <div className="absolute inset-x-12 bottom-14">
              <p className="display text-5xl leading-[1.05]">{brand.name}</p>
              <p className="mt-4 text-sm text-cream/70">Tus cursos, tus contenidos y tus accesos, en un solo sitio.</p>
            </div>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demo/ana-cover.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="starfield absolute inset-0 opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            <div className="absolute inset-x-12 bottom-14">
              <p className="display text-5xl leading-[1.05]">«Mis seguidoras compran desde Instagram en segundos.»</p>
              <p className="mt-4 text-sm text-cream/70">Ana Luna · Astrología, Human Design y Gene Keys · cuenta de demostración</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
