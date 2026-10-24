/**
 * Catálogo de automatizaciones (sin dependencias de servidor: lo usan el panel, lib/automations.ts y
 * las pruebas unitarias).
 */
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
} as const;

export type AutomationTrigger = keyof typeof AUTOMATIONS;

/** ¿Está activada si la creadora no la ha tocado? Las del calendario propio, solo en la web personal. */
export function automationDefaultOn(t: AutomationTrigger): boolean {
  const meta = AUTOMATIONS[t] as { defaultEnabled?: boolean | "personal" };
  if (meta.defaultEnabled === "personal") return isPersonalMode();
  return meta.defaultEnabled ?? true;
}
