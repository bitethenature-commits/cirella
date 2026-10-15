/** Cabeceras extra de los emails (EmailMessage.headers). Funciones puras: scripts/unit/baja-recordatorios.test.ts. */

/**
 * Cabeceras extra que dejamos pasar al proveedor: solo las de baja (RFC 2369 y 8058), sin saltos de
 * línea (una cabecera con \r\n podría inyectar otras).
 */
const ALLOWED_HEADERS = new Set(["List-Unsubscribe", "List-Unsubscribe-Post"]);

export function safeHeaders(h: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) if (ALLOWED_HEADERS.has(k) && typeof v === "string" && v && !/[\r\n]/.test(v)) out[k] = v;
  return out;
}

/** Cabeceras guardadas en EmailMessage.headers (JSON) → las del envío, o undefined si no hay. */
export function storedHeaders(json: unknown): Record<string, string> | undefined {
  if (!json || typeof json !== "object" || Array.isArray(json)) return undefined;
  const h = safeHeaders(json as Record<string, unknown>);
  return Object.keys(h).length ? h : undefined;
}
