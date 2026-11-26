import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./config";
import { makeT } from "./dict";

/**
 * El idioma de esta petición: el de la dirección (lo pone middleware.ts en una cabecera) o, si no hay, el de la
 * cookie; si no, el alemán.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const h = (await headers()).get(LOCALE_HEADER);
  if (isLocale(h)) return h;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
});

/** Traducir en el servidor: `const t = await getT(); t("Ver más")`. */
export async function getT() {
  const locale = await getLocale();
  return makeT(locale);
}
