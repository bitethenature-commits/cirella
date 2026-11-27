import type { Locale } from "./config";
import { AREA } from "./dict/area";
import { AUTH } from "./dict/auth";
import { LEGAL } from "./dict/legal";
import { PUBLIC } from "./dict/public";
import { SITE } from "./dict/site";
import { EXTRA } from "./dict/extra";
import { FORMS } from "./dict/forms";
import { EMAIL } from "./dict/email";
import { PANEL } from "./dict/panel";
import { MODELS } from "./dict/models";
import { LEGAL_DOCS } from "./dict/legal-docs";
import { AUDIT } from "./dict/audit";
import type { DictEntry } from "./dict/types";

/**
 * Los textos fijos escritos en el código, en alemán e inglés. La clave es el texto en español tal cual (así se lee
 * el código igual que antes y lo que falte sale en español). Huecos con llaves: {n}, {host}… Puro y seguro en el
 * navegador. Los textos que ella cambia en el Canva están aparte (lib/i18n/site-texts-i18n.ts).
 */

export type TrVars = Record<string, string | number | null | undefined>;

const BASE: Record<string, DictEntry> = {
  // Cabecera y comunes
  Idioma: { de: "Sprache", en: "Language" },
  Volver: { de: "Zurück", en: "Back" },
  "Ver más": { de: "Mehr anzeigen", en: "Show more" },
  "Ver menos": { de: "Weniger anzeigen", en: "Show less" },
  "Ver más noticias ({n})": { de: "Mehr Nachrichten ({n})", en: "More news ({n})" },

  // Tarjetas de producto
  Lectura: { de: "Reading", en: "Reading" },
  Sesión: { de: "Sitzung", en: "Session" },
  Curso: { de: "Kurs", en: "Course" },
  Comunidad: { de: "Community", en: "Community" },
  Destacado: { de: "Empfohlen", en: "Featured" },
  Gratis: { de: "Kostenlos", en: "Free" },
  "Acceder gratis": { de: "Kostenlos zugreifen", en: "Get free access" },
  Escríbeme: { de: "Schreib mir", en: "Write to me" },
  "Pago en {host}": { de: "Bezahlung auf {host}", en: "Payment on {host}" },
  "Pago en otra web": { de: "Bezahlung auf einer anderen Website", en: "Payment on another website" },
  Oferta: { de: "Angebot", en: "Offer" },
  "El precio de oferta es el del primer pago; después, el normal.": {
    de: "Der Angebotspreis gilt für die erste Zahlung, danach der normale Preis.",
    en: "The offer price is for the first payment; after that, the regular price.",
  },

  // Portal de Noticias
  "Gracias por estar suscrita": { de: "Danke, dass du dabei bist", en: "Thank you for subscribing" },
  "Para quien está suscrita a mi newsletter": { de: "Für alle, die meinen Newsletter abonniert haben", en: "For my newsletter subscribers" },
  Noticias: { de: "Nachrichten", en: "News" },
  "Suscríbete a mi newsletter para {what}": { de: "Abonniere meinen Newsletter, um {what}", en: "Subscribe to my newsletter to {what}" },
  "Al suscribirte": { de: "Mit dem Abo", en: "When you subscribe" },
  "Pronto estará aquí el vídeo.": { de: "Das Video ist bald hier.", en: "The video will be here soon." },
  "Entrar al directo": { de: "Zum Livestream", en: "Join the live session" },
  "Ver la oferta": { de: "Zum Angebot", en: "See the offer" },
  "Revisa tu email": { de: "Schau in dein Postfach", en: "Check your email" },
  "Te hemos enviado un enlace a": { de: "Wir haben dir einen Link geschickt an", en: "We've sent a link to" },
  "Ábrelo y pulsa «Confirmar y entrar»: {hint}.": { de: "Öffne ihn und tippe auf „Bestätigen und anmelden“: {hint}.", en: "Open it and tap “Confirm and log in”: {hint}." },
  "el portal se abrirá con todo": { de: "dann öffnet sich das Portal mit allem", en: "the portal will open with everything" },
  "se abrirá esta noticia": { de: "dann öffnet sich diese Nachricht", en: "this news item will open" },
  "se abre el portal": { de: "das Portal öffnet sich", en: "the portal opens" },
  "se abre esta noticia": { de: "diese Nachricht öffnet sich", en: "this news item opens" },
  "Suscríbete para ver el portal": { de: "Abonniere, um das Portal zu sehen", en: "Subscribe to see the portal" },
  "Has entrado como": { de: "Angemeldet als", en: "Logged in as" },
  "Solo falta que te apuntes a la newsletter para {what}.": { de: "Du musst nur noch den Newsletter abonnieren, um {what}.", en: "You just need to subscribe to the newsletter to {what}." },
  "Tu nombre": { de: "Dein Name", en: "Your name" },
  "Tu email": { de: "Deine E-Mail", en: "Your email" },
  "tu@email.com": { de: "du@email.de", en: "you@email.com" },
  "Quiero recibir la newsletter de {name} (puedo darme de baja cuando quiera). Acepto la": {
    de: "Ich möchte den Newsletter von {name} erhalten (ich kann mich jederzeit abmelden). Ich akzeptiere die",
    en: "I want to receive {name}'s newsletter (I can unsubscribe anytime). I accept the",
  },
  "política de privacidad": { de: "Datenschutzerklärung", en: "privacy policy" },
  "Enviando…": { de: "Wird gesendet…", en: "Sending…" },
  "Suscribirme y verlo": { de: "Abonnieren und ansehen", en: "Subscribe and see it" },
  "Suscribirme para {what}": { de: "Abonnieren, um {what}", en: "Subscribe to {what}" },
  "Te enviaremos un enlace para confirmar tu email: al pulsarlo, entras en tu área y {hint}.": {
    de: "Wir schicken dir einen Link, um deine E-Mail zu bestätigen: Wenn du darauf tippst, kommst du in deinen Bereich und {hint}.",
    en: "We'll send you a link to confirm your email: when you tap it, you enter your area and {hint}.",
  },

  Vídeo: { de: "Video", en: "Video" },
  Audio: { de: "Audio", en: "Audio" },
  Fotos: { de: "Fotos", en: "Photos" },
  "Directo · Zoom": { de: "Live · Zoom", en: "Live · Zoom" },
  "Early Bird": { de: "Early Bird", en: "Early Bird" },
  "ver el vídeo": { de: "das Video zu sehen", en: "watch the video" },
  "escuchar el audio": { de: "das Audio zu hören", en: "listen to the audio" },
  "ver las fotos": { de: "die Fotos zu sehen", en: "see the photos" },
  "recibir el enlace del directo": { de: "den Link zum Livestream zu bekommen", en: "get the live session link" },
  "acceder a la oferta": { de: "zum Angebot zu kommen", en: "access the offer" },

  "Te hemos enviado un email a {email}. Pulsa «Sí, quiero recibirla» y ya estarás dentro. Si no lo ves, mira en spam o en promociones.": {
    de: "Wir haben dir eine E-Mail an {email} geschickt. Tippe auf „Ja, ich möchte ihn erhalten“ und du bist dabei. Wenn du sie nicht siehst, schau im Spam- oder Werbeordner nach.",
    en: "We've sent an email to {email}. Tap “Yes, I want to receive it” and you're in. If you can't see it, check spam or promotions.",
  },

  // Actualidades de la portada (lib/web-news.ts)
  Nuevo: { de: "Neu", en: "New" },
  "{what} en {where}": { de: "{what} in {where}", en: "{what} in {where}" },
  "Nuevo texto": { de: "Neuer Text", en: "New text" },
  "Nuevo podcast": { de: "Neuer Podcast", en: "New podcast" },
  "Nueva meditación": { de: "Neue Meditation", en: "New meditation" },
  "Nuevo Astroweather": { de: "Neues Astroweather", en: "New Astroweather" },
  "Nueva masterclass": { de: "Neue Masterclass", en: "New masterclass" },
  "Nueva ceremonia": { de: "Neue Zeremonie", en: "New ceremony" },
  "Nuevo vídeo": { de: "Neues Video", en: "New video" },
  "Nuevo círculo": { de: "Neuer Kreis", en: "New circle" },
  "Nuevo curso": { de: "Neuer Kurs", en: "New course" },
  "Nueva lectura": { de: "Neues Reading", en: "New reading" },
  "Nuevo taller": { de: "Neuer Workshop", en: "New workshop" },
  "Nueva sesión": { de: "Neue Sitzung", en: "New session" },
  "Nuevo código de descuento": { de: "Neuer Rabattcode", en: "New discount code" },
  "Mañana · círculo de la luna": { de: "Morgen · Mondkreis", en: "Tomorrow · moon circle" },
  "Para miembros de {name}.": { de: "Für Mitglieder von {name}.", en: "For members of {name}." },
  "Ven sin ser miembro: apúntate a este círculo.": { de: "Komm, ohne Mitglied zu sein: Melde dich für diesen Kreis an.", en: "Come without being a member: sign up for this circle." },

  // Gifts y noticias en su página
  "Lo quiero": { de: "Ich möchte es", en: "I want it" },
  "Ver toda mi energía": { de: "Meine ganze Energie", en: "See all my energy" },
};

