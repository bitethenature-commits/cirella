import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { makeWav } from "../prisma/demo-files";
import { addDaysToKey, dateKeyInTz, weekdayOfKey, zonedTimeToUtc } from "../lib/tz";
import { freeTimes, pickDay } from "./slots";

/**
 * Calendario propio de Cirella (web personal que cobra: puerto 3102).
 *   · una clienta en Bogotá reserva su lectura en su hora, con sus datos de nacimiento, y paga;
 *   · Cirella ve la reserva con los datos, cambia el enlace de Zoom y avisa;
 *   · fechas especiales en hora de Bali; «Dar una sesión o lectura»; datos que completa la clienta;
 *   · entrega de una lectura grabada; un taller con 2 plazas que se llena.
 * Crea sus propios productos y clientas y lo borra todo al final.
 */

const SALES = `http://localhost:${process.env.E2E_SALES_PORT ?? 3102}`;
test.use({ baseURL: SALES });

const TAG = `e2e-lecturas-${Date.now()}`;
const buyer = (label: string) => `${TAG}-${label}@example.com`;
const MADRID = "Europe/Madrid";

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function acceptConsents(page: Page) {
  await page.getByLabel(/He leído y acepto/).check();
  // La casilla del desistimiento la piden lo digital, los cursos, las membresías y los talleres (no las sesiones individuales).
  const waiver = page.getByLabel(/Quiero acceder ya|Quiero que se prepare ya|Entiendo que este taller|Quiero empezar ya/);
  if (await waiver.count()) await waiver.check();
}

/** Último email a `to` con esa plantilla (lo guarda la bandeja de salida). */
async function lastMail(to: string, template: string) {
  const prisma = new PrismaClient();
  try {
    return await prisma.emailMessage.findFirst({ where: { to, template }, orderBy: { createdAt: "desc" } });
  } finally {
    await prisma.$disconnect();
  }
}
const ctaUrl = (html: string) => html.match(/href="([^"]*\/auth\/enlace[^"]*)"/)?.[1]?.replace(/&amp;/g, "&") ?? "";

/** Un lunes a jueves libre a partir de +minDays (ni bloqueado ni con fecha especial). */
async function freeWorkday(minDays: number) {
  const prisma = new PrismaClient();
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const blocked = new Set((await prisma.blockedDate.findMany({ where: { creatorId: ana.id } })).map((b) => b.date));
  const special = new Set((await prisma.availabilityOverride.findMany({ where: { creatorId: ana.id } })).map((o) => o.date));
  await prisma.$disconnect();
  const today = dateKeyInTz(new Date(), MADRID);
  for (let d = minDays; ; d++) {
    const k = addDaysToKey(today, d);
    if ([1, 2, 3, 4].includes(weekdayOfKey(k)) && !blocked.has(k) && !special.has(k)) return k;
  }
}

