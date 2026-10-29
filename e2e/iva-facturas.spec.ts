import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * IVA incluido y facturas:
 *   · «IVA incluido» en los planes, la ficha y la tarjeta de un producto digital;
 *   · compra con «Necesito factura con mi NIF» (con un NIF mal escrito antes) → factura completa;
 *   · compra desde Francia: 20 %, simplificada con la nota OSS y, después, la factura con NIF-IVA
 *     que la sustituye;
 *   · sesión de una creadora sin IVA: precio final y justificante de compra (no es una factura);
 *   · panel: facturas de Cirella, situación de IVA y CSV de ventas; admin: política de IVA;
 *   · nadie abre una factura que no es suya (404) y sin sesión se pide entrar.
 * Cada prueba deja los datos de demostración como estaban.
 */

const prisma = new PrismaClient();
const stamp = Date.now().toString().slice(-6);
const esBuyer = `factura${stamp}@example.com`;
const frBuyer = `francia${stamp}@example.com`;
const sessionBuyer = `justificante${stamp}@example.com`;

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function fillBuyer(page: Page, path: string, name: string, email: string, country: string) {
  await page.goto(path);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.selectOption("#country", country);
}

async function acceptAndPay(page: Page) {
  await page.getByLabel(/He leído y acepto/).check();
  // La casilla del desistimiento la piden lo digital, los cursos, las membresías y los talleres (no las sesiones individuales).
  const waiver = page.getByLabel(/Quiero acceder ya|Quiero que se prepare ya|Entiendo que este taller|Quiero empezar ya/);
  if (await waiver.count()) await waiver.check();
  await page.getByRole("button", { name: /pagar/i }).click();
}

