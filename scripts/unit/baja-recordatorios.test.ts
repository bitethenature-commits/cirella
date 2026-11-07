import { simulatedIdentityFields, maskTaxId } from "../../app/pago-simulado/cuenta/identity";
import { safeHeaders, storedHeaders } from "../../lib/email/headers";
import { previewEmailHtml } from "../../lib/email/preview";
import { buildResendRequest } from "../../lib/email/providers/resend";
import { eq, ok, test } from "./harness";

// ── Baja en un clic (RFC 8058): cabeceras del email ──

const LIST = { "List-Unsubscribe": "<https://cirella.app/baja/recordatorios/un-clic?t=abc>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };

test("safeHeaders deja pasar solo las cabeceras de baja", () => {
  eq(safeHeaders({ ...LIST, Bcc: "otra@example.com", "X-Lo-Que-Sea": "1" }), LIST);
});

test("safeHeaders descarta valores con saltos de línea (inyección de cabeceras)", () => {
  eq(safeHeaders({ "List-Unsubscribe": "<https://x>\r\nBcc: otra@example.com" }), {});
});

test("storedHeaders: JSON vacío, nulo o con otra forma → sin cabeceras", () => {
  eq(storedHeaders(null), undefined);
  eq(storedHeaders({}), undefined);
  eq(storedHeaders(["List-Unsubscribe"]), undefined);
  eq(storedHeaders({ "List-Unsubscribe": 3 }), undefined);
  eq(storedHeaders(LIST), LIST);
});

test("Resend recibe las cabeceras List-Unsubscribe", () => {
  const cfg = { apiKey: "re_x", fromAddress: "hola@cirella.app", defaultFromName: "Cirella" };
  const { init } = buildResendRequest({ id: "m1", to: "a@example.com", subject: "S", html: "<p>h</p>", headers: LIST }, cfg);
  eq(JSON.parse(init.body).headers, LIST);
  const sin = buildResendRequest({ id: "m2", to: "a@example.com", subject: "S", html: "<p>h</p>" }, cfg);
  ok(!("headers" in JSON.parse(sin.init.body)), "sin cabeceras extra no se manda el campo");
});

// ── Buzón de demostración: los enlaces abren fuera del iframe ──

test("previewEmailHtml añade <base target=_top> en el <head>", () => {
  eq(previewEmailHtml("<html><head><title>x</title></head><body>a</body></html>"), '<html><head><base target="_top"><title>x</title></head><body>a</body></html>');
});

test("previewEmailHtml crea el <head> si el email no lo trae", () => {
  eq(previewEmailHtml('<!doctype html><html lang="es"><body>a</body></html>'), '<!doctype html><html lang="es"><head><base target="_top"></head><body>a</body></html>');
  eq(previewEmailHtml("<p>a</p>"), '<base target="_top"><p>a</p>');
});

// ── Alta simulada de Stripe: datos de la creadora, nunca de ejemplo ──

test("maskTaxId deja ver solo los 4 últimos caracteres", () => {
  eq(maskTaxId("12345678Z"), "•••••678Z");
  eq(maskTaxId("b-1234 5678"), "•••••5678");
  eq(maskTaxId("123"), "••••");
});

test("alta simulada con la identidad legal de la creadora (documento enmascarado)", () => {
  const f = simulatedIdentityFields({
    legalEntityType: "INDIVIDUAL",
    legalName: "Ana Luna Pérez",
    legalTaxId: "12345678Z",
    legalAddress: "Calle Luna 3",
    legalPostalCode: "08001",
    legalCity: "Barcelona",
    legalCountry: "ES",
  });
  eq(f.map((x) => x.label), ["Nombre y apellidos", "DNI o NIE", "Dirección", "IBAN"]);
  eq(f[0].value, "Ana Luna Pérez");
  eq(f[1].value, "•••••678Z");
  eq(f[2].value, "Calle Luna 3, 08001 Barcelona (España)");
  eq(f[3].value, null);
  ok(!JSON.stringify(f).includes("12345678Z"), "el documento no se muestra completo");
});

test("alta simulada sin datos legales: textos neutros, sin datos de ejemplo", () => {
  const f = simulatedIdentityFields({ legalEntityType: "COMPANY", legalName: null, legalTaxId: "", legalAddress: null, legalCountry: "ES" });
  eq(f.map((x) => x.label), ["Razón social", "CIF", "Dirección", "IBAN"]);
  ok(f.every((x) => x.value === null && x.placeholder.length > 0));
  ok(!/12345678Z|Calle Mayor|ES91/.test(JSON.stringify(f)));
});
