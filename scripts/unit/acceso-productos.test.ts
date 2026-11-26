import {
  accessModesFor,
  asAccessMode,
  defaultAccessMode,
  defaultExternalLabel,
  externalButtonLabel,
  externalHost,
  hostsContent,
  isNoChargeOrder,
  parseExternalUrl,
  publishPriceError,
  resendDedupeKey,
  resolveAccessMode,
  storedPriceCents,
} from "../../lib/access-mode";
import { deliveryFacts, deliveryIssue } from "../../lib/delivery";
import { accessGrantedEmail, emailBranding, layout, SITE_NAME_TOKEN } from "../../lib/email/templates";
import { RULES } from "../../lib/limits";
import { eq, ok, test } from "./harness";

// ── Modo de acceso de un producto ──
test("asAccessMode: valores conocidos", () => eq([asAccessMode("FREE_EMAIL"), asAccessMode("EXTERNAL"), asAccessMode("PAID")], ["FREE_EMAIL", "EXTERNAL", "PAID"]));
test("asAccessMode: desconocido o vacío → PAID (nunca se regala por error)", () => eq([asAccessMode("GRATIS"), asAccessMode(null), asAccessMode(undefined), asAccessMode("")], ["PAID", "PAID", "PAID", "PAID"]));

test("plataforma: el formulario solo ofrece pago en la web", () => {
  for (const t of ["DIGITAL", "COURSE", "MEMBERSHIP", "SESSION"]) eq(accessModesFor("platform", t), ["PAID"], t);
});
test("web personal: gratis con email y pago fuera (nunca PAID)", () => {
  for (const t of ["DIGITAL", "COURSE", "MEMBERSHIP"]) eq(accessModesFor("personal", t), ["FREE_EMAIL", "EXTERNAL"], t);
});
test("web personal: una sesión solo se reserva fuera (no hay sesión gratis con email)", () => eq(accessModesFor("personal", "SESSION"), ["EXTERNAL"]));
test("producto nuevo: PAID en la plataforma, gratis o externo en la web personal", () =>
  eq([defaultAccessMode("platform", "COURSE"), defaultAccessMode("personal", "COURSE"), defaultAccessMode("personal", "SESSION")], ["PAID", "FREE_EMAIL", "EXTERNAL"]));
test("hostsContent: todo menos las sesiones", () => eq(["DIGITAL", "COURSE", "MEMBERSHIP", "SESSION"].map(hostsContent), [true, true, true, false]));

test("resolveAccessMode: web personal, el elegido si está permitido", () => eq(resolveAccessMode("EXTERNAL", "FREE_EMAIL", "personal", "COURSE"), "EXTERNAL"));
test("resolveAccessMode: web personal, PAID pedido → se queda el actual permitido", () => eq(resolveAccessMode("PAID", "FREE_EMAIL", "personal", "COURSE"), "FREE_EMAIL"));
test("resolveAccessMode: web personal, un producto de pago no cambia sin elegirlo (sin modo en el formulario)", () => eq(resolveAccessMode(undefined, "PAID", "personal", "DIGITAL"), "PAID"));
test("resolveAccessMode: web personal, una sesión gratis pedida → externa", () => eq(resolveAccessMode("FREE_EMAIL", "PAID", "personal", "SESSION"), "EXTERNAL"));
test("resolveAccessMode: plataforma, PAID sigue PAID", () => eq(resolveAccessMode(undefined, "PAID", "platform", "COURSE"), "PAID"));
test("resolveAccessMode: plataforma, un gratis existente (demo) conserva su modo", () => eq(resolveAccessMode(undefined, "FREE_EMAIL", "platform", "COURSE"), "FREE_EMAIL"));
test("resolveAccessMode: plataforma, no se puede pasar a gratis desde el formulario", () => eq(resolveAccessMode("FREE_EMAIL", "PAID", "platform", "COURSE"), "PAID"));

test("publicar: PAID exige 1 €", () => eq(publishPriceError("PAID", 99), "Pon un precio de al menos 1 € para publicarlo"));
test("publicar: PAID con 1 € vale", () => eq(publishPriceError("PAID", 100), null));
test("publicar: gratis no exige precio", () => eq(publishPriceError("FREE_EMAIL", 0), null));
test("publicar: externo sin precio vale (es informativo)", () => eq(publishPriceError("EXTERNAL", 0), null));
test("precio guardado: gratis siempre 0", () => eq(storedPriceCents("FREE_EMAIL", 4900), 0));
test("precio guardado: externo conserva el informativo", () => eq(storedPriceCents("EXTERNAL", 6500), 6500));
test("precio guardado: PAID tal cual", () => eq(storedPriceCents("PAID", 4900), 4900));

// ── Enlace de la web externa ──
test("parseExternalUrl: https válido", () => eq(parseExternalUrl(" https://pay.hotmart.com/X123?off=abc "), { ok: true, url: "https://pay.hotmart.com/X123?off=abc" }));
for (const [raw, fragment] of [
  ["", "Pega el enlace"],
  ["http://calendly.com/ana", "https://"],
  ["javascript:alert(1)", "https://"],
  ["calendly.com/ana", "no es válido"],
  ["https://localhost/x", "no es válido"],
  ["https://usuario:clave@example.com", "no es válido"],
  [`https://example.com/${"a".repeat(600)}`, "demasiado largo"],
] as const)
  test(`parseExternalUrl(${JSON.stringify(raw.slice(0, 40))}) → error`, () => {
    const r = parseExternalUrl(raw);
    ok(!r.ok && r.error.includes(fragment), JSON.stringify(r));
  });
