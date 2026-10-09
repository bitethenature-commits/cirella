import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import * as T from "./email/templates";
import { formatPrice } from "./money";
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
      const order = await prisma.order.findUniqueOrThrow({ where: { id: event.orderId }, include: { product: true } });
      const s = await setting(order.creatorId, "PURCHASE_RECEIPT");
      const name = s.creator.displayName;
      if (s.enabled) {
        await enqueueEmail({
          to: order.buyerEmail,
          creatorId: order.creatorId,
          template: "PURCHASE_RECEIPT",
          dedupeKey: `receipt:${order.id}`,
          ...withCustomSubject(
            T.purchaseReceiptEmail({
              name: order.buyerName,
              creatorName: name,
              productTitle: order.productTitle,
              amount: formatPrice(order.amountCents, order.currency, order.product.billingInterval),
              orderId: order.id,
              accountUrl: `${base}/cuenta`,
              instructions: order.product.instructions,
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
        if (c.enabled)
          await enqueueEmail({
            to: order.buyerEmail,
            creatorId: order.creatorId,
            template: "COURSE_ACCESS",
            dedupeKey: `course:${order.id}`,
            ...withCustomSubject(T.courseAccessEmail({ creatorName: name, courseTitle: order.productTitle, url: `${base}/cuenta/cursos/${order.productId}` }), c.subject),
          });
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
          T.welcomeCustomerEmail({ name: customer.name, creatorName: s.creator.displayName, accountUrl: `${base}/cuenta`, message: s.message }),
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
      const url = `${base}/cuenta/sesiones/${b.id}`;
      // El recordatorio se calcula antes para que la confirmación solo lo prometa si existe.
      const r = await setting(b.creatorId, "SESSION_REMINDER");
      const reminderAt = b.startAt ? new Date(b.startAt.getTime() - r.delayMinutes * 60000) : null;
      const reminderScheduled = !!(b.startAt && r.enabled && reminderAt && reminderAt > new Date());
      if (s.enabled)
        await enqueueEmail({
          to: b.customer.email,
          creatorId: b.creatorId,
          template: "BOOKING_CONFIRMED",
          dedupeKey: `booking:${b.id}:${b.startAt?.toISOString() ?? "pending"}`,
          ...withCustomSubject(
            T.bookingConfirmedEmail({
              creatorName: s.creator.displayName,
              productTitle: b.product.title,
              when,
              url,
              meetingUrl: b.meetingUrl,
              reminderMinutes: reminderScheduled ? r.delayMinutes : null,
            }),
            s.subject,
          ),
        });
      if (reminderScheduled)
        await enqueueEmail({
          to: b.customer.email,
          creatorId: b.creatorId,
          template: "SESSION_REMINDER",
          dedupeKey: `reminder:${b.id}:${b.startAt!.toISOString()}`,
          sendAt: reminderAt!,
          ...withCustomSubject(
            T.sessionReminderEmail({ creatorName: s.creator.displayName, productTitle: b.product.title, when: when!, url, meetingUrl: b.meetingUrl }),
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
