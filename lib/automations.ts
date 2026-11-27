import { creatorLegalHref } from "@/lib/legal";
import { productPath, loginPath } from "@/lib/public-paths";
import { isNoChargeOrder } from "./access-mode";
import { orderTargetPath } from "./auth-utils";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { accessEmailGreetingName, accessUntil, newsletterConfirmPath, newsletterPending } from "./free-access-rules";
import { lastDayText } from "./access-end";
import * as T from "./email/templates";
import { formatLegalAddress, sellerStatement, sessionChangePolicyText, type LegalIdentity } from "./legal";
import type { LegalSnapshotContent } from "./legal-snapshot";
import { formatPrice } from "./money";
import { createOrderLink, emailAlreadyQueued, orderLinkNote } from "./order-links";
import { planFeatures } from "./plans";
import { hasOptedOut, optOutHeaders, optOutUrl } from "./recovery-optout";
import { clientTimeNote, formatDate, formatSessionDate, sessionWhen } from "./tz";
import type { BookingChange, DomainEvent } from "./events";
import { createHash } from "node:crypto";
import { intakeLines, intakeMissing, readIntakeAnswers, readIntakeConfig } from "./intake";
import { meetingLabel } from "./meeting-url";
import { moonCircleSky } from "./moon-circle-sky";
import { icsUrl } from "./ics";
import { isPersonalMode } from "./site-mode";
import { withdrawalDeadline } from "./withdrawal";
import * as BT from "./email/booking-templates";
import { readDesign, type EmailVars } from "./email-blocks";
import { renderDesignHtml, renderSubject } from "./email/blocks-html";

// Compatibilidad: el código de negocio sigue importando emit y DomainEvent desde aquí.
export { emit } from "./events";
export type { DomainEvent } from "./events";

/**
 * Automatizaciones = eventos de dominio → acciones (hoy: emails).
 *
 * El código de negocio guarda eventos de dominio (lib/events.ts, en la misma transacción que
 * el cambio); el outbox los entrega a lib/event-handlers.ts, que llama a `handleAutomation`.
 * Aquí se decide qué hacer con cada evento según:
 *   · el catálogo de automatizaciones (AUTOMATIONS),
 *   · el plan de la creadora (las "pro" requieren la palanca `automations`),
 *   · la configuración de la creadora (tabla Automation: activada, retraso, texto).
 *
 * Añadir una automatización nueva = una entrada en AUTOMATIONS + un `case` en
 * `handleAutomation`. Si algo falla, lanza: el outbox reintenta el evento, así que cada acción
 * tiene que ser idempotente (todos los emails llevan dedupeKey). Para otros canales (WhatsApp,
 * webhooks, Zapier) se añade otra acción junto a `enqueueEmail` sin tocar el resto del sistema.
 *
 * Los emails de una compra llevan un enlace personal (lib/order-links.ts): abre solo ese pedido
 * (sesión limitada de 7 días), nunca la cuenta completa. Se crea solo si el email se va a crear de
 * verdad (dedupeKey libre), para no dejar enlaces que nadie recibe al reprocesar un evento.
 */

export { AUTOMATIONS, automationDefaultOn, type AutomationTrigger } from "./automation-catalog";
import { AUTOMATIONS, automationDefaultOn, type AutomationTrigger } from "./automation-catalog";
import { inMail } from "@/lib/i18n/email";

/** Configuración de una automatización para una creadora (también la usan el cron de caducidades y la comunidad). */
export async function automationSetting(creatorId: string, trigger: AutomationTrigger) {
  return setting(creatorId, trigger);
}

async function setting(creatorId: string, trigger: AutomationTrigger) {
  const [row, creator] = await Promise.all([
    prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId, trigger } } }),
    prisma.creator.findUniqueOrThrow({ where: { id: creatorId }, include: { plan: true, user: true } }),
  ]);
  const meta = AUTOMATIONS[trigger];
  const allowed = meta.essential || planFeatures(creator.plan).automations;
  const enabled = allowed && (row ? row.enabled || meta.essential : automationDefaultOn(trigger));
  return {
    enabled,
    delayMinutes: row?.delayMinutes ?? meta.defaultDelay,
    subject: row?.subject || null,
    message: row?.message || null,
    messageFormat: row?.message ? (row.messageFormat ?? null) : null,
    /** Email editado con el editor visual (null = el original). */
    design: readDesign(row?.design),
    creator,
  };
}

