/**
 * Los textos fijos de la web («Ver todas las novedades», «Hecho por mí», el botón «Email», la letra pequeña de
 * la newsletter, los nombres de los enlaces legales del pie…). Cada uno se cambia en el Canva escribiendo encima
 * y vale para toda la web (portada, páginas y fichas): se guarda en PageConfig.texts. Vacío o igual al de siempre:
 * el de siempre. Algunos llevan huecos que se rellenan solos: {n} (cuántos), {nombre} (su nombre), {titular} (quién
 * vende) y {año}. Los números de los desplegables ({n}) los pone la web: en el Canva solo se cambia el texto de
 * alrededor. Puro y seguro en el cliente.
 */
export const SITE_TEXTS = {
  // Portada: los desplegables y sus botones
  "news.last": "Lo último de la web",
  "news.count1": "{n} novedad este mes",
  "news.countN": "{n} novedades este mes",
  "news.all": "Ver todas las novedades",
  "portal.count1": "{n} aviso",
  "portal.countN": "{n} avisos",
  "offers.count1": "{n} oferta",
  "offers.countN": "{n} ofertas",
  "offers.more": "Ver más ofertas",
  "gifts.count1": "{n} regalo",
  "gifts.countN": "{n} regalos",
  "gifts.eyebrow": "Hecho por mí",
  "gifts.all": "Ver todos los regalos",
  "courses.all": "Ver todos los cursos por método",
  "readings.steps": "Ver los pasos",
  "circles.free": "Apuntarme",
  "circles.paid": "Quiero ir",
  "contact.email": "Email",
  // Entrar en el área
  "account.enter": "Entrar",
  "account.mine": "Mi área",
  "account.footerIn": "Ir a mi área",
  "account.footerPersonal": "¿Ya tienes acceso? Entra en tu área",
  "account.footer": "¿Ya compraste? Accede a tu área de cliente",
  "account.signup": "¿Aún no tienes cuenta? Créala",
  // Formulario de la newsletter
  "nl.footerTitle": "Recibe mi newsletter",
  "nl.name": "Nombre (opcional)",
  "nl.email": "Email",
  "nl.consent": "Te enviaré un email para confirmar. Solo lo usaré para la newsletter de {nombre}; puedes darte de baja cuando quieras con el enlace de cada email.",
  "nl.privacy": "Privacidad",
  "nl.portal": "Al suscribirte se abre también el Portal de noticias: audios, vídeos y avisos solo para quien está suscrita.",
  "nl.doneTitle": "Revisa tu email y confirma",
  // Pie: los enlaces legales (obligatorios: se cambia su nombre, no se quitan) y la firma
  "legal.aviso": "Aviso legal",
  "legal.condiciones": "Condiciones",
  "legal.privacidad": "Privacidad",
  "legal.cookies": "Cookies",
  "footer.signature": "{titular} · {año}",
  // Las páginas que se crean solas (Mi página › Mis páginas): sus títulos y frases fijas
  "pg.back": "Volver a la página",
  "pg.courses.eyebrow": "Cursos",
  "pg.courses.title": "Aprende a tu ritmo",
  "pg.courses.text": "Elige el sistema que te llama y escríbeme para empezar.",
  "pg.courses.empty": "Pronto habrá cursos aquí.",
  "pg.community.eyebrow": "✦ Comunidad ✦",
  "pg.community.title": "Elige cómo quieres acompañarte",
  "pg.community.text": "Un espacio privado para vivir el cielo semana a semana: textos, voz, directos y lunas compartidas.",
  "pg.community.textN": "Cada nivel incluye todo lo del anterior y puedes subir o cancelar cuando quieras.",
  "pg.community.text1": "Puedes cancelar cuando quieras.",
  "pg.community.empty": "Pronto abriré la comunidad.",
  "pg.community.badge": "La más elegida",
  "pg.community.circles": "¿Solo quieres venir a un círculo?",
  "pg.community.circlesLink": "Apúntate a un día suelto sin ser miembro",
  "pg.news.eyebrow": "Lo nuevo de la web",
  "pg.news.title": "Actualidades",
  "pg.news.posts": "Publicaciones",
  "pg.news.divider": "Lo nuevo de la web",
  "pg.news.empty": "Todavía no hay novedades.",
  "pg.portal.eyebrow": "Para quien está suscrita a mi newsletter",
  "pg.portal.empty": "Pronto habrá aquí vídeos, audios y avisos para quien está suscrita a mi newsletter.",
  "pg.offers.eyebrow": "Por tiempo limitado",
  "pg.offers.empty": "Ahora mismo no hay ofertas.",
  "pg.booking.back": "Volver",
  "pg.booking.how": "Cómo reservar",
  "pg.readings.title": "Lecturas",
  "pg.readings.empty": "Ahora mismo no hay lecturas disponibles.",
  "pg.sessions.title": "Sesiones",
  "pg.sessions.empty": "Ahora mismo no hay sesiones disponibles.",
  "pg.legal.eyebrow": "Información legal",
  "pg.legal.title": "Aviso legal y privacidad",
  "pg.legal.titleSales": "Aviso legal y condiciones",
  "pg.legal.aviso": "Aviso legal",
  "pg.legal.condiciones": "Condiciones de venta",
  "pg.legal.reembolsos": "Cambios y reembolsos",
  "pg.legal.privacidad": "Privacidad",
  "pg.legal.cookies": "Cookies",
  "pg.legal.cookiesText":
    "Esta página no instala cookies de seguimiento. Medimos visitas de forma agregada y anónima, sin cookies. Solo usamos cookies técnicas para mantener tu sesión si entras en tu cuenta.",
  "pg.legal.otras": "Otras webs",
} as const;

