import { Prisma, PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Modo personal: lo que se vio al grabar la demo (servidor del puerto 3101, mismo build y BD).
 *   · un producto de pago en la web (oculto en la web personal) no se enlaza desde la página, sale
 *     como «Oculto» en el panel y guardarlo no lo regala;
 *   · la duración del curso en español, el código de descuento sin partirse al copiarlo y el login
 *     sin hablar de compras.
 * Los datos que crea los borra al terminar.
 */

const PERSONAL = process.env.E2E_PERSONAL_URL ?? "http://localhost:3101";
test.use({ baseURL: PERSONAL });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `personal-demo-${stamp}`;
let paidId = "";

test.beforeAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  // Una lectura de pago en la web, como las de la demo: en la web personal no se ve.
  const p = await prisma.product.create({
    data: { creatorId: ana.id, type: "DIGITAL", slug: TAG, title: `Lectura de prueba ${stamp}`, priceCents: 4900, status: "PUBLISHED", accessMode: "PAID", sortOrder: 98 },
  });
  await prisma.productFile.create({ data: { creatorId: ana.id, productId: p.id, name: "Lectura en PDF", kind: "LINK", url: "https://example.com/lectura.pdf" } });
  paidId = p.id;
});

test.afterAll(async () => {
  if (paidId) {
    await prisma.productFile.deleteMany({ where: { productId: paidId } });
    await prisma.product.deleteMany({ where: { id: paidId } });
  }
  await prisma.$disconnect();
});

