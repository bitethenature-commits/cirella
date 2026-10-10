import { expect, test, type Page } from "@playwright/test";

/**
 * No publicar productos que no tienen nada que entregar (lib/delivery.ts).
 *   · Paso 9 del onboarding «¿Cómo lo entregas?»: subir el archivo, poner un enlace, «Lo preparo yo
 *     para cada clienta» o «Lo añado más tarde» (borrador, fuera de la página y con aviso).
 *   · El editor del panel no publica un producto sin entrega ni deja borrar lo último que entrega.
 *   · La ficha, el checkout y la página de gracias prometen lo que de verdad se entrega.
 */

let seq = 0;
function uniqueUser() {
  const stamp = `${Date.now().toString().slice(-6)}${seq++}`;
  return { username: `entrega${stamp}`, email: `entrega${stamp}@example.com` };
}

const TITLE = "Tirada de 3 cartas";
const SLUG = "tirada-de-3-cartas";
const INSTRUCTIONS = "Te envío la interpretación en PDF por email en 3 días";

/**
 * Alta de una creadora con un producto digital de 19 € hasta el resumen final (paso 11), con los
 * cobros conectados. En el paso 9 ejecuta `delivery`.
 */
async function onboard(page: Page, username: string, email: string, delivery: (page: Page) => Promise<void>) {
  await page.goto("/registro");
  await page.fill("#email", email);
  await page.fill("#password", "secreto123");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.waitForURL("**/onboarding");

  const next = page.getByRole("button", { name: /Continuar|Lo haré más tarde/ });
  await page.getByPlaceholder("tunombre").fill(username);
  await expect(page.getByText("✓ Disponible")).toBeVisible();
  await page.getByLabel(/Acepto los Términos del servicio/).check();
  await next.click();
  await expect(page.getByText("Sube tu foto")).toBeVisible();
  await next.click();
  await page.getByPlaceholder("Ana Luna").fill("Vera Tarot");
  await next.click();
  await page.getByRole("button", { name: /Tarot y oráculos/ }).click();
  await next.click();
  await expect(page.getByText("Elige tu estilo")).toBeVisible();
  await next.click();
  await page.getByPlaceholder("Lectura de Astrología").fill(TITLE);
  await page.getByPlaceholder("Qué recibe tu clienta").fill("Pasado, presente y futuro con su interpretación.");
  await next.click();
  await page.getByPlaceholder("49").fill("19");
  await next.click();

  // 9. ¿Cómo lo entregas?
  await expect(page.getByRole("heading", { name: "¿Cómo lo entregas?" })).toBeVisible();
  await expect(next).toBeDisabled();
  await delivery(page);
  await next.click();

  // 10. Datos legales y cuenta de cobro (simulada); la vuelta de Stripe deja el asistente en el paso 11.
  await page.getByLabel("Nombre y apellidos").fill("Vera Tarot Gómez");
  await page.getByLabel("NIF / NIE / CIF").fill("12345678Z");
  await page.getByLabel("Dirección").fill("Calle Luna 3");
  await page.getByLabel("Código postal").fill("28004");
  await page.getByLabel("Ciudad").fill("Madrid");
  await page.getByRole("button", { name: "Conectar con Stripe" }).click();
  await page.waitForURL("**/pago-simulado/cuenta**");
  await page.getByRole("button", { name: "Verificar al instante" }).click();
  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: /Todo listo/ })).toBeVisible();
}

async function publish(page: Page) {
  await page.getByRole("button", { name: "Publicar mi página" }).click();
  await page.waitForURL("**/onboarding/lista");
  await expect(page.getByRole("heading", { name: "Tu página está lista" })).toBeVisible();
}

