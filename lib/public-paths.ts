/**
 * Las direcciones públicas de la web, en inglés y sencillas. Puro y seguro en el navegador: el modo del sitio llega
 * al compilar (NEXT_PUBLIC_SITE_MODE, next.config.ts).
 *
 *   · web personal (sin el usuario de la dueña delante; middleware.ts → lib/personal-routing.ts):
 *       productos      /courses/<curso>, /sessions/<sesión>, /membership/<nivel>, /readings/<lectura>
 *       entrar         /area/login            gracias   /thanks            legal   /legal
 *       área de alumna /area/courses/<curso>, /area/membership/<nivel> (por su nombre)
 *   · plataforma: /<usuaria>/<producto>, /<usuaria>/login…; en el área, cursos y membresías por su código (los nombres
 *     solo son únicos dentro de cada creadora).
 */

const personal = () => process.env.NEXT_PUBLIC_SITE_MODE?.trim() === "personal";

/** La sección de la web donde vive cada tipo de producto (web personal). */
export const PRODUCT_SECTION = { COURSE: "courses", SESSION: "sessions", MEMBERSHIP: "membership", DIGITAL: "readings" } as const;
export type ProductSection = (typeof PRODUCT_SECTION)[keyof typeof PRODUCT_SECTION];
export const PRODUCT_SECTIONS: readonly string[] = Object.values(PRODUCT_SECTION);

export function productSection(type: string): ProductSection {
  return PRODUCT_SECTION[type as keyof typeof PRODUCT_SECTION] ?? "readings";
}

/** La página de un producto. `sub`: «checkout» o «request» (pedir una sesión o una lectura). */
export function productPath(username: string, p: { slug: string; type: string }, sub?: "checkout" | "request"): string {
  const base = personal() ? `/${productSection(p.type)}/${p.slug}` : `/${username}/${p.slug}`;
  return sub ? `${base}/${sub}` : base;
}

/** Entrar al área de alumna con la marca de la web (o de la creadora en la plataforma). */
export function loginPath(username?: string | null): string {
  if (personal()) return "/area/login";
  return username ? `/${username}/login` : "/login";
}

/** «Gracias por tu compra». */
export function thanksPath(username: string): string {
  return personal() ? "/thanks" : `/${username}/thanks`;
}

/** Un curso o una membresía en el área de alumna: por su nombre en la web personal, por su código en la plataforma. */
export function areaProductPath(p: { id: string; slug: string; type: string }): string {
  const ref = personal() ? p.slug : p.id;
  return p.type === "MEMBERSHIP" ? `/area/membership/${ref}` : `/area/courses/${ref}`;
}