export type SiteTextKey = keyof typeof SITE_TEXTS;
export type SiteTexts = Partial<Record<SiteTextKey, string>>;
export type TextVars = Record<string, string | number>;

/** Lo más largo que admite un texto fijo. */
export const SITE_TEXT_MAX = 400;

export const isSiteTextKey = (k: string): k is SiteTextKey => Object.prototype.hasOwnProperty.call(SITE_TEXTS, k);

/** El texto (el suyo o el de siempre) con sus huecos rellenos. */
export function siteText(texts: SiteTexts | null | undefined, key: SiteTextKey, vars?: TextVars): string {
  let s: string = texts?.[key]?.trim() || SITE_TEXTS[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/**
 * Lo que escribió en el Canva, de vuelta con sus huecos: si dejó su nombre, el año o el número tal cual, vuelven
 * a ser {nombre}, {año}, {n}… (así se siguen rellenando solos).
 */
export function unfillText(value: string, vars?: TextVars): string {
  let s = value;
  // Los valores más largos primero: «2026» antes que «2».
  const list = Object.entries(vars ?? {})
    .map(([k, v]) => [k, String(v)] as const)
    .filter(([, v]) => v.trim())
    .sort((a, b) => b[1].length - a[1].length);
  for (const [k, v] of list) s = s.split(v).join(`{${k}}`);
  return s;
}

/** Lee los textos guardados: solo las claves que existen, como texto y sin pasarse de largo. */
export function readSiteTexts(raw: unknown): SiteTexts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SiteTexts = {};
  for (const [k, v] of Object.entries(raw)) if (isSiteTextKey(k) && typeof v === "string" && v.trim()) out[k] = v.slice(0, SITE_TEXT_MAX);
  return out;
}

/** Cambia un texto: vacío o igual al de siempre, vuelve al de siempre (sin guardarlo). */
export function withSiteText(texts: SiteTexts | undefined, key: SiteTextKey, value: string): SiteTexts {
  const next = { ...(texts ?? {}) };
  const v = value.trim().slice(0, SITE_TEXT_MAX);
  if (!v || v === SITE_TEXTS[key]) delete next[key];
  else next[key] = v;
  return next;
}
