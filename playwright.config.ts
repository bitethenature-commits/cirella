import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Segundo servidor, mismo build, en modo personal (la web de Ana): lo usa e2e/personal.spec.ts. */
const PERSONAL_PORT = Number(process.env.E2E_PERSONAL_PORT ?? 3101);

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
 * Usa una BD de demo recién sembrada (npm run db:reset) y arranca dos `next start` sobre el mismo
 * build: la plataforma (puerto 3100, la de todas las pruebas) y el modo personal (3101).
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
  ],
});
