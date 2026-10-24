import { accountEntryLink, hasHintCookie, HINT_COOKIE } from "../../lib/auth-utils";
import { redactLoginTokens } from "../../lib/email/outbox";
import {
  AREA_LINK_TOKEN,
  areaLinkFooter,
  emailChangeConfirmEmail,
  emailChangedEmail,
  emailChangeRequestedEmail,
  emailTakenEmail,
  layout,
  magicLinkEmail,
} from "../../lib/email/templates";
import { readEmailChangeData, readRegisterData } from "../../lib/login-token-data";
import { isMediaPath, mediaUrl } from "../../lib/media-url";
import { eq, ok, test } from "./harness";

// ── Entrada «Entrar» / «Mi área» ──
test("hasHintCookie: solo con cirella_hola=1", () => {
  eq(HINT_COOKIE, "cirella_hola");
  ok(hasHintCookie("a=1; cirella_hola=1; b=2"));
  ok(hasHintCookie("cirella_hola=1"));
  ok(!hasHintCookie(""));
  ok(!hasHintCookie(null));
  ok(!hasHintCookie("cirella_hola=0; x_cirella_hola=1"));
});

test("accountEntryLink: con sesión «Mi área» a /cuenta; sin ella «Entrar» al login con marca", () => {
  eq(accountEntryLink("ana", true), { href: "/cuenta", label: "Mi área" });
  eq(accountEntryLink("ana", false), { href: "/ana/entrar?next=%2Fcuenta", label: "Entrar" });
});

// ── Datos de los enlaces ──
test("readRegisterData: válido, recortado; estropeado → null (el enlace sigue sirviendo)", () => {
  eq(readRegisterData({ name: " Lucía ", newsletter: true, creatorId: "c1" }), { name: "Lucía", newsletter: true, creatorId: "c1" });
  eq(readRegisterData({ name: "x".repeat(200), newsletter: true, creatorId: "c1" }), null);
  eq(readRegisterData({ newsletter: "sí" }), null);
  eq(readRegisterData(null), null);
  eq(readRegisterData(undefined), null);
  eq(readRegisterData("texto"), null);
});

test("readEmailChangeData: válido; sin email de antes → null", () => {
  eq(readEmailChangeData({ userId: "u1", fromEmail: "a@b.co" }), { userId: "u1", fromEmail: "a@b.co" });
  eq(readEmailChangeData({ userId: "u1" }), null);
  eq(readEmailChangeData(42), null);
});

// ── Emails ──
test("magicLinkEmail REGISTER: «Confirma tu email para entrar» y «Confirmar y entrar», nombre escapado", () => {
  const m = magicLinkEmail({ url: "https://x.test/auth/magic?token=abc", creatorName: "Ana Luna", purpose: "REGISTER", name: "<b>Lucía</b>" });
  eq(m.subject, "Confirma tu email para entrar");
  ok(m.html.includes(">Confirmar y entrar</a>"));
  ok(m.html.includes("24 horas") && m.html.includes("no se creará nada"));
  ok(!m.html.includes("<b>Lucía</b>"));
});

test("emails del cambio de email: botón «Confirmar el cambio» y el email enmascarado escapado", () => {
  ok(emailChangeConfirmEmail({ url: "https://x.test/auth/magic?token=abc" }).html.includes(">Confirmar el cambio</a>"));
  for (const m of [emailChangeRequestedEmail({ newEmailMasked: "<i>n•••@x.co</i>" }), emailChangedEmail({ newEmailMasked: "<i>n•••@x.co</i>" })]) {
    ok(!m.html.includes("<i>n"), m.subject);
    ok(m.html.includes("&lt;i&gt;n•••@x.co"), m.subject);
    ok(!/auth\/magic/.test(m.html), "sin enlaces que cambien nada");
  }
  ok(emailTakenEmail({ loginUrl: "https://x.test/ana/entrar" }).html.includes("ya hay una cuenta"));
});

test("redactLoginTokens tapa los enlaces de alta y de cambio de email", () => {
  const html = [magicLinkEmail({ url: "https://x.test/auth/magic?token=AAA_b-1", purpose: "REGISTER" }).html, emailChangeConfirmEmail({ url: "https://x.test/auth/magic?token=BBB_c-2" }).html].join("");
  const r = redactLoginTokens(html);
  ok(!r.includes("AAA_b-1") && !r.includes("BBB_c-2"));
});

test("pie «Tu área»: el marcador solo sale en la web personal; el enlace va escapado", () => {
  ok(!layout({ title: "x", body: "y" }).includes(AREA_LINK_TOKEN), "en la plataforma no hay marcador");
  const f = areaLinkFooter("https://ana.test");
  ok(f.includes('href="https://ana.test/cuenta"') && f.includes(">ana.test/cuenta</a>") && f.includes("Tu área"));
});

test("la foto de perfil (/media/{usuaria}/{hex}.webp) es una ruta de /media válida", () => {
  const url = mediaUrl("cmh1usuaria0001", "0123456789abcdef0123");
  eq(url, "/media/cmh1usuaria0001/0123456789abcdef0123.webp");
  ok(isMediaPath(url.replace(/^\/media\//, "")));
});
