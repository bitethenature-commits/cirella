import "server-only";
import type { Prisma, Product } from "@prisma/client";
import { asAccessMode, hostsContent, resendDedupeKey, type NoChargeProvider, NO_CHARGE_PROVIDERS } from "./access-mode";
import { sendAccessEmail } from "./automations";
import { prisma } from "./db";
import { deliveryFacts, deliveryIssue, DELIVERY_COUNT } from "./delivery";
import { accessUntil, newsletterRequested, publicClaimBlocked, revokedByOwner } from "./free-access-rules";
import { legalIdentityComplete } from "./legal";
import { ensureLegalSnapshot } from "./legal-snapshot";
import { revokeOrderAccess } from "./order-links";
import { fulfillOrder } from "./orders";
import { isPersonalMode } from "./site-mode";

/**
 * Acceso sin cobro a un producto (Product.accessMode, lib/access-mode.ts):
 *   · claimFreeAccess: el formulario «nombre + email» de la ficha de un producto gratis (FREE_EMAIL).
 *   · grantManualAccess / revokeManualAccess: la dueña da o quita el acceso desde el panel (lo que se
 *     paga fuera pero se ve aquí, o regalar un producto gratis a alguien).
 *
 * Los dos crean un pedido de 0 € (paymentProvider «free» o «manual»: sin IVA, comisión, factura ni
 * transacción de cobro) y entregan por el mismo camino que una compra (fulfillOrder): clienta, acceso
 * y el email «Ya tienes acceso a «X»» con el enlace personal que lleva directo al contenido.
 *
 * Idempotente por email + producto: si ya lo tiene, no se crea otro pedido; se reenvía el enlace.
 * Si la dueña le quitó el acceso, solo ella lo devuelve (dándolo otra vez a mano): volver a
 * apuntarse con el formulario no hace nada (Order.metadata.revokedAt, lib/free-access-rules.ts).
 * Dos envíos a la vez del mismo email esperan al mismo cerrojo de la BD, así que nunca hay dos pedidos.
 *
 * Novedades: la casilla del formulario no es consentimiento todavía (cualquiera puede escribir un
 * email ajeno). Se anota como pedida y el email de acceso lleva un botón para confirmarla
 * (confirmNewsletter, desde /cuenta/novedades/confirmar).
 */

export class FreeAccessError extends Error {}

/**
 * «blocked»: petición del formulario sobre un acceso que la dueña quitó (o cuya fecha de fin ya
 * pasó); no se hace nada. `until`: fin del acceso que puso la dueña (null = sin fecha).
 */
export type GrantResult = { status: "granted" | "resent" | "blocked"; orderId: string; until?: Date | null };

type ProductForGrant = Pick<Product, "id" | "creatorId" | "title" | "type" | "currency">;

/**
 * Producto gratis con email que se puede pedir ahora: publicado y de una creadora activa, publicada
 * y con sus datos legales completos (sin ellos la privacidad que se acepta no dice quién trata los
 * datos; igual que el checkout de pago, lib/orders.ts).
 */
export async function getClaimableProduct(productId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: { creator: { include: { user: { select: { status: true } } } } },
  });
  if (!p || p.status !== "PUBLISHED" || asAccessMode(p.accessMode) !== "FREE_EMAIL" || !hostsContent(p.type)) return null;
  const c = p.creator;
  if (c.status !== "ACTIVE" || !c.published || c.user.status !== "ACTIVE" || !legalIdentityComplete(c)) return null;
  return p;
}

