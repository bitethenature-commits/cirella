import "server-only";
import { EDITABLE_EMAILS, type AutomationTrigger } from "../automation-catalog";
import type { EmailDesign } from "../email-blocks";
import { appUrl } from "../env";
import { formatSessionDate } from "../tz";
import { renderDesignHtml, renderSubject } from "./blocks-html";
import { AREA_LINK_TOKEN, areaLinkFooter, esc, SITE_NAME_TOKEN } from "./templates";
import * as T from "./templates";
import { receivedEmailHtml } from "../requests";

/**
 * Vista previa de un email automático con datos de ejemplo (Laura, su primer producto, una sesión la
 * semana que viene) y lo que la dueña ha escrito en el editor visual. Usa las mismas plantillas que
 * el envío: lo que se ve es lo que llegará.
 */
export function sampleAutomaticEmail(
  trigger: AutomationTrigger,
  c: { displayName: string; username: string; timezone: string; legalName: string | null; legalAddress: string | null; legalPostalCode: string | null; legalCity: string | null; legalCountry: string; legalEmail: string | null; pagePublished: unknown; pageDraft: unknown },
  edit: { subject: string | null; design: EmailDesign | null },
  o: { productTitle: string; siteName: string },
): { subject: string; html: string } | null {
  const meta = EDITABLE_EMAILS[trigger];
  if (!meta) return null;
  const base = appUrl();
  const when = formatSessionDate(new Date(Date.now() + 7 * 86_400_000), c.timezone);
  const vars = { nombre: "Laura", mi_nombre: c.displayName, producto: o.productTitle, fecha: when, luna: "Luna llena en Tauro" };
  const introHtml = edit.design?.blocks.length ? renderDesignHtml(edit.design, { baseUrl: base, vars }) : null;
  const url = `${base}/area`;
  let mail: { subject: string; html: string };
  switch (trigger) {
    case "WELCOME":
      mail = T.welcomeCustomerEmail({ name: "Laura", creatorName: c.displayName, accountUrl: url, introHtml });
      break;
    case "PURCHASE_RECEIPT":
      mail = T.purchaseReceiptEmail({ name: "Laura", creatorName: c.displayName, productTitle: o.productTitle, amount: "45,00 €", orderId: "cmpedidodeejemplo0001", accountUrl: url, introHtml });
      break;
    case "ACCESS_GRANTED":
      mail = T.accessGrantedEmail({ name: "Laura", creatorName: c.displayName, productTitle: o.productTitle, productType: "DIGITAL", url, introHtml });
      break;
    case "CANCEL_CONFIRMED":
      mail = T.cancelConfirmedEmail({ creatorName: c.displayName, productTitle: o.productTitle, receivedAt: "3 de diciembre de 2026, 10:24", until: "15 de diciembre de 2026", url });
      break;
    case "BOOKING_CONFIRMED":
      mail = T.bookingConfirmedEmail({ creatorName: c.displayName, productTitle: o.productTitle, when, url, meetingUrl: "https://zoom.us/j/123456789", meetingLabel: "Enlace de Zoom", reminderMinutes: 1440, introHtml });
      break;
    case "SESSION_REMINDER":
    case "SESSION_REMINDER_SOON":
      mail = T.sessionReminderEmail({ creatorName: c.displayName, productTitle: o.productTitle, when, url, meetingUrl: "https://zoom.us/j/123456789", meetingLabel: "Enlace de Zoom", introHtml });
      break;
    case "ABANDONED_CHECKOUT":
      mail = T.abandonedCheckoutEmail({ creatorName: c.displayName, productTitle: o.productTitle, url, optOutUrl: `${base}/unsubscribe/reminders`, introHtml });
      break;
    case "REQUEST_RECEIVED":
      mail = { subject: `He recibido tu mensaje ✦ ${o.productTitle}`, html: receivedEmailHtml({ brand: c.displayName, buyer: "Laura", productTitle: o.productTitle, when, price: null, message: "Hola, me encantaría reservar contigo. ¡Gracias!", introHtml }) };
      break;
    case "MOON_CIRCLE_REMINDER":
      mail = T.moonCircleReminderEmail({ creatorName: c.displayName, productTitle: o.productTitle, when, url, sky: { glyph: "♉", title: "Luna llena en Tauro", phrase: "Lo que cuidas con paciencia florece." }, meetingUrl: "https://zoom.us/j/123456789", meetingLabel: "Enlace de Zoom", introHtml });
      break;
    case "SESSION_THANKS":
      mail = T.sessionThanksEmail({ name: "Laura", creatorName: c.displayName, productTitle: o.productTitle, url, introHtml });
      break;
    case "MISS_YOU":
      mail = T.missYouEmail({ name: "Laura", creatorName: c.displayName, url, items: [o.productTitle], introHtml });
      break;
    default:
      return null;
  }
  const subject = edit.subject ? renderSubject(edit.subject, vars) || mail.subject : mail.subject;
  return {
    subject: subject.replaceAll(SITE_NAME_TOKEN, o.siteName),
    html: mail.html.replaceAll(SITE_NAME_TOKEN, esc(o.siteName)).replaceAll(AREA_LINK_TOKEN, areaLinkFooter(base)),
  };
}
