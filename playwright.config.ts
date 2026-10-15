import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Prueba de extremo a extremo del flujo principal.
 *   npm run build && npm run test:e2e
 * Usa una BD de demo recién sembrada (npm run db:reset) y arranca `next start`.
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
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    // `next start` valida la configuración al arrancar (instrumentation.ts): entorno de pruebas con
    // demo, pagos simulados, emails en el buzón y archivos en disco.
    env: {
      APP_ENV: "test",
      APP_URL: `http://localhost:${PORT}`,
      DEMO_MODE: "true",
      PAYMENT_PROVIDER: "simulated",
      EMAIL_PROVIDER: "log",
      STORAGE_DRIVER: "local",
    },
  },
});
