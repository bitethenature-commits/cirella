import { esc, layout, p } from "./templates";

/**
 * Emails de cambios de una compra: otra fecha, sesión cancelada, reembolso y desistimiento.
 * Todo lo que escribe una persona (mensaje, motivo, nombres) se escapa.
 */

const muted = (s: string) => `<span style="color:#8A8698;font-size:13px">${s}</span>`;
const quote = (who: string, text: string) => p(`Mensaje de ${esc(who)}: <em>«${esc(text)}»</em>`);
const ARRIVES = "Lo verás en tu tarjeta en 5-10 días hábiles.";

export function rescheduleProposalEmail(o: { creatorName: string; productTitle: string; previousWhen: string; note: string | null; url: string }) {
  return {
    subject: `${o.creatorName} te propone cambiar la fecha de tu sesión`,
    html: layout({
      brand: o.creatorName,
      title: "Elige una nueva fecha",
      body:
        p(`Tu sesión «${esc(o.productTitle)}» del ${esc(o.previousWhen)} ha quedado libre. Tu pago sigue en pie: solo tienes que elegir otro hueco que te venga bien.`) +
        (o.note ? quote(o.creatorName, o.note) : ""),
      cta: { label: "Elegir nueva fecha", url: o.url },
    }),
  };
}

export function bookingCancelledEmail(o: { creatorName: string; productTitle: string; when: string | null; reason: string | null; refundAmount: string | null; url: string }) {
  return {
    subject: `Tu sesión «${o.productTitle}» se ha cancelado`,
    html: layout({
      brand: o.creatorName,
      title: "Sesión cancelada",
      body:
        p(`${esc(o.creatorName)} ha cancelado tu sesión «${esc(o.productTitle)}»${o.when ? ` del ${esc(o.when)}` : ""}.`) +
        (o.reason ? p(`Motivo: <em>«${esc(o.reason)}»</em>`) : "") +
        (o.refundAmount ? p(`Te hemos devuelto <strong>${esc(o.refundAmount)}</strong>. ${ARRIVES}`) : ""),
      cta: { label: "Ver mis compras", url: o.url },
    }),
  };
}

export function refundIssuedEmail(o: { creatorName: string; productTitle: string; amount: string; partial: boolean; accessRevoked: boolean; note: string | null; url: string }) {
  return {
    subject: `Te hemos devuelto ${o.amount} de «${o.productTitle}»`,
    html: layout({
      brand: o.creatorName,
      title: "Reembolso en camino",
      body:
        p(`${esc(o.creatorName)} te ha devuelto <strong>${esc(o.amount)}</strong>${o.partial ? " de tu compra" : ""} de «${esc(o.productTitle)}». ${ARRIVES}`) +
        (o.accessRevoked ? p("Ya no tendrás acceso a este contenido.") : "") +
        (o.note ? quote(o.creatorName, o.note) : ""),
      cta: { label: "Ver mis compras", url: o.url },
    }),
  };
}

/** Acuse de recibo del desistimiento (TRLGDCU art. 106.4: hay que confirmarlo sin demora). */
export function withdrawalReceiptEmail(o: { creatorName: string; productTitle: string; amount: string; url: string }) {
  return {
    subject: `Hemos recibido tu desistimiento de «${o.productTitle}»`,
    html: layout({
      brand: o.creatorName,
      title: "Desistimiento recibido",
      body:
        p(`Has ejercido tu derecho de desistimiento de «${esc(o.productTitle)}». Te devolvemos <strong>${esc(o.amount)}</strong> por el mismo medio de pago; lo verás en 5-10 días hábiles.`) +
        p(muted("Guarda este email: es el acuse de recibo de tu desistimiento.")),
      cta: { label: "Ver mis compras", url: o.url },
    }),
  };
}

export function withdrawalCreatorEmail(o: { buyer: string; productTitle: string; amount: string; url: string }) {
  return {
    subject: `${o.buyer} ha desistido de «${o.productTitle}»`,
    html: layout({
      title: "Desistimiento de una compra",
      body: p(`${esc(o.buyer)} ha ejercido su derecho de desistimiento de «${esc(o.productTitle)}» dentro del plazo de 14 días. Le hemos devuelto <strong>${esc(o.amount)}</strong> y retirado el acceso.`),
      cta: { label: "Ver el pedido", url: o.url },
    }),
  };
}

export function refundFailedCreatorEmail(o: { buyer: string; productTitle: string; amount: string; error: string; url: string }) {
  return {
    subject: "No se ha podido completar un reembolso",
    html: layout({
      title: "Reembolso fallido",
      body:
        p(`La pasarela no ha podido devolver <strong>${esc(o.amount)}</strong> a ${esc(o.buyer)} por «${esc(o.productTitle)}».`) +
        p(`Motivo: ${esc(o.error)}`) +
        p("Puedes volver a intentarlo desde el pedido. Si el acceso ya se había retirado, sigue retirado."),
      cta: { label: "Ver el pedido", url: o.url },
    }),
  };
}

export function rescheduledCreatorEmail(o: { buyer: string; productTitle: string; when: string; url: string }) {
  return {
    subject: `${o.buyer} ha elegido nueva fecha`,
    html: layout({
      title: "Nueva fecha elegida",
      body: p(`${esc(o.buyer)} ha elegido nueva fecha para «${esc(o.productTitle)}»: <strong>${esc(o.when)}</strong>.`),
      cta: { label: "Ver mis reservas", url: o.url },
    }),
  };
}
