import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSession, type CurrentSession } from "./auth";
import { cuentaRefFromPath, orderTargetPath, scopeAllows } from "./auth-utils";
import { prisma } from "./db";
import { captureError } from "./monitoring";

/**
 * Guardas del área de cliente (/cuenta, descargas, .ics, huecos).
 *
 * Tres tipos de sesión:
 *   · de cuenta verificada (enlace mágico, o contraseña con el email confirmado) → todo /cuenta;
 *   · de cuenta sin verificar (alta con contraseña sin confirmar) → nada de /cuenta, salvo lo que
 *     la creadora tiene de sus propios productos;
 *   · limitada a un pedido (tras pagar o desde un enlace personal) → solo ese pedido: su producto,
 *     sus archivos y su reserva.
 * Cuando falta permiso se manda al login con la marca de la creadora del destino.
 */

export type LoginMotivo = "completa" | "confirmar" | "caducado" | "enlace";

type Scope = { orderId: string; productId: string };

const scopeOf = (s: CurrentSession): Scope | null => (s.order ? { orderId: s.order.id, productId: s.order.productId } : null);

export async function getBuyerSession() {
  const s = await getSession();
  if (!s) return null;
  return { user: s.user, verified: s.verified, scope: scopeOf(s), creatorId: s.order?.creatorId ?? null };
}

async function usernameFor(next: string, creatorId?: string | null) {
  const ref = cuentaRefFromPath(next);
  const select = { creator: { select: { username: true } } } as const;
  const row =
    ref?.kind === "product"
      ? await prisma.product.findUnique({ where: { id: ref.id }, select })
      : ref?.kind === "booking"
        ? await prisma.booking.findUnique({ where: { id: ref.id }, select })
        : ref?.kind === "order"
          ? await prisma.order.findUnique({ where: { id: ref.id }, select })
          : ref?.kind === "file"
            ? ((await prisma.productFile.findUnique({ where: { id: ref.id }, select: { product: { select } } }))?.product ??
              (await prisma.orderFile.findUnique({ where: { id: ref.id }, select: { order: { select } } }))?.order ??
              null)
            : null;
  if (row) return row.creator.username;
  if (!creatorId) return null;
  return (await prisma.creator.findUnique({ where: { id: creatorId }, select: { username: true } }))?.username ?? null;
}

/**
 * Login para llegar a `next`: con la marca de la creadora si la ruta (o `creatorId`, p. ej. la de
 * una sesión limitada) dice de quién es; si no, el login de Cirella.
 */
export async function buyerLoginPath(next: string, opts: { motivo?: LoginMotivo; creatorId?: string | null } = {}) {
  const username = await usernameFor(next, opts.creatorId);
  const q = `next=${encodeURIComponent(next)}${opts.motivo ? `&motivo=${opts.motivo}` : ""}`;
  return username ? `/${username}/entrar?${q}` : `/entrar?${q}`;
}