test.describe.serial("Calendario propio: lecturas, horario y talleres", () => {
  let readingSlug = "";
  let workshopSlug = "";

  test.beforeAll(async () => {
    const prisma = new PrismaClient();
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    readingSlug = `${TAG}-lectura`;
    workshopSlug = `${TAG}-taller`;
    await prisma.product.create({
      data: {
        creatorId: ana.id, type: "DIGITAL", deliveryMode: "PERSONAL", status: "PUBLISHED", accessMode: "PAID", priceCents: 4500, slug: readingSlug, title: "Lectura grabada (prueba)",
        instructions: "Te envío la grabación en 72 horas.", intake: { birth: "optional", questions: [{ id: "tema", label: "¿Qué quieres explorar?", long: true, required: false }] },
      },
    });
    const day = await freeWorkday(10);
    await prisma.product.create({
      data: {
        creatorId: ana.id, type: "SESSION", status: "PUBLISHED", accessMode: "PAID", priceCents: 2500, slug: workshopSlug, title: "Taller de Luna Nueva (prueba)",
        groupSession: true, eventStartAt: zonedTimeToUtc(day, 17 * 60, MADRID), capacity: 2, durationMin: 90, minNoticeHours: 0, meetingUrl: "https://us02web.zoom.us/j/555",
      },
    });
    await prisma.$disconnect();
  });

  test.afterAll(async () => {
    const prisma = new PrismaClient();
    const products = (await prisma.product.findMany({ where: { slug: { startsWith: TAG } }, select: { id: true } })).map((p) => p.id);
    const users = (await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } })).map((u) => u.id);
    const orders = (await prisma.order.findMany({ where: { OR: [{ buyerEmail: { startsWith: TAG } }, { productId: { in: products } }] }, select: { id: true } })).map((o) => o.id);
    const bookings = (await prisma.booking.findMany({ where: { orderId: { in: orders } }, select: { id: true } })).map((b) => b.id);
    const keys = [...orders, ...bookings];
    await prisma.$transaction([
      prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...keys.map((k) => ({ dedupeKey: { contains: k } }))] } }),
      prisma.access.deleteMany({ where: { userId: { in: users } } }),
      prisma.transaction.deleteMany({ where: { orderId: { in: orders } } }),
      prisma.paymentEvent.deleteMany({ where: { orderId: { in: orders } } }),
      prisma.analyticsEvent.deleteMany({ where: { OR: [{ visitorId: { in: users.map((id) => `user:${id}`) } }, { productId: { in: products } }] } }),
      prisma.orderLink.deleteMany({ where: { orderId: { in: orders } } }),
      prisma.session.deleteMany({ where: { OR: [{ orderId: { in: orders } }, { userId: { in: users } }] } }),
      prisma.booking.deleteMany({ where: { id: { in: bookings } } }),
      prisma.order.deleteMany({ where: { id: { in: orders } } }),
      prisma.customer.deleteMany({ where: { userId: { in: users } } }),
      prisma.user.deleteMany({ where: { id: { in: users } } }),
      prisma.product.deleteMany({ where: { id: { in: products } } }),
      prisma.availabilityOverride.deleteMany({ where: { note: TAG } }),
    ]);
    await prisma.$disconnect();
  });

  test.describe("desde Bogotá", () => {
    test.use({ timezoneId: "America/Bogota" });

    test("reserva su lectura en su hora, con sus datos de nacimiento, y paga", async ({ page }) => {
      await page.goto("/ana/lectura-human-design/checkout");
      await expect(page.getByText(/Horas en tu zona: Bogotá \(GMT-5\)/)).toBeVisible();
      await pickDay(page, 3);
      // La primera hora libre de ese día, en hora de Bogotá, es la de la API con ?tz=America/Bogota.
      const first = await freeTimes(page).first().textContent();
      await freeTimes(page).first().click();
      await expect(page.getByText(/\(tu hora\) · \d\d:\d\d en Madrid/)).toBeVisible();
      expect(first).toMatch(/^\d\d:\d\d$/);

      await page.fill("#name", "Lucía Bogotá");
      await page.fill("#email", buyer("bogota"));
      // Validación del servidor: un lugar de una letra.
      await page.getByLabel("Fecha de nacimiento").fill("1991-03-03");
      await page.getByLabel("Hora de nacimiento").fill("06:40");
      await page.getByLabel("Lugar de nacimiento").fill("V");
      await acceptConsents(page);
      await page.getByRole("button", { name: /Reservar y pagar/ }).click();
      await expect(page.getByText("Escribe tu lugar de nacimiento")).toBeVisible();
      await expect(page.locator("#name")).toHaveValue("Lucía Bogotá");
      await expect(page.getByLabel(/He leído y acepto/)).toBeChecked();

      await page.getByLabel("Lugar de nacimiento").fill("Valencia, España");
      await page.getByRole("button", { name: /Reservar y pagar/ }).click();
      await page.waitForURL("**/ana/gracias**");
      await expect(page.getByText(/\(hora de Bogotá\)/)).toBeVisible();

      const confirm = await lastMail(buyer("bogota"), "BOOKING_CONFIRMED");
      expect(confirm?.html).toContain("(hora de Bogotá)");
      const prisma = new PrismaClient();
      const owner = await prisma.emailMessage.findFirst({ where: { template: "BOOKING_OWNER", html: { contains: "Lucía Bogotá" } } });
      const booking = await prisma.booking.findFirstOrThrow({ where: { customer: { email: buyer("bogota") } } });
      await prisma.$disconnect();
      expect(owner?.subject).toMatch(/^Nueva reserva: Lucía Bogotá/);
      expect(owner?.html).toContain("Valencia");
      expect(owner?.html).toContain("para ella");
      expect(booking.customerTimezone).toBe("America/Bogota");
    });
  });

  test("Cirella ve la reserva con sus datos, cambia el enlace de Zoom y le avisa", async ({ page }) => {
    await demoLogin(page, "Cirella");
    await page.goto("/panel/reservas");
    const card = page.locator(".card", { hasText: "Lucía Bogotá" }).first();
    await expect(card.getByText("Datos ✓")).toBeVisible();
    await expect(card.getByText(/para ella, .*en Bogotá/i)).toBeVisible();
    await card.getByRole("link", { name: /Cambiar o cancelar/ }).click();
    await page.waitForURL(/\/panel\/reservas\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "Lucía Bogotá" })).toBeVisible();
    await expect(page.getByText("Valencia, España")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible();
    await page.getByLabel("Enlace de Zoom de esta sesión").fill("https://us02web.zoom.us/j/7777777");
    await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
    await expect(page.getByText("Le hemos enviado el enlace nuevo por email")).toBeVisible();
    const mail = await lastMail(buyer("bogota"), "MEETING_LINK_CHANGED");
    expect(mail?.html).toContain("/j/7777777");
  });

  test("fechas especiales en hora de Bali: ese día solo esas horas", async ({ page }) => {
    // A partir del día 15: antes, una sesión que se paga en la web no ofrece huecos (lib/withdrawal.ts).
    const day = await freeWorkday(16);
    await demoLogin(page, "Cirella");
    await page.goto("/panel/reservas/horario");
    await page.getByLabel("Desde", { exact: true }).fill(day);
    await page.getByLabel("Desde las").fill("09:00");
    await page.getByLabel("Hasta las").fill("11:00");
    await page.getByLabel("Zona horaria de esas horas").selectOption("Asia/Makassar");
    // Antes de guardar, cómo quedan en su hora de siempre.
    await expect(page.locator("[data-special-preview]")).toHaveText(/^9:00–11:00 en Bali \(.+ en España\)$/);
    await page.getByLabel(/^Nota/).fill(TAG);
    await page.getByRole("button", { name: "Guardar fechas especiales" }).click();
    await expect(page.getByText("Fecha especial guardada")).toBeVisible();
    await expect(page.getByText(/9:00–11:00 en Bali \(\d+:00–\d+:00( del día anterior)? en España\)/).first()).toBeVisible();

    const prisma = new PrismaClient();
    const hd = await prisma.product.findFirstOrThrow({ where: { slug: "lectura-human-design" } });
    await prisma.$disconnect();
    const res = await page.request.get(`/api/slots?productId=${hd.id}&tz=Europe/Madrid`);
    const data = (await res.json()) as { days: { date: string; slots: { start: string }[] }[] };
    // Ese día no hay horario semanal: 75 min + 15 de margen de 9:00 a 11:00 de Bali → solo las 9:00 de Bali.
    expect(data.days.find((d) => d.date === day)?.slots.map((s) => s.start)).toEqual([zonedTimeToUtc(day, 9 * 60, "Asia/Makassar").toISOString()]);

    // Se quita la suya (la demo tiene además su viaje a Bali sembrado).
    const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
    const remove = page.getByRole("button", { name: `Quitar la fecha especial del ${label}` });
    await remove.click();
    await expect(remove).toHaveCount(0);
  });

  test("«Dar una sesión o lectura»: regalo a otra hora; ella completa sus datos y Cirella recibe el aviso", async ({ page, browser }) => {
    const day = await freeWorkday(6);
    await demoLogin(page, "Cirella");
    await page.goto("/panel/reservas");
    await page.getByRole("link", { name: /Dar una sesión o lectura/ }).click();
    await page.getByLabel("Email", { exact: true }).fill(buyer("regalo"));
    await page.getByLabel("Nombre", { exact: true }).fill("Marta Regalo");
    await page.getByLabel("Sesión o lectura").selectOption({ label: "Lectura de Human Design" });
    await page.getByText("Otra fecha y hora").click();
    await page.getByLabel("Día").fill(day);
    await page.getByLabel("Hora (la tuya)").fill("21:30");
    await page.getByText("Se los pido por email").click();
    await page.getByLabel(/^Para /).fill("¡Feliz cumpleaños!");
    await page.getByRole("button", { name: "Dar sesión" }).click();
    await page.waitForURL(/\/panel\/reservas\/[^/?]+\?ok=dada/);
    await expect(page.getByText("Sesión dada. Le hemos enviado un email.")).toBeVisible();
    await expect(page.getByText("Regalo", { exact: true })).toBeVisible();

    const mail = await lastMail(buyer("regalo"), "BOOKING_CONFIRMED");
    expect(mail?.subject).toMatch(/^Cirella te ha reservado una sesión/);
    expect(mail?.html).toContain("Completa tus datos para la lectura");
    const client = await (await browser.newContext({ baseURL: SALES })).newPage();
    await client.goto(ctaUrl(mail!.html));
    await client.waitForURL("**/cuenta/sesiones/**");
    await expect(client.getByRole("heading", { name: "Completa tus datos para la lectura" })).toBeVisible();
    await client.getByLabel(/Fecha de nacimiento/).fill("1990-05-10");
    await client.getByText("No sé la hora exacta").click();
    await client.getByLabel("Lugar de nacimiento").fill("Sevilla, España");
    await client.getByRole("button", { name: "Guardar" }).click();
    await expect(client.getByText("Datos guardados")).toBeVisible();
    await client.context().close();
    const prisma = new PrismaClient();
    const notice = await prisma.emailMessage.findFirst({ where: { template: "INTAKE_UPDATED", subject: { startsWith: "Marta Regalo" } } });
    await prisma.$disconnect();
    expect(notice?.subject).toBe("Marta Regalo te ha enviado sus datos");
  });

  test("entrega: Cirella sube la grabación de una lectura y la clienta la escucha en su área", async ({ page, browser }) => {
    const buyerPage = await (await browser.newContext({ baseURL: SALES })).newPage();
    await buyerPage.goto(`/ana/${readingSlug}/checkout`);
    await buyerPage.fill("#name", "Inés Lectura");
    await buyerPage.fill("#email", buyer("lectura"));
    await buyerPage.getByLabel("Lugar de nacimiento").fill("Bilbao, España");
    await buyerPage.getByLabel(/Fecha de nacimiento/).fill("1988-01-02");
    await buyerPage.getByText("No sé la hora exacta").click();
    await acceptConsents(buyerPage);
    await buyerPage.getByRole("button", { name: /^Pagar 45/ }).click();
    await buyerPage.waitForURL("**/ana/gracias**");

    await demoLogin(page, "Cirella");
    await page.goto("/panel/reservas");
    await page.locator("section", { has: page.getByRole("heading", { name: "Lecturas por entregar" }) }).getByRole("link", { name: /Inés Lectura/ }).click();
    await page.waitForURL(/\/panel\/ventas\/[^/?#]+/);
    await expect(page.getByRole("heading", { name: "Entrega para Inés" })).toBeVisible();
    await expect(page.getByText("Bilbao, España")).toBeVisible();
    await page.getByLabel("Subir archivo para la entrega").setInputFiles({ name: "Tu lectura.wav", mimeType: "audio/wav", buffer: makeWav(3) });
    await expect(page.getByText("Tu lectura.wav")).toBeVisible();
    await expect(page.getByText("Borrador")).toBeVisible();
    await page.getByRole("textbox", { name: "Mensaje para Inés", exact: true }).fill("Aquí tienes tu lectura, Inés.");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Enviar a Inés" }).click();
    await expect(page.getByText("Enviado. Le hemos mandado un email con el enlace.")).toBeVisible();

    const mail = await lastMail(buyer("lectura"), "READING_DELIVERED");
    expect(mail?.subject).toMatch(/^Tu lectura está lista/);
    await buyerPage.context().clearCookies();
    await buyerPage.goto(ctaUrl(mail!.html));
    await buyerPage.waitForURL("**/cuenta/pedidos/**");
    await expect(buyerPage.getByRole("heading", { name: "Tu lectura" })).toBeVisible();
    await expect(buyerPage.getByText("Aquí tienes tu lectura, Inés.")).toBeVisible();
    await expect(buyerPage.locator("audio")).toHaveCount(1);
    await buyerPage.context().close();
  });

  test("taller con 2 plazas: se llena y la hora no se ofrece para sesiones 1:1", async ({ browser, page }) => {
    for (const n of [1, 2]) {
      const p = await (await browser.newContext({ baseURL: SALES })).newPage();
      await p.goto(`/ana/${workshopSlug}`);
      await expect(p.getByText(n === 1 ? "Quedan 2 plazas" : "Quedan 1 plaza")).toBeVisible();
      await p.goto(`/ana/${workshopSlug}/checkout`);
      await expect(p.getByText("Fecha del taller")).toBeVisible();
      await p.fill("#name", `Asistente ${n}`);
      await p.fill("#email", buyer(`taller${n}`));
      await acceptConsents(p);
      await p.getByRole("button", { name: /Reservar y pagar/ }).click();
      await p.waitForURL("**/ana/gracias**");
      await p.context().close();
    }
    await page.goto(`/ana/${workshopSlug}`);
    await expect(page.getByText("Completo: no quedan plazas.")).toBeVisible();
    await page.goto(`/ana/${workshopSlug}/checkout`);
    await expect(page.getByRole("button", { name: "Completo" })).toBeDisabled();

    const prisma = new PrismaClient();
    const w = await prisma.product.findFirstOrThrow({ where: { slug: workshopSlug } });
    const one = await prisma.product.findFirstOrThrow({ where: { slug: "sesion-1-1" } });
    await prisma.$disconnect();
    const res = await page.request.get(`/api/slots?productId=${one.id}&tz=Europe/Madrid`);
    const data = (await res.json()) as { days: { slots: { start: string }[] }[] };
    const starts = data.days.flatMap((d) => d.slots.map((s) => Date.parse(s.start)));
    const t = w.eventStartAt!.getTime();
    expect(starts.some((s) => s < t + 90 * 60000 && s + 60 * 60000 > t)).toBe(false);

    await demoLogin(page, "Cirella");
    await page.goto(`/panel/productos/${w.id}`);
    await expect(page.getByRole("heading", { name: "Asistentes 2 de 2" })).toBeVisible();
  });
});
