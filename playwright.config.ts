import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Segundo servidor, mismo build, en modo personal (la web de Ana): lo usa e2e/personal.spec.ts. */
const PERSONAL_PORT = Number(process.env.E2E_PERSONAL_PORT ?? 3101);
/** Tercero: la web personal de Ana que cobra con tarjeta (simulador) y PayPal (falso): e2e/personal-cobros.spec.ts. */
const SALES_PORT = Number(process.env.E2E_SALES_PORT ?? 3102);
/** PayPal falso (scripts/paypal-mock.ts) para el tercer servidor. */
const PAYPAL_PORT = Number(process.env.E2E_PAYPAL_PORT ?? 4010);

// `next start` valida la configuración al arrancar (instrumentation.ts): entorno de pruebas con
// demo, emails en el buzón y archivos en disco.
const testEnv = {
  APP_ENV: "test",
  DEMO_MODE: "true",
  EMAIL_PROVIDER: "log",
  STORAGE_DRIVER: "local",
};

/**
 * Prueba de extremo a extremo del flujo principal.
 *   npm run build && npm run test:e2e
 * Usa una BD de demo recién sembrada (npm run db:reset) y arranca tres `next start` sobre el mismo
 * build: la plataforma (puerto 3100, la de todas las pruebas), el modo personal sin cobros (3101) y
 * el modo personal que cobra con tarjeta y PayPal (3102, con un PayPal falso en el 4010).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["iPhone 13"],
    browserName: "chromium",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { ...testEnv, APP_URL: `http://localhost:${PORT}`, SITE_MODE: "platform", PAYMENT_PROVIDER: "simulated" },
    },
    {
      // Modo personal: la web de una sola dueña (Ana, de la demo), sin cobros en la web.
      command: `npx next start -p ${PERSONAL_PORT}`,
      url: `http://localhost:${PERSONAL_PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { ...testEnv, APP_URL: `http://localhost:${PERSONAL_PORT}`, SITE_MODE: "personal", OWNER_USERNAME: "ana", PAYMENT_PROVIDER: "none" },
    },
    {
      command: `npx tsx scripts/paypal-mock.ts ${PAYPAL_PORT}`,
      url: `http://localhost:${PAYPAL_PORT}/health`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Modo personal que cobra en la web: tarjeta (simulador) y PayPal (el falso de arriba).
      command: `npx next start -p ${SALES_PORT}`,
      url: `http://localhost:${SALES_PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...testEnv,
        APP_URL: `http://localhost:${SALES_PORT}`,
        SITE_MODE: "personal",
        OWNER_USERNAME: "ana",
        PAYMENT_PROVIDER: "simulated,paypal",
        PAYPAL_CLIENT_ID: "cliente-prueba",
        PAYPAL_CLIENT_SECRET: "secreto-prueba",
        PAYPAL_WEBHOOK_ID: "WH-PRUEBA",
        PAYPAL_ENV: "sandbox",
        PAYPAL_API_URL: `http://localhost:${PAYPAL_PORT}`,
      },
    },
  ],
});