/** Formulario de la ficha. El nombre y el email ya llegan validados; el email, en minúsculas. */
export async function claimFreeAccess(input: {
  productId: string;
  name: string;
  email: string;
  newsletter: boolean;
  visitorId?: string | null;
  ipHash?: string | null;
  source?: string | null;
}): Promise<GrantResult> {
  const product = await getClaimableProduct(input.productId);
  if (!product) throw new FreeAccessError("Este contenido no está disponible ahora mismo.");
  // La versión exacta de los textos legales (privacidad incluida) que tenía la página al apuntarse.
  const snapshot = await ensureLegalSnapshot(product.creatorId);
  const now = new Date();
  return grantNoCharge(product, "free", {
    email: input.email,
    name: input.name,
    origin: "public",
    newsletter: input.newsletter,
    data: {
      // Las novedades no cuentan hasta que las confirma desde su email (confirmNewsletter).
      marketingOptIn: false,
      legalSnapshotId: snapshot.id,
      termsAcceptedAt: now,
      visitorId: input.visitorId ?? null,
      ipHash: input.ipHash ?? null,
      source: input.source ?? null,
      metadata: {
        privacyAcceptedAt: now.toISOString(),
        ...(input.newsletter ? { newsletterRequested: true, newsletterRequestedAt: now.toISOString() } : {}),
      },
    },
  });
}

/**
 * La dueña da acceso a una persona desde la ficha del producto en el panel. Productos con algo que
 * ver aquí (no sesiones, y con contenido) que no se cobran aquí (gratis o pagados fuera); en la web
 * personal, también los de pago (Bizum, transferencia o un regalo).
 *
 * `until`: fin del acceso (lib/access-end.ts). null = sin fecha de fin; undefined = la que tuviera.
 * Volver a darlo con otra fecha la cambia (también para alargarlo o quitarle la fecha).
 */
export async function grantManualAccess(input: {
  creatorId: string;
  productId: string;
  name: string;
  email: string;
  grantedByUserId: string;
  until?: Date | null;
}): Promise<GrantResult> {
  const product = await prisma.product.findFirst({ where: { id: input.productId, creatorId: input.creatorId }, include: DELIVERY_COUNT });
  if (!product || product.status === "ARCHIVED") throw new FreeAccessError("Producto no encontrado");
  if (asAccessMode(product.accessMode) === "PAID" && !isPersonalMode()) throw new FreeAccessError("Este producto se cobra en la web: no se puede dar acceso a mano.");
  if (!hostsContent(product.type)) throw new FreeAccessError("Las sesiones se dan desde Reservas → «Dar una sesión o lectura».");
  // Lo que se ve aquí tiene que existir (como si fuera gratis: un externo nunca bloquea al publicar).
  const issue = deliveryIssue({ ...deliveryFacts(product), accessMode: "FREE_EMAIL" });
  if (issue?.blocking)
    throw new FreeAccessError(
      product.type === "COURSE"
        ? "Añade primero alguna lección: si no, no verá nada al entrar."
        : "Añade primero lo que recibirá (archivos, enlaces o instrucciones): si no, no verá nada al entrar.",
    );
  const now = new Date();
  const dated = input.until ? { accessUntil: input.until.toISOString() } : {};
  return grantNoCharge(product, "manual", {
    email: input.email,
    name: input.name,
    origin: "owner",
    until: input.until,
    data: { metadata: { grantedByUserId: input.grantedByUserId, accessGrantedAt: now.toISOString(), ...dated } },
  });
}

/**
 * Quita el acceso a un producto: el acceso pasa a REVOKED y se cortan sus enlaces personales y
 * sesiones limitadas. El pedido de 0 € se queda (es el registro de la inscripción) con la marca
 * revokedAt: el formulario público ya no lo devuelve; solo la dueña, dándolo otra vez a mano.
 */
export async function revokeManualAccess(input: { creatorId: string; orderId: string }): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, creatorId: input.creatorId, paymentProvider: { in: [...NO_CHARGE_PROVIDERS] }, status: "PAID" },
    include: { customer: { select: { userId: true } } },
  });
  if (!order?.customer) return false;
  await prisma.access.updateMany({
    where: { creatorId: input.creatorId, userId: order.customer.userId, productId: order.productId, orderId: order.id },
    data: { status: "REVOKED" },
  });
  await mergeOrderMetadata(prisma, order.id, { revokedAt: new Date().toISOString() });
  await revokeOrderAccess(order.id);
  return true;
}

