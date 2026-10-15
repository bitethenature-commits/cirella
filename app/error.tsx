"use client";
import { ErrorView, useErrorRetry } from "@/components/error-view";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const onRetry = useErrorRetry(error, reset);
  return (
    <ErrorView
      title="Algo no ha ido bien"
      text="Ha ocurrido un error inesperado. Lo hemos registrado para revisarlo. Prueba de nuevo en unos segundos."
      digest={error.digest}
      onRetry={onRetry}
      homeHref="/"
      homeLabel="Volver al inicio"
    />
  );
}