async function ownerLogin(page: Page) {
  await page.goto("/login");
  await page.fill("#email", "ana@cirella.app");
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("Modo personal · detalles de la demo", () => {
  test("la página no enlaza los productos ocultos (botones principales y accesos a un curso de pago)", async ({ page }) => {
    // La demo ya no trae botones principales: se añaden aquí uno a un curso de pago (oculto sin cobros) y otro normal.
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const before = ana.pagePublished;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = structuredClone((before ?? ana.pageDraft) as any);
    cfg.links = [
      { id: "l1", label: `✨ Empieza aquí ${stamp}`, url: "/ana/know-your-energy", highlight: true },
      { id: "l2", label: `Podcast «Cielo interior» ${stamp}`, url: "https://open.spotify.com" },
    ];
    cfg.bubbles = [...(cfg.bubbles ?? []).slice(0, 2), { id: "b-oculto", label: `Curso ${stamp}`, url: "/ana/know-your-energy", image: null }];
    cfg.sections = cfg.sections.map((x: { key: string; enabled: boolean }) => (x.key === "links" ? { ...x, enabled: true } : x));
    await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: cfg } });
    try {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Cirella", level: 1 })).toBeVisible();
      // /ana/know-your-energy en la web personal sin cobros da 404: ni botón ni burbuja.
      await expect(page.locator('a[href="/ana/know-your-energy"]')).toHaveCount(0);
      await expect(page.getByText(/Empieza aquí/)).toHaveCount(0);
      await expect(page.getByText(`Curso ${stamp}`)).toHaveCount(0);
      // Los demás siguen ahí.
      await expect(page.getByRole("link", { name: new RegExp(`Podcast «Cielo interior» ${stamp}`) })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Accesos" }).getByRole("link")).toHaveCount(2);
    } finally {
      await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: before === null ? Prisma.DbNull : (before as Prisma.InputJsonValue) } });
    }
  });

  test("la duración del mini-curso se escribe en minutos", async ({ page }) => {
    await page.goto("/ana/natal-chart-in-3-steps");
    await expect(page.getByText("3 lecciones · 30 min").first()).toBeVisible();
    await expect(page.getByText("0.5 h")).toHaveCount(0);
  });

  test("el login no habla de compras (el general y el de «Mi área»)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("¿No tienes contraseña?")).toBeVisible();
    await expect(page.getByText(/compr/i)).toHaveCount(0);
    for (const path of ["/ana/login?next=%2Farea", "/ana/login?next=%2Farea&motivo=completa", "/ana/login?next=%2Farea&motivo=confirmar"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Entra a tu área" })).toBeVisible();
      await expect(page.getByText(/compr/i), path).toHaveCount(0);
    }
    await expect(page.getByText("Confirma tu email para ver tu contenido.")).toBeVisible();
  });

  test("un bloque de texto con botón a un producto oculto: se ve el texto, no el botón", async ({ page }) => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const before = ana.pagePublished;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = structuredClone((before ?? ana.pageDraft) as any);
    const block = (id: string, buttonUrl: string) => ({ id, title: `Bloque ${id} ${stamp}`, body: "Texto del bloque.", buttonLabel: `Botón ${id}`, buttonUrl, enabled: true });
    cfg.blocks = [
      ...(cfg.blocks ?? []),
      block("oculto", "/ana/know-your-energy"),
      // Sin https:// y con la dirección de la propia web: la página lo pinta como https://localhost:3101/…
      block("sin-esquema", `${new URL(PERSONAL).host}/ana/know-your-energy`),
      block("visible", "/ana/natal-chart-in-3-steps"),
    ];
    if (!cfg.sections?.some((x: { key: string }) => x.key === "blocks")) cfg.sections = [...(cfg.sections ?? []), { key: "blocks", enabled: true }];
    else cfg.sections = cfg.sections.map((x: { key: string; enabled: boolean }) => (x.key === "blocks" ? { ...x, enabled: true } : x));
    await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: cfg } });
    try {
      await page.goto("/");
      for (const id of ["oculto", "sin-esquema"]) {
        await expect(page.getByText(`Bloque ${id} ${stamp}`)).toBeVisible();
        await expect(page.getByRole("link", { name: `Botón ${id}` })).toHaveCount(0);
      }
      await expect(page.getByRole("link", { name: "Botón visible" })).toHaveAttribute("href", "/ana/natal-chart-in-3-steps");
    } finally {
      await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: before === null ? Prisma.DbNull : (before as Prisma.InputJsonValue) } });
    }
  });

  test("panel: lo que se cobraba en la web sale como oculto y guardarlo no lo regala", async ({ page }) => {
    await ownerLogin(page);
    await page.goto("/panel/productos");
    await expect(page.getByText(/tu plan/)).toHaveCount(0);
    const row = page.locator(".card", { hasText: `Lectura de prueba ${stamp}` });
    await expect(row.getByText("Oculto: se cobraba en la web")).toBeVisible();
    await expect(row.getByText("Publicado")).toHaveCount(0);
    // «Ver» va oculto con CSS en el móvil: se busca por su dirección (cuenta aunque no se vea).
    await expect(row.locator(`a[href="/ana/${TAG}"]`)).toHaveCount(0);
    const free = page.locator(".card", { hasText: "Mini-curso gratis" });
    await expect(free.locator('a[href="/ana/natal-chart-in-3-steps"]')).toHaveCount(1);

    // «Orden de productos» del editor: solo lo que se ve en la página.
    await page.goto("/panel/pagina");
    await page.getByRole("button", { name: "Secciones", exact: true }).click();
    const order = page.locator("section", { has: page.getByRole("heading", { name: "Orden de productos" }) });
    await expect(order.getByText("Mini-curso gratis")).toBeVisible();
    await expect(order.getByText(`Lectura de prueba ${stamp}`)).toHaveCount(0);
    await expect(order.getByText("Lectura de Astrología")).toHaveCount(0);

    await page.goto(`/panel/productos/${paidId}`);
    const modes = page.getByRole("radiogroup", { name: "Cómo se consigue" });
    await expect(modes.getByRole("radio", { name: /Oculto: se cobraba en la web/ })).toBeChecked();
    await expect(modes.getByRole("radio", { name: /Gratis con email/ })).not.toBeChecked();
    await expect(page.getByText("IVA incluido")).toHaveCount(0);

    // Cambiar solo el título y guardar: sigue de pago (oculto) y con su precio.
    await page.locator('input[name="title"]').fill(`Lectura de prueba ${stamp} (editada)`);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText(/No se ve en tu página/)).toBeVisible();
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: paidId } });
    expect(saved.title).toBe(`Lectura de prueba ${stamp} (editada)`);
    expect(saved.accessMode).toBe("PAID");
    expect(saved.priceCents).toBe(4900);

    // Elegir «Gratis con email» a propósito sí lo cambia.
    await modes.getByText("Gratis con email", { exact: true }).click();
    await expect(modes.getByRole("radio", { name: /Gratis con email/ })).toBeChecked();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Guardado y publicado en tu página")).toBeVisible();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: paidId } })).accessMode).toBe("FREE_EMAIL");
  });

  test.describe("en el móvil", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("el código de descuento no se parte al pulsar «Copiar código»", async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: PERSONAL });
      await page.goto("/");
      const card = page.getByRole("article", { name: "Código de descuento de Velas Alba" });
      await card.scrollIntoViewIfNeeded();
      const code = card.locator("code");
      const before = await code.boundingBox();
      await card.getByRole("button", { name: "Copiar código CIRELLA15" }).click();
      await expect(card.getByRole("button", { name: /Copiado/ })).toBeVisible();
      const after = await code.boundingBox();
      expect(after?.height).toBe(before?.height);
      expect(after?.width).toBe(before?.width);
      // Una sola línea de texto («CIRELLA15», no «CIRELLA1 / 5»).
      const lines = await code.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      });
      expect(lines).toBe(1);
    });
  });
});
