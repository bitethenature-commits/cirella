"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { makeT, tr, type TrVars } from "./dict";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** El idioma de la página para los componentes del navegador (lo pone app/layout.tsx). */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** Traducir en el navegador: `const t = useT(); t("Ver más")`. */
export function useT() {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}

/**
 * Un texto fijo traducido, para usar dentro de cualquier componente (también los del servidor, que no tienen
 * hooks): `<Tr s="Escríbeme" />` o `<Tr s="Pago en {host}" vars={{ host }} />`. Fuera de la web (el Canva, el
 * panel) sale en español mientras el panel no tenga idiomas.
 */
export function Tr({ s, vars }: { s: string | null | undefined; vars?: TrVars }) {
  const locale = useLocale();
  return <>{s ? tr(locale, s, vars) : s}</>;
}
