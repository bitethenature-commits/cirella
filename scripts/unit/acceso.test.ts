import { addDays, cuentaRefFromPath, isBuyerPath, maskEmail, orderTargetPath, scopeAllows, sessionSatisfies } from "../../lib/auth-utils";
import { magicLinkEmail, purchaseReceiptEmail } from "../../lib/email/templates";
import { eq, ok, test } from "./harness";

// Destino de una compra en /cuenta
const o = (productType: string) => ({ id: "o1", productType, productId: "p1" });
test("orderTargetPath: curso → su reproductor", () => eq(orderTargetPath(o("COURSE")), "/cuenta/cursos/p1"));
test("orderTargetPath: membresía → su comunidad", () => eq(orderTargetPath(o("MEMBERSHIP")), "/cuenta/membresias/p1"));
test("orderTargetPath: sesión con reserva → la reserva", () => eq(orderTargetPath(o("SESSION"), "b1"), "/cuenta/sesiones/b1"));
test("orderTargetPath: sesión sin reserva → «Tu compra»", () => eq(orderTargetPath(o("SESSION"), null), "/cuenta/pedidos/o1"));
test("orderTargetPath: digital → «Tu compra»", () => eq(orderTargetPath(o("DIGITAL")), "/cuenta/pedidos/o1"));

// A qué apunta una ruta de /cuenta
for (const [path, want] of [
  ["/cuenta/cursos/abc?leccion=x", { kind: "product", id: "abc" }],
  ["/cuenta/membresias/m1", { kind: "product", id: "m1" }],
  ["/cuenta/sesiones/b1/ics", { kind: "booking", id: "b1" }],
  ["/cuenta/pedidos/o1", { kind: "order", id: "o1" }],
  ["/cuenta/archivos/f1", { kind: "file", id: "f1" }],
  ["/cuenta/archivos", null],
  ["/cuenta", null],
  ["/cuenta/compras", null],
  ["/panel", null],
] as const)
  test(`cuentaRefFromPath(${JSON.stringify(path)})`, () => eq(cuentaRefFromPath(path), want));

// Alcance de una sesión limitada al pedido o1 (producto p1)
const scope = { orderId: "o1", productId: "p1" };
for (const [target, want] of [
  [{ orderId: "o1" }, true],
  [{ orderId: "o2" }, false],
  [{ productId: "p1" }, true],
  [{ productId: "p2" }, false],
  [{ bookingOrderId: "o1" }, true],
  [{ bookingOrderId: "o2" }, false],
  // Una reserva anterior de la misma dueña (otro pedido o hecha a mano) nunca se muestra.
  [{ bookingOrderId: null }, false],
  [{}, false],
] as const)
  test(`scopeAllows(${JSON.stringify(target)}) → ${want}`, () => eq(scopeAllows(scope, target), want));

// ¿Basta la sesión para la ruta?
const verified = { verified: true, scoped: false };
const scoped = { verified: false, scoped: true };
const account = { verified: false, scoped: false };
test("sessionSatisfies: verificada abre /cuenta y /panel", () => eq([sessionSatisfies(verified, "/cuenta"), sessionSatisfies(verified, "/panel")], [true, true]));
test("sessionSatisfies: limitada no abre /cuenta ni /panel", () => eq([sessionSatisfies(scoped, "/cuenta"), sessionSatisfies(scoped, "/panel")], [false, false]));
test("sessionSatisfies: de cuenta sin verificar abre /panel pero no el área de cliente", () =>
  eq([sessionSatisfies(account, "/panel"), sessionSatisfies(account, "/cuenta"), sessionSatisfies(account, "/api/download/x")], [true, false, false]));
test("isBuyerPath exige el prefijo exacto", () =>
  eq([isBuyerPath("/cuenta"), isBuyerPath("/cuenta/compras"), isBuyerPath("/cuenta?x=1"), isBuyerPath("/cuentas"), isBuyerPath("/onboarding")], [true, true, true, false, false]));

test("maskEmail oculta el usuario", () => eq(maskEmail("paula@example.com"), "pa•••@example.com"));
test("addDays suma días exactos", () => {
  const d = new Date("2026-10-01T10:00:00Z");
  eq(addDays(d, 14).getTime() - d.getTime(), 14 * 86_400_000);
});

// Plantillas
test("magicLinkEmail: el de entrar dura 1 hora y pide pulsar «Entrar»", () => {
  const m = magicLinkEmail({ url: "https://x/auth/magic?token=t" });
  eq(m.subject, "Tu enlace para entrar");
  ok(m.html.includes("1 hora") && m.html.includes("Entrar a mi cuenta"));
});
test("magicLinkEmail: el de confirmar explica «No he sido yo» y lleva la marca", () => {
  const m = magicLinkEmail({ url: "https://x", creatorName: "Cirella", purpose: "VERIFY_SIGNUP" });
  eq(m.subject, "Confirma tu email en Cirella");
  ok(m.html.includes("No he sido yo") && m.html.includes("Cirella") && m.html.includes("Confirmar mi email"));
});
test("purchaseReceiptEmail pinta la nota del enlace personal escapada", () => {
  const m = purchaseReceiptEmail({ creatorName: "Cirella", productTitle: "PDF", amount: "9 €", orderId: "o1", accountUrl: "https://x/auth/enlace?t=a", linkNote: "Este enlace es personal <b>" });
  ok(m.html.includes("Este enlace es personal &lt;b&gt;") && m.html.includes("No necesitas contraseña"));
});
