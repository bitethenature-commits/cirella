import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/db";
import { setDateLocaleSource } from "@/lib/tz";
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale, type Locale } from "./config";
import { tr, type TrVars } from "./dict";

/**
 * Idioma de los emails. Cada email sale en el idioma de quien lo recibe: el que se guardó al registrarse,
 * comprar o apuntarse a la newsletter (User.locale, Subscriber.locale); si no hay ninguno, en alemán. Los
 * avisos a la dueña y a la administración van en el idioma de su panel (User.panelLocale; sin él, español).
 *
 * Las plantillas escriben sus textos con `et("…")`, que traduce al idioma del email que se está montando
 * (`inMail` lo marca). Fuera de `inMail`, en español, como siempre.
 */
const store = new AsyncLocalStorage<Locale>();

export const mailLocale = (): Locale => store.getStore() ?? "es";

// Las fechas de un email, en su idioma (lib/tz.ts).
setDateLocaleSource(() => {
  const l = store.getStore();
  return l ? INTL_LOCALE[l] : undefined;
});

/** Texto fijo de un email, en el idioma de quien lo recibe. */
export const et = (s: string, vars?: TrVars) => tr(mailLocale(), s, vars);

/** Monta un email en un idioma concreto. */
export const withMailLocale = <T>(locale: Locale, build: () => T): T => store.run(locale, build);

/** El idioma de una dirección: la dueña y la administración, el de su panel; las demás, el suyo o alemán. */
export async function recipientLocale(email: string): Promise<Locale> {
  const to = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: to }, select: { locale: true, panelLocale: true, isAdmin: true, creator: { select: { id: true } } } });
  if (user && (user.isAdmin || user.creator)) return isLocale(user.panelLocale) ? user.panelLocale : "es";
  // Su email de contacto (los avisos de ventas y solicitudes pueden ir ahí): el idioma de su panel.
  if (!user) {
    const owner = await prisma.creator.findFirst({ where: { OR: [{ contactEmail: { equals: to, mode: "insensitive" } }, { legalEmail: { equals: to, mode: "insensitive" } }] }, select: { user: { select: { panelLocale: true } } } });
    if (owner) return isLocale(owner.user.panelLocale) ? owner.user.panelLocale : "es";
  }
  if (isLocale(user?.locale)) return user.locale;
  const sub = await prisma.subscriber.findFirst({ where: { email: to, locale: { not: null } }, orderBy: { createdAt: "desc" }, select: { locale: true } });
  return isLocale(sub?.locale) ? sub.locale : DEFAULT_LOCALE;
}

/** Monta el email en el idioma de quien lo recibe: `...(await inMail(to, () => T.algoEmail({ … })))`. */
export async function inMail<T>(to: string, build: () => T): Promise<Awaited<T>> {
  return await withMailLocale(await recipientLocale(to), build);
}

/**
 * El idioma de la petición en curso (la web en la que está la persona), o null fuera de una petición (los
 * avisos de la pasarela, las tareas programadas). Se guarda al registrarse, comprar o apuntarse.
 */
export async function requestLocale(): Promise<Locale | null> {
  try {
    const { getLocale } = await import("./server");
    return await getLocale();
  } catch {
    return null;
  }
}