type Setting = Awaited<ReturnType<typeof setting>>;

function withCustomSubject<T extends { subject: string }>(mail: T, subject: string | null) {
  return subject ? { ...mail, subject } : mail;
}

/**
 * Lo que la dueña ha editado de un email automático (editor visual): su texto, ya en HTML seguro y con
 * las variables puestas, y su asunto. null = lo de siempre.
 */
export function customEmail(s: Pick<Setting, "design" | "subject">, vars: EmailVars) {
  const introHtml = s.design?.blocks.length ? renderDesignHtml(s.design, { baseUrl: appUrl(), vars }) : null;
  return { introHtml, subject: s.subject ? renderSubject(s.subject, vars) || null : null };
}

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null;

/**
 * «Ya tienes acceso a «X»» con el enlace personal que lleva directo al contenido. Es el único email
 * de un pedido sin cobro (gratis con email o acceso dado a mano: ni recibo, ni aviso de
 * venta) y el del reenvío cuando alguien vuelve a pedir un acceso que ya tiene (lib/free-access.ts).
 * Esencial: no depende de las automatizaciones.
 */
export async function sendAccessEmail(orderId: string, dedupeKey: string) {
  if (await emailAlreadyQueued(dedupeKey)) return;
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { product: true, creator: true, customer: { select: { marketingOptIn: true } }, bookings: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  });
  const link = await createOrderLink({ orderId: order.id, path: orderTargetPath(order, order.bookings[0]?.id) });
  // Marcó «Quiero recibir novedades» en el formulario: no cuenta hasta que lo confirma desde aquí.
  const newsletter = newsletterPending(order.metadata, !!order.customer?.marketingOptIn)
    ? await createOrderLink({ orderId: order.id, path: newsletterConfirmPath(order.id) })
    : null;
  const custom = customEmail(await setting(order.creatorId, "ACCESS_GRANTED"), {
    nombre: firstName(accessEmailGreetingName(order)),
    mi_nombre: order.creator.displayName,
    producto: order.productTitle,
  });
  await enqueueEmail({
    to: order.buyerEmail,
    creatorId: order.creatorId,
    template: "ACCESS_GRANTED",
    dedupeKey,
    ...(await inMail(order.buyerEmail, async () => withCustomSubject(T.accessGrantedEmail({
      introHtml: custom.introHtml,
      // Sin el nombre que escribió cualquiera en el formulario gratis (sale del dominio de la dueña).
      name: accessEmailGreetingName(order),
      creatorName: order.creator.displayName,
      productTitle: order.productTitle,
      productType: order.productType,
      url: link.url,
      newsletterUrl: newsletter?.url ?? null,
      linkNote: orderLinkNote(link.expiresAt),
      instructions: order.product.instructions,
      deliveryMode: order.product.deliveryMode,
      until: (() => {
        const until = isNoChargeOrder(order) ? accessUntil(order.metadata) : null;
        return until ? lastDayText(until, order.creator.timezone) : null;
      })(),
    }), custom.subject))),
  });
}

