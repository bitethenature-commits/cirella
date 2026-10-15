"use client";
import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { SiteMark } from "@/components/site-brand-context";

/**
 * Pantalla de error genérica (solo presentación). La usan los error.tsx de la app:
 * siempre ofrece reintentar y una salida, y muestra el código del error para soporte. El símbolo es
 * el de la marca del sitio (en modo personal, el de la dueña) salvo que se pase `mark` (null = ninguno).
 */
export function ErrorView({
  title,
  text,
  extra,
  digest,
  onRetry,
  homeHref,
  homeLabel,
  dark = false,
  fullScreen = true,
  mark,
}: {
  title: string;
  text: string;
  extra?: React.ReactNode;
  digest?: string;
  onRetry: () => void;
  homeHref: string;
  homeLabel: string;
  dark?: boolean;
  /** false dentro de un layout con navegación (panel, cuenta): no ocupa toda la pantalla. */
  fullScreen?: boolean;
  mark?: React.ReactNode;
}) {
  const Root = fullScreen ? "main" : "div";
  return (
    <Root
      className={`flex flex-col items-center justify-center px-6 text-center ${fullScreen ? "min-h-dvh" : "py-20"} ${
        dark ? "bg-ink text-cream" : fullScreen ? "bg-paper" : ""
      }`}
    >
      {mark === undefined ? <SiteMark className="h-10 w-10" dark={dark} /> : mark}
      <h1 className="display mt-6 text-balance text-3xl sm:text-4xl">{title}</h1>
      <p className={`mt-3 max-w-sm text-sm ${dark ? "text-cream/70" : "text-muted"}`}>{text}</p>
      {extra && <div className={`mt-3 max-w-sm text-sm ${dark ? "text-cream/70" : "text-muted"}`}>{extra}</div>}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <button type="button" onClick={onRetry} className={`btn ${dark ? "btn-light" : "btn-primary"}`}>
          <RotateCw className="h-4 w-4" /> Reintentar
        </button>
        <Link href={homeHref} className={dark ? "btn text-cream/80 hover:text-cream" : "btn btn-outline"}>
          {homeLabel}
        </Link>
      </div>
      {digest && <p className={`mt-6 text-xs ${dark ? "text-cream/50" : "text-muted"}`}>Código del error: {digest}</p>}
    </Root>
  );
}

/**
 * Comportamiento común de los error.tsx: registra el error en la consola del navegador (los de
 * servidor ya llegan a Sentry por onRequestError) y devuelve la acción «Reintentar», que vuelve
 * a pedir los datos al servidor y a pintar el segmento.
 */
export function useErrorRetry(error: Error, reset: () => void) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
}
