/**
 * Quién puede abrir una factura (/facturas/[id]). Puro, para probarlo sin BD.
 *   · Administración: todas.
 *   · FEES (Cirella → creadora): solo esa creadora.
 *   · SALE: la creadora de la venta y la compradora (por su usuaria o, si la factura no la tiene,
 *     por el email al que se emitió).
 * Quien llama pasa userId/email vacíos si la sesión no ha demostrado que el email es suyo.
 */
export function canViewInvoice(
  viewer: { userId: string; isAdmin: boolean; creatorId: string | null; email: string },
  inv: { kind: string; creatorId: string; buyerUserId: string | null; recipientEmail: string | null },
): boolean {
  if (viewer.isAdmin) return true;
  if (viewer.creatorId && viewer.creatorId === inv.creatorId) return true;
  if (inv.kind !== "SALE") return false;
  if (inv.buyerUserId) return !!viewer.userId && inv.buyerUserId === viewer.userId;
  return !!viewer.email && !!inv.recipientEmail && inv.recipientEmail.toLowerCase() === viewer.email.toLowerCase();
}
