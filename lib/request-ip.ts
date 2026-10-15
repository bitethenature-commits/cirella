import { parseClientIp } from "./client-ip";

/**
 * IP de quien hace la petición, con la misma regla que los límites de intentos (lib/client-ip.ts):
 * la cabecera CLIENT_IP_HEADER que fija el proxy del despliegue o, sin ella, el último valor de
 * X-Forwarded-For (el que añade nuestro proxy; los anteriores los puede inventar el navegador).
 * La usa la medición de visitas sin cookies (ver README, «Cumplimiento legal» y «Límites de intentos»).
 */
export function clientIp(h: Headers): string {
  return parseClientIp((n) => h.get(n));
}
