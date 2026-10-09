import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Cobros (pasarela simulada): confirmación del banco (3DS), pago pendiente, cancelación y
 * reintento; estados de la cuenta de cobro de una creadora; «Pagar ahora» de una renovación;
 * datos fiscales e informe de DAC7; y las rutas que solo existen con una pasarela concreta.
 * Cada prueba deja los datos de demostración como estaban.
 */

const prisma = new PrismaClient();
const stamp = Date.now().toString().slice(-6);
const THREE_DS = "4000 0027 6000 3184";

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function passwordLogin(page: Page, email: string) {
  await page.goto("/entrar");
  await page.fill("#email", email);
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function startCheckout(page: Page, path: string, name: string, email: string, card: string) {
  await page.goto(path);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.getByPlaceholder("Número de tarjeta").fill(card);
  await page.getByRole("button", { name: /Pagar/ }).click();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe.serial("Pagos", () => {
  test("pago con confirmación del banco (3DS) → compra completada y acceso", async ({ page }) => {
    await startCheckout(page, "/ana/lectura-astrologia/checkout", "Rosa Banco", `rosa${stamp}@example.com`, THREE_DS);
    await page.waitForURL("**/pago-simulado/**");
    await expect(page.getByRole("heading", { name: "Confirma el pago en la app de tu banco" })).toBeVisible();
    await expect(page.getByText(/Lectura de Astrología/)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar el pago" }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
    // La cookie del checkout demuestra que es el mismo navegador: entra sin contraseña.
    await page.getByRole("link", { name: /Acceder a mi contenido/ }).click();
    await page.waitForURL("**/cuenta");
    await expect(page.getByText("Lectura de Astrología").first()).toBeVisible();
  });

  test("pago pendiente: el banco tarda y la confirmación llega después", async ({ page }) => {
    await startCheckout(page, "/ana/lectura-astrologia/checkout", "Elena Espera", `elena${stamp}@example.com`, THREE_DS);
    await page.waitForURL("**/pago-simulado/**");
    const bankUrl = page.url();
    await page.getByRole("button", { name: "El banco tarda (pago pendiente)" }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Pago pendiente de confirmar" })).toBeVisible();
    await page.goto(bankUrl);
    await expect(page.getByText("el pago está pendiente")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar el pago" }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
  });

  test("cancelar en el banco → de vuelta al checkout con los datos, y reintento con otra tarjeta", async ({ page }) => {
    const email = `nerea${stamp}@example.com`;
    await startCheckout(page, "/ana/lectura-astrologia/checkout", "Nerea Cancela", email, THREE_DS);
    await page.waitForURL("**/pago-simulado/**");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.waitForURL("**/lectura-astrologia/checkout**");
    await expect(page.getByText(/No se ha completado el pago/)).toBeVisible();
    await expect(page.locator("#name")).toHaveValue("Nerea Cancela");
    await expect(page.locator("#email")).toHaveValue(email);
    await page.getByPlaceholder("Número de tarjeta").fill("4242 4242 4242 4242");
    await page.getByRole("button", { name: /Pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
    const orders = await prisma.order.findMany({ where: { buyerEmail: email } });
    expect(orders.map((o) => o.status)).toEqual(["PAID"]);
  });

  test("estados de la cuenta de cobro: falta un documento → no se vende → verificada", async ({ page, browser }) => {
    const sofia = await prisma.creator.findUniqueOrThrow({ where: { username: "sofia" } });
    const original = {
      payoutProvider: sofia.payoutProvider,
      payoutAccountId: sofia.payoutAccountId,
      payoutStatus: sofia.payoutStatus,
      payoutChargesEnabled: sofia.payoutChargesEnabled,
      payoutPayoutsEnabled: sofia.payoutPayoutsEnabled,
      payoutStatusUpdatedAt: sofia.payoutStatusUpdatedAt,
    };
    try {
      await passwordLogin(page, "sofia@cirella.app");
      await page.goto("/panel/ajustes/cobros");
      await expect(page.getByText("Activada").first()).toBeVisible();

      await prisma.creator.update({
        where: { id: sofia.id },
        data: { payoutProvider: null, payoutAccountId: null, payoutStatus: "NONE", payoutChargesEnabled: false, payoutPayoutsEnabled: false },
      });
      await page.reload();
      await expect(page.getByText("Sin conectar").first()).toBeVisible();
      await page.getByRole("button", { name: "Conectar con Stripe" }).click();
      await page.waitForURL("**/pago-simulado/cuenta**");
      await expect(page.getByRole("heading", { name: "Verifica tu identidad" })).toBeVisible();
      await page.getByRole("button", { name: "Falta un documento" }).click();
      await page.waitForURL("**/panel/ajustes/cobros**");
      await expect(page.getByText("Te falta subir una foto de tu DNI, NIE o pasaporte").first()).toBeVisible();
      await page.goto("/panel");
      await expect(page.getByRole("link", { name: /Te falta subir una foto de tu DNI/ })).toBeVisible();

      // Nadie puede comprar mientras tanto.
      const visitor = await browser.newContext();
      const buyer = await visitor.newPage();
      await buyer.goto("/sofia/guia-bio-instagram/checkout");
      await expect(buyer.getByText("Las compras de este producto aún no están disponibles.")).toBeVisible();
      await expect(buyer.getByRole("button", { name: /Pagar/ })).toBeDisabled();
      await visitor.close();

      await page.goto("/panel/ajustes/cobros");
      await page.getByRole("button", { name: "Completar en Stripe" }).click();
      await page.waitForURL("**/pago-simulado/cuenta**");
      await page.getByRole("button", { name: "Verificar al instante" }).click();
      await page.waitForURL("**/panel/ajustes/cobros**");
      await expect(page.getByText("Cuenta de cobro activada: ya puedes vender")).toBeVisible();
      await expect(page.getByText("Activada").first()).toBeVisible();
    } finally {
      await prisma.creator.update({ where: { id: sofia.id }, data: original });
    }
  });

  test("«Pagar ahora» una renovación que no se pudo cobrar", async ({ page }) => {
    const lucia = await prisma.user.findUniqueOrThrow({ where: { email: "lucia@example.com" } });
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: lucia.id, status: "ACTIVE" } });
    const access = await prisma.access.findFirstOrThrow({ where: { subscriptionId: sub.id } });
    try {
      await prisma.user.update({ where: { id: lucia.id }, data: { passwordHash: await hash("demo1234", 10) } });
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "PAST_DUE", renewalAttempts: 1, nextRenewalAttemptAt: new Date(Date.now() + 86_400_000), lastRenewalError: "La tarjeta ha sido rechazada." },
      });
      await passwordLogin(page, "lucia@example.com");
      await page.goto("/cuenta/membresias");
      await expect(page.getByText("Pago pendiente · actualiza tu tarjeta")).toBeVisible();
      await page.goto(`/cuenta/membresias/${sub.productId}`);
      await expect(page.getByText("No hemos podido renovar tu membresía")).toBeVisible();
      await page.getByRole("button", { name: /Pagar ahora/ }).click();
      await expect(page.getByText("Pago recibido. ¡Gracias!")).toBeVisible();
      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.status).toBe("ACTIVE");
      expect(after.currentPeriodStart.getTime()).toBe(sub.currentPeriodEnd.getTime());
    } finally {
      await prisma.transaction.deleteMany({ where: { subscriptionId: sub.id, type: "RENEWAL", createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          renewalAttempts: 0,
          nextRenewalAttemptAt: null,
          lastRenewalError: null,
          providerCustomerRef: sub.providerCustomerRef,
          providerPaymentMethodRef: sub.providerPaymentMethodRef,
        },
      });
      await prisma.access.update({ where: { id: access.id }, data: { expiresAt: access.expiresAt, status: access.status } });
      await prisma.user.update({ where: { id: lucia.id }, data: { passwordHash: lucia.passwordHash } });
    }
  });

  test("DAC7: datos fiscales de la creadora e informe para la asesoría", async ({ page }) => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    try {
      await demoLogin(page, "Ana Luna");
      await page.goto("/panel");
      await expect(page.getByText("Completa tus datos fiscales")).toBeVisible();
      await page.goto("/panel/ajustes/cobros");
      await page.fill("#iban", "ES00 1234");
      await page.getByRole("button", { name: "Guardar datos fiscales" }).click();
      await expect(page.getByText(/Revisa el IBAN/)).toBeVisible();
      await page.fill("#iban", "ES91 2100 0418 4502 0005 1332");
      await page.fill("#birthDate", "1990-05-20");
      await page.getByLabel("Confirmo que mis datos fiscales son correctos").check();
      await page.getByRole("button", { name: "Guardar datos fiscales" }).click();
      await expect(page.getByText("Datos fiscales guardados")).toBeVisible();
      await expect(page.getByText("ES91 •••• •••• 1332").first()).toBeVisible();
      await expect(page.getByText("2100 0418 4502")).toHaveCount(0);

      await page.context().clearCookies();
      await demoLogin(page, "Superadmin");
      const year = new Date().getFullYear();
      await page.goto(`/admin/reportes/dac7?anio=${year}`);
      await expect(page.getByRole("heading", { name: `DAC7 · ${year}` })).toBeVisible();
      const row = page.locator("tr", { hasText: "@ana" });
      await expect(row).toBeVisible();
      await expect(row.getByText(/Faltan:/)).toBeVisible();
      const csv = await page.request.get(`/admin/reportes/dac7/csv?anio=${year}`);
      expect(csv.status()).toBe(200);
      expect(csv.headers()["content-type"]).toContain("text/csv");
      const header = (await csv.text()).split("\n")[0];
      expect(header).toContain("nif");
      expect(header).toContain("iban");
      await page.goto("/admin/creadoras");
      await expect(page.getByText(/Cobros:/)).toBeVisible();
      await expect(page.locator("th", { hasText: "Cobros" })).toHaveCount(1);
    } finally {
      await prisma.creator.update({ where: { id: ana.id }, data: { iban: ana.iban, birthDate: ana.birthDate, dac7ConfirmedAt: ana.dac7ConfirmedAt } });
    }
  });

  test("rutas de cada pasarela: sin webhook de Stripe con el simulador y simulador solo con sesión", async ({ page, request }) => {
    const webhook = await request.post("/api/webhooks/stripe", { data: "{}", headers: { "stripe-signature": "t=1,v1=x" } });
    expect(webhook.status()).toBe(404);
    await page.goto("/pago-simulado/cuenta");
    await page.waitForURL("**/entrar**");
  });
});
