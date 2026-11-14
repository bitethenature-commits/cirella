import { mobileNav, panelNav, PLATFORM_NAV_FLAGS, PANEL_NAV, MOBILE_NAV } from "../../app/panel/nav-items";
import { PERSONAL_THIRD_PARTY_TEXT, currentPersonalPrivacy, parseLegalText, renderPersonalPrivacy } from "../../lib/legal-templates";
import { isPublicUsernameAllowed, ownerRootRedirect, personalOwnerFromEnv } from "../../lib/personal-routing";
import { parseSetupArgs, PERSONAL_PLAN, readFlags } from "../../lib/personal-setup";
import { planFeatures } from "../../lib/plans";
import { resolveSiteBrand } from "../../lib/site-brand";
import { resolveOwnerUsername, resolveSiteMode } from "../../lib/site-mode";
import { PRODUCT_TYPES } from "../../lib/types";
import { eq, test } from "./harness";

// ── Modo y dueña desde el entorno (middleware): la misma regla que lib/site-mode
for (const [mode, owner] of [
  [undefined, "ana"],
  ["platform", "ana"],
  ["personal", "ana"],
  ["personal", " @Cirella "],
  ["personal", ""],
  [" personal ", "ana"],
  ["Personal", "ana"],
] as const)
  test(`personalOwnerFromEnv(${JSON.stringify(mode)}, ${JSON.stringify(owner)}) = resolveOwnerUsername(resolveSiteMode(…))`, () =>
    eq(personalOwnerFromEnv(mode, owner), resolveOwnerUsername(resolveSiteMode(mode), owner)));

// ── /<dueña> → «/»; lo demás no se toca
for (const [path, owner, want] of [
  ["/ana", "ana", "/"],
  ["/Cirella", "ana", "/"],
  ["/ana/", "ana", "/"],
  ["/%41na", "ana", "/"],
  ["/ana", null, null],
  ["/", "ana", null],
  ["/maria", "ana", null],
  ["/ana/curso", "ana", null],
  ["/ana/legal", "ana", null],
  ["/ana/icon", "ana", null],
  ["/panel", "ana", null],
  ["/%E0%A4%A", "ana", null],
] as const)
  test(`ownerRootRedirect(${path}, ${owner}) → ${want}`, () => eq(ownerRootRedirect(path, owner), want));

for (const [username, owner, want] of [
  ["ana", "ana", true],
  ["ANA", "ana", true],
  ["maria", "ana", false],
  ["maria", null, true],
  ["%E0%A4%A", "ana", false],
] as const)
  test(`isPublicUsernameAllowed(${username}, ${owner}) → ${want}`, () => eq(isPublicUsernameAllowed(username, owner), want));

// ── Menú del panel
const hrefs = (items: { href: string }[]) => items.map((i) => i.href);
const labels = (items: { label: string }[]) => items.map((i) => i.label);

test("menú de la plataforma: el de siempre", () => {
  eq(panelNav(PLATFORM_NAV_FLAGS), PANEL_NAV);
  eq(mobileNav(PLATFORM_NAV_FLAGS), MOBILE_NAV);
});

test("menú personal: sin Plan, con Publicaciones y Códigos, «Ventas» es «Inscripciones»", () => {
  const items = panelNav({ personal: true, showBookings: true });
  eq(hrefs(items).includes("/panel/plan"), false);
  eq(hrefs(items).includes("/panel/publicaciones"), true);
  eq(hrefs(items).includes("/panel/codigos"), true);
  eq(items.find((i) => i.href === "/panel/ventas")?.label, "Inscripciones");
  eq(labels(items).includes("Ventas"), false);
  eq(hrefs(items).includes("/panel/reservas"), true);
});

test("menú personal: «Cursos» y «Comunidad» justo después de Productos (en la plataforma, no)", () => {
  const h = hrefs(panelNav({ personal: true, showBookings: true }));
  eq(h.slice(h.indexOf("/panel/productos"), h.indexOf("/panel/productos") + 3), ["/panel/productos", "/panel/cursos", "/panel/comunidad"]);
  eq(hrefs(PANEL_NAV).includes("/panel/cursos"), false);
});

test("menú personal sin sesiones con reserva aquí: sin Reservas", () => {
  eq(hrefs(panelNav({ personal: true, showBookings: false })).includes("/panel/reservas"), false);
});

test("barra del móvil personal: 5 accesos, con Inscripciones y «Más» al final", () => {
  const items = mobileNav({ personal: true, showBookings: false });
  eq(items.length, 5);
  eq(items.at(-1)?.href, "/panel/mas");
  eq(labels(items).includes("Inscripciones"), true);
});

