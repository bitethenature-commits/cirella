"use client";
import Link from "next/link";
import { useCreatorBranding, usePersonalMode, useSignupsOnly } from "@/components/creator-page/branding-context";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { LogoMark } from "@/components/logo";
import { SiteMark } from "@/components/site-brand-context";
import { Tr } from "@/lib/i18n/client";

/**
 * 404 dentro de /{usuaria}. Si la creadora existe (p. ej. un producto retirado), con su plantilla
 * y un enlace a su página; si no, la página neutra de Cirella (en la web personal, con la marca de la dueña).
 */
export default function CreatorNotFound() {
  const branding = useCreatorBranding();
  const personal = usePersonalMode();
  const signupsOnly = useSignupsOnly();
  if (branding) {
    const { username, config, allowCustom } = branding;
    return (
      <CreatorShell username={username} config={config} allowCustom={allowCustom} back={false} personal={personal} signupsOnly={signupsOnly}>
        <main className="relative mx-auto max-w-md px-6 py-20 text-center">
          <h1 className="cp-display text-3xl"><Tr s={"Este contenido ya no está disponible"} /></h1>
          <p className="cp-muted mt-3"><Tr s={"Puede que el enlace haya cambiado o que"} />{" "}{config.displayName}{" "}<Tr s={"lo haya retirado."} /></p>
          <Link className="cp-btn mt-8" href={personal ? "/" : `/${username}`}><Tr s={"Ver la página de"} />{" "}{config.displayName}
          </Link>
        </main>
      </CreatorShell>
    );
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-cream">
      <div>
        {personal ? <SiteMark className="h-10 w-10" dark /> : <LogoMark className="mx-auto h-10 w-10" />}
        <h1 className="display mt-6 text-4xl"><Tr s={"Esta página no existe… todavía"} /></h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-cream/70"><Tr s={"Puede que el enlace esté mal escrito o que la página ya no esté disponible."} /></p>
        {personal ? (
          <Link href="/" className="btn btn-light mt-8"><Tr s={"Volver al inicio"} /></Link>
        ) : (
          <Link href="/signup" className="btn btn-light mt-8"><Tr s={"Crea la tuya en 5 minutos"} /></Link>
        )}
      </div>
    </main>
  );
}