test("externalHost sin www", () => eq([externalHost("https://www.hotmart.com/p"), externalHost("https://calendly.com/ana"), externalHost("nada"), externalHost(null)], ["hotmart.com", "calendly.com", null, null]));
test("botón por defecto: «Reservar en …» para sesiones, «Comprar en …» para el resto", () =>
  eq([defaultExternalLabel("SESSION", "https://calendly.com/ana"), defaultExternalLabel("COURSE", "https://www.hotmart.com/x"), defaultExternalLabel("DIGITAL", null)], [
    "Reservar en calendly.com",
    "Comprar en hotmart.com",
    "Comprar",
  ]));
test("botón: el texto de la dueña manda", () => eq(externalButtonLabel({ type: "SESSION", externalLabel: "Reservar en Calendly", externalUrl: "https://calendly.com/x" }), "Reservar en Calendly"));
test("botón: texto en blanco → el de por defecto", () => eq(externalButtonLabel({ type: "SESSION", externalLabel: "  ", externalUrl: "https://calendly.com/x" }), "Reservar en calendly.com"));

// ── Pedidos sin cobro ──
test("isNoChargeOrder: free y manual sí; simulated y stripe no", () =>
  eq(["free", "manual", "simulated", "stripe"].map((paymentProvider) => isNoChargeOrder({ paymentProvider })), [true, true, false, false]));
test("reenvío del enlace: misma clave dentro del mismo minuto, otra al minuto siguiente", () => {
  const t = new Date("2026-10-15T10:00:10Z");
  eq(resendDedupeKey("o1", t), resendDedupeKey("o1", new Date("2026-10-15T10:00:50Z")));
  ok(resendDedupeKey("o1", t) !== resendDedupeKey("o1", new Date("2026-10-15T10:01:01Z")));
  ok(resendDedupeKey("o1", t) !== `access:o1`, "no choca con la clave del primer email");
});

// ── Entrega: lo que se paga fuera no bloquea la publicación ──
const facts = (o: Partial<Parameters<typeof deliveryIssue>[0]>) => ({ type: "COURSE", deliveryMode: "AUTOMATIC", instructions: null, files: 0, lessons: 0, posts: 0, ...o });
test("curso sin lecciones de pago en la web: bloquea", () => eq(deliveryIssue(facts({}))?.code, "NO_LESSONS"));
test("curso sin lecciones gratis con email: bloquea igual (se entrega aquí)", () => eq(deliveryIssue(facts({ accessMode: "FREE_EMAIL" }))?.code, "NO_LESSONS"));
test("curso sin lecciones que se paga fuera: no bloquea (lo entrega la otra web)", () => eq(deliveryIssue(facts({ accessMode: "EXTERNAL" })), null));
test("digital sin archivos que se paga fuera: no bloquea", () => eq(deliveryIssue(facts({ type: "DIGITAL", accessMode: "EXTERNAL" })), null));
test("deliveryFacts lleva el modo de acceso", () =>
  eq(deliveryFacts({ type: "DIGITAL", deliveryMode: "AUTOMATIC", instructions: null, accessMode: "EXTERNAL", _count: { files: 0, lessons: 0, posts: 0 } }).accessMode, "EXTERNAL"));

// ── Emails: marca y email de acceso ──
test("marca de la plataforma: Cirella con su pie", () => {
  const b = emailBranding("platform");
  eq(b.name, "Cirella");
  ok(b.footer.includes("Enviado con Cirella"));
});
test("marca de la web personal: sin Cirella ni pie (el nombre lo pone el outbox)", () => {
  const b = emailBranding("personal");
  eq(b, { name: SITE_NAME_TOKEN, footer: "" });
  ok(!b.name.includes("Cirella"));
});
test("layout con marca propia y pie vacío: no pinta pie", () => {
  const html = layout({ brand: "Cirella", title: "Hola", body: "x", footer: "" });
  ok(html.includes("Cirella") && !html.includes("Enviado con"), html);
});
test("email de acceso: asunto «Ya tienes acceso a «X»» y botón directo al curso", () => {
  const m = accessGrantedEmail({ name: "Lucía", creatorName: "Cirella", productTitle: "Mini-curso", productType: "COURSE", url: "https://a.es/auth/link?t=1", linkNote: "Personal" });
  eq(m.subject, "Ya tienes acceso a «Mini-curso»");
  ok(m.html.includes(">Empezar el curso</a>") && m.html.includes("https://a.es/auth/link?t=1"), m.html);
  ok(!/IVA|factura|Total/.test(m.html), "sin importes, IVA ni factura");
});
test("email de acceso: membresía y descarga con su botón", () => {
  const base = { creatorName: "Cirella", productTitle: "X", url: "https://a.es/e" };
  ok(accessGrantedEmail({ ...base, productType: "MEMBERSHIP" }).html.includes(">Entrar en la comunidad</a>"));
  ok(accessGrantedEmail({ ...base, productType: "DIGITAL" }).html.includes(">Acceder a mi contenido</a>"));
});
test("email de acceso: escapa el nombre y las instrucciones", () => {
  const m = accessGrantedEmail({ name: "<b>Eva</b>", creatorName: "Cirella", productTitle: "X", productType: "DIGITAL", url: "https://a.es/e", instructions: "<script>" });
  ok(!m.html.includes("<b>Eva</b>") && !m.html.includes("<script>"), m.html);
});

// ── Límites de intentos del formulario gratis ──
test("límites del formulario gratis: por email más estricto que por conexión", () => {
  ok(RULES.freeClaimEmail.limit < RULES.freeClaimIp.limit);
  ok(RULES.freeClaimEmail.windowSec >= 3600 && RULES.freeClaimIp.windowSec >= 3600);
});
