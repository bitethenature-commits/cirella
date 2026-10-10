import { orderTargetPath } from "./auth-utils";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import * as T from "./email/templates";
import { formatLegalAddress, sellerLine, sessionChangePolicyText, type LegalIdentity } from "./legal";
import type { LegalSnapshotContent } from "./legal-snapshot";
import { formatPrice } from "./money";
import { createOrderLink, emailAlreadyQueued, orderLinkNote } from "./order-links";
import { planFeatures } from "./plans";
import { formatSessionDate } from "./tz";
import type { DomainEvent } from "./events";

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

export const AUTOMATIONS = {
  PURCHASE_RECEIPT: { label: "Email de compra", description: "Recibo y acceso al contenido para quien compra", audience: "Clienta", essential: true, defaultDelay: 0 },
  COURSE_ACCESS: { label: "Acceso al curso", description: "Enlace directo al curso tras la compra", audience: "Clienta", essential: true, defaultDelay: 0 },
  BOOKING_CONFIRMED: { label: "Confirmación de reserva", description: "Fecha, hora y enlace de la sesión", audience: "Clienta", essential: true, defaultDelay: 0 },
  NEW_SUBSCRIPTION: { label: "Aviso de nueva suscripción", description: "Te avisamos cuando alguien se une a tu membresía", audience: "Tú", essential: true, defaultDelay: 0 },
  SUBSCRIPTION_CANCELED: { label: "Aviso de cancelación", description: "Te avisamos cuando alguien cancela su membresía", audience: "Tú", essential: true, defaultDelay: 0 },
  WELCOME: { label: "Email de bienvenida", description: "Mensaje personal tras la primera compra de una clienta nueva", audience: "Clienta", essential: false, defaultDelay: 10 },
  SESSION_REMINDER: { label: "Recordatorio de sesión", description: "Se envía antes de cada sesión (minutos de antelación)", audience: "Clienta", essential: false, defaultDelay: 1440 },
  ABANDONED_CHECKOUT: { label: "Recuperación de compra abandonada", description: "Si alguien empieza a pagar y no termina", audience: "Clienta", essential: false, defaultDelay: 60 },
} as const;

export type AutomationTrigger = keyof typeof AUTOMATIONS;

async function setting(creatorId: string, trigger: AutomationTrigger) {
  const [row, creator] = await Promise.all([
    prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId, trigger } } }),
    prisma.creator.findUniqueOrThrow({ where: { id: creatorId }, include: { plan: true, user: true } }),
  ]);
  const meta = AUTOMATIONS[trigger];
  const allowed = meta.essential || planFeatures(creator.plan).automations;
  const enabled = allowed && (row ? row.enabled || meta.essential : true);
  return {
    enabled,
    delayMinutes: row?.delayMinutes ?? meta.defaultDelay,
    subject: row?.subject || null,
    message: row?.message || null,
    creator,
  };
}

function withCustomSubject<T extends { subject: string }>(mail: T, subject: string | null) {
  return subject ? { ...mail, subject } : mail;
}

