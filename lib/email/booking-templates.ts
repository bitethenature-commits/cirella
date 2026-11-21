/**
 * Emails del calendario propio: avisos a la dueña (nueva reserva, cambio de fecha, cancelación del
 * sistema, datos actualizados) y a la clienta (sesión dada a mano, enlace nuevo, lectura entregada,
 * grabación del taller). Todo lo que escribe una persona pasa por esc(); el mensaje de la entrega, por
 * richToEmailHtml (muestra el dominio real de cada enlace).
 */
import { esc, p } from "./html";
import { layout } from "./templates";
import { richToEmailHtml } from "./rich-html";

const muted = (s: string) => `<span style="color:#A99FC2;font-size:13px">${s}</span>`;
const note = (s?: string | null) => (s ? p(muted(esc(s))) : "");

/** Tabla sencilla etiqueta / valor (datos para la lectura). */
export function detailsTable(lines: { label: string; value: string }[]) {
  if (!lines.length) return "";
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:4px 0 14px;font-size:14px">${lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 10px 6px 0;color:#A99FC2;vertical-align:top;white-space:nowrap">${esc(l.label)}</td><td style="padding:6px 0;color:#F4EBD8;white-space:pre-line">${esc(l.value)}</td></tr>`,
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
  const short = o.when ?? "sin fecha";
  const subject =
    o.kind === "rescheduled"
      ? `${o.buyer} ha cambiado la fecha: ${short}`
      : o.kind === "scheduled"
        ? `${o.buyer} ha elegido fecha: ${short}`
        : o.seats
          ? `Nueva plaza: ${o.buyer} · ${o.productTitle}`
          : `Nueva reserva: ${o.buyer} · ${short}`;
  const title = o.kind === "rescheduled" ? "Cambio de fecha" : o.kind === "scheduled" ? "Fecha elegida" : o.seats ? "Nueva plaza en tu taller" : "Nueva reserva";
  const over = o.seats && o.seats.capacity != null && o.seats.taken > o.seats.capacity;
  const body =
    p(`<strong>${esc(o.buyer)}</strong> · ${esc(o.productTitle)}`) +
    p(o.when ? `<strong>${esc(o.when)}</strong>${o.clientNote ? `<br>${muted(esc(o.clientNote))}` : ""}` : "Todavía no ha elegido fecha: le hemos enviado el enlace para hacerlo.") +
    (o.previousWhen ? p(muted(`Antes: ${esc(o.previousWhen)}`)) : "") +
    (o.amount ? p(`Ha pagado ${esc(o.amount)}.`) : "") +
    (o.seats
      ? p(
          over
            ? `<strong>Aforo superado: ${o.seats.taken} de ${o.seats.capacity}.</strong> Dos pagos llegaron a la vez; decide si la mantienes o le devuelves el dinero.`
            : `Plazas: ${o.seats.taken}${o.seats.capacity != null ? ` de ${o.seats.capacity}` : ""}.`,
        )
      : "") +
    (o.intake?.length ? p("<strong>Datos para la lectura</strong>") + detailsTable(o.intake) : o.intakeMissing ? p(muted("Todavía no ha enviado sus datos para la lectura: se los hemos pedido.")) : "");
  return { subject, html: layout({ title, body, cta: { label: "Ver la reserva", url: o.url } }) };
}

export function ownerCancelledEmail(o: { buyer: string; productTitle: string; when: string | null; reason: string; url: string }) {
  return {
    subject: `Se ha cancelado la sesión de ${o.buyer}`,
    html: layout({
      title: "Sesión cancelada",
      body:
        p(`La sesión de <strong>${esc(o.buyer)}</strong> (${esc(o.productTitle)})${o.when ? ` del ${esc(o.when)}` : ""} se ha cancelado y el hueco vuelve a estar libre.`) +
        p(muted(esc(o.reason))),
      cta: { label: "Ver mis reservas", url: o.url },
    }),
  };
}

export function intakeUpdatedOwnerEmail(o: { buyer: string; productTitle: string; first: boolean; lines: { label: string; value: string }[]; url: string }) {
  return {
    subject: o.first ? `${o.buyer} te ha enviado sus datos` : `${o.buyer} ha actualizado sus datos`,
    html: layout({
      title: o.first ? "Datos para la lectura" : "Datos actualizados",
      body: p(`${esc(o.buyer)} · ${esc(o.productTitle)}`) + detailsTable(o.lines),
      cta: { label: "Ver la reserva", url: o.url },
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
    ? `${o.creatorName} te ha reservado una sesión · ${o.when}`
    : o.gift
      ? `${o.creatorName} te regala una sesión: elige fecha`
      : `${o.creatorName} te ha reservado una sesión: elige fecha`;
  const body =
    p(
      o.when
        ? `${esc(o.creatorName)} te ha reservado <strong>${esc(o.productTitle)}</strong>:<br><strong>${esc(o.when)}</strong>`
        : `${esc(o.creatorName)} te ${o.gift ? "regala" : "ha reservado"} <strong>${esc(o.productTitle)}</strong>. Elige el día y la hora que mejor te vengan.`,
    ) +
    (o.message ? p(`«${esc(o.message)}»`) : "") +
    (o.when && o.meetingUrl ? p(`${esc(o.meetingLabel ?? "Enlace de la videollamada")}: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`) : "") +
    (o.intakeUrl ? p(`<strong>Completa tus datos para la lectura.</strong> <a href="${esc(o.intakeUrl)}">Enviar mis datos</a>`) : "") +
    (o.when ? p(muted("Si no te viene bien, puedes elegir otra fecha desde el enlace (hasta 24 horas antes).")) : "") +
    (o.icsUrl ? p(`<a href="${esc(o.icsUrl)}" style="color:#D9BF8C">Añadir a mi calendario</a>`) : "");
  return {
    subject,
    html: layout({ brand: o.creatorName, title: o.when ? "Tienes una sesión reservada" : "Elige fecha para tu sesión", body, cta: { label: o.when ? "Ver mi sesión" : "Elegir fecha", url: o.url }, afterCta: note(o.linkNote) }),
  };
}

export function meetingLinkChangedEmail(o: { creatorName: string; productTitle: string; when: string; meetingUrl: string | null; meetingLabel: string; url: string; linkNote?: string }) {
  return {
    subject: `Nuevo enlace para tu sesión · ${o.when}`,
    html: layout({
      brand: o.creatorName,
      title: "Nuevo enlace para tu sesión",
      body:
        p(`<strong>${esc(o.productTitle)}</strong><br>${esc(o.when)}`) +
        (o.meetingUrl
          ? p(`${esc(o.meetingLabel)}: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`)
          : p(`${esc(o.creatorName)} te enviará el enlace de la videollamada antes de la sesión.`)),
      cta: { label: "Ver mi sesión", url: o.url },
      afterCta: note(o.linkNote),
    }),
  };
}