test.describe("Entrega de productos", () => {
  test("«Lo añado más tarde»: borrador fuera de la página, avisos y el editor no lo publica vacío", async ({ page }) => {
    const { username, email } = uniqueUser();
    await onboard(page, username, email, async (p) => {
      await p.getByRole("button", { name: "Lo añado más tarde" }).click();
      await expect(p.getByText("Lo guardaremos como borrador")).toBeVisible();
    });
    await expect(page.getByText("Entrega pendiente")).toBeVisible();
    await expect(page.getByText(`«${TITLE}» se guardará como borrador`)).toBeVisible();
    await publish(page);

    // «Tu página está lista» no promete ventas y dice qué falta.
    await expect(page.getByText("ya pueden comprarte")).toHaveCount(0);
    await expect(page.getByText(`«${TITLE}» no tiene nada que entregar`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Añadir lo que entregas" })).toBeVisible();

    // La página pública no lo enseña y su ficha no existe.
    await page.goto(`/${username}`);
    await expect(page.getByRole("heading", { name: "Vera Tarot" })).toBeVisible();
    await expect(page.getByText(TITLE)).toHaveCount(0);
    expect((await page.request.get(`/${username}/${SLUG}`)).status()).toBe(404);

    // Panel: aviso en Inicio y «Sin entrega» en la lista.
    await page.goto("/panel");
    await expect(page.getByText(`«${TITLE}» no tiene nada que entregar`)).toBeVisible();
    await page.goto("/panel/productos");
    await expect(page.getByText("Sin entrega")).toBeVisible();
    await page.getByRole("link", { name: new RegExp(TITLE) }).first().click();
    await page.waitForURL("**/panel/productos/**");

    // Publicar sin nada que entregar → error, nada se guarda.
    const status = page.locator('select[name="status"]');
    const save = page.getByRole("button", { name: "Guardar", exact: true });
    await status.selectOption("PUBLISHED");
    await save.click();
    await expect(page.getByText(/No se puede publicar todavía/)).toBeVisible();

    // Con un enlace sí.
    await page.getByPlaceholder(/Nombre del enlace/).fill("Tirada en PDF");
    // Enviar con Intro: en el iPhone emulado el botón queda pegado al final de la página, bajo la barra inferior.
    await page.getByPlaceholder("https://…").fill("https://example.com/x.pdf");
    await page.getByPlaceholder("https://…").press("Enter");
    const linkRow = page.locator("li", { hasText: "Tirada en PDF" });
    await expect(linkRow).toBeVisible();
    await status.selectOption("PUBLISHED");
    await save.click();
    await expect(page.getByText("Guardado y publicado en tu página")).toBeVisible();

    // Borrar lo único que entrega un producto publicado → no se borra.
    await page.reload();
    await linkRow.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText(/Es lo último que entregas/)).toBeVisible();
    await expect(linkRow).toBeVisible();

    // La ficha cuenta los enlaces como enlaces.
    await page.goto(`/${username}/${SLUG}`);
    await expect(page.getByText("1 enlace", { exact: true })).toBeVisible();
    await expect(page.getByText("Contenido archivos descargables")).toHaveCount(0);
  });

  test("«Subir el archivo ahora» en el onboarding: publicado y a la venta", async ({ page }) => {
    const { username, email } = uniqueUser();
    await onboard(page, username, email, async (p) => {
      await p.getByRole("button", { name: /Subir el archivo ahora/ }).click();
      await p
        .locator('input[type=file][accept^=".pdf"]')
        .setInputFiles({ name: "tirada.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
      await expect(p.getByText("tirada.pdf")).toBeVisible();
    });
    await expect(page.getByText("1 archivo descargable")).toBeVisible();
    await publish(page);
    await expect(page.getByText("Tus seguidoras ya pueden comprarte")).toBeVisible();

    await page.goto(`/${username}/${SLUG}`);
    await expect(page.getByText("1 archivo descargable", { exact: true })).toBeVisible();
    await expect(page.getByText("Acceso inmediato tras el pago")).toBeVisible();
  });

  test("«Lo preparo yo para cada clienta»: la ficha, el checkout y la compra lo dicen", async ({ page }) => {
    const { username, email } = uniqueUser();
    await onboard(page, username, email, async (p) => {
      await p.getByRole("button", { name: /Lo preparo yo para cada clienta/ }).click();
      await p.getByLabel("¿Qué recibirá y cuándo?").fill(INSTRUCTIONS);
    });
    await expect(page.getByText("Entrega: lo preparas tú")).toBeVisible();
    await publish(page);
    await expect(page.getByText("Tus seguidoras ya pueden comprarte")).toBeVisible();

    // Otra visitante (sin la sesión de la creadora).
    const buyer = await page.context().browser()!.newPage();
    await buyer.goto(`/${username}/${SLUG}`);
    await expect(buyer.getByText("Preparado personalmente para ti")).toBeVisible();
    await expect(buyer.getByRole("heading", { name: "Cómo lo recibes" })).toBeVisible();
    await expect(buyer.getByText(INSTRUCTIONS)).toBeVisible();
    await expect(buyer.getByText("Acceso inmediato tras el pago")).toHaveCount(0);

    await buyer.goto(`/${username}/${SLUG}/checkout`);
    await expect(buyer.getByText("Preparado para ti", { exact: true })).toBeVisible();
    await expect(buyer.getByText("Acceso inmediato", { exact: true })).toHaveCount(0);
    await buyer.fill("#name", "Irene Compradora");
    await buyer.fill("#email", `irene-${username}@example.com`);
    await buyer.getByLabel(/He leído y acepto/).check();
    await buyer.getByLabel(/Quiero acceder ya/).check();
    await buyer.getByRole("button", { name: /Pagar 19/ }).click();
    await buyer.waitForURL(`**/${username}/gracias**`);
    await expect(buyer.getByRole("heading", { name: "Compra completada" })).toBeVisible();
    await expect(buyer.getByText(/lo prepara personalmente para ti/)).toBeVisible();
    await expect(buyer.getByText("Siguientes pasos")).toBeVisible();
    await expect(buyer.getByText(INSTRUCTIONS)).toBeVisible();
    await buyer.close();
  });
});
