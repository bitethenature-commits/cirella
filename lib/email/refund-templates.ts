import { esc, layout, p } from "./templates";
import { et } from "@/lib/i18n/email";

/**
 * Emails de cambios de una compra: otra fecha, sesión cancelada, reembolso y desistimiento.
 * Todo lo que escribe una persona (mensaje, motivo, nombres) se escapa.
 */

const muted = (s: string) => `<span style="color:#A99FC2;font-size:13px">${s}</span>`;
const quote = (who: string, text: string) => p(et("Mensaje de {who}: <em>«{text}»</em>", { who: esc(who), text: esc(text) }));
const arrives = () => et("Lo verás en tu tarjeta en 5-10 días hábiles.");

export function rescheduleProposalEmail(o: { creatorName: string; productTitle: string; previousWhen: string; note: string | null; url: string }) {
  return {
    subject: et("{creatorName} te propone cambiar la fecha de tu sesión", { creatorName: o.creatorName }),
    html: layout({
      brand: o.creatorName,
      title: et("Elige una nueva fecha"),
      body:
        p(et("Tu sesión «{productTitle}» del {previousWhen} ha quedado libre. Tu pago sigue en pie: solo tienes que elegir otro hueco que te venga bien.", { productTitle: esc(o.productTitle), previousWhen: esc(o.previousWhen) })) +
        (o.note ? quote(o.creatorName, o.note) : ""),
      cta: { label: et("Elegir nueva fecha"), url: o.url },
    }),
  };
}

export function bookingCancelledEmail(o: { creatorName: string; productTitle: string; when: string | null; reason: string | null; refundAmount: string | null; url: string }) {
  return {
    subject: et("Tu sesión «{productTitle}» se ha cancelado", { productTitle: o.productTitle }),
    html: layout({
      brand: o.creatorName,
      title: et("Sesión cancelada"),
      body:
        p(et("{creatorName} ha cancelado tu sesión «{productTitle}»{when}.", { creatorName: esc(o.creatorName), productTitle: esc(o.productTitle), when: o.when ? ` del ${esc(o.when)}` : "" })) +
        (o.reason ? p(et("Motivo: <em>«{reason}»</em>", { reason: esc(o.reason) })) : "") +
        (o.refundAmount ? p(et("Te hemos devuelto <strong>{refundAmount}</strong>. {arrives}", { refundAmount: esc(o.refundAmount), arrives: arrives() })) : ""),
      cta: { label: et("Ver mis compras"), url: o.url },
    }),
  };
}

export function refundIssuedEmail(o: { creatorName: string; productTitle: string; amount: string; partial: boolean; accessRevoked: boolean; note: string | null; url: string }) {
  return {
    subject: et("Te hemos devuelto {amount} de «{productTitle}»", { amount: o.amount, productTitle: o.productTitle }),
    html: layout({
      brand: o.creatorName,
      title: et("Reembolso en camino"),
      body:
        p(et("{creatorName} te ha devuelto <strong>{amount}</strong>{partial} de «{productTitle}». {arrives}", { creatorName: esc(o.creatorName), amount: esc(o.amount), partial: o.partial ? et(" de tu compra") : "", productTitle: esc(o.productTitle), arrives: arrives() })) +
        (o.accessRevoked ? p(et("Ya no tendrás acceso a este contenido.")) : "") +
        (o.note ? quote(o.creatorName, o.note) : ""),
      cta: { label: et("Ver mis compras"), url: o.url },
    }),
  };
}

/** Acuse de recibo del desistimiento (TRLGDCU art. 106.4: hay que confirmarlo sin demora). */
export function withdrawalReceiptEmail(o: { creatorName: string; productTitle: string; amount: string; url: string; membership?: boolean }) {
  return {
    subject: et("Hemos recibido tu desistimiento de «{productTitle}»", { productTitle: o.productTitle }),
    html: layout({
      brand: o.creatorName,
      title: et("Desistimiento recibido"),
      body:
        p(
          et("Has ejercido tu derecho de desistimiento de «{productTitle}». Te devolvemos <strong>{amount}</strong>{membership} por el mismo medio de pago; lo verás en 5-10 días hábiles.", { productTitle: esc(o.productTitle), amount: esc(o.amount), membership: o.membership ? et(", la parte proporcional de los días que no has disfrutado,") : "" }),
        ) +
        (o.membership ? p(et("Tu membresía ha terminado hoy: ya no se renovará ni se te cobrará nada más.")) : "") +
        p(muted(et("Guarda este email: es el acuse de recibo de tu desistimiento."))),
      cta: { label: et("Ver mis compras"), url: o.url },
    }),
  };
}

export function withdrawalCreatorEmail(o: { buyer: string; productTitle: string; amount: string; url: string; membership?: boolean }) {
  return {
    subject: et("{buyer} ha desistido de «{productTitle}»", { buyer: o.buyer, productTitle: o.productTitle }),
    html: layout({
      title: et("Desistimiento de una compra"),
      body: p(et("{buyer} ha ejercido su derecho de desistimiento de «{productTitle}» dentro del plazo de 14 días. Le hemos devuelto <strong>{amount}</strong>{membership}.", { buyer: esc(o.buyer), productTitle: esc(o.productTitle), amount: esc(o.amount), membership: o.membership ? et(" (la parte proporcional de los días que no ha disfrutado) y su membresía ha terminado") : et(" y retirado el acceso") })),
      cta: { label: et("Ver el pedido"), url: o.url },
    }),
  };
}

export function refundFailedCreatorEmail(o: { buyer: string; productTitle: string; amount: string; error: string; url: string }) {
  return {
    subject: et("No se ha podido completar un reembolso"),
    html: layout({
      title: et("Reembolso fallido"),
      body:
        p(et("La pasarela no ha podido devolver <strong>{amount}</strong> a {buyer} por «{productTitle}».", { amount: esc(o.amount), buyer: esc(o.buyer), productTitle: esc(o.productTitle) })) +
        p(`Motivo: ${esc(o.error)}`) +
        p(et("Puedes volver a intentarlo desde el pedido. Si el acceso ya se había retirado, sigue retirado.")),
      cta: { label: et("Ver el pedido"), url: o.url },
    }),
  };
}

export function rescheduledCreatorEmail(o: { buyer: string; productTitle: string; when: string; url: string }) {
  return {
    subject: et("{buyer} ha elegido nueva fecha", { buyer: o.buyer }),
    html: layout({
      title: et("Nueva fecha elegida"),
      body: p(et("{buyer} ha elegido nueva fecha para «{productTitle}»: <strong>{when}</strong>.", { buyer: esc(o.buyer), productTitle: esc(o.productTitle), when: esc(o.when) })),
      cta: { label: et("Ver mis reservas"), url: o.url },
    }),
  };
}