/** Todo junto: lo de arriba y lo de cada parte de la web (lib/i18n/dict/*). */
const DICT: Record<string, DictEntry> = { ...LEGAL_DOCS, ...AUDIT, ...MODELS, ...BASE, ...PUBLIC, ...AUTH, ...LEGAL, ...AREA, ...SITE, ...EXTRA, ...FORMS, ...EMAIL, ...PANEL };

/** Busca el texto tal cual o, si no, sin los espacios de alrededor (y se los vuelve a poner). */
function lookup(s: string, locale: "de" | "en"): string {
  const hit = DICT[s]?.[locale];
  if (hit !== undefined) return hit;
  const t = s.trim();
  if (t === s) return s;
  const inner = DICT[t]?.[locale];
  return inner === undefined ? s : s.slice(0, s.indexOf(t)) + inner + s.slice(s.indexOf(t) + t.length);
}

/** La función `t` de useT/getT: acepta también textos que pueden faltar (los devuelve tal cual). */
export type TFn = <S extends string | null | undefined>(s: S, vars?: TrVars) => S extends string ? string : S;

/** Crea la función `t` de un idioma. */
export const makeT = (locale: Locale): TFn => ((s: string | null | undefined, vars?: TrVars) => (s ? tr(locale, s, vars) : s)) as TFn;

/** Traduce un texto fijo (en español) al idioma y rellena sus huecos. Lo que no está en el diccionario, en español. */
export function tr(locale: Locale, s: string, vars?: TrVars): string {
  let out = locale === "es" ? s : lookup(s, locale);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v ?? ""));
  return out;
}
