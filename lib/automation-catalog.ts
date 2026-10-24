/**
 * Catálogo de automatizaciones (sin dependencias de servidor: lo usan el panel, lib/automations.ts y
 * las pruebas unitarias).
 */
import type { EmailDesign, EmailVars } from "./email-blocks";
import { isPersonalMode } from "./site-mode";

export const AUTOMATIONS = {
  PURCHASE_RECEIPT: { label: "Email de compra", description: "Recibo y acceso al contenido para quien compra", audience: "Clienta", essential: true, defaultDelay: 0 },
  COURSE_ACCESS: { label: "Acceso al curso", description: "Enlace directo al curso tras la compra", audience: "Clienta", essential: true, defaultDelay: 0 },
  BOOKING_CONFIRMED: { label: "Confirmación de reserva", description: "Fecha, hora y enlace de la sesión", audience: "Clienta", essential: true, defaultDelay: 0 },
  NEW_SUBSCRIPTION: { label: "Aviso de nueva suscripción", description: "Te avisamos cuando alguien se une a tu membresía", audience: "Tú", essential: true, defaultDelay: 0 },
  SUBSCRIPTION_CANCELED: { label: "Aviso de cancelación", description: "Te avisamos cuando alguien cancela su membresía", audience: "Tú", essential: true, defaultDelay: 0 },
  WELCOME: { label: "Email de bienvenida", description: "Mensaje personal tras la primera compra de una clienta nueva", audience: "Clienta", essential: false, defaultDelay: 10 },
  SESSION_REMINDER: { label: "Recordatorio de sesión", description: "Se envía antes de cada sesión (minutos de antelación)", audience: "Clienta", essential: false, defaultDelay: 1440 },
  ABANDONED_CHECKOUT: { label: "Recuperación de compra abandonada", description: "Si alguien empieza a pagar y no termina", audience: "Clienta", essential: false, defaultDelay: 60 },
  // Calendario propio: activadas por defecto solo en la web personal (en la plataforma, como siempre).
  BOOKING_OWNER_NOTICE: { label: "Aviso de reservas", description: "Te avisamos de cada reserva, cambio de fecha, cancelación y datos nuevos de tus clientas", audience: "Tú", essential: false, defaultDelay: 0, defaultEnabled: "personal" },
  SESSION_REMINDER_SOON: { label: "Segundo recordatorio", description: "Poco antes de la sesión, con el enlace de Zoom (minutos de antelación)", audience: "Clienta", essential: false, defaultDelay: 60, defaultEnabled: "personal" },
  // Comunidad y fin de acceso.
  ACCESS_ENDING: { label: "Fin de acceso", description: "Avisa 7 días antes de que termine un acceso con fecha, el día que termina y cuando acaba una membresía de pago", audience: "Clienta", essential: false, defaultDelay: 0 },
  MEMBER_ENDED: { label: "Aviso de fin de acceso", description: "Te avisamos cuando termina el acceso con fecha de alguien", audience: "Tú", essential: false, defaultDelay: 0 },
  NEW_COMMENT: { label: "Comentarios nuevos", description: "Te avisamos cuando alguien comenta en tu comunidad", audience: "Tú", essential: false, defaultDelay: 0 },
  // Newsletter: el acceso a lo gratis (o dado a mano) y la bienvenida a la newsletter (solo la web personal).
  ACCESS_GRANTED: { label: "Acceso a un contenido gratis", description: "Enlace directo a lo gratis con email o a lo que das a mano", audience: "Clienta", essential: true, defaultDelay: 0 },
  NEWSLETTER_WELCOME: { label: "Bienvenida a la newsletter", description: "Al confirmar que quiere recibir tu newsletter", audience: "Suscriptora", essential: false, defaultDelay: 0, defaultEnabled: false, personalOnly: true },
} as const;

export type AutomationTrigger = keyof typeof AUTOMATIONS;

/** ¿Está activada si la creadora no la ha tocado? Las del calendario propio, solo en la web personal. */
/** Las que se enseñan en el panel (la bienvenida a la newsletter, solo en la web personal). */
export function visibleAutomations(personal: boolean): AutomationTrigger[] {
  return (Object.keys(AUTOMATIONS) as AutomationTrigger[]).filter((t) => personal || !(AUTOMATIONS[t] as { personalOnly?: boolean }).personalOnly);
}

export function automationDefaultOn(t: AutomationTrigger): boolean {
  const meta = AUTOMATIONS[t] as { defaultEnabled?: boolean | "personal" };
  if (meta.defaultEnabled === "personal") return isPersonalMode();
  return meta.defaultEnabled ?? true;
}

/**
 * Emails automáticos que se editan con el editor visual (lib/email-blocks.ts): asunto y texto, con
 * variables y vista previa. «body»: el texto es el email entero (salvo el botón final); «intro»: va en
 * lugar del saludo y la parte fija (datos de la compra o la sesión, botón de acceso, enlaces legales)
 * sale siempre. `original` es el email de siempre escrito con bloques: el punto de partida del editor.
 */
