import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { lauraSessionLabel } from "./demo-data";

/**
 * Instagram → página → producto → pago → entrega → clienta recurrente.
 * Recorre el flujo completo como lo haría una creadora nueva y su primera compradora.
 */

const stamp = Date.now().toString().slice(-6);
const username = `luna${stamp}`;
const creatorEmail = `creadora${stamp}@example.com`;
const buyerEmail = `compradora${stamp}@example.com`;

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Casillas obligatorias del checkout: condiciones de venta y renuncia al desistimiento. */
async function acceptConsents(page: Page) {
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByLabel(/Quiero acceder ya|Solicito que la sesión/).check();
}

test.describe.serial("Flujo principal", () => {
  test("1. Landing → registro → onboarding de 10 pasos → «Tu página está lista»", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("negocio completo");
    await page.getByRole("link", { name: "Crear mi página" }).first().click();
    await page.waitForURL("**/registro**");

    await page.fill("#email", creatorEmail);
    await page.fill("#password", "secreto123");
    await expect(page.getByText("Paso 1 de 10")).toBeVisible();
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**/onboarding");
    await expect(page.getByText("2/10", { exact: true })).toBeVisible();

    const next = page.getByRole("button", { name: /Continuar|Lo haré más tarde/ });
    // 2. Usuario
    await page.getByPlaceholder("tunombre").fill(username);
    await expect(page.getByText("✓ Disponible")).toBeVisible();
    // Sin aceptar los Términos del servicio no se puede seguir.
    await expect(next).toBeDisabled();
    await page.getByLabel(/Acepto los Términos del servicio/).check();
    await next.click();
    // 3. Foto (se puede omitir)
    await expect(page.getByText("Sube tu foto")).toBeVisible();
    await next.click();
    // 4. Nombre y descripción
    await page.getByPlaceholder("Ana Luna").fill("Luna Prueba");
    await page.getByPlaceholder("Astrología · Human Design · Gene Keys").fill("Tarot · Astrología");
    await next.click();
    // 5. Categoría
    await page.getByRole("button", { name: /Tarot y oráculos/ }).click();
    await next.click();
    // 6. Estilo visual
    await expect(page.getByText("Elige tu estilo")).toBeVisible();
    await page.getByRole("button", { name: /Editorial/ }).click();
    await next.click();
    // 7. Tu primer producto: nombre, descripción y precio en el mismo paso (sin precio no se sigue)
    await expect(page.getByRole("heading", { name: "Tu primer producto" })).toBeVisible();
    await expect(page.getByText("7/10", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Lectura de Astrología").fill("Tirada de tarot en PDF");
    await page.getByPlaceholder("Qué recibe tu clienta").fill("Tres cartas y su interpretación.");
    await expect(next).toBeDisabled();
    await page.getByPlaceholder("49").fill("29");
    await expect(page.getByText(/Recibirás/)).toBeVisible();
    await expect(page.getByText(/IVA incluido/).first()).toBeVisible();
    await next.click();
    // 8. Cómo se entrega: sin nada que entregar no se puede seguir (salvo «Lo añado más tarde»)
    await expect(page.getByRole("heading", { name: "¿Cómo lo entregas?" })).toBeVisible();
    await expect(next).toBeDisabled();
    await page.getByRole("button", { name: /Poner un enlace/ }).click();
    await page.getByLabel("Nombre").fill("Tirada en PDF");
    await page.getByLabel("Enlace").fill("https://example.com/tirada.pdf");
    await page.getByRole("button", { name: "Añadir enlace" }).click();
    await expect(page.getByText("Tirada en PDF")).toBeVisible();
    await next.click();
    // 9. Datos legales de quien vende (obligatorios) y cuenta de cobro: formulario de Stripe
    // (simulado) y vuelta al onboarding, ya en el paso 10
    await page.getByRole("button", { name: "Conectar con Stripe" }).click();
    await expect(page.getByText("Completa tus datos legales para activar los cobros")).toBeVisible();
    await page.getByLabel("Nombre y apellidos").fill("Luna Prueba García");
    await page.getByLabel("NIF / NIE / CIF").fill("12345678A");
    await page.getByLabel("Dirección").fill("Calle Mayor 1, 3.º A");
    await page.getByLabel("Código postal").fill("28001");
    await page.getByLabel("Ciudad").fill("Madrid");
    await page.getByRole("button", { name: "Conectar con Stripe" }).click();
    await expect(page.getByText("Revisa el NIF: la letra no coincide")).toBeVisible();
    await page.getByLabel("NIF / NIE / CIF").fill("12345678Z");
    await page.getByRole("button", { name: "Conectar con Stripe" }).click();
    await page.waitForURL("**/pago-simulado/cuenta**");
    await page.getByRole("button", { name: "Verificar al instante" }).click();
    await page.waitForURL("**/onboarding");
    await expect(page.getByText("Pagos activados")).toBeVisible();
    await expect(page.getByText("1 enlace")).toBeVisible();
    await expect(page.getByText("10/10", { exact: true })).toBeVisible();
    // 10. Publicar
    await page.getByRole("button", { name: "Publicar mi página" }).click();
    await page.waitForURL("**/onboarding/lista");
    await expect(page.getByRole("heading", { name: "Tu página está lista" })).toBeVisible();
    await expect(page.getByText(`/${username}`)).toBeVisible();
    for (const b of ["Copiar enlace", "Instagram", "WhatsApp", "Telegram", "Ver página"]) await expect(page.getByText(b, { exact: true }).first()).toBeVisible();
  });

  test("2. Compradora sin cuenta: página → producto → checkout → compra completada → su cuenta", async ({ page }) => {
    await page.goto(`/${username}`);
    await expect(page.getByRole("heading", { name: "Luna Prueba" })).toBeVisible();
    await page.getByRole("link", { name: /Comprar: Tirada de tarot/ }).click();
    await page.waitForURL(`**/${username}/**/checkout`);
    await page.fill("#name", "Paula Compradora");
    await page.fill("#email", buyerEmail);
    await acceptConsents(page);
    await page.getByRole("button", { name: /Pagar 29/ }).click();
    await page.waitForURL(`**/${username}/gracias**`);
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
    await expect(page.getByText("Tu contenido está disponible en tu cuenta.")).toBeVisible();
    // Cuenta creada automáticamente tras la compra: la sesión solo abre ESTA compra.
    await page.getByRole("link", { name: /Acceder a mi contenido/ }).click();
    await page.waitForURL("**/cuenta/pedidos/**");
    await expect(page.getByRole("heading", { name: "Tirada de tarot en PDF" })).toBeVisible();
    await expect(page.getByText("Estás viendo solo esta compra.")).toBeVisible();
    // Para ver todas sus compras tiene que demostrar que el email es suyo.
    await page.goto("/cuenta/compras");
    await expect(page).toHaveURL(/\/entrar/);
    await expect(page.getByText("Para ver todas tus compras")).toBeVisible();
  });

  test("3. La venta aparece en el panel de la creadora", async ({ page }) => {
    await page.goto("/entrar");
    await page.fill("#email", creatorEmail);
    await page.fill("#password", "secreto123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/panel");
    await page.goto("/panel/ventas");
    await expect(page.getByText("Tirada de tarot en PDF").first()).toBeVisible();
    await page.goto("/panel/clientes");
    await expect(page.getByText("Paula Compradora")).toBeVisible();
  });

  test("4. Demo: la clienta de Ana ve su curso (43 %), su sesión y su PDF", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await expect(page.getByRole("heading", { name: "Hola, Laura" })).toBeVisible();
    await expect(page.getByText("Progreso 43%")).toBeVisible();
    await expect(page.getByText(await lauraSessionLabel())).toBeVisible();
    const download = page.getByRole("link", { name: "Descargar" }).first();
    await expect(download).toBeVisible();
    const res = await page.request.get((await download.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
  });

  test("5. Multi-tenant: Ana no puede abrir productos ni archivos de María; Laura tampoco", async ({ page }) => {
    const prisma = new PrismaClient();
    const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
    const product = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } });
    const file = await prisma.productFile.findFirstOrThrow({ where: { creatorId: maria.id } });
    const customer = await prisma.customer.findFirstOrThrow({ where: { creatorId: maria.id } });
    await prisma.$disconnect();

    await demoLogin(page, "Ana Luna");
    await expect(page).toHaveURL(/\/panel/);
    expect((await page.request.get(`/panel/productos/${product.id}`)).status()).toBe(404);
    expect((await page.request.get(`/panel/clientes/${customer.id}`)).status()).toBe(404);
    expect((await page.request.get(`/api/download/${file.id}`)).status()).toBe(403);

    await page.context().clearCookies();
    await demoLogin(page, "Laura Martín");
    expect((await page.request.get(`/api/download/${file.id}`)).status()).toBe(403);
  });

  test("6. Seguridad: registrarse con el email de una compradora no da acceso a su cuenta", async ({ page }) => {
    // Carmen compró como invitada: su cuenta no tiene contraseña.
    await page.goto("/registro");
    await page.fill("#email", "carmen@example.com");
    await page.fill("#password", "intrusa1234");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByText(/Ya tienes una cuenta con este email/)).toBeVisible();
    await expect(page).toHaveURL(/\/registro/);
    await page.goto("/cuenta");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("7. Panel móvil: el menú «Más» abre sin errores", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    const res = await page.goto("/panel/mas");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Más" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Automatizaciones/ })).toBeVisible();
  });

  test("8. Membresías: no se puede pagar dos veces la misma suscripción", async ({ page }) => {
    // Lucía ya es miembro del Círculo de Ana.
    await page.goto("/ana/comunidad-privada/checkout");
    await page.fill("#name", "Lucía Torres");
    await page.fill("#email", "lucia@example.com");
    await acceptConsents(page);
    await page.getByRole("button", { name: /Unirme/ }).click();
    await expect(page.getByText(/Ya eres miembro/)).toBeVisible();
  });

  test("9. Checkout: tras un pago rechazado se conservan los datos y se reserva la hora elegida al reintentar", async ({ page }) => {
    await page.goto("/ana/sesion-1-1/checkout");
    const days = page.locator("section button.w-\\[3\\.9rem\\]");
    await expect(days.first()).toBeVisible();
    await days.nth(1).click();
    await page.locator("section .grid.grid-cols-3 button").first().click();
    await page.fill("#name", "Rocío Reintento");
    await page.fill("#email", `rocio${stamp}@example.com`);
    await page.fill("input[name=cardNumber]", "4000 0000 0000 0002");
    await acceptConsents(page);
    await page.getByRole("button", { name: /Reservar y pagar/ }).click();
    await expect(page.getByText(/rechazado/)).toBeVisible();
    await expect(page.locator("#name")).toHaveValue("Rocío Reintento");
    await expect(page.getByLabel(/He leído y acepto/)).toBeChecked();
    // Cambia de día antes de reintentar: la reserva debe quedar en el día nuevo.
    await days.nth(2).click();
    const dayNumber = (await days.nth(2).locator("span").nth(1).textContent())!.trim();
    await page.locator("section .grid.grid-cols-3 button").first().click();
    await page.fill("input[name=cardNumber]", "4242 4242 4242 4242");
    await page.getByRole("button", { name: /Reservar y pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByText(new RegExp(`, ${dayNumber} de `))).toBeVisible();
  });
});