/**
 * «Sí, quiero recibir novedades» del email de acceso (/cuenta/novedades/confirmar): la persona que
 * abre su email confirma lo que marcó en el formulario. Solo su propio pedido y solo si lo pidió.
 * Nunca retira un consentimiento (eso, desde /cuenta/perfil o el enlace de cada email).
 */
export async function confirmNewsletter(input: { orderId: string; userId: string }): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, status: true, metadata: true, customer: { select: { id: true, userId: true } } },
  });
  if (!order?.customer || order.customer.userId !== input.userId || order.status !== "PAID" || !newsletterRequested(order.metadata)) return false;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customer.updateMany({ where: { id: order.customer!.id, marketingOptIn: false }, data: { marketingOptIn: true, marketingOptInAt: now } });
    await mergeOrderMetadata(tx, order.id, { newsletterConfirmedAt: now.toISOString() });
  });
  return true;
}

/** Añade claves a Order.metadata sin pisar las demás (markFirstAccess escribe ahí a la vez). */
function mergeOrderMetadata(db: Prisma.TransactionClient, orderId: string, patch: Record<string, unknown>, remove: string[] = []) {
  return db.$executeRaw`
    UPDATE "Order"
    SET "metadata" = (COALESCE("metadata", '{}'::jsonb) - ${remove}::text[]) || ${JSON.stringify(patch)}::jsonb
    WHERE "id" = ${orderId}`;
}

/** Pedidos de 0 € de este producto y email que cuentan como «ya apuntada» (o a medio entregar). */
function existingNoChargeOrder(tx: Prisma.TransactionClient, productId: string, email: string) {
  return tx.order.findFirst({
    where: { productId, buyerEmail: email, paymentProvider: { in: [...NO_CHARGE_PROVIDERS] }, status: { in: ["PAID", "PENDING"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, metadata: true },
  });
}

async function grantNoCharge(
  product: ProductForGrant,
  provider: NoChargeProvider,
  input: {
    email: string;
    name: string;
    /** public: el formulario de la ficha; owner: la dueña desde el panel. */
    origin: "public" | "owner";
    /** Marcó «Quiero recibir novedades» (se anota como pedida en un pedido que ya existía). */
    newsletter?: boolean;
    /** Solo la dueña: fin del acceso (null = sin fecha; undefined = la que tuviera). */
    until?: Date | null;
    data: Omit<Prisma.OrderUncheckedCreateInput, "creatorId" | "productId" | "productTitle" | "productType" | "buyerEmail" | "buyerName" | "amountCents" | "commissionBps" | "platformFeeCents" | "netCents" | "paymentProvider">;
  },
): Promise<GrantResult> {
  const email = input.email.trim().toLowerCase();
  const found = await prisma.$transaction(async (tx) => {
    // Un cerrojo por producto + email: dos envíos a la vez no crean dos pedidos.
    // $executeRaw y no $queryRaw: pg_advisory_xact_lock devuelve void.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`free-access:${product.id}:${email}`}, 0))`;
    const existing = await existingNoChargeOrder(tx, product.id, email);
    if (existing) {
      // La dueña le quitó el acceso: el formulario no lo devuelve (y responde lo mismo de siempre).
      if (input.origin === "public" && publicClaimBlocked(existing)) return { orderId: existing.id, fresh: false, blocked: true };
      // La dueña lo da otra vez: vuelve a valer también el formulario, y su fecha de fin es la nueva.
      if (input.origin === "owner") {
        const remove = revokedByOwner(existing.metadata) ? ["revokedAt"] : [];
        if (input.until === undefined) {
          if (remove.length) await mergeOrderMetadata(tx, existing.id, {}, remove);
        } else
          await mergeOrderMetadata(
            tx,
            existing.id,
            { accessGrantedAt: new Date().toISOString(), ...(input.until ? { accessUntil: input.until.toISOString() } : {}) },
            input.until ? remove : [...remove, "accessUntil"],
          );
      }
      if (input.newsletter) await requestNewsletter(tx, existing.id);
      return { orderId: existing.id, fresh: existing.status !== "PAID" };
    }
    // Ya tenía acceso por una compra anterior: se le reenvía ese enlace, sin pedido nuevo.
    const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    const access = user ? await tx.access.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } }) : null;
    if (access?.status === "ACTIVE" && access.orderId && (!access.expiresAt || access.expiresAt > new Date())) {
      if (input.newsletter) await requestNewsletter(tx, access.orderId);
      return { orderId: access.orderId, fresh: false };
    }
    const order = await tx.order.create({
      data: {
        ...input.data,
        creatorId: product.creatorId,
        productId: product.id,
        productTitle: product.title,
        productType: product.type,
        buyerEmail: email,
        buyerName: input.name.trim() || null,
        amountCents: 0,
        currency: product.currency,
        commissionBps: 0,
        platformFeeCents: 0,
        netCents: 0,
        taxSeller: "CREATOR",
        taxRateBps: 0,
        taxCents: 0,
        paymentProvider: provider,
        // «Listo para entregar» desde ya: si la entrega falla a mitad, el vigilante del cron la
        // reintenta (lib/watchdog.ts) y nunca se trata como un checkout abandonado.
        chargedAt: new Date(),
      },
      select: { id: true },
    });
    return { orderId: order.id, fresh: true };
  });

  if ("blocked" in found) return { status: "blocked", orderId: found.orderId };
  if (found.fresh) {
    await fulfillOrder(found.orderId, "");
    return { status: "granted", orderId: found.orderId, until: input.until ?? null };
  }
  const until = await restoreAccess(found.orderId, { owner: input.origin === "owner" });
  await sendAccessEmail(found.orderId, resendDedupeKey(found.orderId));
  return { status: "resent", orderId: found.orderId, until };
}

