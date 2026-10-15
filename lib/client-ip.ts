import { headers } from "next/headers";
import { env, isProductionLike } from "./env";
import { keyHash } from "./rate-limit";

/**
 * IP real de quien hace la petición, para los límites de intentos y la medición de visitas.
 *
 *   · CLIENT_IP_HEADER (obligatoria en producción): la cabecera que fija nuestro proxy de confianza,
 *     x-real-ip en Vercel y Railway, o fly-client-ip en Fly. Solo es fiable si TODOS los caminos hasta la web
 *     la sobrescriben: cf-connecting-ip delante de Vercel no lo es (Vercel la deja pasar y la web
 *     también responde en *.vercel.app), así que cualquiera podría inventársela.
 *   · Sin ella, el último valor de X-Forwarded-For: el valor más a la derecha lo añade nuestro proxy;
 *     los de la izquierda los puede inventar el cliente. Sin proxy, Next la rellena con la IP de
 *     la conexión solo si no viene (así que el cliente puede falsearla: en producción, siempre proxy).
 *
 * Pura y sin `server-only` (salvo requestClient): la prueban los tests unitarios.
 */
export function parseClientIp(get: (name: string) => string | null, header: string | null | undefined = env().CLIENT_IP_HEADER): string {
  const name = header?.trim().toLowerCase();
  const raw = name && name !== "x-forwarded-for" ? get(name) : lastForwarded(get("x-forwarded-for"));
  return raw?.trim().slice(0, 64) || "unknown";
}

function lastForwarded(value: string | null) {
  const parts = (value ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.at(-1) ?? null;
}

/** HMAC de la IP: es lo único que se guarda (claves de límites y Order.ipHash). */
export function hashIp(ip: string): string {
  return keyHash(`ip|${ip}`);
}

const LOCAL_IPS = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];
let localHashes: Set<string> | undefined;

/**
 * ¿Es una petición desde esta misma máquina fuera de producción? En desarrollo y en las pruebas
 * todo llega desde localhost: si contara por conexión, unas pruebas agotarían el cupo de las
 * siguientes. En producción nunca se exime (detrás del proxy no llega una IP local).
 */
export function isLocalDevIp(ipHash: string): boolean {
  if (isProductionLike()) return false;
  localHashes ??= new Set(LOCAL_IPS.map(hashIp));
  return localHashes.has(ipHash);
}

let warnedUnknown = false;

/** IP, su hash y el navegador de la petición actual (acciones de servidor y rutas). */
export async function requestClient(): Promise<{ ip: string; ipHash: string; ua: string }> {
  const h = await headers();
  const ip = parseClientIp((n) => h.get(n));
  if (ip === "unknown" && isProductionLike() && !warnedUnknown) {
    warnedUnknown = true;
    console.warn("No se pudo determinar la IP del cliente: revisa CLIENT_IP_HEADER.");
  }
  return { ip, ipHash: hashIp(ip), ua: (h.get("user-agent") ?? "").slice(0, 200) };
}
