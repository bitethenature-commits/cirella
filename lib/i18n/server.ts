import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { setDateLocaleSource } from "@/lib/tz";
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./config";
import { makeT } from "./dict";

/**
 * El idioma de la página que se está pintando, para las fechas (lib/tz.ts): lo apunta `getLocale` y dura lo que
 * dura la petición (fuera de una página, `cache` no guarda nada y las fechas siguen en español).
 */
const pageLocale = cache((): { value?: Locale } => ({}));
setDateLocaleSource(() => {
  try {
    const l = pageLocale().value;
    return l ? INTL_LOCALE[l] : undefined;
  } catch {
    return undefined;
  }
});

/**
 * El idioma de esta petición: el de la dirección (lo pone middleware.ts en una cabecera) o, si no hay, el de la
 * cookie; si no, el alemán.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const h = (await headers()).get(LOCALE_HEADER);
  const c = isLocale(h) ? null : (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(h) ? h : isLocale(c) ? c : DEFAULT_LOCALE;
  pageLocale().value = locale;
  return locale;
});

/** Traducir en el servidor: `const t = await getT(); t("Ver más")`. */
export async function getT() {
  const locale = await getLocale();
  return makeT(locale);
}