export async function handleAutomation(event: DomainEvent) {
  const base = appUrl();
  switch (event.type) {
    case "order.paid": {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: event.orderId },
        include: { product: true, bookings: { select: { id: true }, orderBy: { createdAt: "asc" } }, legalSnapshot: true },
      });
      // Sin cobro (0 €): solo el email de acceso. Ni recibo, ni curso aparte, ni «¡Nueva venta!».
      // Una sesión sin cobro (dada a mano) ya tiene el suyo: el de la reserva (booking.confirmed).
      if (isNoChargeOrder(order)) {
        if (order.productType !== "SESSION") await sendAccessEmail(order.id, `access:${order.id}`);
        return;
      }
      const s = await setting(order.creatorId, "PURCHASE_RECEIPT");
      // Lo que aceptó (LegalSnapshot): quién vende, la renuncia marcada y las condiciones exactas.
      const snapshot = order.legalSnapshot?.content as LegalSnapshotContent | undefined;
      const identity: Partial<LegalIdentity> = snapshot?.identity ?? s.creator;
      const name = s.creator.displayName;
      const receiptKey = `receipt:${order.id}`;
      if (s.enabled && !(await emailAlreadyQueued(receiptKey))) {
        const target = orderTargetPath(order, order.bookings[0]?.id);
        const link = await createOrderLink({ orderId: order.id, path: target });
        // El recibo está en el detalle de la compra. Si el botón ya lleva allí, es el mismo
        // enlace personal; si no, la dirección normal: la sesión que abre el botón (limitada a este
        // pedido) también la cubre y, sin ella, se pide un enlace de acceso.
        const receiptPath = `/area/orders/${order.id}`;
        const receiptUrl = target === receiptPath ? link.url : `${base}${receiptPath}`;

        const custom = customEmail(s, { nombre: firstName(order.buyerName), mi_nombre: name, producto: order.productTitle });
        await enqueueEmail({
          to: order.buyerEmail,
          creatorId: order.creatorId,
          template: "PURCHASE_RECEIPT",
          dedupeKey: receiptKey,
          ...(await inMail(order.buyerEmail, async () => withCustomSubject(
            T.purchaseReceiptEmail({
              introHtml: custom.introHtml,
              name: order.buyerName,
              creatorName: name,
              productTitle: order.productTitle,
              amount: formatPrice(order.amountCents, order.currency, order.product.billingInterval),
              orderId: order.id,
              accountUrl: link.url,
              linkNote: orderLinkNote(link.expiresAt),
              instructions: order.product.instructions,
              // Quién vende, igual que en el checkout y en la compra: la identidad legal de la creadora.
              seller: identity.legalName
                ? {
                    line: sellerStatement({ ...identity, displayName: name }).line,
                    address: formatLegalAddress(identity),
                    email: identity.legalEmail ?? "",
                  }
                : undefined,
              waiver:
                order.waiverText && order.waiverAcceptedAt
                  ? {
                      text: order.waiverText,
                      at: order.waiverAcceptedAt.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: s.creator.timezone }),
                      version: order.waiverVersion,
                    }
                  : undefined,
              // Sesión pagada sin renuncia: los 14 días para desistir (la sesión es a partir del día 15).
              withdrawalUntil:
                order.productType === "SESSION" && !order.waiverAcceptedAt && order.paidAt && !isNoChargeOrder(order)
                  ? formatDate(withdrawalDeadline(order.paidAt, s.creator.timezone), { day: "numeric", month: "long" }, s.creator.timezone)
                  : null,
              // Membresía (primer pago): desistimiento con reembolso proporcional (art. 108.3).
              membershipWithdrawalUntil:
                order.productType === "MEMBERSHIP" && order.paidAt && !isNoChargeOrder(order)
                  ? formatDate(withdrawalDeadline(order.paidAt, s.creator.timezone), { day: "numeric", month: "long" }, s.creator.timezone)
                  : null,
              changePolicy: order.productType === "SESSION" ? `${sessionChangePolicyText()} desde tu área de cliente.` : null,
              legalUrl: order.legalSnapshotId ? `${base}${creatorLegalHref(s.creator.username)}?v=${order.legalSnapshotId}` : undefined,
              conditions: snapshot ? { terms: snapshot.terms, refunds: snapshot.refunds } : undefined,

              receiptUrl,
              course: order.productType === "COURSE",
            }),
            custom.subject,
          ))),
        });
      }
      // Aviso de venta a la creadora (notificación de sistema). En la web personal, la de una sesión va
      // en el aviso de la reserva (un solo email por reserva pagada) si lo tiene activado.
      // Y la de una membresía va en «Nueva suscripción» (un solo aviso por miembro nueva).
      const merged =
        (order.productType === "SESSION" && isPersonalMode() && (await setting(order.creatorId, "BOOKING_OWNER_NOTICE")).enabled) ||
        (order.productType === "MEMBERSHIP" && (await setting(order.creatorId, "NEW_SUBSCRIPTION")).enabled);
      const answers = readIntakeAnswers(order.intake);
      if (!merged)
        await enqueueEmail({
          to: s.creator.contactEmail || s.creator.user.email,
          creatorId: order.creatorId,
          template: "NEW_SALE",
          dedupeKey: `sale:${order.id}`,
          ...(await inMail(s.creator.contactEmail || s.creator.user.email, async () => T.newSaleCreatorEmail({
            productTitle: order.productTitle,
            amount: formatPrice(order.amountCents, order.currency),
            buyer: order.buyerName || order.buyerEmail,
            url: answers && order.productType !== "SESSION" ? `${base}/panel/ventas/${order.id}#entrega` : `${base}/panel/ventas`,
            details: answers && order.productType !== "SESSION" ? intakeLines(answers) : undefined,
          }))),
        });
      return;
    }

    case "customer.created": {
      const customer = await prisma.customer.findUniqueOrThrow({ where: { id: event.customerId } });
      const s = await setting(customer.creatorId, "WELCOME");
      if (!s.enabled) return;
      const custom = customEmail(s, { nombre: firstName(customer.name), mi_nombre: s.creator.displayName });
      await enqueueEmail({
        to: customer.email,
        creatorId: customer.creatorId,
        template: "WELCOME",
        dedupeKey: `welcome:${customer.id}`,
        sendAt: new Date(Date.now() + s.delayMinutes * 60000),
        ...(await inMail(customer.email, async () => withCustomSubject(
          // Sin pedido concreto: el login con su marca (enlace por email, sin contraseña).
          T.welcomeCustomerEmail({
            name: customer.name,
            creatorName: s.creator.displayName,
            accountUrl: `${base}${loginPath(s.creator.username)}?next=%2Farea`,
            message: s.message,
            messageFormat: s.messageFormat,
            introHtml: custom.introHtml,
          }),
          custom.subject,
        ))),
      });
      return;
    }

    case "booking.confirmed": {
      await sendBookingConfirmation(event.bookingId, event.change);
      await scheduleSessionReminders(event.bookingId);
      await notifyOwnerOfBooking(event.bookingId, event.change);
      return;
    }

    case "booking.cancelled": {
      // Solo las cancelaciones del sistema (reembolso o contracargo desde la pasarela): las de la dueña
      // las hace ella y el desistimiento de la clienta ya le llega con su propio email.
      const b = await prisma.booking.findUnique({ where: { id: event.bookingId }, include: { product: true, customer: true } });
      if (!b || b.cancelledBy !== "SYSTEM") return;
      const s = await setting(b.creatorId, "BOOKING_OWNER_NOTICE");
      if (!s.enabled) return;
      await enqueueEmail({
        to: s.creator.contactEmail || s.creator.user.email,
        creatorId: b.creatorId,
        template: "BOOKING_OWNER_CANCELLED",
        dedupeKey: `owner-cancel:${b.id}`,
        ...(await inMail(s.creator.contactEmail || s.creator.user.email, async () => BT.ownerCancelledEmail({
          buyer: b.customer.name || b.customer.email,
          productTitle: b.product.title,
          when: b.startAt ? formatSessionDate(b.startAt, s.creator.timezone) : null,
          reason: b.cancelReason ?? "El pago se ha devuelto desde la pasarela.",
          url: `${base}/panel/solicitudes/reserva/${b.id}`,
        }))),
      });
      return;
    }

    case "booking.updated": {
      const b = await prisma.booking.findUnique({ where: { id: event.bookingId }, include: { product: true, customer: true, creator: true } });
      if (!b || b.status !== "CONFIRMED" || !b.startAt || b.startAt <= new Date()) return;
      const key = `meeting:${b.id}:${createHash("sha1").update(b.meetingUrl ?? "").digest("hex").slice(0, 12)}`;
      if (!(await emailAlreadyQueued(key))) {
        const a = await bookingAccess(b, base);
        await enqueueEmail({
          to: b.customer.email,
          creatorId: b.creatorId,
          template: "MEETING_LINK_CHANGED",
          dedupeKey: key,
          ...(await inMail(b.customer.email, async () => BT.meetingLinkChangedEmail({
            creatorName: b.creator.displayName,
            productTitle: b.product.title,
            when: sessionWhen(b.startAt!, b.customerTimezone, b.creator.timezone),
            meetingUrl: b.meetingUrl,
            meetingLabel: meetingLabel(b.meetingUrl),
            ...a,
          }))),
        });
      }
      // Los recordatorios guardan su HTML al programarse: se vuelven a hacer con el enlace nuevo.
      const { cancelQueuedReminders } = await import("./booking-changes");
      await cancelQueuedReminders(b.id);
      await scheduleSessionReminders(b.id);
      return;
    }

    case "intake.updated": {
      const order = await prisma.order.findUnique({ where: { id: event.orderId }, include: { bookings: { select: { id: true }, orderBy: { createdAt: "asc" } } } });
      const answers = readIntakeAnswers(order?.intake);
      if (!order || !answers) return;
      const s = await setting(order.creatorId, "BOOKING_OWNER_NOTICE");
      if (!s.enabled) return;
      // Varias correcciones seguidas mandan un solo aviso (ventana de 10 minutos).
      const slot = Math.floor((order.intakeUpdatedAt ?? new Date()).getTime() / 600_000);
      await enqueueEmail({
        to: s.creator.contactEmail || s.creator.user.email,
        creatorId: order.creatorId,
        template: "INTAKE_UPDATED",
        dedupeKey: `intake:${order.id}:${slot}`,
        ...(await inMail(s.creator.contactEmail || s.creator.user.email, async () => BT.intakeUpdatedOwnerEmail({
          buyer: order.buyerName || order.buyerEmail,
          productTitle: order.productTitle,
          first: event.first,
          lines: intakeLines(answers),
          url: order.bookings[0] ? `${base}/panel/solicitudes/reserva/${order.bookings[0].id}` : `${base}/panel/ventas/${order.id}`,
        }))),
      });
      return;
    }

    case "subscription.created":
    case "subscription.canceled": {
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: event.subscriptionId }, include: { product: true, customer: true } });
      const trigger = event.type === "subscription.created" ? "NEW_SUBSCRIPTION" : "SUBSCRIPTION_CANCELED";
      if (event.type === "subscription.canceled" && event.byMember) await sendCancelConfirmed(sub.id);
      const s = await setting(sub.creatorId, trigger);
      if (!s.enabled) return;
      const to = s.creator.contactEmail || s.creator.user.email;
      const buyer = sub.customer.name || sub.customer.email;
      // En el idioma de su panel (lib/i18n/email.ts).
      const mail = await inMail(to, () =>
        trigger === "NEW_SUBSCRIPTION"
          ? T.newSubscriptionCreatorEmail({ productTitle: sub.product.title, buyer, url: `${base}/panel/clientes` })
          : T.subscriptionCanceledCreatorEmail({
              productTitle: sub.product.title,
              buyer,
              until: formatDate(sub.currentPeriodEnd, { day: "numeric", month: "long" }, s.creator.timezone),
              url: `${base}/panel/clientes`,
            }),
      );
      await enqueueEmail({ to, creatorId: sub.creatorId, template: trigger, dedupeKey: `${trigger}:${sub.id}`, ...mail });
      return;
    }

    case "subscription.ended": {
      // A la miembro: su membresía de pago ha terminado (fin del periodo tras cancelar, o el último
      // cobro fallido). Con «Volver a unirme» si se puede comprar otra vez.
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: event.subscriptionId }, include: { product: true, customer: true, creator: true } });
      const s = await setting(sub.creatorId, "ACCESS_ENDING");
      if (!s.enabled) return;
      const rejoin = sub.product.status === "PUBLISHED" ? `${base}${productPath(sub.creator.username, sub.product)}` : null;
      await enqueueEmail({
        to: sub.customer.email,
        creatorId: sub.creatorId,
        userId: sub.userId,
        template: "MEMBERSHIP_ENDED",
        dedupeKey: `sub-ended:${sub.id}`,
        ...(await inMail(sub.customer.email, async () => T.membershipEndedEmail({ creatorName: sub.creator.displayName, productTitle: sub.product.title, reason: event.reason, rejoinUrl: rejoin }))),
      });
      return;
    }

    case "checkout.abandoned": {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: event.orderId }, include: { product: true, creator: true } });
      const s = await setting(order.creatorId, "ABANDONED_CHECKOUT");
      if (!s.enabled) return;
      // Se dio de baja entre el cron y el envío: no sale, y queda el motivo como en lib/abandoned.ts.
      if (await hasOptedOut(order.creatorId, order.buyerEmail)) {
        await prisma.order.update({ where: { id: order.id }, data: { recoverySkipped: "opuesta" } });
        return;
      }
      const custom = customEmail(s, { mi_nombre: s.creator.displayName, producto: order.productTitle });
      await enqueueEmail({
        to: order.buyerEmail,
        creatorId: order.creatorId,
        template: "ABANDONED_CHECKOUT",
        dedupeKey: `abandoned:${order.id}`,
        // Botón «Cancelar suscripción» del propio gestor de correo (baja en un clic, RFC 8058).
        headers: optOutHeaders(order.id),
        ...(await inMail(order.buyerEmail, async () => withCustomSubject(
          T.abandonedCheckoutEmail({
            creatorName: s.creator.displayName,
            productTitle: order.productTitle,
            url: `${base}${productPath(order.creator.username, order.product, "checkout")}`,
            message: s.message,
            messageFormat: s.messageFormat,
            optOutUrl: optOutUrl(order.id),
            introHtml: custom.introHtml,
          }),
          custom.subject,
        ))),
      });
      await prisma.order.update({ where: { id: order.id }, data: { recoveryEmailedAt: new Date() } });
      return;
    }
  }
}

