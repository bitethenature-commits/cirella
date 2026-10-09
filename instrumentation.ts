/**
 * Se ejecuta una vez al arrancar el servidor (`next start` / `next dev`; no durante `next build`).
 * Si la configuración no es válida, el proceso termina (exit 1) mostrando todos los problemas:
 * así la web real nunca arranca en modo demo ni con pagos simulados.
 * Lo comprueba `npm run test:startup` (repetirlo en cada actualización de Next).
 */
import type { Env } from "./lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("./lib/env");
  let e: Env;
  try {
    e = assertEnv();
  } catch (err) {
    // Next 15 solo registra un error de register() y sigue sirviendo peticiones: hay que salir a mano.
    console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
  console.info(`[cirella] Entorno ${e.APP_ENV} · pagos: ${e.PAYMENT_PROVIDER} · email: ${e.EMAIL_PROVIDER} · archivos: ${e.STORAGE_DRIVER}`);
  if (e.DEMO_MODE === "true") console.warn("[cirella] Modo demo activo: pagos simulados, buzón /dev/correo y accesos rápidos.");
}
