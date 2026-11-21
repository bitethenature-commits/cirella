import "server-only";
import { accessEndText } from "@/lib/access-end";
import { asAccessMode, hostsContent, NO_CHARGE_LABEL, NO_CHARGE_PROVIDERS, type NoChargeProvider } from "@/lib/access-mode";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import type { AccessRow } from "./access-manager";

/** Cuántas personas con acceso se listan en la ficha (el resto, en Inscripciones). */
const ACCESS_ROWS = 50;

/**
 * ¿Se da y se quita el acceso a mano? Gratis o pagado fuera, con contenido aquí. En la web personal, también lo de
 * pago (para quien paga por Bizum o transferencia, o para regalarlo).
 */
export function managesAccessOf(p: { type: string; accessMode: string | null }): boolean {
  return hostsContent(p.type) && (asAccessMode(p.accessMode) !== "PAID" || isPersonalMode());
}

/**
 * Las personas con acceso dado a mano o por formulario (las 50 últimas), cuántas son y cuántas ventas de pago tiene.
 * Lo usan la ficha del producto (/panel/productos/<id>) y «Dar acceso» en Cursos.
 */
export async function productAccess(creator: { id: string; timezone: string }, product: { id: string; type: string; accessMode: string | null }, paidOrders: number) {
  const managesAccess = managesAccessOf(product);
  if (!managesAccess) return { managesAccess, rows: [] as AccessRow[], total: 0, paidSales: paidOrders };
  const db = tenantDb(creator.id);
  const noCharge = { productId: product.id, paymentProvider: { in: [...NO_CHARGE_PROVIDERS] }, status: "PAID" };
  const [orders, total, paidSales] = await Promise.all([
    db.order.findMany({
      where: noCharge,
      orderBy: { paidAt: "desc" },
      take: ACCESS_ROWS,
      select: { id: true, buyerName: true, buyerEmail: true, paidAt: true, paymentProvider: true },
    }),
    db.order.count({ where: noCharge }),
    db.order.count({ where: { productId: product.id, status: "PAID", paymentProvider: { notIn: [...NO_CHARGE_PROVIDERS] } } }),
  ]);
  const access = await db.access.findMany({
    where: { productId: product.id, orderId: { in: orders.map((o) => o.id) } },
    select: { orderId: true, status: true, expiresAt: true },
  });
  const now = new Date();
  const byOrder = new Map(access.map((a) => [a.orderId, a]));
  const rows: AccessRow[] = orders.map((o) => {
    const a = byOrder.get(o.id);
    const live = !!a && a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now);
    const ended = !!a && !!a.expiresAt && a.expiresAt <= now && (a.status === "ACTIVE" || a.status === "EXPIRED");
    return {
      orderId: o.id,
      name: o.buyerName,
      email: o.buyerEmail,
      date: o.paidAt ? formatDate(o.paidAt, { day: "numeric", month: "short", year: "numeric" }, creator.timezone) : "—",
      origin: NO_CHARGE_LABEL[o.paymentProvider as NoChargeProvider] ?? o.paymentProvider,
      active: live,
      ended,
      until: a?.expiresAt && (live || ended) ? accessEndText(a.expiresAt, creator.timezone, now) : null,
    };
  });
  return { managesAccess, rows, total, paidSales };
}
