"use client";
import { useEffect } from "react";
import { ErrorView } from "@/components/error-view";
import { globalErrorTitle, isPersonalModeInBrowser } from "@/lib/site-brand-client";
import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * Último recurso: falla el layout raíz. Sustituye a toda la página, así que pinta su propio <html>.
 * Sin datos del servidor: en la web personal, título neutro y sin el símbolo de la plataforma.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const personal = isPersonalModeInBrowser();
  return (
    <html lang="es" className={fontVariables}>
      <body>
        <ErrorView
          dark
          title={globalErrorTitle(personal)}
          text="Estamos teniendo un problema técnico. Inténtalo de nuevo en unos minutos."
          digest={error.digest}
          onRetry={reset}
          homeHref="/"
          homeLabel="Ir al inicio"
          mark={personal ? null : undefined}
        />
      </body>
    </html>
  );
}