/**
 * Novedades marcadas al repetir el formulario: se anotan como pedidas en el pedido que ya tenía y
 * el email que se reenvía lleva el botón para confirmarlas. Si ya las había confirmado y luego se
 * dio de baja, vuelve a quedar pendiente de confirmar.
 */
function requestNewsletter(tx: Prisma.TransactionClient, orderId: string) {
  return mergeOrderMetadata(tx, orderId, { newsletterRequested: true, newsletterRequestedAt: new Date().toISOString() }, ["newsletterConfirmedAt"]);
}

/**
 * Si el acceso de un pedido de 0 € ya no está activo (caducado, terminado o quitado), lo devuelve con
 * la fecha de fin del pedido (Order.metadata.accessUntil). Con `owner` (la dueña lo da otra vez o
 * cambia la fecha), el acceso vigente de ESTE pedido también toma la fecha nueva. Un acceso vigente
 * de una compra o de una suscripción nunca se toca. No llega aquí una petición del formulario sobre
 * un acceso que quitó o terminó la dueña (grantNoCharge la para). Devuelve el fin del acceso.
 */
async function restoreAccess(orderId: string, o: { owner: boolean }): Promise<Date | null> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: { select: { userId: true } } } });
  const until = accessUntil(order.metadata);
  if (!order.customer || !NO_CHARGE_PROVIDERS.includes(order.paymentProvider as NoChargeProvider)) return until;
  const current = await prisma.access.findUnique({ where: { userId_productId: { userId: order.customer.userId, productId: order.productId } } });
  const live = current?.status === "ACTIVE" && (!current.expiresAt || current.expiresAt > new Date());
  const ours = !!current && current.orderId === order.id && !current.subscriptionId;
  if (live && !(o.owner && ours)) return current!.expiresAt;
  await prisma.access.upsert({
    where: { userId_productId: { userId: order.customer.userId, productId: order.productId } },
    create: { creatorId: order.creatorId, userId: order.customer.userId, productId: order.productId, orderId: order.id, expiresAt: until },
    update: { status: "ACTIVE", orderId: order.id, expiresAt: until, subscriptionId: null },
  });
  return until;
}
