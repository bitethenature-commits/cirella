import { expect, test, type Page } from "@playwright/test";

/**
 * Límites de intentos (lib/limits.ts): login, enlace mágico, pagos rechazados y horarios.
 * En e2e no hay proxy y Next respeta la X-Forwarded-For que llega, así que cada bloque usa su
 * propia «conexión» y no gasta el cupo de las demás pruebas (que llegan desde localhost, que fuera
 * de producción no cuenta). Las claves de Turnstile no están configuradas: solo límites, sin captcha.
 */

const stamp = Date.now().toString().slice(-6);
const REJECTED = "4000 0000 0000 0002";
const OK_CARD = "4242 4242 4242 4242";

async function acceptConsents(page: Page) {
  await page.getByLabel(/He leído y acepto/).check();
  // La renuncia la piden lo digital, los cursos, las membresías y los talleres a menos de 15 días (no las sesiones).
  const waiver = page.getByLabel(/Quiero acceder ya|Quiero que se prepare ya|Solicito expresamente/);
  if (await waiver.count()) await waiver.check();
}

test.describe.serial("Login con contraseña", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.71" } });

  test("5 contraseñas erróneas y el 6.º intento se corta (con un email sin cuenta)", async ({ page }) => {
    const email = `nadie${stamp}@example.com`;
    // Cada intento en una página recién cargada: el mensaje que se ve es el de ese intento.
    for (let i = 1; i <= 6; i++) {
      await page.goto("/entrar");
      await page.fill("#email", email);
      await page.fill("#password", `incorrecta-${i}`);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      if (i <= 5) await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
    }
    await expect(page.getByText(/Demasiados intentos con este email/)).toBeVisible();
    await expect(page.getByText(/entra con un enlace mágico/)).toBeVisible();
  });
});

test.describe.serial("Enlace mágico", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.72" } });

  test("3 enlaces para el mismo email y el 4.º se corta", async ({ page }) => {
    for (let i = 1; i <= 4; i++) {
      await page.goto("/entrar");
      await page.getByRole("button", { name: "Enlace por email" }).click();
      await page.fill("#ml-email", `enlaces${stamp}@example.com`);
      await page.getByRole("button", { name: "Enviarme el enlace" }).click();
      if (i <= 3) await expect(page.getByText(/Te hemos enviado un enlace/)).toBeVisible();
    }
    await expect(page.getByText(/Ya te hemos enviado varios enlaces/)).toBeVisible();
    await expect(page.getByText(/Te hemos enviado un enlace/)).toHaveCount(0);
  });
});

test.describe.serial("Checkout: pagos rechazados", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.73" } });

  test("5 rechazos con el mismo email y el 6.º intento se bloquea, también con una tarjeta buena", async ({ page }) => {
    const attempt = async (card: string) => {
      await page.goto("/ana/lectura-astrologia/checkout");
      await page.fill("#name", "Prueba Rechazos");
      await page.fill("#email", `rechazos${stamp}@example.com`);
      await page.getByPlaceholder("Número de tarjeta").fill(card);
      await acceptConsents(page);
      await page.getByRole("button", { name: /Pagar/ }).click();
    };
    for (let i = 1; i <= 5; i++) {
      await attempt(REJECTED);
      await expect(page.locator("p[role=alert]")).toContainText(/rechazad/);
      // Sin claves de Turnstile no hay captcha, ni siquiera tras varios rechazos.
      await expect(page.getByText("Comprobación de seguridad de Cloudflare")).toHaveCount(0);
    }
    await attempt(OK_CARD);
    await expect(page.locator("p[role=alert]")).toContainText(/Demasiados/);
    await expect(page).toHaveURL(/\/checkout/);
    expect(await page.locator("#cf-turnstile-script").count()).toBe(0);
  });
});

test.describe.serial("Checkout: otra compradora", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.74" } });

  test("desde otra conexión y con otro email, la compra sale bien", async ({ page }) => {
    await page.goto("/ana/lectura-astrologia/checkout");
    await page.fill("#name", "Prueba Ajena");
    await page.fill("#email", `ajena${stamp}@example.com`);
    await page.getByPlaceholder("Número de tarjeta").fill(OK_CARD);
    await acceptConsents(page);
    await page.getByRole("button", { name: /Pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
  });
});

test.describe.serial("Horarios", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.75" } });

  test("si /api/slots responde 429, el checkout lo dice sin romperse", async ({ page }) => {
    await page.route("**/api/slots**", (route) =>
      route.fulfill({ status: 429, headers: { "Retry-After": "30" }, contentType: "application/json", body: JSON.stringify({ error: "Demasiadas peticiones. Espera un momento." }) }),
    );
    await page.goto("/ana/sesion-1-1/checkout");
    await expect(page.getByText("No hemos podido cargar los horarios. Recarga la página en unos segundos.")).toBeVisible();
    await expect(page.getByText(/No hay huecos disponibles/)).toHaveCount(0);
    // El resto del checkout sigue ahí.
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.getByRole("button", { name: /Reservar y pagar/ })).toBeVisible();
  });

  test("y la ruta real corta con 429 y Retry-After tras 60 peticiones en un minuto", async ({ request }) => {
    const statuses: number[] = [];
    let retryAfter: string | undefined;
    for (let i = 0; i < 61; i++) {
      const res = await request.get("/api/slots?productId=no-existe", { headers: { "x-forwarded-for": "203.0.113.76" } });
      statuses.push(res.status());
      retryAfter ??= res.headers()["retry-after"];
    }
    expect(statuses.slice(0, 60).every((s) => s === 404)).toBe(true);
    expect(statuses[60]).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
