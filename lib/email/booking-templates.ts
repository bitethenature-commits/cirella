/**
 * Emails del calendario propio: avisos a la dueña (nueva reserva, cambio de fecha, cancelación del
 * sistema, datos actualizados) y a la clienta (sesión dada a mano, enlace nuevo, lectura entregada,
 * grabación del taller). Todo lo que escribe una persona pasa por esc(); el mensaje de la entrega, por
 * richToEmailHtml (muestra el dominio real de cada enlace).
 */
import { esc, p } from "./html";
import { layout } from "./templates";
import { richToEmailHtml } from "./rich-html";
import { et } from "@/lib/i18n/email";

const muted = (s: string) => `<span style="color:#A99FC2;font-size:13px">${s}</span>`;
const note = (s?: string | null) => (s ? p(muted(esc(s))) : "");

/** Tabla sencilla etiqueta / valor (datos para la lectura). */
export function detailsTable(lines: { label: string; value: string }[]) {
  if (!lines.length) return "";
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:4px 0 14px;font-size:14px">${lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 10px 6px 0;color:#A99FC2;vertical-align:top;white-space:nowrap">${esc(et(l.label))}</td><td style="padding:6px 0;color:#F4EBD8;white-space:pre-line">${esc(l.value)}</td></tr>`,
    )
    .join("")}</table>`;
}

export function ownerBookingEmail(o: {
  kind: "new" | "scheduled" | "rescheduled";
  buyer: string;
  productTitle: string;
  /** En la zona de la dueña. */
  when: string | null;
  /** «para ella, 11:00 en Bogotá» (vacío si es la misma hora). */
  clientNote?: string;
  previousWhen?: string | null;
  amount?: string | null;
  seats?: { taken: number; capacity: number | null } | null;
  intake?: { label: string; value: string }[];
  intakeMissing?: boolean;
  url: string;
}) {
  const short = o.when ?? et("sin fecha");
  const subject =
    o.kind === "rescheduled"
      ? et("{buyer} ha cambiado la fecha: {short}", { buyer: o.buyer, short: short })
      : o.kind === "scheduled"
        ? et("{buyer} ha elegido fecha: {short}", { buyer: o.buyer, short: short })
        : o.seats
          ? et("Nueva plaza: {buyer} · {productTitle}", { buyer: o.buyer, productTitle: o.productTitle })
          : et("Nueva reserva: {buyer} · {short}", { buyer: o.buyer, short: short });
  const title = o.kind === "rescheduled" ? et("Cambio de fecha") : o.kind === "scheduled" ? et("Fecha elegida") : o.seats ? et("Nueva plaza en tu taller") : et("Nueva reserva");
  const over = o.seats && o.seats.capacity != null && o.seats.taken > o.seats.capacity;
  const body =
    p(`<strong>${esc(o.buyer)}</strong> · ${esc(o.productTitle)}`) +
    p(o.when ? `<strong>${esc(o.when)}</strong>${o.clientNote ? `<br>${muted(esc(o.clientNote))}` : ""}` : et("Todavía no ha elegido fecha: le hemos enviado el enlace para hacerlo.")) +
    (o.previousWhen ? p(muted(`Antes: ${esc(o.previousWhen)}`)) : "") +
    (o.amount ? p(et("Ha pagado {amount}.", { amount: esc(o.amount) })) : "") +
    (o.seats
      ? p(
          over
            ? et("<strong>Aforo superado: {taken} de {capacity}.</strong> Dos pagos llegaron a la vez; decide si la mantienes o le devuelves el dinero.", { taken: o.seats.taken, capacity: o.seats.capacity })
            : `Plazas: ${o.seats.taken}${o.seats.capacity != null ? ` de ${o.seats.capacity}` : ""}.`,
        )
      : "") +
    (o.intake?.length ? p(et("<strong>Datos para la lectura</strong>")) + detailsTable(o.intake) : o.intakeMissing ? p(muted(et("Todavía no ha enviado sus datos para la lectura: se los hemos pedido."))) : "");
  return { subject, html: layout({ title, body, cta: { label: et("Ver la reserva"), url: o.url } }) };
}

