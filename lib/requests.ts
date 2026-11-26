import "server-only";
import { Prisma } from "@prisma/client";
import { asAccessMode } from "./access-mode";
import { hasBookingClash, isGroupSession, isSlotAvailable, lockCreatorBookings, lockProductSeats, SESSION_DEFAULTS, seatsTaken } from "./booking";
import { prisma } from "./db";
import { appUrl } from "./env";
import { detailsTable } from "./email/booking-templates";
import { esc, p } from "./email/html";
import { enqueueEmail } from "./email/outbox";
import { automationSetting, customEmail } from "./automations";
import { layout } from "./email/templates";
import { intakeLines, type IntakeAnswers } from "./intake";
import { formatPrice } from "./money";
import { effectivePriceCents } from "./offers";
import { firstPeriodEnd } from "./membership-renewal";
import { fulfillOrder, type SessionOrderMeta } from "./orders";
import { canonicalTimezone } from "./timezones";
import { formatSessionDate, labelToMinutes, zonedTimeToUtc } from "./tz";
import { et, inMail, requestLocale } from "@/lib/i18n/email";

/**
 * Solicitudes: la web no cobra. En vez de pagar, la clienta rellena un formulario (sus datos, un
 * mensaje y, en una sesión, el día y la hora que quiere) y le llega a la dueña por email y a
 * /panel/clientes (pestaña «Nuevas»). Lo hablan por email y, cuando la dueña confirma, se entrega como un acceso dado
 * a mano: cuenta de la clienta, acceso al curso, reserva, emails y su área (fulfillOrder).
 *
 * Una solicitud es un pedido de 0 € («manual») con status REQUESTED: su hora queda guardada
 * (lib/booking.ts → holdWhere) hasta que la dueña la confirma o la descarta (DECLINED).
 */
export const REQUESTED = "REQUESTED";
export const DECLINED = "DECLINED";

export type RequestMeta = SessionOrderMeta & { request: true; phone?: string; priceCents?: number; declinedAt?: string; confirmedAt?: string };

export class RequestError extends Error {}

/** Producto que se puede solicitar: «con solicitud» (PAID), publicado y de una creadora activa. */
export async function getRequestableProduct(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { creator: { include: { user: { select: { email: true } } } } } });
  if (!product || product.status !== "PUBLISHED" || asAccessMode(product.accessMode) !== "PAID") return null;
  if (product.creator.status !== "ACTIVE" || !product.creator.published) return null;
  if (isGroupSession(product) && (!product.eventStartAt || product.eventStartAt <= new Date())) return null;
  return product;
}

