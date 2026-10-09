import "server-only";
import { grantPostCheckoutAccess } from "../checkout-access";
import { prisma } from "../db";
import { captureError } from "../monitoring";
import { reconcileCheckout } from "./events";

/**
 * Vuelta de la compradora desde la pasarela (o desde el «banco» del simulador): consulta el estado
 * real (la URL no demuestra nada), lo aplica como si fuera un aviso y decide adónde va:
 *   · pagado → página de gracias, con sesión si es el mismo navegador o enlace mágico si no;
 *   · pendiente → página de gracias, que muestra «Pago pendiente de confirmar»;
 *   · fallido o cancelado → de vuelta al checkout con el mismo pedido;
 *   · renovación de membresía → su página en /cuenta.
 * La usan /api/payments/return y las acciones del simulador (que no pueden redirigir a una ruta
 * de API sin perder las cookies de la sesión).
 */
export async function checkoutReturnPath(ref: string): Promise<string> {
  let result: Awaited<ReturnType<typeof reconcileCheckout>>;
  try {
    result = await reconcileCheckout(ref);
  } catch (e) {
    captureError(e, { area: "payments", tags: { op: "vuelta" }, extra: { ref } });
    // Sin poder consultar la pasarela: si el pedido existe, la página de gracias muestra su estado.
    const order = await prisma.order.findUnique({ where: { checkoutRef: ref }, include: { creator: { select: { username: true } } } });
    return order ? `/${order.creator.username}/gracias?pedido=${order.id}` : "/";
  }
  if (result.subscriptionId) {
    const sub = await prisma.subscription.findUnique({ where: { id: result.subscriptionId }, select: { productId: true } });
    return sub ? `/cuenta/membresias/${sub.productId}${result.state === "succeeded" ? "?pago=ok" : ""}` : "/cuenta/membresias";
  }
  const order = result.orderId
    ? await prisma.order.findUnique({ where: { id: result.orderId }, include: { creator: { select: { username: true } }, product: { select: { slug: true } } } })
    : null;
  if (!order) return "/";
  const thanks = `/${order.creator.username}/gracias?pedido=${order.id}`;
  if (order.status === "PAID") {
    const access = await grantPostCheckoutAccess(order.id);
    return `${thanks}${access === "magic" ? "&acceso=email" : ""}`;
  }
  if (order.status === "FAILED") return `/${order.creator.username}/${order.product.slug}/checkout?pedido=${order.id}&cancelado=1`;
  return thanks;
}