test.describe.serial("IVA y facturas", () => {
  let esInvoiceId = "";

  test("los precios dicen «IVA incluido»", async ({ page }) => {
    await page.goto("/#precios");
    await expect(page.locator("#precios").getByText("IVA incluido").first()).toBeVisible();
    await page.goto("/ana/gene-keys");
    await expect(page.getByText("IVA incluido", { exact: true })).toBeVisible();
    await page.goto("/ana");
    await expect(page.locator("article", { hasText: "Gene Keys" }).getByText("IVA incluido").first()).toBeVisible();
  });

  test("compra con factura: un NIF mal escrito no se pierde y la factura completa lleva el NIF", async ({ page }) => {
    await fillBuyer(page, "/ana/gene-keys/checkout", "Paula Factura", esBuyer, "ES");
    await expect(page.getByText("IVA incluido · 10,24 € (21 %)")).toBeVisible();
    await expect(page.getByText(/Cobro y factura gestionados por/)).toBeVisible();
    await page.getByLabel("Necesito factura con mi NIF").check();
    await page.fill("#billingName", "Paula Factura Gómez");
    await page.fill("#billingTaxId", "12345678A");
    await page.fill("#billingAddress", "Calle del Sol 1, 28001 Madrid");
    await acceptAndPay(page);
    await expect(page.getByText("Revisa el NIF: no es válido")).toBeVisible();
    await expect(page.locator("#billingName")).toHaveValue("Paula Factura Gómez");
    await expect(page.locator("#billingAddress")).toHaveValue("Calle del Sol 1, 28001 Madrid");

    await page.fill("#billingTaxId", "12345678Z");
    await page.getByRole("button", { name: /pagar/i }).click();
    await page.waitForURL("**/ana/gracias**");
    await page.getByRole("link", { name: /Acceder a mi contenido/ }).click();
    await page.waitForURL("**/cuenta/pedidos/**");
    await expect(page.getByRole("heading", { name: "Recibo y factura" })).toBeVisible();
    await expect(page.getByText(/^Factura V\d{4}-\d{6}$/)).toBeVisible();
    await expect(page.getByText("¿Necesitas factura con tu NIF?")).toHaveCount(0);

    await page.locator("#factura").getByRole("link", { name: "Ver" }).click();
    await page.waitForURL("**/facturas/**");
    esInvoiceId = page.url().split("/facturas/")[1];
    await expect(page.getByRole("heading", { name: "Factura", exact: true })).toBeVisible();
    await expect(page.getByText("NIF 12345678Z")).toBeVisible();
    await expect(page.getByText("NIF B12345674")).toBeVisible();
    await expect(page.getByText("IVA (21 %)", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir o guardar en PDF" })).toBeVisible();
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: esInvoiceId } });
    expect(inv.baseCents + inv.taxCents).toBe(inv.totalCents);
    expect([inv.type, inv.taxCents, inv.totalCents]).toEqual(["F1", 1024, 5900]);

    // El recibo lleva el IVA, el número de factura y el enlace al detalle.
    const receipt = await prisma.emailMessage.findFirstOrThrow({ where: { to: esBuyer, template: "PURCHASE_RECEIPT" } });
    for (const text of ["IVA incluido (21 %)", inv.fullNumber, "Ver tu factura o justificante"]) expect(receipt.html).toContain(text);
  });

  test("compra desde Francia: 20 %, simplificada con OSS y después la factura con NIF-IVA", async ({ page }) => {
    await fillBuyer(page, "/ana/gene-keys/checkout", "Camille Martin", frBuyer, "FR");
    await expect(page.getByText("IVA incluido · 9,83 € (20 %)")).toBeVisible();
    await acceptAndPay(page);
    await page.waitForURL("**/ana/gracias**");
    await page.getByRole("link", { name: /Acceder a mi contenido/ }).click();
    await page.waitForURL("**/cuenta/pedidos/**");
    await expect(page.getByText(/^Factura simplificada V\d{4}-\d{6}$/)).toBeVisible();
    await expect(page.getByText(/régimen de ventanilla única, OSS/)).toBeVisible();

    await expect(page.getByText("¿Necesitas factura con tu NIF?")).toBeVisible();
    await page.fill("#fi-name", "Société Lune SARL");
    await page.fill("#fi-taxid", "FR12345678901");
    await page.fill("#fi-address", "1 rue de la Paix, 75002 Paris");
    // El país es el de la compra (con el que se calculó el IVA): se muestra, no se elige.
    await expect(page.locator("#fi-country")).toHaveText("Francia");
    await page.getByRole("button", { name: "Pedir factura" }).click();
    await expect(page.getByText(/Hemos emitido tu factura V\d{4}-\d{6}\./)).toBeVisible();
    await expect(page.getByText(/^Factura V\d{4}-\d{6}$/)).toBeVisible();
    await expect(page.getByText("(sustituida)")).toBeVisible();
    await expect(page.getByText("¿Necesitas factura con tu NIF?")).toHaveCount(0);

    const f3 = await prisma.invoice.findFirstOrThrow({ where: { recipientEmail: frBuyer, type: "F3" }, include: { related: true } });
    await page.goto(`/facturas/${f3.id}`);
    await expect(page.getByText(`Sustituye a la factura simplificada ${f3.related!.fullNumber}`, { exact: true })).toBeVisible();
    await expect(page.getByText("NIF FR12345678901")).toBeVisible();
  });

  test("sesión de una creadora sin IVA: precio final y justificante de compra", async ({ page }) => {
    await fillBuyer(page, "/maria/yoga-terapeutico/checkout", "Julia Justificante", sessionBuyer, "ES");
    await expect(page.getByText("Precio final")).toBeVisible();
    await expect(page.getByText("Recibirás un justificante de compra por email.")).toBeVisible();
    await expect(page.getByLabel("Necesito factura con mi NIF")).toHaveCount(0);
    await page.getByLabel("Prefiero elegir la fecha después del pago").check();
    await acceptAndPay(page);
    await page.waitForURL("**/maria/gracias**");
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: sessionBuyer } });
    await page.goto(`/cuenta/pedidos/${order.id}`);
    await expect(page.getByRole("heading", { name: "Justificante de compra" })).toBeVisible();
    await expect(page.getByText("Este documento no es una factura.")).toBeVisible();
    await expect(page.getByText(/no emite facturas con IVA por esta venta/)).toBeVisible();
    expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(0);

    // Seguridad: esta compradora no abre la factura de otra (404, no se revela que existe).
    expect((await page.request.get(`/facturas/${esInvoiceId}`)).status()).toBe(404);
  });

  test("sin sesión, la factura pide entrar", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`/facturas/${esInvoiceId}`);
    await expect(page).toHaveURL(/\/entrar\?next=%2Ffacturas%2F/);
  });

  test("panel: facturas de Cirella, situación de IVA y CSV de ventas", async ({ page }) => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
    await demoLogin(page, "Ana Luna");

    await page.goto("/panel/plan");
    await expect(page.getByRole("heading", { name: "Facturas de Cirella" })).toBeVisible();
    await expect(page.getByText(/^S\d{4}-\d{6}$/).first()).toBeVisible();
    await page.getByRole("link", { name: "Ver factura" }).first().click();
    await page.waitForURL("**/facturas/**");
    await expect(page.getByText("Ana Luna Pérez")).toBeVisible();
    await expect(page.getByText("IVA (21 %)", { exact: true })).toBeVisible();

    // La factura de cuotas de María no existe para Ana.
    const mariaFees = await prisma.invoice.findFirstOrThrow({ where: { creatorId: maria.id, kind: "FEES" } });
    expect((await page.request.get(`/facturas/${mariaFees.id}`)).status()).toBe(404);
    // La venta a Paula sí (es de su tienda).
    expect((await page.request.get(`/facturas/${esInvoiceId}`)).status()).toBe(200);

    await page.goto("/panel/ajustes");
    try {
      await page.getByLabel("Soy autónoma o empresa y mi actividad está exenta de IVA").check();
      await page.fill("#vatExemptionNote", "Exenta de IVA según el art. 20.Uno.9.º de la Ley 37/1992");
      await page.getByRole("button", { name: "Guardar IVA" }).click();
      await expect(page.getByText("Datos de IVA guardados")).toBeVisible();
      const saved = await prisma.creator.findUniqueOrThrow({ where: { id: ana.id } });
      expect([saved.vatStatus, saved.vatExemptionNote]).toEqual(["EXEMPT", "Exenta de IVA según el art. 20.Uno.9.º de la Ley 37/1992"]);
    } finally {
      await prisma.creator.update({ where: { id: ana.id }, data: { vatStatus: ana.vatStatus, vatExemptionNote: ana.vatExemptionNote } });
    }

    await page.goto("/panel/ventas");
    const href = await page.getByRole("link", { name: "Descargar CSV" }).getAttribute("href");
    const csv = await page.request.get(href!);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text.split("\n")[0]).toContain("iva_eur");
    expect(text).toContain("Paula Factura");
  });

  test("admin: política de IVA sin aviso de datos pendientes y facturas emitidas", async ({ page }) => {
    await demoLogin(page, "Superadmin");
    await page.goto("/admin/impuestos");
    await expect(page.getByRole("heading", { name: "Impuestos y facturas" })).toBeVisible();
    await expect(page.getByText(/Faltan los datos fiscales de la empresa/)).toHaveCount(0);
    await expect(page.getByLabel(/Cirella vende los productos digitales/)).toBeChecked();
    await expect(page.getByText(/^S\d{4}-\d{6}$/).first()).toBeVisible();
    await page.getByRole("button", { name: "Guardar política" }).click();
    await expect(page.getByText("Política de IVA guardada")).toBeVisible();
  });
});
