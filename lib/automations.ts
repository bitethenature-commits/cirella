import { isNoChargeOrder } from "./access-mode";
import { orderTargetPath } from "./auth-utils";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { accessEmailGreetingName, newsletterConfirmPath, newsletterPending } from "./free-access-rules";
import * as T from "./email/templates";
import { formatLegalAddress, sellerStatement, sessionChangePolicyText, type LegalIdentity } from "./legal";
import type { LegalSnapshotContent } from "./legal-snapshot";
import { getPlatformIssuer } from "./invoices/issuer";
import { bpsToPercent, formatMoney, formatPrice } from "./money";
import { createOrderLink, emailAlreadyQueued, orderLinkNote } from "./order-links";
import { planFeatures } from "./plans";
import { hasOptedOut, optOutHeaders, optOutUrl } from "./recovery-optout";
import { formatSessionDate, formatDate } from "./tz";
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
    messageFormat: row?.message ? (row.messageFormat ?? null) : null,
    creator,
  };
}

function withCustomSubject<T extends { subject: string }>(mail: T, subject: string | null) {
  return subject ? { ...mail, subject } : mail;
}

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
  await enqueueEmail({
    to: order.buyerEmail,
    creatorId: order.creatorId,
    template: "ACCESS_GRANTED",
    dedupeKey,
    ...T.accessGrantedEmail({
      // Sin el nombre que escribió cualquiera en el formulario gratis (sale del dominio de la dueña).
      name: accessEmailGreetingName(order),
      creatorName: order.creator.displayName,
      productTitle: order.productTitle,
      productType: order.productType,
      url: link.url,
      newsletterUrl: newsletter?.url ?? null,
      linkNote: orderLinkNote(link.expiresAt),
      instructions: order.product.instructions,
    }),
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
      if (isNoChargeOrder(order)) {
        await sendAccessEmail(order.id, `access:${order.id}`);
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
                    }
                  : undefined,
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
          T.welcomeCustomerEmail({ name: customer.name, creatorName: s.creator.displayName, accountUrl: `${base}/${s.creator.username}/entrar?next=%2Fcuenta`, message: s.message, messageFormat: s.messageFormat }),
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
              until: formatDate(sub.currentPeriodEnd, { day: "numeric", month: "long" }, s.creator.timezone),
              url: `${base}/panel/clientes`,
            });
      await enqueueEmail({ to, creatorId: sub.creatorId, template: trigger, dedupeKey: `${trigger}:${sub.id}`, ...mail });
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
          }),
          s.subject,
        ),
      });
      await prisma.order.update({ where: { id: order.id }, data: { recoveryEmailedAt: new Date() } });
      return;
    }
  }
}
