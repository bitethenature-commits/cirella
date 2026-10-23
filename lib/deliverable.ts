/** Regla pura de las entregas por pedido (lib/order-files.ts, lib/uploads.ts). */
/** ¿Se le puede entregar algo a este pedido? Pagado, y una lectura «Lo preparo yo» o una sesión 1:1. */
export function deliverableOrder(o: { status: string; productType: string; product: { deliveryMode: string; groupSession: boolean } }) {
  if (o.status !== "PAID") return false;
  return (o.productType === "DIGITAL" && o.product.deliveryMode === "PERSONAL") || (o.productType === "SESSION" && !o.product.groupSession);
}
