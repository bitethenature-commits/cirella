import "server-only";
import type { Prisma, Product } from "@prisma/client";
import { asAccessMode, hostsContent, resendDedupeKey, type NoChargeProvider, NO_CHARGE_PROVIDERS } from "./access-mode";
import { sendAccessEmail } from "./automations";
import { prisma } from "./db";
import { deliveryFacts, deliveryIssue, DELIVERY_COUNT } from "./delivery";
import { ensureLegalSnapshot } from "./legal-snapshot";
import { revokeOrderAccess } from "./order-links";
import { fulfillOrder } from "./orders";

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
 * Idempotente por email + producto: si ya lo tiene, no se crea otro pedido; se reenvía el enlace
 * (y, si se le había quitado el acceso, se le devuelve). Dos envíos a la vez del mismo email esperan
 * al mismo cerrojo de la BD, así que nunca hay dos pedidos.
 */

export class FreeAccessError extends Error {}

export type GrantResult = { status: "granted" | "resent"; orderId: string };

type ProductForGrant = Pick<Product, "id" | "creatorId" | "title" | "type" | "currency">;

/** Producto gratis con email que se puede pedir ahora: publicado y de una creadora activa y publicada. */
export async function getClaimableProduct(productId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: { creator: { include: { user: { select: { status: true } } } } },
  });
  if (!p || p.status !== "PUBLISHED" || asAccessMode(p.accessMode) !== "FREE_EMAIL" || !hostsContent(p.type)) return null;
  const c = p.creator;
  if (c.status !== "ACTIVE" || !c.published || c.user.status !== "ACTIVE") return null;
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
    data: {
      marketingOptIn: input.newsletter,
      legalSnapshotId: snapshot.id,
      termsAcceptedAt: now,
      visitorId: input.visitorId ?? null,
      ipHash: input.ipHash ?? null,
      source: input.source ?? null,
      metadata: { privacyAcceptedAt: now.toISOString() },
    },
  });
}

/**
 * La dueña da acceso a una persona desde la ficha del producto en el panel. Solo productos que no
 * se cobran aquí (gratis o pagados fuera) y con algo que ver aquí (no sesiones, y con contenido).
 */
export async function grantManualAccess(input: { creatorId: string; productId: string; name: string; email: string; grantedByUserId: string }): Promise<GrantResult> {
  const product = await prisma.product.findFirst({ where: { id: input.productId, creatorId: input.creatorId }, include: DELIVERY_COUNT });
  if (!product || product.status === "ARCHIVED") throw new FreeAccessError("Producto no encontrado");
  if (asAccessMode(product.accessMode) === "PAID") throw new FreeAccessError("Este producto se cobra en la web: no se puede dar acceso a mano.");
  if (!hostsContent(product.type)) throw new FreeAccessError("Las sesiones se reservan en la otra web: aquí no hay nada a lo que dar acceso.");
  // Lo que se ve aquí tiene que existir (como si fuera gratis: un externo nunca bloquea al publicar).
  const issue = deliveryIssue({ ...deliveryFacts(product), accessMode: "FREE_EMAIL" });
  if (issue?.blocking)
    throw new FreeAccessError(
      product.type === "COURSE"
        ? "Añade primero alguna lección: si no, no verá nada al entrar."
        : "Añade primero lo que recibirá (archivos, enlaces o instrucciones): si no, no verá nada al entrar.",
    );
  return grantNoCharge(product, "manual", {
    email: input.email,
    name: input.name,
    data: { metadata: { grantedByUserId: input.grantedByUserId } },
  });
}

/**
 * Quita el acceso a un producto: el acceso pasa a REVOKED y se cortan sus enlaces personales y
 * sesiones limitadas. El pedido de 0 € se queda (es el registro de la inscripción).
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
  await revokeOrderAccess(order.id);
  return true;
}

/** Pedidos de 0 € de este producto y email que cuentan como «ya apuntada» (o a medio entregar). */
function existingNoChargeOrder(tx: Prisma.TransactionClient, productId: string, email: string) {
  return tx.order.findFirst({
    where: { productId, buyerEmail: email, paymentProvider: { in: [...NO_CHARGE_PROVIDERS] }, status: { in: ["PAID", "PENDING"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true },
  });
}

async function grantNoCharge(
  product: ProductForGrant,
  provider: NoChargeProvider,
  input: { email: string; name: string; data: Omit<Prisma.OrderUncheckedCreateInput, "creatorId" | "productId" | "productTitle" | "productType" | "buyerEmail" | "buyerName" | "amountCents" | "commissionBps" | "platformFeeCents" | "netCents" | "paymentProvider"> },
): Promise<GrantResult> {
  const email = input.email.trim().toLowerCase();
  const found = await prisma.$transaction(async (tx) => {
    // Un cerrojo por producto + email: dos envíos a la vez no crean dos pedidos.
    // $executeRaw y no $queryRaw: pg_advisory_xact_lock devuelve void.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`free-access:${product.id}:${email}`}, 0))`;
    const existing = await existingNoChargeOrder(tx, product.id, email);
    if (existing) return { orderId: existing.id, fresh: existing.status !== "PAID" };
    // Ya tenía acceso por una compra anterior: se le reenvía ese enlace, sin pedido nuevo.
    const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    const access = user ? await tx.access.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } }) : null;
    if (access?.status === "ACTIVE" && access.orderId && (!access.expiresAt || access.expiresAt > new Date())) return { orderId: access.orderId, fresh: false };
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

  if (found.fresh) {
    await fulfillOrder(found.orderId, "");
    return { status: "granted", orderId: found.orderId };
  }
  await restoreAccess(found.orderId);
  await sendAccessEmail(found.orderId, resendDedupeKey(found.orderId));
  return { status: "resent", orderId: found.orderId };
}

/** Si se le quitó el acceso de un pedido de 0 €, volver a apuntarse (o que se lo den) lo devuelve. */
async function restoreAccess(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: { select: { userId: true } } } });
  if (!order.customer || !NO_CHARGE_PROVIDERS.includes(order.paymentProvider as NoChargeProvider)) return;
  const current = await prisma.access.findUnique({ where: { userId_productId: { userId: order.customer.userId, productId: order.productId } } });
  // Un acceso vigente (también el de una compra o una suscripción) no se toca.
  if (current?.status === "ACTIVE" && (!current.expiresAt || current.expiresAt > new Date())) return;
  await prisma.access.upsert({
    where: { userId_productId: { userId: order.customer.userId, productId: order.productId } },
    create: { creatorId: order.creatorId, userId: order.customer.userId, productId: order.productId, orderId: order.id },
    update: { status: "ACTIVE", orderId: order.id, expiresAt: null, subscriptionId: null },
  });
}
