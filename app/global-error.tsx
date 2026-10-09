"use client";
import { useEffect } from "react";
import { ErrorView } from "@/components/error-view";
import { fontVariables } from "./fonts";
import "./globals.css";

/** Último recurso: falla el layout raíz. Sustituye a toda la página, así que pinta su propio <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="es" className={fontVariables}>
      <body>
        <ErrorView
          dark
          title="Cirella no está disponible en este momento"
          text="Estamos teniendo un problema técnico. Inténtalo de nuevo en unos minutos."
          digest={error.digest}
          onRetry={reset}
          homeHref="/"
          homeLabel="Ir al inicio"
        />
      </body>
    </html>
  );
}
