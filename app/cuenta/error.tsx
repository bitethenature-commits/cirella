"use client";
import { ErrorView, useErrorRetry } from "@/components/error-view";

/** Error dentro de la sección: se mantiene la navegación del layout. */
export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const onRetry = useErrorRetry(error, reset);
  return (
    <ErrorView
      fullScreen={false}
      title="No hemos podido cargar esta sección"
      text="Tus datos están a salvo. Vuelve a intentarlo en unos segundos."
      digest={error.digest}
      onRetry={onRetry}
      homeHref="/cuenta"
      homeLabel="Volver a mi cuenta"
    />
  );
}