async function firstBookingId(orderId: string) {
  return (await prisma.booking.findFirst({ where: { orderId }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
}

/** Ruta de la compra de una sesión limitada (adónde va si intenta abrir /cuenta). */
export async function scopedTargetPath(order: { id: string; productId: string; productType: string }) {
  return orderTargetPath(order, order.productType === "SESSION" ? await firstBookingId(order.id) : null);
}

/**
 * Páginas con TODAS las compras (inicio, listas, perfil, soporte): exige una sesión de cuenta
 * verificada. `scopedToTarget`: una sesión limitada va directa a su compra en vez de al login.
 */
export async function requireBuyerFull(next: string, opts: { scopedToTarget?: boolean } = {}) {
  const s = await getSession();
  if (!s) redirect(await buyerLoginPath(next));
  if (s.order) {
    if (opts.scopedToTarget) redirect(await scopedTargetPath(s.order));
    redirect(await buyerLoginPath(next, { motivo: "completa", creatorId: s.order.creatorId }));
  }
  if (!s.verified) redirect(await buyerLoginPath(next, { motivo: "confirmar" }));
  return s.user;
}

/**
 * Páginas de detalle (un pedido, un curso, una membresía o una reserva). Deja pasar a:
 *   · la creadora dueña del producto (sesión de cuenta, aunque no esté verificada);
 *   · una sesión verificada de la compradora (las páginas siguen comprobando el acceso);
 *   · una sesión limitada cuyo pedido cubra el destino.
 * En cualquier otro caso manda al login (o 404 si es otra cuenta verificada).
 */
export async function requireBuyerFor(target: { orderId?: string; productId?: string; bookingId?: string }, next: string) {
  const s = await getSession();
  if (!s) redirect(await buyerLoginPath(next));
  const scope = scopeOf(s);
  const user = s.user;
  let allowed = false;
  let isOwner = false;

  if (target.bookingId) {
    const b = await prisma.booking.findUnique({ where: { id: target.bookingId }, select: { userId: true, orderId: true } });
    if (b && b.userId === user.id) allowed = scope ? scopeAllows(scope, { bookingOrderId: b.orderId }) : s.verified;
  } else if (target.orderId) {
    const o = await prisma.order.findUnique({ where: { id: target.orderId }, select: { customer: { select: { userId: true } } } });
    if (o && o.customer?.userId === user.id) allowed = scope ? scopeAllows(scope, { orderId: target.orderId }) : s.verified;
  } else if (target.productId) {
    const p = await prisma.product.findUnique({ where: { id: target.productId }, select: { creatorId: true } });
    isOwner = !scope && !!p && !!user.creator && user.creator.id === p.creatorId;
    allowed = isOwner || (scope ? scopeAllows(scope, { productId: target.productId }) : s.verified);
  }

  if (allowed) return { user, scoped: !!scope, isOwner };
  if (s.order) redirect(await buyerLoginPath(next, { motivo: "completa", creatorId: s.order.creatorId }));
  if (!s.verified) redirect(await buyerLoginPath(next, { motivo: "confirmar" }));
  notFound();
}

/**
 * Acceso a un archivo de un producto (para route handlers como /api/download):
 * la dueña siempre; si no, un Access activo y una sesión verificada o limitada a ese producto.
 */
export async function checkProductAccess(
  productId: string,
  productCreatorId: string,
): Promise<{ ok: true; userId: string; isOwner: boolean } | { ok: false; reason: "login" | "forbidden" }> {
  const s = await getSession();
  if (!s) return { ok: false, reason: "login" };
  if (!s.order && s.user.creator?.id === productCreatorId) return { ok: true, userId: s.user.id, isOwner: true };
  if (s.order ? s.order.productId !== productId : !s.verified) return { ok: false, reason: "forbidden" };
  const access = await prisma.access.findUnique({ where: { userId_productId: { userId: s.user.id, productId } } });
  const valid = access && access.status === "ACTIVE" && (!access.expiresAt || access.expiresAt > new Date());
  return valid ? { ok: true, userId: s.user.id, isOwner: false } : { ok: false, reason: "forbidden" };
}

/**
 * Anota el primer acceso de la compradora al contenido de un producto (en el pedido que se lo dio,
 * Order.metadata.firstAccessAt). Desde ese momento vale su renuncia al desistimiento (acceso
 * inmediato): antes puede desistir. Una sola vez y sin bloquear: si falla, no impide el acceso.
 */
export async function markFirstAccess(userId: string, productId: string) {
  try {
    const access = await prisma.access.findUnique({ where: { userId_productId: { userId, productId } }, select: { orderId: true } });
    if (!access?.orderId) return;
    const now = new Date().toISOString();
    await prisma.$executeRaw`
      UPDATE "Order"
      SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('firstAccessAt', ${now}::text)
      WHERE "id" = ${access.orderId} AND ("metadata" IS NULL OR "metadata"->>'firstAccessAt' IS NULL)`;
  } catch (e) {
    captureError(e, { area: "acceso", extra: { userId, productId } });
  }
}