export async function createRequest(input: {
  productId: string;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  slotStart?: string | null;
  buyerTz?: string | null;
  intake?: IntakeAnswers | null;
  marketingOptIn?: boolean;
  visitorId?: string | null;
  ipHash?: string | null;
}) {
  const product = await getRequestableProduct(input.productId);
  if (!product) throw new RequestError("Este producto no está disponible ahora mismo.");
  const group = isGroupSession(product);
  const slotStart = product.type === "SESSION" && !group ? input.slotStart || null : null;
  const buyerTz = product.type === "SESSION" ? canonicalTimezone(input.buyerTz) : null;
  const meta: RequestMeta = {
    request: true,
    manual: "paid_elsewhere",
    priceCents: effectivePriceCents(product),
    ...(input.phone?.trim() ? { phone: input.phone.trim().slice(0, 40) } : {}),
    ...(input.message?.trim() ? { message: input.message.trim().slice(0, 2000) } : {}),
    ...(slotStart ? { slotStart } : {}),
    ...(buyerTz ? { buyerTz } : {}),
  };
  const order = await prisma.$transaction(async (tx) => {
    // La hora (o la plaza) se comprueba y se guarda bajo el cerrojo: dos personas no piden la misma.
    if (group) {
      await lockProductSeats(tx, product.id);
      if (product.capacity != null && (await seatsTaken(tx, product.id, { holds: true })) >= product.capacity) throw new RequestError("No quedan plazas en este taller.");
    } else if (slotStart) {
      await lockCreatorBookings(tx, product.creatorId);
      if (!(await isSlotAvailable(product, slotStart, { client: tx, manual: true, holds: true }))) throw new RequestError("Ese horario acaba de ocuparse. Elige otro, por favor.");
    }
    return tx.order.create({
      data: {
        creatorId: product.creatorId,
        productId: product.id,
        productTitle: product.title,
        productType: product.type,
        buyerEmail: input.email.trim().toLowerCase(),
        locale: await requestLocale(),
        buyerName: input.name.trim() || null,
        status: REQUESTED,
        amountCents: 0,
        currency: product.currency,
        commissionBps: 0,
        platformFeeCents: 0,
        netCents: 0,
        paymentProvider: "manual",
        marketingOptIn: !!input.marketingOptIn,
        metadata: meta as Prisma.InputJsonObject,
        intake: input.intake ? (input.intake as unknown as Prisma.InputJsonObject) : undefined,
        intakeUpdatedAt: input.intake ? new Date() : null,
        visitorId: input.visitorId ?? null,
        ipHash: input.ipHash ?? null,
      },
    });
  });

  // Avisos: a la dueña (con todo) y a la clienta (recibido; se habla por email).
  const tz = product.creator.timezone;
  const when = slotStart ? formatSessionDate(new Date(slotStart), tz) : group && product.eventStartAt ? formatSessionDate(product.eventStartAt, tz) : null;
  const price = meta.priceCents ? formatPrice(meta.priceCents, product.currency, product.billingInterval) : null;
  const lines = [
    { label: "Nombre", value: order.buyerName ?? "" },
    { label: "Email", value: order.buyerEmail },
    ...(meta.phone ? [{ label: "Teléfono", value: meta.phone }] : []),
    ...(when ? [{ label: "Día y hora", value: when }] : []),
    ...(price ? [{ label: "Precio", value: price }] : []),
    ...(meta.message ? [{ label: "Mensaje", value: meta.message }] : []),
    ...(input.intake ? intakeLines(input.intake) : []),
  ].filter((l) => l.value);
  const ownerTo = product.creator.contactEmail || product.creator.user.email;
  const buyer = order.buyerName ?? order.buyerEmail;
  // En el idioma de su panel (lib/i18n/email.ts).
  const ownerMail = await inMail(ownerTo, () => ({
    subject: et("Nueva solicitud: {buyer} · {productTitle}", { buyer, productTitle: product.title }),
    html: layout({
      title: et("Nueva solicitud"),
      body:
        p(et("<strong>{buyer}</strong> quiere <strong>{productTitle}</strong>.", { buyer: esc(buyer), productTitle: esc(product.title) })) +
        detailsTable(lines) +
        p(
          slotStart
            ? et("Respóndele a este email para hablar del pago. Cuando esté, confírmalo en el panel y recibirá el acceso y la reserva.")
            : et("Respóndele a este email para hablar del pago. Cuando esté, confírmalo en el panel y recibirá el acceso."),
        ),
      cta: { label: et("Ver la solicitud"), url: `${appUrl()}/panel/clientes` },
    }),
  }));
  await enqueueEmail({
    to: ownerTo,
    creatorId: product.creatorId,
    template: "REQUEST_OWNER",
    dedupeKey: `request-owner:${order.id}`,
    replyTo: order.buyerEmail,
    ...ownerMail,
  });
  const rs = await automationSetting(product.creatorId, "REQUEST_RECEIVED");
  if (rs.enabled) {
    const custom = customEmail(rs, {
      nombre: order.buyerName?.trim().split(/\s+/)[0] || null,
      mi_nombre: product.creator.displayName,
      producto: product.title,
      fecha: when,
    });
    await enqueueEmail({
      to: order.buyerEmail,
      creatorId: product.creatorId,
      template: "REQUEST_RECEIVED",
      dedupeKey: `request-received:${order.id}`,
      replyTo: product.creator.contactEmail || product.creator.user.email,
      ...(await inMail(order.buyerEmail, () => ({
        subject: custom.subject || et("He recibido tu mensaje ✦ {title}", { title: product.title }),
        html: receivedEmailHtml({
          brand: product.creator.displayName,
          buyer: order.buyerName,
          productTitle: product.title,
          when,
          price,
          message: meta.message ?? null,
          introHtml: custom.introHtml,
        }),
      }))),
    });
  }
  return order;
}

