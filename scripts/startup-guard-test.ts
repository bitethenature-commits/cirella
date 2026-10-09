/**
 * La web no arranca con una configuración de producción insegura.
 *   npm run build && npm run test:startup
 *
 * Lanza `next start` con configuraciones de producción incorrectas y comprueba que el proceso
 * termina con error (instrumentation.ts → assertEnv) y explica por qué. Hay que repetirla en
 * cada actualización de Next: depende de que un error en register() aborte el arranque.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 3199;
const TIMEOUT_MS = 30_000;

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? `\n    ${detail.trim().split("\n").slice(-8).join("\n    ")}` : ""}`);
  if (!ok) failures++;
}

/**
 * Arranca `next start` y espera a que termine (o, con `readyText`, a que lo escriba y entonces lo para). Next no pisa las variables que ya existen al cargar
 * .env, así que una variable vacía ("") equivale a no definirla aunque .env la tenga.
 */
function start(extraEnv: Record<string, string>, readyText?: string): Promise<{ code: number | null; output: string; timedOut: boolean; ready: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(path.join(process.cwd(), "node_modules", ".bin", "next"), ["start", "-p", String(PORT)], {
      env: { ...process.env, NODE_ENV: "production", ...extraEnv },
    });
    let output = "";
    const onData = (d: Buffer) => {
      output += d;
      if (readyText && output.includes(readyText)) {
        clearTimeout(timer);
        child.kill("SIGKILL");
        resolve({ code: null, output, timedOut: false, ready: true });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: null, output, timedOut: true, ready: false });
    }, TIMEOUT_MS);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut: false, ready: false });
    });
  });
}

async function main() {
  const demo = await start({ APP_ENV: "production", APP_URL: "https://cirella.app", DEMO_MODE: "true", PAYMENT_PROVIDER: "simulated" });
  check("producción con modo demo y pagos simulados: no arranca", !demo.timedOut && demo.code !== 0, demo.timedOut ? "siguió arrancado 30 s" : demo.output);
  check("explica que DEMO_MODE=true está prohibido", demo.output.includes("DEMO_MODE=true está prohibido"), demo.output);
  check("explica que PAYMENT_PROVIDER=simulated está prohibido", demo.output.includes("PAYMENT_PROVIDER=simulated está prohibido"), demo.output);

  const noUrl = await start({ APP_ENV: "", APP_URL: "" });
  check("NODE_ENV=production sin APP_ENV ni APP_URL: no arranca", !noUrl.timedOut && noUrl.code !== 0, noUrl.timedOut ? "siguió arrancado 30 s" : noUrl.output);
  check("explica que falta APP_URL", noUrl.output.includes("Falta APP_URL"), noUrl.output);
  check("valida como production", noUrl.output.includes("APP_ENV=production"), noUrl.output);

  // Control: con una configuración de producción completa sí arranca (las claves son de mentira:
  // solo se valida su formato, no se conecta a ningún servicio).
  const secret = "0123456789abcdef".repeat(4);
  const valid = await start(
    {
      APP_ENV: "production", APP_URL: "https://cirella.app", DEMO_MODE: "false", PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_live_prueba", STRIPE_PUBLISHABLE_KEY: "pk_live_prueba", STRIPE_WEBHOOK_SECRET: "whsec_prueba", STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect",
      CRON_SECRET: secret, APP_SECRET: secret, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_prueba", EMAIL_FROM: "Cirella <hola@cirella.app>",
      STORAGE_DRIVER: "s3", S3_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com", S3_BUCKET: "cirella", S3_ACCESS_KEY_ID: "id", S3_SECRET_ACCESS_KEY: "secreto",
    },
    "[cirella] Entorno production",
  );
  check("con una configuración de producción completa sí arranca", valid.ready, valid.output);

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nLa web no arranca con una configuración de producción insegura ✓");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