export type EditableEmail = {
  mode: "body" | "intro";
  vars: (keyof EmailVars)[];
  subject: string;
  fixed: string;
  original: () => EmailDesign;
};

const text = (id: string, body: string) => ({ id, t: "text" as const, body });
const title = (id: string, t: string) => ({ id, t: "title" as const, text: t, align: "left" as const });

export const EDITABLE_EMAILS: Partial<Record<AutomationTrigger, EditableEmail>> = {
  WELCOME: {
    mode: "body",
    vars: ["nombre", "mi_nombre"],
    subject: "Bienvenida a la comunidad de {mi_nombre}",
    fixed: "El botón «Ver mi cuenta» se añade solo al final.",
    original: () => ({ v: 1, blocks: [title("hola", "Hola, {nombre}"), text("texto", "Gracias por confiar en {mi_nombre}. Todo lo tuyo estará siempre disponible en tu cuenta.")] }),
  },
  PURCHASE_RECEIPT: {
    mode: "intro",
    vars: ["nombre", "mi_nombre", "producto"],
    subject: "Compra confirmada: {producto}",
    fixed: "Debajo van solos el resumen de la compra (producto, total, pedido, IVA, quién vende), el botón de acceso, la factura y las condiciones aceptadas.",
    original: () => ({ v: 1, blocks: [text("texto", "Hola, {nombre}, gracias por tu compra.")] }),
  },
  ACCESS_GRANTED: {
    mode: "intro",
    vars: ["nombre", "mi_nombre", "producto"],
    subject: "Ya tienes acceso a «{producto}»",
    fixed: "Debajo van solos el botón de acceso, la fecha de fin (si la tiene), tus instrucciones y, si lo pidió, el enlace para confirmar la newsletter.",
    original: () => ({ v: 1, blocks: [text("texto", "Hola, {nombre}, ya puedes entrar en **{producto}**.")] }),
  },
  COURSE_ACCESS: {
    mode: "intro",
    vars: ["mi_nombre", "producto"],
    subject: "Ya tienes acceso a «{producto}»",
    fixed: "Debajo va solo el botón «Empezar el curso».",
    original: () => ({ v: 1, blocks: [text("texto", "Ya puedes empezar **{producto}**. Avanza a tu ritmo: tu progreso se guarda automáticamente.")] }),
  },
  BOOKING_CONFIRMED: {
    mode: "intro",
    vars: ["nombre", "mi_nombre", "producto", "fecha"],
    subject: "Reserva confirmada · {fecha}",
    fixed: "Debajo van solos la sesión con su fecha y hora, el enlace de la videollamada, «Añadir a mi calendario» y el botón «Ver detalles».",
    original: () => ({ v: 1, blocks: [] }),
  },
  SESSION_REMINDER: {
    mode: "intro",
    vars: ["nombre", "mi_nombre", "producto", "fecha"],
    subject: "Recordatorio: tu sesión {fecha}",
    fixed: "Debajo van solos la sesión con su fecha y hora, el enlace de la videollamada y el botón «Ver detalles».",
    original: () => ({ v: 1, blocks: [] }),
  },
  SESSION_REMINDER_SOON: {
    mode: "intro",
    vars: ["nombre", "mi_nombre", "producto", "fecha"],
    subject: "Recordatorio: tu sesión {fecha}",
    fixed: "Debajo van solos la sesión con su fecha y hora, el enlace de la videollamada y el botón «Ver detalles».",
    original: () => ({ v: 1, blocks: [] }),
  },
  ABANDONED_CHECKOUT: {
    mode: "body",
    vars: ["mi_nombre", "producto"],
    subject: "¿Te quedaste a medias con «{producto}»?",
    fixed: "El botón «Completar mi compra» y el enlace para darse de baja de estos recordatorios se añaden solos.",
    original: () => ({ v: 1, blocks: [title("titulo", "Lo guardamos para ti"), text("texto", "Vimos que empezaste a comprar {producto} pero no terminaste. Si tuviste alguna duda, responde a este email.")] }),
  },
  NEWSLETTER_WELCOME: {
    mode: "body",
    vars: ["nombre", "mi_nombre"],
    subject: "¡Bienvenida, {nombre}!",
    fixed: "El pie con tus datos y el enlace para darse de baja se añaden solos.",
    original: () => ({
      v: 1,
      blocks: [title("hola", "¡Hola, {nombre}!"), text("texto", "Gracias por apuntarte a mi newsletter. Te escribiré de vez en cuando con lo que estoy preparando, lecturas y novedades.\n\nUn abrazo,\n{mi_nombre}")],
    }),
  },
};

export function defaultEmailDesign(t: AutomationTrigger): EmailDesign {
  return EDITABLE_EMAILS[t]?.original() ?? { v: 1, blocks: [] };
}

export function defaultEmailSubject(t: AutomationTrigger): string {
  return EDITABLE_EMAILS[t]?.subject ?? "";
}
