"use client";
import { ErrorView, useErrorRetry } from "@/components/error-view";
import { useT } from "@/lib/i18n/client";

/** Error dentro de la sección: se mantiene la navegación del layout. */
export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  const onRetry = useErrorRetry(error, reset);
  return (
    <ErrorView
      fullScreen={false}
      title={t("No hemos podido cargar esta sección")}
      text={t("Tus datos están a salvo. Vuelve a intentarlo en unos segundos.")}
      digest={error.digest}
      onRetry={onRetry}
      homeHref="/area"
      homeLabel="Volver a mi cuenta"
    />
  );
}
