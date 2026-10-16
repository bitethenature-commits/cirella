import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Web personal que cobra en la web (SITE_MODE=personal, PAYMENT_PROVIDER=simulated,paypal): el
 * tercer servidor de playwright.config.ts (puerto 3102) con un PayPal falso (scripts/paypal-mock.ts).
 *   · los productos de pago de Ana se ven en su página y su ficha («Vende», condiciones);
 *   · el checkout ofrece «Tarjeta» y «PayPal»: con PayPal se va a PayPal, se aprueba y vuelve
 *     pagado; con tarjeta se paga en la página;
 *   · la página legal lleva condiciones de venta sin la plataforma;
 *   · el panel dice «Ventas» y en Ajustes salen los cobros y el IVA.
 * Borra las compras que hace.
 */

const SALES = `http://localhost:${process.env.E2E_SALES_PORT ?? 3102}`;
test.use({ baseURL: SALES });

const TAG = `e2e-cobros-${Date.now()}`;
const buyer = (label: string) => `${TAG}-${label}@example.com`;

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function fillCheckout(page: Page, label: string) {
  await page.fill("#name", `Compradora ${label}`);
  await page.fill("#email", buyer(label));
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByLabel(/Quiero acceder ya/).check();
}

test.describe.serial("Web personal que cobra con tarjeta y PayPal", () => {
  test.afterAll(async () => {
    const prisma = new PrismaClient();
    const users = (await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } })).map((u) => u.id);
    const orders = (await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } })).map((o) => o.id);
    await prisma.$transaction([
      prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } }),
      prisma.access.deleteMany({ where: { userId: { in: users } } }),
      prisma.invoice.deleteMany({ where: { recipientEmail: { startsWith: TAG } } }),
      prisma.transaction.deleteMany({ where: { orderId: { in: orders } } }),
      prisma.paymentEvent.deleteMany({ where: { orderId: { in: orders } } }),
      prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: users.map((id) => `user:${id}`) } } }),
      prisma.order.deleteMany({ where: { id: { in: orders } } }),
      prisma.customer.deleteMany({ where: { userId: { in: users } } }),
      prisma.user.deleteMany({ where: { id: { in: users } } }),
    ]);
    await prisma.$disconnect();
  });

  test("los productos de pago se ven en la página y en su ficha", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ana Luna", level: 1 })).toBeVisible();
    await expect(page.getByText("Gene Keys").first()).toBeVisible();
    // Pie con condiciones de venta (la web vende) y sin la plataforma.
    await expect(page.getByRole("link", { name: "Condiciones" })).toHaveAttribute("href", /^\/ana\/legal#condiciones/);
    expect(await page.locator("body").innerText()).not.toContain("Cirella");
    const res = await page.goto("/ana/gene-keys");
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/^Vende:/).first()).toBeVisible();
  });

  test("con PayPal: se va a PayPal, se aprueba y vuelve con la compra hecha", async ({ page }) => {
    await page.goto("/ana/gene-keys/checkout");
    await expect(page.getByRole("radio", { name: /Tarjeta/ })).toBeVisible();
    await page.getByRole("radio", { name: /PayPal/ }).click();
    await expect(page.getByText("Te llevaremos a PayPal")).toBeVisible();
    await fillCheckout(page, "paypal");
    await page.getByRole("button", { name: /Pagar con PayPal · 59/ }).click();
    // PayPal (falso): el importe y «Pagar con PayPal».
    await page.waitForURL(/localhost:\d+\/checkoutnow\?token=/);
    await expect(page.getByText("59.00 EUR")).toBeVisible();
    await page.getByRole("button", { name: "Pagar con PayPal" }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
    const prisma = new PrismaClient();
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: buyer("paypal") } });
    await prisma.$disconnect();
    expect([order.status, order.paymentProvider, order.platformFeeCents]).toEqual(["PAID", "paypal", 0]);
  });

  test("cancelar en PayPal vuelve al checkout con el mismo pedido", async ({ page }) => {
    await page.goto("/ana/gene-keys/checkout");
    await page.getByRole("radio", { name: /PayPal/ }).click();
    await fillCheckout(page, "cancela");
    await page.getByRole("button", { name: /Pagar con PayPal/ }).click();
    await page.waitForURL(/checkoutnow/);
    await page.getByRole("button", { name: "Cancelar y volver" }).click();
    await page.waitForURL(/\/ana\/gene-keys\/checkout\?pedido=.*cancelado=1/);
    await expect(page.getByText("No se ha completado el pago.")).toBeVisible();
    await expect(page.getByRole("radio", { name: /PayPal/ })).toHaveAttribute("aria-checked", "true");
  });

  test("con tarjeta: se paga en la página", async ({ page }) => {
    await page.goto("/ana/gene-keys/checkout");
    await page.getByRole("radio", { name: /Tarjeta/ }).click();
    await fillCheckout(page, "tarjeta");
    await page.getByRole("button", { name: /^Pagar 59/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
  });

  test("la página legal lleva condiciones de venta sin plataforma", async ({ page }) => {
    await page.goto("/ana/legal");
    await expect(page.getByRole("heading", { name: "Aviso legal y condiciones", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Condiciones de venta" })).toBeVisible();
    await expect(page.getByText(/con tarjeta \(también Apple Pay y Google Pay\) a través de Stripe o con PayPal/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Formulario de desistimiento" })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain("Cirella");
  });

  test("el panel: «Ventas» con las compras, cobros e IVA en Ajustes", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await expect(page.getByRole("link", { name: "Ventas" }).first()).toBeVisible();
    await page.goto("/panel/ventas");
    await expect(page.getByRole("heading", { name: "Ventas" })).toBeVisible();
    await expect(page.getByText(`Compradora paypal`).first()).toBeVisible();
    await expect(page.getByText("Comisión plataforma")).toHaveCount(0);
    await page.goto("/panel/ajustes");
    await expect(page.getByRole("heading", { name: "Cobros en tu web" })).toBeVisible();
    await expect(page.getByText(`Avisos (webhook): ${SALES}/api/webhooks/paypal`)).toBeVisible();
    await expect(page.getByText(/Mi empresa es de fuera de la UE/)).toBeVisible();
    // Un producto nuevo empieza como «Pago en la web».
    await page.goto("/panel/productos/nuevo");
    await expect(page.getByText(/si se paga aquí \(tarjeta o PayPal\)/)).toBeVisible();
  });
});