/**
 * «Cancelación confirmada»: a la miembro, al momento, con lo que canceló, la fecha y la hora en que nos llegó y hasta
 * cuándo sigue entrando (en Alemania es obligatorio, § 312k BGB). Con «Reactivar» por si se arrepiente.
 */
async function sendCancelConfirmed(subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { product: true, customer: true, creator: true } });
  if (!sub || !sub.canceledAt) return;
  const s = await setting(sub.creatorId, "CANCEL_CONFIRMED");
  const tz = sub.creator.timezone;
  await enqueueEmail({
    to: sub.customer.email,
    creatorId: sub.creatorId,
    userId: sub.userId,
    template: "CANCEL_CONFIRMED",
    dedupeKey: `cancel-confirmed:${sub.id}:${sub.canceledAt.getTime()}`,
    ...(await inMail(sub.customer.email, async () => withCustomSubject(
      T.cancelConfirmedEmail({
        creatorName: sub.creator.displayName,
        productTitle: sub.product.title,
        receivedAt: formatDate(sub.canceledAt!, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }, tz),
        until: formatDate(sub.currentPeriodEnd, { day: "numeric", month: "long", year: "numeric" }, tz),
        url: `${appUrl()}/area/membership/${sub.productId}`,
      }),
      s.subject,
    ))),
  });
}