// ── Marca
const base = { platformName: "Cirella", supportEmail: "hola@cirella.app" };
const owner = { username: "ana", displayName: "Cirella", avatarUrl: "/media/a.webp", email: "ana@cirella.app" };

test("marca en la plataforma: el nombre de la plataforma", () =>
  eq(resolveSiteBrand({ ...base, personal: false, owner: null }), { personal: false, name: "Cirella", avatarUrl: null, ownerUsername: null, supportEmail: "hola@cirella.app" }));

test("marca en modo personal: el nombre y la foto de la página de la dueña", () =>
  eq(resolveSiteBrand({ ...base, personal: true, owner }), { personal: true, name: "Cirella", avatarUrl: "/media/a.webp", ownerUsername: "ana", supportEmail: "ana@cirella.app" }));

test("marca en modo personal con el nombre vacío: el usuario", () => eq(resolveSiteBrand({ ...base, personal: true, owner: { ...owner, displayName: "  " } }).name, "ana"));

test("marca en modo personal sin la cuenta creada todavía: la de la plataforma", () => eq(resolveSiteBrand({ ...base, personal: true, owner: null }).name, "Cirella"));

// ── Textos legales en modo personal
test("privacidad personal: sin plataforma ni Stripe, con los pagos fuera y los derechos", () => {
  const text = renderPersonalPrivacy({ displayName: "Cirella" });
  eq(/Cirella|Stripe/.test(text), false);
  eq(text.includes("Pagos en otras webs"), true);
  eq(text.includes("www.aepd.es"), true);
  eq(parseLegalText(text).filter((b) => b.kind === "heading").length, 6);
});

test("privacidad personal: manda el texto propio de la dueña", () => {
  eq(currentPersonalPrivacy({ displayName: "Cirella", legalPrivacy: "## Mío\nTexto" }), "## Mío\nTexto");
  eq(currentPersonalPrivacy({ displayName: "Cirella", legalPrivacy: null }), renderPersonalPrivacy({ displayName: "Cirella" }));
});

test("aviso de otras webs: habla de afiliación y de dónde se compra", () => {
  eq(PERSONAL_THIRD_PARTY_TEXT.includes("afiliación"), true);
  eq(PERSONAL_THIRD_PARTY_TEXT.includes("Productos de pago"), true);
});

// ── npm run personal:setup
const personalEnv = { SITE_MODE: "personal", OWNER_USERNAME: "ana" };

test("readFlags: --clave valor y --clave=valor", () =>
  eq(readFlags(["--email", "a@b.es", "--name=Cirella", "--password", "x y z", "--suelto"]), { email: "a@b.es", name: "Cirella", password: "x y z", suelto: "" }));

test("personal:setup: datos correctos", () =>
  eq(parseSetupArgs(["--email", " Cirella@Example.com ", "--name", "Cirella"], personalEnv), {
    ok: true,
    args: { email: "ana@example.com", username: "ana", name: "Cirella", password: null },
  }));

test("personal:setup: se niega en modo plataforma", () => {
  const r = parseSetupArgs(["--email", "a@b.es"], { SITE_MODE: "platform", OWNER_USERNAME: "ana" });
  eq(r.ok, false);
  eq(!r.ok && r.errors[0].startsWith("Este comando solo funciona en modo personal"), true);
});

test("personal:setup: --username distinto de OWNER_USERNAME", () => {
  const r = parseSetupArgs(["--email", "a@b.es", "--username", "maria"], personalEnv);
  eq(!r.ok && r.errors.some((e) => e.includes("no coincide con OWNER_USERNAME")), true);
});

test("personal:setup: sin email, usuario reservado y contraseña corta, todo a la vez", () => {
  const r = parseSetupArgs(["--password", "corta"], { SITE_MODE: "personal", OWNER_USERNAME: "admin" });
  eq(r.ok ? 0 : r.errors.length, 3);
});

test("plan «Personal»: gratis, comisión 0, sin límite, oculto y con todas las funciones", () => {
  eq([PERSONAL_PLAN.priceMonthlyCents, PERSONAL_PLAN.commissionBps, PERSONAL_PLAN.maxProducts, PERSONAL_PLAN.active], [0, 0, null, false]);
  eq(planFeatures({ features: PERSONAL_PLAN.features }), {
    productTypes: [...PRODUCT_TYPES],
    customDesign: true,
    removeBranding: true,
    analytics: "advanced",
    customerArea: true,
    automations: true,
  });
});
