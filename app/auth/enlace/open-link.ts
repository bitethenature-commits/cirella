import "server-only";
import { createSession, getSession } from "@/lib/auth";
import { ORDER_LINK_SESSION_DAYS, resolveOrderLink } from "@/lib/order-links";

/**
 * Abre un enlace personal y devuelve adónde ir. Abre una sesión limitada a ese pedido y nunca
 * confirma el email ni abre la cuenta completa: un enlace reenviado o guardado no debe completar
 * una cuenta registrada por otra persona. Si hay otra cuenta abierta, se pregunta antes de cambiar.
 * `afterSignOut`: la llamada viene de «Salir y abrir el enlace», que ya ha cerrado la sesión.
 */
export async function openOrderLink(t: string, opts: { afterSignOut?: boolean } = {}): Promise<string> {
  const res = await resolveOrderLink(t);
  if (!res) return "/entrar?error=enlace";
  if (res.status === "expired") return `/${res.username}/entrar?next=${encodeURIComponent(res.path)}&error=caducado`;

  const userId = res.order.customer?.userId;
  if (!userId) return "/entrar?error=enlace";
  const current = opts.afterSignOut ? null : await getSession();
  if (current?.user.id === userId && (current.verified || current.orderId === res.order.id)) return res.link.path;
  if (current && !current.orderId && current.user.id !== userId) return `/auth/enlace/cambiar?t=${encodeURIComponent(t)}`;
  await createSession(userId, { verified: false, orderId: res.order.id, ttlHours: ORDER_LINK_SESSION_DAYS * 24 });
  return res.link.path;
}
