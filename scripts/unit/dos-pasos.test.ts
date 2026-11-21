import { deviceLabel } from "../../lib/auth-utils";
import { loginAlertEmail, twoFactorChangedEmail, twoFactorFailuresEmail, type TwoFactorEvent } from "../../lib/email/templates";
import { qrSvg } from "../../lib/qr-svg";
import { newRecoveryCode, normalizeRecoveryCode, openSecret, recoveryCodeHash, sealSecret } from "../../lib/two-factor-codes";
import { base32Decode, base32Encode, formatSecret, hotp, otpauthUri, totpStep, verifyTotp } from "../../lib/totp";
import { eq, ok, test, throws } from "./harness";

// ── TOTP (RFC 6238, apéndice B, SHA-1) ──
const RFC_SECRET = Buffer.from("12345678901234567890");
for (const [t, code8] of [[59, "94287082"], [1111111109, "07081804"], [1234567890, "89005924"], [2000000000, "69279037"]] as const) {
  test(`TOTP RFC 6238 T=${t}`, () => {
    eq(hotp(RFC_SECRET, totpStep(new Date(t * 1000)), 8), code8);
    eq(hotp(RFC_SECRET, totpStep(new Date(t * 1000))), code8.slice(2));
  });
}

test("TOTP: ±1 paso vale, ±2 no", () => {
  const now = new Date(1_700_000_000_000);
  const step = totpStep(now);
  for (const d of [-1, 0, 1]) eq(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + d), { now }), step + d);
  for (const d of [-2, 2]) eq(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + d), { now }), null);
});

test("TOTP: un paso ya usado (o anterior) no vale otra vez", () => {
  const now = new Date(1_700_000_000_000);
  const step = totpStep(now);
  eq(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), { now, lastStep: step }), null);
  eq(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), { now, lastStep: step - 1 }), null);
  eq(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), { now, lastStep: step }), step + 1);
});

test("TOTP: rechaza letras y 5 o 7 cifras; acepta espacios dentro", () => {
  const now = new Date(59_000);
  for (const bad of ["28708a", "28708", "2870822", ""]) eq(verifyTotp(RFC_SECRET, bad, { now }), null);
  ok(verifyTotp(RFC_SECRET, "287 082", { now }) !== null);
});

test("base32 (RFC 4648): «foobar» ↔ MZXW6YTBOI, sin mayúsculas ni espacios", () => {
  eq(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
  eq(base32Decode("mzxw 6ytb oi").toString(), "foobar");
  const r = Buffer.from([0, 255, 17, 42, 99, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  eq(base32Decode(base32Encode(r)).equals(r), true);
  throws(() => base32Decode("1!"));
});

test("otpauthUri escapa emisor y cuenta y lleva los parámetros", () => {
  const u = otpauthUri({ issuer: "Luna & Sol", account: "ñu ana@example.com", secretB32: "ABC" });
  ok(u.startsWith("otpauth://totp/Luna%20%26%20Sol:%C3%B1u%20ana%40example.com?"), u);
  for (const part of ["secret=ABC", "issuer=Luna%20%26%20Sol", "algorithm=SHA1", "digits=6", "period=30"]) ok(u.includes(part), part);
});

test("formatSecret: grupos de 4", () => eq(formatSecret("ABCDEFGHIJ"), "ABCD EFGH IJ"));

// ── Códigos de recuperación y secreto cifrado ──
test("normalizeRecoveryCode: mismas variantes, mismo código", () => {
  const n = normalizeRecoveryCode("abcde12345");
  eq(normalizeRecoveryCode("ABCDE-12345"), n);
  eq(normalizeRecoveryCode(" abcde 12345 "), n);
  eq(normalizeRecoveryCode("O1L1I"), "01111");
});

test("newRecoveryCode: xxxxx-xxxxx sin letras ambiguas y distintos", () => {
  const codes = new Set(Array.from({ length: 50 }, newRecoveryCode));
  eq(codes.size, 50);
  for (const c of codes) ok(/^[0-9a-hjkmnp-tv-z]{5}-[0-9a-hjkmnp-tv-z]{5}$/.test(c), c);
});

test("recoveryCodeHash: HMAC con el secreto, igual para variantes", () => {
  eq(recoveryCodeHash("ABCDE-12345", "s1"), recoveryCodeHash("abcde12345", "s1"));
  ok(recoveryCodeHash("abcde12345", "s1") !== recoveryCodeHash("abcde12345", "s2"));
});

test("sealSecret / openSecret: ida y vuelta; manipulado o con otra clave, lanza", () => {
  const sealed = sealSecret("JBSWY3DPEHPK3PXP", "clave-uno-de-pruebas-con-32-caracteres");
  ok(sealed.startsWith("v1:"));
  ok(!sealed.includes("JBSWY3DPEHPK3PXP"));
  eq(openSecret(sealed, "clave-uno-de-pruebas-con-32-caracteres"), "JBSWY3DPEHPK3PXP");
  throws(() => openSecret(sealed, "clave-dos-de-pruebas-con-32-caracteres"));
  const [v, iv, tag, ct] = sealed.split(":");
  const flipped = ct.slice(0, -2) + (ct.slice(-2) === "AA" ? "AB" : "AA");
  throws(() => openSecret([v, iv, tag, flipped].join(":"), "clave-uno-de-pruebas-con-32-caracteres"));
  throws(() => openSecret([v, iv, tag.replace(/^./, (c) => (c === "A" ? "B" : "A")), ct].join(":"), "clave-uno-de-pruebas-con-32-caracteres"));
});

// ── Dispositivo, QR y emails ──
for (const [ua, want] of [
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "iPhone · Safari"],
  ["Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1", "iPad · Safari"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36", "Mac · Chrome"],
  ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Android · Chrome"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0", "Windows · Firefox"],
  ["", "Navegador desconocido"],
] as const)
  test(`deviceLabel → ${want}`, () => eq(deviceLabel(ua), want));

test("qrSvg: SVG sin scripts ni atributos on*, determinista", () => {
  const a = qrSvg("otpauth://totp/x:y?secret=ABC");
  ok(a.startsWith("<svg"));
  ok(!/<script/i.test(a) && !/\son\w+=/i.test(a));
  eq(qrSvg("otpauth://totp/x:y?secret=ABC"), a);
  ok(qrSvg("otro") !== a);
});

test("emails de la verificación: sin códigos ni enlaces de acceso", () => {
  const url = "https://web.test/panel/ajustes/seguridad";
  const mails = [
    loginAlertEmail({ when: "1 ene", device: "iPhone · Safari", settingsUrl: url }),
    twoFactorFailuresEmail({ when: "1 ene", device: "<b>x</b>", settingsUrl: url }),
    ...(["enabled", "disabled", "codes", "devices", "reset", "recovery_used", "password"] as TwoFactorEvent[]).map((event) =>
      twoFactorChangedEmail({ event, remaining: event === "recovery_used" ? 9 : undefined, settingsUrl: url }),
    ),
  ];
  for (const m of mails) {
    ok(!/auth\/magic|token=/.test(m.html), m.subject);
    ok(m.html.includes(url), m.subject);
  }
  ok(!mails[1].html.includes("<b>x</b>"), "el dispositivo va escapado");
  ok(twoFactorChangedEmail({ event: "recovery_used", remaining: 9, settingsUrl: url }).html.includes("<strong>9</strong>"));
});
