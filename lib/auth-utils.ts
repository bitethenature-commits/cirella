/** Solo acepta rutas internas (evita open redirects como "//x.com", "/\\x.com" o con caracteres de control). */
export function safeNext(next: string | null | undefined, fallback = "/cuenta") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

// ─── Alcance de las sesiones de compradora ───
// Funciones puras (sin BD ni cookies): las usan lib/auth.ts, lib/buyer-access.ts, las páginas
// de /cuenta y las pruebas unitarias.

/** Página de /cuenta que abre una compra concreta (destino del botón de «gracias» y de los emails). */
export function orderTargetPath(order: { id: string; productType: string; productId: string }, bookingId?: string | null) {
  if (order.productType === "COURSE") return `/cuenta/cursos/${order.productId}`;
  if (order.productType === "MEMBERSHIP") return `/cuenta/membresias/${order.productId}`;
  if (order.productType === "SESSION" && bookingId) return `/cuenta/sesiones/${bookingId}`;
  return `/cuenta/pedidos/${order.id}`;
}

/** A qué apunta una ruta de detalle de /cuenta (para saber de qué creadora es o si entra en un alcance). */
export function cuentaRefFromPath(path: string): { kind: "product" | "booking" | "order"; id: string } | null {
  const m = path.split(/[?#]/)[0].match(/^\/cuenta\/(cursos|membresias|sesiones|pedidos)\/([^/]+)(?:\/.*)?$/);
  if (!m) return null;
  const kind = m[1] === "sesiones" ? "booking" : m[1] === "pedidos" ? "order" : "product";
  return { kind, id: m[2] };
}

/**
 * ¿Cubre una sesión limitada a un pedido este destino? Las reservas se comprueban SIEMPRE por su
 * pedido: una reserva anterior de la dueña del email (con su enlace de videollamada) nunca se
 * muestra aunque sea del mismo producto.
 */
export function scopeAllows(
  scope: { orderId: string; productId: string },
  target: { orderId?: string; productId?: string; bookingOrderId?: string | null },
) {
  if (target.orderId !== undefined) return target.orderId === scope.orderId;
  if ("bookingOrderId" in target) return !!target.bookingOrderId && target.bookingOrderId === scope.orderId;
  if (target.productId !== undefined) return target.productId === scope.productId;
  return false;
}

/** Rutas del área de cliente: necesitan una sesión que haya demostrado que el email es suyo. */
export function isBuyerPath(path: string) {
  const p = path.split(/[?#]/)[0];
  return p === "/cuenta" || p.startsWith("/cuenta/") || p.startsWith("/api/download/");
}

/**
 * ¿Basta esta sesión para abrir la ruta? Las limitadas a un pedido no abren ninguna ruta completa
 * (cada página de detalle decide con scopeAllows); las de cuenta sin verificar sirven para el
 * panel y el onboarding, pero no para el área de cliente.
 */
export function sessionSatisfies(s: { verified: boolean; scoped: boolean }, path: string) {
  if (s.scoped) return false;
  if (s.verified) return true;
  return !isBuyerPath(path);
}

/** «paula@example.com» → «pa•••@example.com». */
export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}