type BookingFull = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { product: true, customer: true, creator: { include: { user: true } }, order: true },
  });
}

/** Enlace personal a la reserva (con pedido) o el login con su marca (reserva sin pedido). */
async function bookingAccess(b: { id: string; orderId: string | null; creator: { username: string } }, base: string, validFrom?: Date, hash = "") {
  const path = `/area/sessions/${b.id}${hash}`;
  if (!b.orderId) return { url: `${base}${loginPath(b.creator.username)}?next=${encodeURIComponent(path)}`, linkNote: undefined };
  const link = await createOrderLink({ orderId: b.orderId, path, validFrom });
  return { url: link.url, linkNote: orderLinkNote(link.expiresAt) };
}

/** ¿Le faltan datos obligatorios para la lectura? Entonces sus emails llevan el enlace para completarlos. */
function missingIntake(b: BookingFull) {
  const cfg = readIntakeConfig(b.product.intake);
  return !!b.order && intakeMissing(cfg, readIntakeAnswers(b.order.intake));
}

/**
 * Confirmación a la clienta, con la hora en su zona: la de siempre, la de una plaza de taller, la de un
 * taller que cambia de fecha o la de una sesión que la dueña le da a mano (con su mensaje).
 */
export async function sendBookingConfirmation(bookingId: string, change?: BookingChange) {
  const b = await loadBooking(bookingId);
  if (!b || (b.status !== "CONFIRMED" && b.status !== "PENDING_SCHEDULE")) return;
  const base = appUrl();
  const s = await setting(b.creatorId, "BOOKING_CONFIRMED");
  const tz = s.creator.timezone;
  const when = b.startAt ? sessionWhen(b.startAt, b.customerTimezone, tz) : null;
  const confirmKey = `booking:${b.id}:${b.startAt?.toISOString() ?? "pending"}`;
  if (!s.enabled || (await emailAlreadyQueued(confirmKey))) return;
  const r = await setting(b.creatorId, "SESSION_REMINDER");
  const reminderAt = b.startAt ? new Date(b.startAt.getTime() - r.delayMinutes * 60000) : null;
  const reminderScheduled = !!(b.startAt && r.enabled && reminderAt && reminderAt > new Date());
  const access = await bookingAccess(b, base);
  const intakeUrl = missingIntake(b) ? (await bookingAccess(b, base, undefined, "#datos")).url : null;
  const ics = b.startAt ? icsUrl(b.id) : null;
  const meta = (b.order?.metadata ?? {}) as { manual?: string; message?: string };
  if (change === "manual" && b.order?.paymentProvider === "manual") {
    await enqueueEmail({
      to: b.customer.email,
      creatorId: b.creatorId,
      template: "BOOKING_CONFIRMED",
      dedupeKey: confirmKey,
      ...(await inMail(b.customer.email, async () => BT.manualSessionEmail({
        creatorName: s.creator.displayName,
        productTitle: b.product.title,
        when,
        gift: meta.manual === "gift",
        message: meta.message ?? null,
        meetingUrl: b.meetingUrl,
        meetingLabel: meetingLabel(b.meetingUrl),
        intakeUrl,
        icsUrl: ics,
        ...access,
      }))),
    });
    return;
  }
  const custom = customEmail(s, { nombre: firstName(b.customer.name), mi_nombre: s.creator.displayName, producto: b.product.title, fecha: when });
  await enqueueEmail({
    to: b.customer.email,
    creatorId: b.creatorId,
    template: "BOOKING_CONFIRMED",
    dedupeKey: confirmKey,
    ...(await inMail(b.customer.email, async () => withCustomSubject(
      T.bookingConfirmedEmail({
        introHtml: custom.introHtml,
        creatorName: s.creator.displayName,
        productTitle: b.product.title,
        when,
        ...access,
        meetingUrl: b.meetingUrl,
        reminderMinutes: reminderScheduled ? r.delayMinutes : null,
        // Lo nuevo solo cuando aplica: los emails de siempre salen igual que antes.
        ...(b.meetingUrl && meetingLabel(b.meetingUrl) !== "Enlace de la videollamada" ? { meetingLabel: meetingLabel(b.meetingUrl) } : {}),
        ...(intakeUrl ? { intakeUrl } : {}),
        ...(change && ics ? { icsUrl: ics } : {}),
        ...(change === "moved" ? { variant: "moved" as const } : b.groupSeat ? { variant: "seat" as const } : {}),
      }),
      custom.subject,
    ))),
  });
}

