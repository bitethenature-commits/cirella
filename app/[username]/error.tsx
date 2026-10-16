"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCreatorBranding, usePersonalMode, useSignupsOnly } from "@/components/creator-page/branding-context";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { ErrorView, useErrorRetry } from "@/components/error-view";

const AFTER_PAYMENT = "Si acababas de pagar, tu compra está a salvo: en unos minutos recibirás un email con tu acceso.";

/** Error en la página pública de una creadora (ficha, checkout, confirmación): con su plantilla. */
export default function CreatorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const branding = useCreatorBranding();
  const personal = usePersonalMode();
  const signupsOnly = useSignupsOnly();
  const pathname = usePathname();
  const params = useParams<{ username: string }>();
  const onRetry = useErrorRetry(error, reset);
  const afterPayment = /\/(checkout|gracias)(\/|$)/.test(pathname ?? "");

  if (!branding)
    return (
      <ErrorView
        dark
        title="Algo ha fallado al cargar esta página"
        text="No es culpa tuya. Vuelve a intentarlo en unos segundos."
        extra={afterPayment ? AFTER_PAYMENT : undefined}
        digest={error.digest}
        onRetry={onRetry}
        homeHref={personal ? "/" : `/${params.username ?? ""}`}
        homeLabel="Volver"
      />
    );

  const { username, config, allowCustom } = branding;
  return (
    <CreatorShell username={username} config={config} allowCustom={allowCustom} back={false} personal={personal} signupsOnly={signupsOnly}>
      <main className="relative mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="cp-display text-3xl">Vaya, algo ha fallado al cargar esta página</h1>
        <p className="cp-muted mt-3">No es culpa tuya. Vuelve a intentarlo en unos segundos.</p>
        {afterPayment && <p className="cp-muted mt-3">{AFTER_PAYMENT}</p>}
        <button type="button" className="cp-btn mt-8" onClick={onRetry}>
          Reintentar
        </button>
        <Link href={personal ? "/" : `/${username}`} className="mt-4 block text-sm underline">
          Volver a la página de {config.displayName}
        </Link>
        {error.digest && <p className="cp-muted mt-8 text-xs">Código del error: {error.digest}</p>}
      </main>
    </CreatorShell>
  );
}
