import { buildResendRequest } from "../../lib/email/providers/resend";
import { simulatedEmailOutcome } from "../../lib/email/providers/log";
import {
  chargeKey,
  classifyHttpFailure,
  formatFrom,
  isStale,
  MAX_ATTEMPTS,
  nextAttemptAt,
  parseFromAddress,
  planFeeKey,
  renewalKey,
  truncateError,
} from "../../lib/reliability";
import { eq, ok, test } from "./harness";

const t0 = new Date("2026-10-01T10:00:00.000Z");
const plus = (min: number) => new Date(t0.getTime() + min * 60_000);

// ── Reintentos con backoff ──
test("MAX_ATTEMPTS es 6 (1 intento + 5 reintentos)", () => eq(MAX_ATTEMPTS, 6));
for (const [done, min] of [[1, 1], [2, 5], [3, 30], [4, 120], [5, 720]] as const)
  test(`nextAttemptAt(${done}) → +${min} min`, () => eq(nextAttemptAt(done, t0), plus(min)));
test("nextAttemptAt(6) → null (agotado)", () => eq(nextAttemptAt(6, t0), null));
test("nextAttemptAt(7) → null", () => eq(nextAttemptAt(7, t0), null));

// ── Clasificación de fallos HTTP ──
for (const status of [400, 422]) test(`classifyHttpFailure(${status}) → permanent`, () => eq(classifyHttpFailure(status), "permanent"));
for (const status of [409, 429, 500, 503, undefined]) test(`classifyHttpFailure(${status}) → retry`, () => eq(classifyHttpFailure(status), "retry"));

// ── Cron parado ──
test("isStale sin fecha → parado", () => eq(isStale(null, t0, 20), true));
test("isStale hace 19 min → en marcha", () => eq(isStale(plus(-19), t0, 20), false));
test("isStale hace 21 min → parado", () => eq(isStale(plus(-21), t0, 20), true));

// ── Claves de idempotencia ──
test("chargeKey", () => eq(chargeKey("o1"), "charge:o1"));
test("renewalKey usa la fecha ISO del periodo", () =>
  eq(renewalKey("sub1", new Date("2026-01-31T00:00:00Z")), "renewal:sub1:2026-01-31T00:00:00.000Z"));
test("planFeeKey usa la fecha ISO de la renovación", () => eq(planFeeKey("c1", t0), `plan:c1:${t0.toISOString()}`));

// ── Remitente ──
test("formatFrom limpia comillas, <>, CR y LF", () => eq(formatFrom('Cirella "Luna" <x>\r\n', "hola@cirella.app"), '"Cirella x" <hola@cirella.app>'));
test("formatFrom recorta a 60 caracteres", () => eq(formatFrom("a".repeat(80), "h@c.app"), `"${"a".repeat(60)}" <h@c.app>`));
test("formatFrom sin nombre usa Cirella", () => eq(formatFrom(" <> ", "h@c.app"), '"Cirella" <h@c.app>'));
test("parseFromAddress con nombre", () => eq(parseFromAddress("Cirella <hola@cirella.app>"), { name: "Cirella", address: "hola@cirella.app" }));
test("parseFromAddress con comillas", () => eq(parseFromAddress('"Equipo Cirella" <hola@cirella.app>'), { name: "Equipo Cirella", address: "hola@cirella.app" }));
test("parseFromAddress solo dirección", () => eq(parseFromAddress("hola@cirella.app"), { name: null, address: "hola@cirella.app" }));
test("truncateError recorta y acepta cualquier valor", () => {
  eq(truncateError(new Error("x".repeat(600))).length, 500);
  eq(truncateError("fallo", 3), "fal");
});

// ── Proveedor simulado ──
test("simulatedEmailOutcome +fallo → retry", () => eq(simulatedEmailOutcome("a+fallo@x.com"), "retry"));
test("simulatedEmailOutcome +rebote → permanent", () => eq(simulatedEmailOutcome("a+rebote@x.com"), "permanent"));
test("simulatedEmailOutcome normal → ok", () => eq(simulatedEmailOutcome("a@x.com"), "ok"));
test("simulatedEmailOutcome solo mira la parte local", () => eq(simulatedEmailOutcome("a@fallo+x.com"), "ok"));

// ── Petición a Resend ──
const cfg = { apiKey: "re_test", fromAddress: "hola@cirella.app", defaultFromName: "Cirella" };
const msg = { id: "m1", to: "ana@example.com", subject: "Hola", html: "<p>Hola</p>" };
test("buildResendRequest: Idempotency-Key, Bearer y destinatarios en array", () => {
  const { url, init } = buildResendRequest(msg, cfg);
  eq(url, "https://api.resend.com/emails");
  eq(init.headers["Idempotency-Key"], "email-m1");
  eq(init.headers.Authorization, "Bearer re_test");
  const body = JSON.parse(init.body);
  eq(body.to, ["ana@example.com"]);
  eq(body.from, '"Cirella" <hola@cirella.app>');
  ok(!("reply_to" in body), "sin replyTo no hay reply_to");
});
test("buildResendRequest: nombre de la creadora y reply_to", () => {
  const body = JSON.parse(buildResendRequest({ ...msg, fromName: "Cirella", replyTo: "ana@luna.es" }, cfg).init.body);
  eq(body.from, '"Cirella" <hola@cirella.app>');
  eq(body.reply_to, "ana@luna.es");
});