export function ownerCancelledEmail(o: { buyer: string; productTitle: string; when: string | null; reason: string; url: string }) {
  return {
    subject: et("Se ha cancelado la sesión de {buyer}", { buyer: o.buyer }),
    html: layout({
      title: et("Sesión cancelada"),
      body:
        p(et("La sesión de <strong>{buyer}</strong> ({productTitle}){when} se ha cancelado y el hueco vuelve a estar libre.", { buyer: esc(o.buyer), productTitle: esc(o.productTitle), when: o.when ? ` del ${esc(o.when)}` : "" })) +
        p(muted(esc(o.reason))),
      cta: { label: et("Ver mis reservas"), url: o.url },
    }),
  };
}

export function intakeUpdatedOwnerEmail(o: { buyer: string; productTitle: string; first: boolean; lines: { label: string; value: string }[]; url: string }) {
  return {
    subject: o.first ? et("{buyer} te ha enviado sus datos", { buyer: o.buyer }) : et("{buyer} ha actualizado sus datos", { buyer: o.buyer }),
    html: layout({
      title: o.first ? et("Datos para la lectura") : et("Datos actualizados"),
      body: p(`${esc(o.buyer)} · ${esc(o.productTitle)}`) + detailsTable(o.lines),
      cta: { label: et("Ver la reserva"), url: o.url },
    }),
  };
}

export function manualSessionEmail(o: {
  creatorName: string;
  productTitle: string;
  /** En la zona de la clienta. null = la elige ella. */
  when: string | null;
  gift: boolean;
  message?: string | null;
  meetingUrl?: string | null;
  meetingLabel?: string;
  url: string;
  linkNote?: string;
  intakeUrl?: string | null;
  icsUrl?: string | null;
}) {
  const subject = o.when
    ? et("{creatorName} te ha reservado una sesión · {when}", { creatorName: o.creatorName, when: o.when })
    : o.gift
      ? et("{creatorName} te regala una sesión: elige fecha", { creatorName: o.creatorName })
      : et("{creatorName} te ha reservado una sesión: elige fecha", { creatorName: o.creatorName });
  const body =
    p(
      o.when
        ? et("{creatorName} te ha reservado <strong>{productTitle}</strong>:<br><strong>{when}</strong>", { creatorName: esc(o.creatorName), productTitle: esc(o.productTitle), when: esc(o.when) })
        : et(o.gift ? "{creatorName} te regala <strong>{productTitle}</strong>. Elige el día y la hora que mejor te vengan." : "{creatorName} te ha reservado <strong>{productTitle}</strong>. Elige el día y la hora que mejor te vengan.", { creatorName: esc(o.creatorName), productTitle: esc(o.productTitle) }),
    ) +
    (o.message ? p(et("«{message}»", { message: esc(o.message) })) : "") +
    (o.when && o.meetingUrl ? p(`${esc(o.meetingLabel ?? et("Enlace de la videollamada"))}: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`) : "") +
    (o.intakeUrl ? p(et("<strong>Completa tus datos para la lectura.</strong> <a href=\"{intakeUrl}\">Enviar mis datos</a>", { intakeUrl: esc(o.intakeUrl) })) : "") +
    (o.when ? p(muted(et("Si no te viene bien, puedes elegir otra fecha desde el enlace (hasta 24 horas antes)."))) : "") +
    (o.icsUrl ? p(et("<a href=\"{icsUrl}\" style=\"color:#D9BF8C\">Añadir a mi calendario</a>", { icsUrl: esc(o.icsUrl) })) : "");
  return {
    subject,
    html: layout({ brand: o.creatorName, title: o.when ? et("Tienes una sesión reservada") : et("Elige fecha para tu sesión"), body, cta: { label: o.when ? et("Ver mi sesión") : et("Elegir fecha"), url: o.url }, afterCta: note(o.linkNote) }),
  };
}

export function meetingLinkChangedEmail(o: { creatorName: string; productTitle: string; when: string; meetingUrl: string | null; meetingLabel: string; url: string; linkNote?: string }) {
  return {
    subject: et("Nuevo enlace para tu sesión · {when}", { when: o.when }),
    html: layout({
      brand: o.creatorName,
      title: et("Nuevo enlace para tu sesión"),
      body:
        p(`<strong>${esc(o.productTitle)}</strong><br>${esc(o.when)}`) +
        (o.meetingUrl
          ? p(`${esc(o.meetingLabel)}: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`)
          : p(et("{creatorName} te enviará el enlace de la videollamada antes de la sesión.", { creatorName: esc(o.creatorName) }))),
      cta: { label: et("Ver mi sesión"), url: o.url },
      afterCta: note(o.linkNote),
    }),
  };
}

