import {
  checkoutDeliveryBadge,
  deliveryIssue,
  deliveryIssueCopy,
  deliveryIssueHref,
  digitalContentText,
  isInstantDelivery,
  normalizeDeliveryMode,
  type DeliveryFacts,
} from "../../lib/delivery";
import { eq, ok, test } from "./harness";

const facts = (f: Partial<DeliveryFacts>): DeliveryFacts => ({ type: "DIGITAL", deliveryMode: "AUTOMATIC", instructions: null, files: 0, lessons: 0, posts: 0, ...f });

// Qué falta para poder publicar, por tipo
test("deliveryIssue: digital sin archivos → NO_CONTENT bloqueante", () =>
  eq(deliveryIssue(facts({ files: 0 })), { code: "NO_CONTENT", blocking: true, anchor: "entrega" }));
test("deliveryIssue: digital con un archivo → nada", () => eq(deliveryIssue(facts({ files: 1 })), null));
for (const instructions of [null, "", "corto", "         .  "])
  test(`deliveryIssue: entrega personal con instrucciones ${JSON.stringify(instructions)} → NO_INSTRUCTIONS`, () =>
    eq(deliveryIssue(facts({ deliveryMode: "PERSONAL", instructions })), { code: "NO_INSTRUCTIONS", blocking: true, anchor: "entrega" }));
test("deliveryIssue: entrega personal explicada → nada", () =>
  eq(deliveryIssue(facts({ deliveryMode: "PERSONAL", instructions: "Te lo envío por email en 3 días" })), null));
test("deliveryIssue: entrega personal con archivos pero sin instrucciones → NO_INSTRUCTIONS", () =>
  eq(deliveryIssue(facts({ deliveryMode: "PERSONAL", files: 2 }))?.code, "NO_INSTRUCTIONS"));
test("deliveryIssue: curso sin lecciones → NO_LESSONS bloqueante", () =>
  eq(deliveryIssue(facts({ type: "COURSE", files: 3 })), { code: "NO_LESSONS", blocking: true, anchor: "lecciones" }));
test("deliveryIssue: curso con lecciones → nada", () => eq(deliveryIssue(facts({ type: "COURSE", lessons: 2 })), null));
test("deliveryIssue: membresía sin publicaciones → solo aviso", () =>
  eq(deliveryIssue(facts({ type: "MEMBERSHIP" })), { code: "NO_POSTS", blocking: false, anchor: "publicaciones" }));
test("deliveryIssue: sesión → nada", () => eq(deliveryIssue(facts({ type: "SESSION" })), null));
test("deliveryIssue: sesión con modo PERSONAL (no válido) → nada", () => eq(deliveryIssue(facts({ type: "SESSION", deliveryMode: "PERSONAL" })), null));
test("deliveryIssue: curso con modo PERSONAL se trata como automático", () =>
  eq(deliveryIssue(facts({ type: "COURSE", deliveryMode: "PERSONAL", instructions: "Te lo envío todo por email" }))?.code, "NO_LESSONS"));

test("normalizeDeliveryMode: solo un digital puede ser PERSONAL", () => {
  eq(normalizeDeliveryMode("DIGITAL", "PERSONAL"), "PERSONAL");
  eq(normalizeDeliveryMode("COURSE", "PERSONAL"), "AUTOMATIC");
  eq(normalizeDeliveryMode("DIGITAL", "otro"), "AUTOMATIC");
  eq(normalizeDeliveryMode("DIGITAL", null), "AUTOMATIC");
});

// Lo que se promete en la ficha
for (const [files, want] of [
  [[], null],
  [[{ kind: "PDF" }], "1 archivo descargable"],
  [[{ kind: "PDF" }, { kind: "AUDIO" }], "2 archivos descargables"],
  [[{ kind: "LINK" }], "1 enlace"],
  [[{ kind: "LINK" }, { kind: "LINK" }], "2 enlaces"],
  [[{ kind: "PDF" }, { kind: "LINK" }, { kind: "LINK" }], "1 archivo descargable y 2 enlaces"],
] as const)
  test(`digitalContentText(${files.map((f) => f.kind).join(",") || "vacío"}) → ${want}`, () => {
    const got = digitalContentText([...files]);
    eq(got, want);
    ok(!got?.includes("Contenido"), "nunca «Contenido archivos descargables»");
  });

for (const [type, mode, badge, instant] of [
  ["DIGITAL", "AUTOMATIC", "Acceso inmediato", true],
  ["DIGITAL", "PERSONAL", "Preparado para ti", false],
  ["SESSION", "AUTOMATIC", "Confirmación inmediata", false],
  ["COURSE", "AUTOMATIC", "Acceso inmediato", true],
  ["MEMBERSHIP", "PERSONAL", "Acceso inmediato", true],
] as const)
  test(`checkoutDeliveryBadge/isInstantDelivery ${type}+${mode} → «${badge}»/${instant}`, () => {
    eq(checkoutDeliveryBadge(type, mode), badge);
    eq(isInstantDelivery(type, mode), instant);
  });

test("deliveryIssueHref lleva a la sección que falta (las lecciones, al estudio de cursos)", () => {
  eq(deliveryIssueHref("p1", { code: "NO_LESSONS", blocking: true, anchor: "lecciones" }), "/panel/cursos/p1");
  eq(deliveryIssueHref("p1", { code: "NO_CONTENT", blocking: true, anchor: "entrega" }), "/panel/productos/p1#entrega");
});
test("deliveryIssueCopy: título con el nombre del producto entre comillas", () =>
  eq(deliveryIssueCopy({ code: "NO_CONTENT", blocking: true, anchor: "entrega" }, "Tirada de 3 cartas").title, "«Tirada de 3 cartas» no tiene nada que entregar"));
test("deliveryIssueCopy: todo aviso bloqueante explica por qué no se publica", () => {
  for (const code of ["NO_CONTENT", "NO_INSTRUCTIONS", "NO_LESSONS"] as const)
    ok(deliveryIssueCopy({ code, blocking: true, anchor: "entrega" }, "X").publishError.startsWith("No se puede publicar todavía"), code);
});
