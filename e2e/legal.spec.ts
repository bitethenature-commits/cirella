import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Cumplimiento legal de la venta online:
 *   · checkout: quién vende, primera capa de privacidad, casillas sin marcar y obligatorias,
 *     política de cambios de las sesiones;
 *   · recibo con la identidad de la vendedora, la renuncia marcada y la versión aceptada;
 *   · pie con los enlaces legales, página legal de la creadora y páginas legales de la plataforma;
 *   · métricas sin cookies ni almacenamiento en el navegador;
 *   · datos legales y textos editables en el panel;
 *   · novedades por email: la creadora lo ve y la compradora lo retira desde su cuenta.
 * Cada prueba deja los datos de demostración como estaban.
 */

const prisma = new PrismaClient();
const stamp = Date.now().toString().slice(-6);
const buyerName = "Nora Novedades";
const buyerEmail = `nora${stamp}@example.com`;

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test.describe.serial("Cumplimiento legal", () => {
  test("checkout: quién vende, privacidad y casillas obligatorias sin marcar", async ({ page }) => {
    await page.goto("/ana/gene-keys/checkout");
    await expect(page.getByText("Vende: Cirella Demo S.L. · NIF B12345674, por cuenta de Ana Luna Pérez")).toBeVisible();
    await expect(page.getByRole("link", { name: "Condiciones", exact: true }).first()).toHaveAttribute("href", "/ana/legal#condiciones");
    await expect(page.getByText(/Responsable: Ana Luna Pérez/)).toBeVisible();

    const terms = page.getByLabel(/He leído y acepto/);
    await expect(terms).not.toBeChecked();
    await page.fill("#name", buyerName);
    await page.fill("#email", buyerEmail);
    const pay = page.getByRole("button", { name: /Pagar/ });
    await pay.click();
    await expect(page.getByText("Acepta las condiciones de venta para continuar")).toBeVisible();
    await terms.check();
    await pay.click();
    await expect(page.getByText("Para acceder ahora necesitamos tu consentimiento de acceso inmediato")).toBeVisible();

    await page.getByLabel(/Quiero acceder ya al contenido/).check();
    await page.getByLabel(/Quiero recibir novedades/).check();
    await pay.click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();

    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail } });
    expect(order.termsAcceptedAt).not.toBeNull();
    expect(order.waiverKind).toBe("DIGITAL_IMMEDIATE");
    expect(order.marketingOptIn).toBe(true);
    expect(order.legalSnapshotId).not.toBeNull();
  });

  test("el recibo dice quién vende, qué marcó y enlaza a la versión aceptada", async ({ page }) => {
    const m = await prisma.emailMessage.findFirstOrThrow({ where: { to: buyerEmail, template: "PURCHASE_RECEIPT" }, orderBy: { createdAt: "desc" } });
    // Gene Keys lo vende Cirella a efectos de IVA (PLATFORM_DIGITAL), por cuenta de Ana, como en el checkout.
    for (const text of ["por cuenta de Ana Luna Pérez", "B12345674", "Quiero acceder ya al contenido", "CONDICIONES DE VENTA"]) expect(m.html).toContain(text);
    const href = m.html.match(/href="([^"]*\/ana\/legal\?v=[^"]+)"/)?.[1];
    expect(href).toBeTruthy();
    await page.goto(href!.replace(/&amp;/g, "&"));
    await expect(page.getByText("Versión aceptada en tu compra")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Condiciones de venta" })).toBeVisible();
    // Una versión que no es de esta creadora no existe.
    expect((await page.request.get("/ana/legal?v=no-existe")).status()).toBe(404);
  });

  test("sesiones: la política de cambios está junto al total y en la ficha", async ({ page }) => {
    await page.goto("/ana/sesion-1-1");
    await expect(page.getByText("Vende: Ana Luna Pérez", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Cambios gratis hasta 24 h antes de la sesión")).toBeVisible();
    await page.goto("/ana/sesion-1-1/checkout");
    await expect(page.getByText(/Cambios gratis hasta 24 h antes/)).toBeVisible();
    await expect(page.getByLabel(/Solicito que la sesión pueda realizarse/)).not.toBeChecked();
  });

  test("pie legal en la página de la creadora y página legal completa", async ({ page }) => {
    await page.goto("/ana");
    const footer = page.getByRole("navigation", { name: "Información legal" });
    for (const name of ["Aviso legal", "Condiciones", "Privacidad", "Cookies"]) await expect(footer.getByRole("link", { name })).toBeVisible();
    await footer.getByRole("link", { name: "Aviso legal" }).click();
    await page.waitForURL("**/ana/legal#aviso");
    for (const name of ["Aviso legal", "Condiciones de venta", "Cambios y reembolsos", "Privacidad", "Cookies"])
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Formulario de desistimiento" })).toBeVisible();
    await expect(page.getByText("12345678Z").first()).toBeVisible();
    await expect(page.getByText(/Responsable/).first()).toBeVisible();
  });

  test("páginas legales de la plataforma, pie de la portada y registro", async ({ page }) => {
    for (const [path, h1] of [["/terminos", "Términos del servicio para creadoras"], ["/privacidad", "Política de privacidad"], ["/aviso-legal", "Aviso legal"]]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
    }
    await page.goto("/terminos#encargo");
    await expect(page.locator("#encargo")).toHaveText("Encargo de tratamiento (art. 28 RGPD)");
    await page.goto("/aviso-legal");
    await expect(page.getByText("Cirella Demo S.L.")).toBeVisible();

    await page.goto("/");
    const footer = page.locator("footer").last();
    for (const name of ["Términos", "Privacidad", "Aviso legal"]) await expect(footer.getByRole("link", { name })).toBeVisible();
    await page.goto("/registro");
    await expect(page.getByRole("link", { name: "Términos del servicio" })).toHaveAttribute("href", "/terminos");
    await expect(page.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/privacidad");
  });

  test("las visitas se miden sin cookies ni nada guardado en el navegador", async ({ browser }) => {
    const context = await browser.newContext();
    // Una cookie de visitante de versiones anteriores se borra en la primera visita.
    await context.addCookies([{ name: "cv_id", value: "00000000-0000-0000-0000-000000000000", domain: "localhost", path: "/" }]);
    const page = await context.newPage();
    const tracked = page.waitForResponse((r) => r.url().endsWith("/api/track") && r.request().method() === "POST");
    await page.goto("/ana");
    expect((await tracked).status()).toBe(204);
    expect((await context.cookies()).map((c) => c.name)).not.toContain("cv_id");
    expect(await page.evaluate(() => sessionStorage.length + localStorage.length)).toBe(0);
    await context.close();
  });

  test("panel: datos legales con NIF validado y textos editables con «Restaurar plantilla»", async ({ page }) => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    try {
      await demoLogin(page, "Ana Luna");
      await page.goto("/panel/ajustes/legal");
      await expect(page.getByRole("heading", { name: "Datos legales" })).toBeVisible();
      await expect(page.getByText("Completos", { exact: true })).toBeVisible();
      await page.getByLabel("NIF / NIE / CIF").fill("12345678A");
      await page.getByRole("button", { name: "Guardar datos legales" }).click();
      await expect(page.getByText(/la letra no coincide/)).toBeVisible();
      await page.getByLabel("NIF / NIE / CIF").fill("12345678Z");
      await page.getByRole("button", { name: "Guardar datos legales" }).click();
      await expect(page.getByText("Datos legales guardados")).toBeVisible();

      await page.locator("summary", { hasText: "Condiciones de venta" }).click();
      const terms = page.getByLabel("Condiciones de venta", { exact: true });
      await terms.fill(`${await terms.inputValue()}\n\n## 9. Cláusula de prueba\nTexto de prueba ${stamp}.`);
      await page.getByRole("button", { name: "Guardar textos" }).first().click();
      await expect(page.getByText("Textos guardados")).toBeVisible();
      await page.goto("/ana/legal");
      await expect(page.getByText("9. Cláusula de prueba")).toBeVisible();

      await page.goto("/panel/ajustes/legal");
      await page.locator("summary", { hasText: "Condiciones de venta" }).click();
      await page.getByRole("button", { name: "Restaurar plantilla" }).click();
      await expect(page.getByText("Plantilla restaurada")).toBeVisible();
      await page.goto("/ana/legal");
      await expect(page.getByText("9. Cláusula de prueba")).toHaveCount(0);
    } finally {
      await prisma.creator.update({ where: { id: ana.id }, data: { legalTaxId: ana.legalTaxId, legalTerms: ana.legalTerms } });
    }
  });

  test("novedades por email: la creadora lo ve y la compradora lo retira desde su cuenta", async ({ page, browser }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/clientes");
    const row = page.getByRole("link", { name: new RegExp(buyerName) });
    await expect(row.getByText("Novedades ✓")).toBeVisible();

    // La compradora entra con un enlace por email (su cuenta no tiene contraseña).
    const buyer = await (await browser.newContext()).newPage();
    const since = new Date();
    await buyer.goto("/entrar");
    await buyer.getByRole("button", { name: "Enlace por email" }).click();
    await buyer.fill("#ml-email", buyerEmail);
    await buyer.getByRole("button", { name: "Enviarme el enlace" }).click();
    await expect(buyer.getByText(/Te hemos enviado un enlace/)).toBeVisible();
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { to: buyerEmail, template: "MAGIC_LINK", createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
    const url = mail.html.match(/<a href="([^"]+)"[^>]*>Entrar a mi cuenta<\/a>/)![1].replace(/&amp;/g, "&");
    await buyer.goto(url);
    await buyer.getByRole("button", { name: "Entrar", exact: true }).click();
    await buyer.waitForURL("**/cuenta");

    await buyer.goto("/cuenta/perfil");
    const card = buyer.getByRole("region", { name: "Novedades por email" });
    await expect(card.getByText("Ana Luna")).toBeVisible();
    await card.getByRole("button", { name: "Dejar de recibir" }).click();
    await expect(card.getByText("No recibes novedades de ninguna creadora.")).toBeVisible();
    await buyer.context().close();

    const customer = await prisma.customer.findFirstOrThrow({ where: { email: buyerEmail } });
    expect(customer.marketingOptIn).toBe(false);
    expect(customer.marketingOptInAt).toBeNull();
    await page.reload();
    await expect(page.getByRole("link", { name: new RegExp(buyerName) }).getByText("Novedades ✓")).toHaveCount(0);
  });
});
