/**
 * IP de quien hace la petición: la primera de X-Forwarded-For, si no X-Real-IP, si no «0.0.0.0».
 *
 * Solo es fiable si el proxy del despliegue (Vercel, Cloudflare, nginx…) SOBRESCRIBE la cabecera
 * X-Forwarded-For en vez de añadir a la que manda el navegador (ver README, «Cumplimiento legal»). Si no,
 * cualquiera puede inventarse la IP. La usan la medición de visitas sin cookies y los límites de
 * intentos.
 */
export function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = h.get("x-real-ip")?.trim();
  return real || "0.0.0.0";
}
