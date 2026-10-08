/** Solo acepta rutas internas (evita open redirects como "//x.com", "/\\x.com" o con caracteres de control). */
export function safeNext(next: string | null | undefined, fallback = "/cuenta") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
