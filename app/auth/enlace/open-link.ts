import "server-only";
import { createSession, getSession } from "@/lib/auth";
import { ORDER_LINK_SESSION_DAYS, resolveOrderLink } from "@/lib/order-links";

type OpenSession = { user: { id: string }; verified: boolean; orderId: string | null } | null;

/**
 * Qué hacer con la sesión abierta al abrir el enlace de un pedido de `userId`:
 *   · "ir": ya puede ver la compra (su cuenta confirmada o su sesión de ese pedido), o es su propia
 *     cuenta sin confirmar: no se le cierra el panel; la guarda de /cuenta le pide confirmar el email
 *     si el destino lo exige.
 *   · "preguntar": hay otra cuenta abierta; se pregunta antes de cambiar.
 *   · "limitada": no hay cuenta abierta (o solo otra sesión limitada); se abre una sesión de ese pedido.
 * Una sesión de cuenta nunca se sustituye en silencio (igual que `claimOrderSession`).
 */
export function linkAction(current: OpenSession, userId: string, orderId: string): "ir" | "preguntar" | "limitada" {
  if (current?.user.id === userId && (current.verified || current.orderId === orderId)) return "ir";
  if (current && !current.orderId) return current.user.id === userId ? "ir" : "preguntar";
  return "limitada";
}

/**
 * Abre un enlace personal y devuelve adónde ir. Abre una sesión limitada a ese pedido y nunca
 * confirma el email ni abre la cuenta completa: un enlace reenviado o guardado no debe completar
 * una cuenta registrada por otra persona. Nunca sustituye una sesión de cuenta abierta: si es la
 * suya, va a la compra (y la guarda le pide confirmar el email si hace falta); si es otra, se
 * pregunta antes de cambiar.
 * `afterSignOut`: la llamada viene de «Salir y abrir el enlace», que ya ha cerrado la sesión.
 */
export async function openOrderLink(t: string, opts: { afterSignOut?: boolean } = {}): Promise<string> {
  const res = await resolveOrderLink(t);
  if (!res) return "/entrar?error=enlace";
  if (res.status === "expired") return `/${res.username}/entrar?next=${encodeURIComponent(res.path)}&error=caducado`;

  const userId = res.order.customer?.userId;
  if (!userId) return "/entrar?error=enlace";
  const current = opts.afterSignOut ? null : await getSession();
  const action = linkAction(current, userId, res.order.id);
  if (action === "ir") return res.link.path;
  if (action === "preguntar") return `/auth/enlace/cambiar?t=${encodeURIComponent(t)}`;
  await createSession(userId, { verified: false, orderId: res.order.id, ttlHours: ORDER_LINK_SESSION_DAYS * 24 });
  return res.link.path;
}