/**
 * Email «He recibido tu mensaje» a la clienta, como una carta: su mensaje citado, lo que pidió, la hora
 * que le guarda (si es una sesión), los tres pasos y la firma de la dueña. Sin enlaces que pagar.
 */
export function receivedEmailHtml(o: { brand: string; buyer: string | null; productTitle: string; when: string | null; price: string | null; message: string | null; introHtml?: string | null }) {
  const first = o.brand.split(" ")[0];
  const gold = "#D9BF8C";
  const muted = "#A99FC2";
  const box = (inner: string) => `<div style="margin:18px 0;padding:16px 18px;border:1px solid #6E5B3A;border-radius:14px;background:#211D49">${inner}</div>`;
  const steps = [
    ["1", et("Me has escrito"), et("Ya tengo tu mensaje.")],
    ["2", et("Te respondo"), et("En persona, desde este mismo correo.")],
    ["3", et("Lo cerramos"), et("Te cuento cómo pagar y recibes tu acceso.")],
  ]
    .map(
      ([n, t, d], i) =>
        `<tr><td style="width:34px;vertical-align:top;padding:6px 0"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;border:1px solid ${gold};color:${gold};text-align:center;font-size:12px;font-weight:600;${i === 0 ? `background:${gold};color:#1A1408;` : ""}">${n}</div></td><td style="padding:6px 0 6px 6px;font-size:14px;color:#F4EBD8"><strong>${t}</strong><br><span style="color:${muted};font-size:13px">${d}</span></td></tr>`,
    )
    .join("");
  return layout({
    brand: o.brand,
    title: et("He recibido tu mensaje"),
    preheader: et("Te responderé muy pronto, en persona, desde este mismo correo."),
    body:
      (o.introHtml ||
        p(et("Hola{name},", { name: o.buyer ? ` ${esc(o.buyer.split(" ")[0])}` : "" })) +
          p(et("gracias por escribirme. Me ha llegado tu mensaje sobre <strong>{title}</strong>{price} y te responderé muy pronto desde este mismo correo.", { title: esc(o.productTitle), price: o.price ? ` <span style="color:${muted}">(${esc(o.price)})</span>` : "" }))) +
      (o.when ? box(`<span style="color:${muted};font-size:12px;letter-spacing:.12em;text-transform:uppercase">${et("Tu hora, guardada")}</span><br><strong style="font-size:16px">${esc(o.when)}</strong><br><span style="color:${muted};font-size:13px">${et("Te la guardo mientras lo hablamos.")}</span>`) : "") +
      (o.message ? box(`<span style="color:${muted};font-size:12px;letter-spacing:.12em;text-transform:uppercase">${et("Tu mensaje")}</span><br><span style="font-style:italic;white-space:pre-line">${esc(o.message)}</span>`) : "") +
      `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 14px">${steps}</table>` +
      p(et("Aquí no se paga nada: cuando lo hablemos te diré cómo hacerlo, con calma.")) +
      `<p style="margin:22px 0 0;font-family:Georgia,serif;font-style:italic;font-size:18px;color:${gold}">${et("Con cariño, {name}", { name: esc(first) })}</p>`,
    areaLink: false,
  });
}

/** Solicitud de esta creadora que sigue pendiente. */
async function pendingRequest(creatorId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, creatorId, status: REQUESTED }, include: { product: true, creator: { select: { timezone: true } } } });
  if (!order) throw new RequestError("Esta solicitud ya no está pendiente.");
  return order;
}

