"use client";
import { ErrorView, useErrorRetry } from "@/components/error-view";
import { useT } from "@/lib/i18n/client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  const onRetry = useErrorRetry(error, reset);
  return (
    <ErrorView
      title={t("Algo no ha ido bien")}
      text={t("Ha ocurrido un error inesperado. Lo hemos registrado para revisarlo. Prueba de nuevo en unos segundos.")}
      digest={error.digest}
      onRetry={onRetry}
      homeHref="/"
      homeLabel="Volver al inicio"
    />
  );
}