/** Recordatorios de una reserva confirmada: el de siempre (24 h) y el segundo (60 min, con el enlace). */
export async function scheduleSessionReminders(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b || b.status !== "CONFIRMED" || !b.startAt) return;
  const base = appUrl();
  const tz = b.creator.timezone;
  const when = sessionWhen(b.startAt, b.customerTimezone, tz);
  const intake = missingIntake(b);
  // Círculo de la luna: su propio recordatorio (con la luna y su signo) en lugar del de siempre.
  const moon = b.product.moonCircle ? await setting(b.creatorId, "MOON_CIRCLE_REMINDER") : null;
  if (moon?.enabled) {
    const at = new Date(b.startAt.getTime() - moon.delayMinutes * 60000);
    const key = `reminder:${b.id}:${b.startAt.toISOString()}:moon`;
    if (at > new Date() && !(await emailAlreadyQueued(key))) {
      const a = await bookingAccess(b, base, at);
      let sky: ReturnType<typeof moonCircleSky> | null = null;
      try {
        sky = moonCircleSky(b.startAt);
      } catch {
        sky = null;
      }
      const custom = customEmail(moon, { nombre: firstName(b.customer.name), mi_nombre: moon.creator.displayName, producto: b.product.title, fecha: when, luna: sky?.title ?? "luna" });
      await enqueueEmail({
        to: b.customer.email,
        creatorId: b.creatorId,
        template: "SESSION_REMINDER",
        dedupeKey: key,
        sendAt: at,
        ...(await inMail(b.customer.email, async () => withCustomSubject(
          T.moonCircleReminderEmail({
            introHtml: custom.introHtml,
            creatorName: moon.creator.displayName,
            productTitle: b.product.title,
            when,
            ...a,
            sky: sky ? { glyph: sky.glyph, title: sky.title, phrase: sky.phrase } : null,
            meetingUrl: b.meetingUrl,
            ...(b.meetingUrl && meetingLabel(b.meetingUrl) !== "Enlace de la videollamada" ? { meetingLabel: meetingLabel(b.meetingUrl) } : {}),
          }),
          custom.subject,
        ))),
      });
    }
  }
  // Gracias tras la sesión: al rato de terminar; si responde, le llega a la dueña.
  const thanks = await setting(b.creatorId, "SESSION_THANKS");
  if (thanks.enabled) {
    const end = b.startAt.getTime() + (b.product.durationMin ?? 60) * 60000;
    const at = new Date(end + thanks.delayMinutes * 60000);
    const key = `reminder:${b.id}:${b.startAt.toISOString()}:thanks`;
    if (at > new Date() && !(await emailAlreadyQueued(key))) {
      const custom = customEmail(thanks, { nombre: firstName(b.customer.name), mi_nombre: thanks.creator.displayName, producto: b.product.title, fecha: when });
      await enqueueEmail({
        to: b.customer.email,
        creatorId: b.creatorId,
        template: "SESSION_REMINDER",
        dedupeKey: key,
        sendAt: at,
        replyTo: thanks.creator.contactEmail || thanks.creator.user.email,
        ...(await inMail(b.customer.email, async () => withCustomSubject(
          T.sessionThanksEmail({ name: firstName(b.customer.name), creatorName: thanks.creator.displayName, productTitle: b.product.title, url: `${base}/area`, introHtml: custom.introHtml }),
          custom.subject,
        ))),
      });
    }
  }
  for (const [trigger, suffix] of [["SESSION_REMINDER", ""], ["SESSION_REMINDER_SOON", ":soon"]] as const) {
    if (moon?.enabled && trigger === "SESSION_REMINDER") continue;
    const r = await setting(b.creatorId, trigger);
    const at = new Date(b.startAt.getTime() - r.delayMinutes * 60000);
    if (!r.enabled || at <= new Date()) continue;
    const key = `reminder:${b.id}:${b.startAt.toISOString()}${suffix}`;
    if (await emailAlreadyQueued(key)) continue;
    // El enlace del recordatorio cuenta desde su envío: si la sesión es dentro de semanas, no llega caducado.
    const a = await bookingAccess(b, base, at);
    const custom = customEmail(r, { nombre: firstName(b.customer.name), mi_nombre: r.creator.displayName, producto: b.product.title, fecha: when });
    await enqueueEmail({
      to: b.customer.email,
      creatorId: b.creatorId,
      template: "SESSION_REMINDER",
      dedupeKey: key,
      sendAt: at,
      ...(await inMail(b.customer.email, async () => withCustomSubject(
        T.sessionReminderEmail({
          introHtml: custom.introHtml,
          creatorName: r.creator.displayName,
          productTitle: b.product.title,
          when,
          ...a,
          meetingUrl: b.meetingUrl,
          ...(b.meetingUrl && meetingLabel(b.meetingUrl) !== "Enlace de la videollamada" ? { meetingLabel: meetingLabel(b.meetingUrl) } : {}),
          ...(intake ? { intakeUrl: (await bookingAccess(b, base, at, "#datos")).url } : {}),
        }),
        custom.subject,
      ))),
    });
  }
}

