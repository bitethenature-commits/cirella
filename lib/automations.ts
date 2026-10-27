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
import { getPlatformIssuer } from "./invoices/issuer";
import { bpsToPercent, formatMoney, formatPrice } from "./money";
import { createOrderLink, emailAlreadyQueued, orderLinkNote } from "./order-links";
import { planFeatures } from "./plans";
import { hasOptedOut, optOutHeaders, optOutUrl } from "./recovery-optout";
import { clientTimeNote, formatDate, formatSessionDate, sessionWhen } from "./tz";
import type { BookingChange, DomainEvent } from "./events";
import { createHash } from "node:crypto";
import { intakeLines, intakeMissing, readIntakeAnswers, readIntakeConfig } from "./intake";
import { meetingLabel } from "./meeting-url";
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
 * de un pedido sin cobro (gratis con email o acceso dado a mano: ni recibo, ni factura, ni aviso de
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
    ...withCustomSubject(T.accessGrantedEmail({
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
    }), custom.subject),
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
      // Sin cobro (0 €): solo el email de acceso. Ni recibo con IVA, ni curso aparte, ni «¡Nueva venta!».
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
        // «Recibo y factura» está en el detalle de la compra. Si el botón ya lleva allí, es el mismo
        // enlace personal; si no, la dirección normal: la sesión que abre el botón (limitada a este
        // pedido) también la cubre y, sin ella, se pide un enlace de acceso.
        const receiptPath = `/cuenta/pedidos/${order.id}`;
        const receiptUrl = target === receiptPath ? link.url : `${base}${receiptPath}#factura`;
        const invoice = await prisma.invoice.findFirst({ where: { orderId: order.id, kind: "SALE", type: { in: ["F1", "F2"] } }, orderBy: { issuedAt: "asc" } });
        const platformIssuer = order.taxSeller === "PLATFORM" ? await getPlatformIssuer() : null;
        const custom = customEmail(s, { nombre: firstName(order.buyerName), mi_nombre: name, producto: order.productTitle });
        await enqueueEmail({
          to: order.buyerEmail,
          creatorId: order.creatorId,
          template: "PURCHASE_RECEIPT",
          dedupeKey: receiptKey,
          ...withCustomSubject(
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
              // Quién vende, igual que en el checkout y en la compra: Cirella por cuenta de la creadora
              // cuando vende ella a efectos de IVA (con su domicilio) y, si no, la identidad de la creadora.
              seller: platformIssuer
                ? {
                    line: sellerStatement(order.taxSeller, { ...identity, displayName: name }, platformIssuer).line,
                    address: platformIssuer.address ?? "",
                    email: identity.legalEmail ?? "",
                  }
                : identity.legalName
                  ? {
                      line: sellerStatement(order.taxSeller, { ...identity, displayName: name }, null).line,
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
              legalUrl: order.legalSnapshotId ? `${base}/${s.creator.username}/legal?v=${order.legalSnapshotId}` : undefined,
              conditions: snapshot ? { terms: snapshot.terms, refunds: snapshot.refunds } : undefined,
              taxLine:
                order.taxCents > 0
                  ? `IVA incluido (${bpsToPercent(order.taxRateBps)}): ${formatMoney(order.taxCents, order.currency, { decimals: true })}`
                  : null,
              invoiceNumber: invoice?.fullNumber ?? null,
              taxSellerLine: platformIssuer
                ? `${platformIssuer.name} vende este contenido digital a efectos de IVA y emite la factura; ${name} lo crea y te atiende.`
                : null,
              receiptUrl,
            }),
            custom.subject,
          ),
        });
      }
      // Aviso de venta a la creadora (notificación de sistema). En la web personal, la de una sesión va
      // en el aviso de la reserva (un solo email por reserva pagada) si lo tiene activado.
      const merged = order.productType === "SESSION" && isPersonalMode() && (await setting(order.creatorId, "BOOKING_OWNER_NOTICE")).enabled;
      const answers = readIntakeAnswers(order.intake);
      if (!merged)
        await enqueueEmail({
          to: s.creator.contactEmail || s.creator.user.email,
          creatorId: order.creatorId,
          template: "NEW_SALE",
          dedupeKey: `sale:${order.id}`,
          ...T.newSaleCreatorEmail({
            productTitle: order.productTitle,
            amount: formatPrice(order.amountCents, order.currency),
            buyer: order.buyerName || order.buyerEmail,
            url: answers && order.productType !== "SESSION" ? `${base}/panel/ventas/${order.id}#entrega` : `${base}/panel/ventas`,
            details: answers && order.productType !== "SESSION" ? intakeLines(answers) : undefined,
          }),
        });
      if (order.productType === "COURSE") {
        const c = await setting(order.creatorId, "COURSE_ACCESS");
        const courseKey = `course:${order.id}`;
        if (c.enabled && !(await emailAlreadyQueued(courseKey))) {
          const link = await createOrderLink({ orderId: order.id, path: `/cuenta/cursos/${order.productId}` });
          const custom = customEmail(c, { mi_nombre: name, producto: order.productTitle });
          await enqueueEmail({
            to: order.buyerEmail,
            creatorId: order.creatorId,
            template: "COURSE_ACCESS",
            dedupeKey: courseKey,
            ...withCustomSubject(
              T.courseAccessEmail({ creatorName: name, courseTitle: order.productTitle, url: link.url, linkNote: orderLinkNote(link.expiresAt), introHtml: custom.introHtml }),
              custom.subject,
            ),
          });
        }
      }
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
        ...withCustomSubject(
          // Sin pedido concreto: el login con su marca (enlace por email, sin contraseña).
          T.welcomeCustomerEmail({
            name: customer.name,
            creatorName: s.creator.displayName,
            accountUrl: `${base}/${s.creator.username}/entrar?next=%2Fcuenta`,
            message: s.message,
            messageFormat: s.messageFormat,
            introHtml: custom.introHtml,
          }),
          custom.subject,
        ),
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
        ...BT.ownerCancelledEmail({
          buyer: b.customer.name || b.customer.email,
          productTitle: b.product.title,
          when: b.startAt ? formatSessionDate(b.startAt, s.creator.timezone) : null,
          reason: b.cancelReason ?? "El pago se ha devuelto desde la pasarela.",
          url: `${base}/panel/reservas`,
        }),
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
          ...BT.meetingLinkChangedEmail({
            creatorName: b.creator.displayName,
            productTitle: b.product.title,
            when: sessionWhen(b.startAt, b.customerTimezone, b.creator.timezone),
            meetingUrl: b.meetingUrl,
            meetingLabel: meetingLabel(b.meetingUrl),
            ...a,
          }),
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
        ...BT.intakeUpdatedOwnerEmail({
          buyer: order.buyerName || order.buyerEmail,
          productTitle: order.productTitle,
          first: event.first,
          lines: intakeLines(answers),
          url: order.bookings[0] ? `${base}/panel/reservas/${order.bookings[0].id}` : `${base}/panel/ventas/${order.id}`,
        }),
      });
      return;
    }

    case "subscription.created":
    case "subscription.canceled": {
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: event.subscriptionId }, include: { product: true, customer: true } });
      const trigger = event.type === "subscription.created" ? "NEW_SUBSCRIPTION" : "SUBSCRIPTION_CANCELED";
      const s = await setting(sub.creatorId, trigger);
      if (!s.enabled) return;
      const to = s.creator.contactEmail || s.creator.user.email;
      const buyer = sub.customer.name || sub.customer.email;
      const mail =
        trigger === "NEW_SUBSCRIPTION"
          ? T.newSubscriptionCreatorEmail({ productTitle: sub.product.title, buyer, url: `${base}/panel/clientes` })
          : T.subscriptionCanceledCreatorEmail({
              productTitle: sub.product.title,
              buyer,
              until: formatDate(sub.currentPeriodEnd, { day: "numeric", month: "long" }, s.creator.timezone),
              url: `${base}/panel/clientes`,
            });
      await enqueueEmail({ to, creatorId: sub.creatorId, template: trigger, dedupeKey: `${trigger}:${sub.id}`, ...mail });
      return;
    }

    case "subscription.ended": {
      // A la miembro: su membresía de pago ha terminado (fin del periodo tras cancelar, o el último
      // cobro fallido). Con «Volver a unirme» si se puede comprar otra vez.
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: event.subscriptionId }, include: { product: true, customer: true, creator: true } });
      const s = await setting(sub.creatorId, "ACCESS_ENDING");
      if (!s.enabled) return;
      const rejoin = sub.product.status === "PUBLISHED" ? `${base}/${sub.creator.username}/${sub.product.slug}` : null;
      await enqueueEmail({
        to: sub.customer.email,
        creatorId: sub.creatorId,
        userId: sub.userId,
        template: "MEMBERSHIP_ENDED",
        dedupeKey: `sub-ended:${sub.id}`,
        ...T.membershipEndedEmail({ creatorName: sub.creator.displayName, productTitle: sub.product.title, reason: event.reason, rejoinUrl: rejoin }),
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
        ...withCustomSubject(
          T.abandonedCheckoutEmail({
            creatorName: s.creator.displayName,
            productTitle: order.productTitle,
            url: `${base}/${order.creator.username}/${order.product.slug}/checkout`,
            message: s.message,
            messageFormat: s.messageFormat,
            optOutUrl: optOutUrl(order.id),
            introHtml: custom.introHtml,
          }),
          custom.subject,
        ),
      });
      await prisma.order.update({ where: { id: order.id }, data: { recoveryEmailedAt: new Date() } });
      return;
    }
  }
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
  const path = `/cuenta/sesiones/${b.id}${hash}`;
  if (!b.orderId) return { url: `${base}/${b.creator.username}/entrar?next=${encodeURIComponent(path)}`, linkNote: undefined };
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
      ...BT.manualSessionEmail({
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
      }),
    });
    return;
  }
  const custom = customEmail(s, { nombre: firstName(b.customer.name), mi_nombre: s.creator.displayName, producto: b.product.title, fecha: when });
  await enqueueEmail({
    to: b.customer.email,
    creatorId: b.creatorId,
    template: "BOOKING_CONFIRMED",
    dedupeKey: confirmKey,
    ...withCustomSubject(
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
    ),
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
  for (const [trigger, suffix] of [["SESSION_REMINDER", ""], ["SESSION_REMINDER_SOON", ":soon"]] as const) {
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
      ...withCustomSubject(
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
      ),
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
    ...BT.ownerBookingEmail({
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
      url: `${appUrl()}/panel/reservas/${b.id}`,
    }),
  });
}