/**
 * Cambiar el día y la hora de una solicitud de sesión (hora de la dueña). Puede salirse de su horario,
 * pero no chocar con otra reserva confirmada ni con un taller.
 */
export async function rescheduleRequest(creatorId: string, orderId: string, date: string, time: string) {
  const order = await pendingRequest(creatorId, orderId);
  if (order.productType !== "SESSION" || isGroupSession(order.product)) throw new RequestError("Esta solicitud no lleva hora.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new RequestError("Escribe el día y la hora.");
  const start = zonedTimeToUtc(date, labelToMinutes(time), order.creator.timezone);
  if (Number.isNaN(start.getTime()) || start <= new Date()) throw new RequestError("Elige un día y una hora futuros.");
  const end = new Date(start.getTime() + (order.product.durationMin ?? SESSION_DEFAULTS.durationMin) * 60000);
  await prisma.$transaction(async (tx) => {
    if (await hasBookingClash(tx, creatorId, start, end, order.product.bufferMin ?? SESSION_DEFAULTS.bufferMin)) throw new RequestError("Ya tienes otra sesión a esa hora.");
    const meta = { ...((order.metadata ?? {}) as RequestMeta), slotStart: start.toISOString(), ownerPlaced: true };
    await tx.order.update({ where: { id: order.id }, data: { metadata: meta as Prisma.InputJsonObject } });
  });
  return start;
}

/** Quitar la hora: se confirmará como «pendiente de fecha» y la clienta la elige desde su área. */
export async function clearRequestSlot(creatorId: string, orderId: string) {
  const order = await pendingRequest(creatorId, orderId);
  const { slotStart: _s, ownerPlaced: _o, ...meta } = (order.metadata ?? {}) as RequestMeta;
  await prisma.order.update({ where: { id: order.id }, data: { metadata: meta as Prisma.InputJsonObject } });
}

/**
 * Confirmar: ya lo habéis hablado y ha pagado. Se entrega como un acceso dado a mano (fulfillOrder):
 * acceso, reserva con su hora (si sigue libre; si no, pendiente de fecha) y los emails de siempre.
 */
export async function confirmRequest(creatorId: string, orderId: string) {
  const order = await pendingRequest(creatorId, orderId);
  const meta = {
    ...((order.metadata ?? {}) as RequestMeta),
    confirmedAt: new Date().toISOString(),
    ...((order.metadata as RequestMeta | null)?.slotStart ? { ownerPlaced: true } : {}),
    // Membresía: un periodo (mes o año). 5 días antes le llega el aviso para renovar.
    ...(order.productType === "MEMBERSHIP" ? { accessUntil: firstPeriodEnd(order.product.billingInterval, order.creator.timezone).toISOString() } : {}),
  };
  await prisma.order.update({ where: { id: order.id }, data: { metadata: meta as Prisma.InputJsonObject, chargedAt: new Date() } });
  await fulfillOrder(order.id, "");
  const booking = await prisma.booking.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "asc" }, select: { id: true, status: true } });
  return { bookingId: booking?.id ?? null, bookingStatus: booking?.status ?? null, productType: order.productType };
}

/** Descartar: no sigue adelante. Su hora queda libre. */
export async function declineRequest(creatorId: string, orderId: string) {
  const order = await pendingRequest(creatorId, orderId);
  const meta = { ...((order.metadata ?? {}) as RequestMeta), declinedAt: new Date().toISOString() };
  await prisma.order.update({ where: { id: order.id }, data: { status: DECLINED, metadata: meta as Prisma.InputJsonObject } });
}

/** Volver a abrir una solicitud descartada (por si fue sin querer). */
export async function reopenRequest(creatorId: string, orderId: string) {
  const r = await prisma.order.updateMany({ where: { id: orderId, creatorId, status: DECLINED }, data: { status: REQUESTED } });
  if (!r.count) throw new RequestError("Esta solicitud ya no se puede recuperar.");
}