/**
 * Aviso a la dueña de una reserva nueva, de una fecha elegida o de un cambio de fecha, con la hora en su
 * zona y en la de la clienta y sus datos para la lectura. No para lo que hace ella (a mano, mover un
 * taller), ni para la respuesta a «Proponer otra fecha» (ya tiene su aviso), ni para eventos antiguos.
 */
export async function notifyOwnerOfBooking(bookingId: string, change?: BookingChange) {
  if (change !== "new" && change !== "scheduled" && change !== "rescheduled") return;
  const b = await loadBooking(bookingId);
  if (!b || (b.status !== "CONFIRMED" && b.status !== "PENDING_SCHEDULE")) return;
  const s = await setting(b.creatorId, "BOOKING_OWNER_NOTICE");
  if (!s.enabled) return;
  const tz = s.creator.timezone;
  const answers = readIntakeAnswers(b.order?.intake);
  const paid = b.order && !isNoChargeOrder(b.order) && change === "new";
  const seats = b.groupSeat
    ? {
        taken: await prisma.booking.count({ where: { productId: b.productId, groupSeat: true, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
        capacity: b.product.capacity,
      }
    : null;
  await enqueueEmail({
    to: s.creator.contactEmail || s.creator.user.email,
    creatorId: b.creatorId,
    template: "BOOKING_OWNER",
    dedupeKey: `owner-booking:${b.id}:${b.startAt?.toISOString() ?? "pending"}`,
    ...(await inMail(s.creator.contactEmail || s.creator.user.email, async () => BT.ownerBookingEmail({
      kind: change,
      buyer: b.customer.name || b.customer.email,
      productTitle: b.product.title,
      when: b.startAt ? formatSessionDate(b.startAt, tz) : null,
      clientNote: b.startAt ? clientTimeNote(b.startAt, tz, b.customerTimezone) : "",
      previousWhen: change === "rescheduled" && b.previousStartAt ? formatSessionDate(b.previousStartAt, tz) : null,
      amount: paid ? formatPrice(b.order!.amountCents, b.order!.currency) : null,
      seats,
      intake: answers ? intakeLines(answers) : [],
      intakeMissing: missingIntake(b),
      url: `${appUrl()}/panel/solicitudes/reserva/${b.id}`,
    }))),
  });
}