export async function handleAutomation(event: DomainEvent) {
  const base = appUrl();
  switch (event.type) {
    case "order.paid": {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: event.orderId },
        include: { product: true, bookings: { select: { id: true }, orderBy: { createdAt: "asc" } }, legalSnapshot: true },
      });
      const s = await setting(order.creatorId, "PURCHASE_RECEIPT");
      // Lo que aceptó (LegalSnapshot): quién vende, la renuncia marcada y las condiciones exactas.
      const snapshot = order.legalSnapshot?.content as LegalSnapshotContent | undefined;
      const identity: Partial<LegalIdentity> = snapshot?.identity ?? s.creator;
      const name = s.creator.displayName;
      const receiptKey = `receipt:${order.id}`;
      if (s.enabled && !(await emailAlreadyQueued(receiptKey))) {
        const link = await createOrderLink({ orderId: order.id, path: orderTargetPath(order, order.bookings[0]?.id) });
        await enqueueEmail({
          to: order.buyerEmail,
          creatorId: order.creatorId,
          template: "PURCHASE_RECEIPT",
          dedupeKey: receiptKey,
          ...withCustomSubject(
            T.purchaseReceiptEmail({
              name: order.buyerName,
              creatorName: name,
              productTitle: order.productTitle,
              amount: formatPrice(order.amountCents, order.currency, order.product.billingInterval),
              orderId: order.id,
              accountUrl: link.url,
              linkNote: orderLinkNote(link.expiresAt),
              instructions: order.product.instructions,
              seller: identity.legalName
                ? { line: sellerLine(identity), address: formatLegalAddress(identity), email: identity.legalEmail ?? "" }
                : undefined,
              waiver:
                order.waiverText && order.waiverAcceptedAt
                  ? {
                      text: order.waiverText,
                      at: order.waiverAcceptedAt.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: s.creator.timezone }),
                    }
                  : undefined,
              changePolicy: order.productType === "SESSION" ? `${sessionChangePolicyText()} desde tu área de cliente.` : null,
              legalUrl: order.legalSnapshotId ? `${base}/${s.creator.username}/legal?v=${order.legalSnapshotId}` : undefined,
              conditions: snapshot ? { terms: snapshot.terms, refunds: snapshot.refunds } : undefined,
            }),
            s.subject,
          ),
        });
      }
      // Aviso de venta a la creadora (notificación de sistema).
      await enqueueEmail({
        to: s.creator.contactEmail || s.creator.user.email,
        creatorId: order.creatorId,
        template: "NEW_SALE",
        dedupeKey: `sale:${order.id}`,
        ...T.newSaleCreatorEmail({
          productTitle: order.productTitle,
          amount: formatPrice(order.amountCents, order.currency),
          buyer: order.buyerName || order.buyerEmail,
          url: `${base}/panel/ventas`,
        }),
      });
      if (order.productType === "COURSE") {
        const c = await setting(order.creatorId, "COURSE_ACCESS");
        const courseKey = `course:${order.id}`;
        if (c.enabled && !(await emailAlreadyQueued(courseKey))) {
          const link = await createOrderLink({ orderId: order.id, path: `/cuenta/cursos/${order.productId}` });
          await enqueueEmail({
            to: order.buyerEmail,
            creatorId: order.creatorId,
            template: "COURSE_ACCESS",
            dedupeKey: courseKey,
            ...withCustomSubject(
              T.courseAccessEmail({ creatorName: name, courseTitle: order.productTitle, url: link.url, linkNote: orderLinkNote(link.expiresAt) }),
              c.subject,
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
      await enqueueEmail({
        to: customer.email,
        creatorId: customer.creatorId,
        template: "WELCOME",
        dedupeKey: `welcome:${customer.id}`,
        sendAt: new Date(Date.now() + s.delayMinutes * 60000),
        ...withCustomSubject(
          // Sin pedido concreto: el login con su marca (enlace por email, sin contraseña).
          T.welcomeCustomerEmail({ name: customer.name, creatorName: s.creator.displayName, accountUrl: `${base}/${s.creator.username}/entrar?next=%2Fcuenta`, message: s.message }),
          s.subject,
        ),
      });
      return;
    }

    case "booking.confirmed": {
      const b = await prisma.booking.findUniqueOrThrow({ where: { id: event.bookingId }, include: { product: true, customer: true } });
      const s = await setting(b.creatorId, "BOOKING_CONFIRMED");
      const tz = s.creator.timezone;
      const when = b.startAt ? formatSessionDate(b.startAt, tz) : null;
      const path = `/cuenta/sesiones/${b.id}`;
      // Con pedido, enlace personal; una reserva creada a mano (sin pedido) va al login con la marca.
      const access = async (validFrom?: Date) => {
        if (!b.orderId) return { url: `${base}/${s.creator.username}/entrar?next=${encodeURIComponent(path)}`, linkNote: undefined };
        const link = await createOrderLink({ orderId: b.orderId, path, validFrom });
        return { url: link.url, linkNote: orderLinkNote(link.expiresAt) };
      };
      // El recordatorio se calcula antes para que la confirmación solo lo prometa si existe.
      const r = await setting(b.creatorId, "SESSION_REMINDER");
      const reminderAt = b.startAt ? new Date(b.startAt.getTime() - r.delayMinutes * 60000) : null;
      const reminderScheduled = !!(b.startAt && r.enabled && reminderAt && reminderAt > new Date());
      const confirmKey = `booking:${b.id}:${b.startAt?.toISOString() ?? "pending"}`;
      if (s.enabled && !(await emailAlreadyQueued(confirmKey)))
        await enqueueEmail({
          to: b.customer.email,
          creatorId: b.creatorId,
          template: "BOOKING_CONFIRMED",
          dedupeKey: confirmKey,
          ...withCustomSubject(
            T.bookingConfirmedEmail({
              creatorName: s.creator.displayName,
              productTitle: b.product.title,
              when,
              ...(await access()),
              meetingUrl: b.meetingUrl,
              reminderMinutes: reminderScheduled ? r.delayMinutes : null,
            }),
            s.subject,
          ),
        });
      const reminderKey = reminderScheduled ? `reminder:${b.id}:${b.startAt!.toISOString()}` : null;
      if (reminderKey && !(await emailAlreadyQueued(reminderKey)))
        await enqueueEmail({
          to: b.customer.email,
          creatorId: b.creatorId,
          template: "SESSION_REMINDER",
          dedupeKey: reminderKey,
          sendAt: reminderAt!,
          ...withCustomSubject(
            // El enlace del recordatorio cuenta desde su envío: si la sesión es dentro de semanas, no llega caducado.
            T.sessionReminderEmail({ creatorName: s.creator.displayName, productTitle: b.product.title, when: when!, ...(await access(reminderAt!)), meetingUrl: b.meetingUrl }),
            r.subject,
          ),
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
              until: sub.currentPeriodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long" }),
              url: `${base}/panel/clientes`,
            });
      await enqueueEmail({ to, creatorId: sub.creatorId, template: trigger, dedupeKey: `${trigger}:${sub.id}`, ...mail });
      return;
    }

    case "checkout.abandoned": {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: event.orderId }, include: { product: true, creator: true } });
      const s = await setting(order.creatorId, "ABANDONED_CHECKOUT");
      if (!s.enabled) return;
      await enqueueEmail({
        to: order.buyerEmail,
        creatorId: order.creatorId,
        template: "ABANDONED_CHECKOUT",
        dedupeKey: `abandoned:${order.id}`,
        ...withCustomSubject(
          T.abandonedCheckoutEmail({
            creatorName: s.creator.displayName,
            productTitle: order.productTitle,
            url: `${base}/${order.creator.username}/${order.product.slug}/checkout`,
            message: s.message,
          }),
          s.subject,
        ),
      });
      await prisma.order.update({ where: { id: order.id }, data: { recoveryEmailedAt: new Date() } });
      return;
    }
  }
}
