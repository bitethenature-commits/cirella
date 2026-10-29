import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { addDaysToKey, dateKeyInTz, zonedTimeToUtc } from "../lib/tz";
import { earliestPaidSessionStart, membershipWithdrawalRefund } from "../lib/withdrawal";
import { freeDays } from "./slots";

/**
 * Desistimiento (lib/withdrawal.ts) en el navegador:
 *   · lo digital no se paga sin la casilla de renuncia;
 *   · un taller avisa en la ficha y en el checkout de que no tiene desistimiento y no se paga sin su
 *     casilla;
 *   · una membresía no se paga sin «Quiero empezar ya»; en «Mis compras», «Desistir» dice el importe
 *     proporcional exacto, lo devuelve y termina la membresía;
 *   · el calendario de una sesión pagada no ofrece ningún día antes del día 15, ni al comprar ni al
 *     elegir la fecha después del pago;
 *   · «Mis canales» de Laura: sin «Desistir» en lo digital y con «Desistir» en su sesión en plazo;
 *   · el formulario del producto explica la regla y no deja bajar de 15 días.
 * Depende solo del seed (npm run db:reset). No toca la reserva de Laura (la usa reembolsos.spec.ts).
 * Lo que crea (un taller y las compradoras) lleva TAG y se borra al terminar.
 */

const prisma = new PrismaClient();
const stamp = Date.now().toString().slice(-6);
const TZ = "Europe/Madrid";
const TAG = `e2e-desist-${stamp}`;
const workshopSlug = `${TAG}-taller`;

test.beforeAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  // Un taller a 40 días (lejos del plazo de 14 días: aun así, sin desistimiento).
  const day = addDaysToKey(dateKeyInTz(new Date(), TZ), 40);
  await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", accessMode: "PAID", priceCents: 3500, slug: workshopSlug, title: "Taller de equinoccio (prueba)",
      groupSession: true, eventStartAt: zonedTimeToUtc(day, 19 * 60, TZ), capacity: 10, durationMin: 90, minNoticeHours: 0, meetingUrl: "https://us02web.zoom.us/j/777",
    },
  });
});

test.afterAll(async () => {
  const products = (await prisma.product.findMany({ where: { slug: { startsWith: TAG } }, select: { id: true } })).map((p) => p.id);
  const users = (await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } })).map((u) => u.id);
  const orders = (await prisma.order.findMany({ where: { OR: [{ buyerEmail: { startsWith: TAG } }, { productId: { in: products } }] }, select: { id: true } })).map((o) => o.id);
  const bookings = (await prisma.booking.findMany({ where: { orderId: { in: orders } }, select: { id: true } })).map((b) => b.id);
  const subs = (await prisma.subscription.findMany({ where: { userId: { in: users } }, select: { id: true } })).map((x) => x.id);
  const keys = [...orders, ...bookings, ...subs];
  const txs = (await prisma.transaction.findMany({ where: { OR: [{ orderId: { in: orders } }, { subscriptionId: { in: subs } }] }, select: { id: true } })).map((t) => t.id);
  await prisma.$transaction([
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...keys.map((k) => ({ dedupeKey: { contains: k } }))] } }),
    prisma.outboxEvent.deleteMany({ where: { OR: keys.map((k) => ({ payload: { string_contains: k } })) } }),
    prisma.access.deleteMany({ where: { userId: { in: users } } }),
    prisma.invoice.updateMany({ where: { OR: [{ orderId: { in: orders } }, { transactionId: { in: txs } }] }, data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany({ where: { OR: [{ orderId: { in: orders } }, { transactionId: { in: txs } }] } }),
    prisma.transaction.deleteMany({ where: { id: { in: txs } } }),
    prisma.refund.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.paymentEvent.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.analyticsEvent.deleteMany({ where: { OR: [{ visitorId: { in: users.map((id) => `user:${id}`) } }, { productId: { in: products } }] } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.session.deleteMany({ where: { OR: [{ orderId: { in: orders } }, { userId: { in: users } }] } }),
    prisma.booking.deleteMany({ where: { id: { in: bookings } } }),
    prisma.subscription.deleteMany({ where: { id: { in: subs } } }),
    prisma.order.deleteMany({ where: { id: { in: orders } } }),
    prisma.customer.deleteMany({ where: { userId: { in: users } } }),
    prisma.user.deleteMany({ where: { id: { in: users } } }),
    prisma.product.deleteMany({ where: { id: { in: products } } }),
  ]);
  await prisma.$disconnect();
});

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Fechas (AAAA-MM-DD) de todos los días libres del calendario, mes a mes. */
async function allFreeDates(page: Page): Promise<string[]> {
  await expect(freeDays(page).first()).toBeVisible();
  while (await page.getByRole("button", { name: "Mes anterior" }).isEnabled()) await page.getByRole("button", { name: "Mes anterior" }).click();
  const dates: string[] = [];
  for (;;) {
    for (const d of await freeDays(page).all()) dates.push((await d.getAttribute("data-date")) ?? "");
    const next = page.getByRole("button", { name: "Mes siguiente" });
    if (!(await next.isEnabled())) return dates;
    await next.click();
  }
}

test.describe.serial("Desistimiento", () => {
  test("lo digital no se paga sin la casilla de renuncia", async ({ page }) => {
    const email = `${TAG}-curso@example.com`;
    await page.goto("/ana/curso-conocete-tu-energia/checkout");
    await page.fill("#name", "Rita Renuncia");
    await page.fill("#email", email);
    await page.getByLabel(/He leído y acepto/).check();
    const waiver = page.getByLabel(/Quiero acceder ya al contenido: doy mi consentimiento expreso/);
    await expect(waiver).not.toBeChecked();
    await page.getByRole("button", { name: /Pagar/ }).click();
    await expect(page.getByText("Para pagar, marca la casilla de acceso inmediato y renuncia al desistimiento")).toBeVisible();
    expect(await prisma.order.count({ where: { buyerEmail: email, status: "PAID" } })).toBe(0);
  });

  test("taller: avisa antes de pagar de que no hay desistimiento y no se paga sin su casilla", async ({ page }) => {
    const email = `${TAG}-taller@example.com`;
    await page.goto(`/ana/${workshopSlug}`);
    await expect(page.getByTestId("withdrawal-info")).toContainText("Taller con fecha fija: no tiene derecho de desistimiento (art. 103 l)");
    await page.goto(`/ana/${workshopSlug}/checkout`);
    await expect(page.getByTestId("withdrawal-info")).toContainText("no tiene derecho de desistimiento");
    await page.fill("#name", "Tere Taller");
    await page.fill("#email", email);
    await page.getByLabel(/He leído y acepto/).check();
    const box = page.getByLabel(/Entiendo que este taller se celebra en una fecha fija .* no tengo derecho de desistimiento \(art\. 103 l\)/);
    await expect(box).not.toBeChecked();
    await page.getByRole("button", { name: /Reservar y pagar/ }).click();
    await expect(page.getByText("Para reservar tu plaza, marca la casilla que confirma que el taller tiene fecha fija y no admite desistimiento")).toBeVisible();
    expect(await prisma.order.count({ where: { buyerEmail: email, status: "PAID" } })).toBe(0);
    await box.check();
    await page.getByRole("button", { name: /Reservar y pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: email, status: "PAID" } });
    expect(order.waiverKind).toBe("WORKSHOP_FIXED_DATE");
    expect(order.waiverText).toMatch(/^Entiendo que este taller se celebra en una fecha fija/);
    expect(order.waiverVersion).toMatch(/^\d{4}-\d{2}-\d{2}#[0-9a-f]{16}$/);
  });

  test("membresía: sin «Quiero empezar ya» no se paga; «Desistir» devuelve lo proporcional y la termina", async ({ page }) => {
    const email = `${TAG}-socia@example.com`;
    await page.goto("/ana/comunidad-privada/checkout");
    await expect(page.getByTestId("withdrawal-info")).toContainText("te devolvemos la parte proporcional de los días que no hayas disfrutado");
    await page.fill("#name", "Sara Socia");
    await page.fill("#email", email);
    await page.getByLabel(/He leído y acepto/).check();
    const box = page.getByLabel(/Quiero empezar ya: solicito expresamente acceder a la membresía en cuanto pague/);
    await expect(box).not.toBeChecked();
    await page.getByRole("button", { name: /Unirme/ }).click();
    await expect(page.getByText("Para empezar tu membresía, marca la casilla para acceder en cuanto pagues (con reembolso proporcional si desistes)")).toBeVisible();
    expect(await prisma.order.count({ where: { buyerEmail: email, status: "PAID" } })).toBe(0);
    await box.check();
    await page.getByRole("button", { name: /Unirme/ }).click();
    await page.waitForURL("**/ana/gracias**");
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: email, status: "PAID" } });
    expect(order.waiverKind).toBe("MEMBERSHIP_START");
    const sub = await prisma.subscription.findFirstOrThrow({ where: { orderId: order.id } });
    const expected = membershipWithdrawalRefund({ amountCents: order.amountCents, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd, now: new Date(), timezone: TZ });
    const euros = `${Math.floor(expected.refundCents / 100)},${String(expected.refundCents % 100).padStart(2, "0")}`;

    // Entra con su cuenta (email confirmado y contraseña) a «Mis compras».
    await prisma.user.update({ where: { email }, data: { passwordHash: await hash("demo1234", 10), emailVerifiedAt: new Date() } });
    await page.context().clearCookies();
    await page.goto("/entrar");
    await page.fill("#email", email);
    await page.fill("#password", "demo1234");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
    await page.goto("/cuenta/compras");
    const row = page.locator(".card > div", { hasText: "Comunidad privada" });
    await expect(row).toContainText(`hoy te devolveríamos ${euros}`);
    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.accept();
    });
    await row.getByRole("button", { name: "Desistir" }).click();
    await page.waitForURL("**/cuenta/compras?ok=desistido");
    expect(message).toContain(`Te devolveremos ${euros}`);
    expect(message).toContain(`los ${expected.unusedDays} días que no has disfrutado de los ${expected.totalDays} del periodo pagado`);
    expect(message).toContain("Tu membresía terminará ahora");
    await expect(row).toContainText("Reembolsado");
    await expect(row.getByRole("button", { name: "Desistir" })).toHaveCount(0);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { refunds: true } });
    expect(after.refunds.map((r) => [r.reason, r.amountCents])).toEqual([["WITHDRAWAL", expected.refundCents]]);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("CANCELED");
  });

  test("calendario de una sesión pagada: ningún día antes del día 15", async ({ page }) => {
    const day15 = dateKeyInTz(earliestPaidSessionStart(new Date(), TZ), TZ);
    await page.goto("/ana/sesion-1-1/checkout");
    await expect(page.getByTestId("dia-15")).toContainText("se reservan desde el día 15 tras la compra");
    const dates = await allFreeDates(page);
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) expect(d >= day15, `${d} es antes del día 15 (${day15})`).toBe(true);
  });

  test("«Prefiero elegir la fecha después del pago»: al elegirla, también desde el día 15 de su compra", async ({ page }) => {
    const email = `despues${stamp}@example.com`;
    const day15 = dateKeyInTz(earliestPaidSessionStart(new Date(), TZ), TZ);
    await page.goto("/ana/sesion-1-1/checkout");
    await page.getByLabel("Prefiero elegir la fecha después del pago").check();
    await page.fill("#name", "Dora Después");
    await page.fill("#email", email);
    await page.getByLabel(/He leído y acepto/).check();
    await expect(page.getByLabel(/Quiero acceder ya|Entiendo que este taller|Quiero empezar ya/)).toHaveCount(0);
    await page.getByRole("button", { name: /Reservar y pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await page.getByRole("link", { name: /Elegir fecha y hora/ }).click();
    await page.waitForURL("**/cuenta/sesiones/**");
    const dates = await allFreeDates(page);
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) expect(d >= day15, `${d} es antes del día 15 (${day15})`).toBe(true);
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: email } });
    expect(order.waiverKind).toBeNull();
  });

  test("«Mis canales» de Laura: «Desistir» solo en su sesión en plazo", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await page.goto("/cuenta/compras");
    const row = (title: string) => page.locator(".card > div", { hasText: title });
    await expect(row("Lectura de Human Design").getByRole("button", { name: "Desistir" })).toBeVisible();
    await expect(row("Lectura de Human Design")).toContainText(/Puedes desistir hasta el \d+ de \p{L}+ \(incluido\)/u);
    // Solo un «Desistir» en toda la página: ni lo digital ni la comunidad que le regaló Ana.
    await expect(page.getByRole("button", { name: "Desistir" })).toHaveCount(1);
    for (const title of ["Gene Keys", "Conócete a través de tu energía"]) {
      await expect(row(title)).toBeVisible();
      await expect(row(title).getByRole("button", { name: "Desistir" })).toHaveCount(0);
    }
  });

  test("producto: la regla del día 15 explicada y sin bajar de 15 días", async ({ page }) => {
    const p = await prisma.product.findFirstOrThrow({ where: { slug: "sesion-1-1", creator: { username: "ana" } } });
    await demoLogin(page, "Ana Luna");
    await page.goto(`/panel/productos/${p.id}`);
    await expect(page.getByText("Las sesiones que se pagan en la web se pueden reservar a partir del día 15 desde la compra: así nunca caen dentro de los 14 días en los que tu clienta puede desistir.")).toBeVisible();
    const notice = page.getByLabel("Antelación mínima (días desde la compra)");
    await expect(notice).toHaveValue("15");
    // Sin la comprobación del navegador, el servidor también lo rechaza.
    await notice.evaluate((el) => el.removeAttribute("min"));
    await notice.fill("10");
    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText(/La antelación mínima de una sesión que se paga en la web es de 15 días/)).toBeVisible();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).minNoticeHours).toBe(360);
  });
});
