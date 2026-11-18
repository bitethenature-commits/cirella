/**
 * Newsletter propia: reglas, editor visual, tokens de alta y baja, webhook de Resend y cupo diario.
 */
import { readFileSync } from "node:fs";
import { applyVars, defaultCampaignDesign, emailImagePath, lintDesign, parseDesignStrict, readDesign, type EmailDesign } from "../../lib/email-blocks";
import { renderDesignHtml, renderSubject } from "../../lib/email/blocks-html";
import { safeHeaders } from "../../lib/email/headers";
import { esc } from "../../lib/email/html";
import { campaignEmail, newsletterConfirmEmail } from "../../lib/email/newsletter-templates";
import { effectiveDailyCap } from "../../lib/email/outbox";
import { buildResendRequest } from "../../lib/email/providers/resend";
import * as T from "../../lib/email/templates";
import { EDITABLE_EMAILS } from "../../lib/automation-catalog";
import { canSend, dailyBudget, etaDays, parseSegment } from "../../lib/newsletter-rules";
import { confirmToken, readConfirmToken, readUnsubscribeToken, unsubscribeHeaders, unsubscribeToken } from "../../lib/newsletter-tokens";
import { defaultSections, readPageConfig } from "../../lib/page-config";
import { readResendEvent, signResendWebhook, verifyResendWebhook } from "../../lib/resend-webhook";
import { eq, ok, test } from "./harness";

const BASE = "https://cirella.app";
const design = (blocks: unknown[]): EmailDesign => readDesign({ v: 1, blocks })!;

// ── Reglas ──

test("solo se envía a las confirmadas", () => {
  eq(["PENDING", "CONFIRMED", "UNSUBSCRIBED", "BOUNCED", "COMPLAINED"].map(canSend), [false, true, false, false, false]);
});

test("parseSegment: tolerante (lo que no entiende es «todas»)", () => {
  eq(parseSegment({ kind: "member" }), { kind: "member" });
  eq(parseSegment({ kind: "product", productId: "p1" }), { kind: "product", productId: "p1" });
  eq(parseSegment({ kind: "tag", tag: "talleres" }), { kind: "all" });
  eq(parseSegment("x"), { kind: "all" });
});

test("dailyBudget: límite menos reserva menos lo enviado; 0 = sin límite", () => {
  eq(dailyBudget({ cap: 100, reserve: 20, sentLast24h: 85 }), 0);
  eq(dailyBudget({ cap: 100, reserve: 20, sentLast24h: 30 }), 50);
  eq(dailyBudget({ cap: 0, reserve: 20, sentLast24h: 500 }), Infinity);
});

test("etaDays: redondea hacia arriba", () => {
  eq(etaDays(0, 80), 0);
  eq(etaDays(80, 80), 1);
  eq(etaDays(81, 80), 2);
  eq(etaDays(400, 80), 5);
  eq(etaDays(10, Infinity), 1);
});

test("effectiveDailyCap: 100 en la web personal con Resend; sin límite en lo demás; el ajuste manda", () => {
  eq(effectiveDailyCap(null, { personal: true, provider: "resend" }), 100);
  eq(effectiveDailyCap(null, { personal: true, provider: "log" }), 0);
  eq(effectiveDailyCap(null, { personal: false, provider: "resend" }), 0);
  eq(effectiveDailyCap(3000, { personal: false, provider: "log" }), 3000);
  eq(effectiveDailyCap(0, { personal: true, provider: "resend" }), 0);
});

// ── Editor visual ──

test("readDesign descarta bloques dañados; parseDesignStrict dice qué falla", () => {
  const d = readDesign({ v: 1, blocks: [{ id: "a", t: "title", text: "Hola", align: "left" }, { id: "b", t: "video" }, { t: "text" }] });
  eq(d?.blocks.length, 1);
  eq(readDesign(null), null);
  const bad = parseDesignStrict({ v: 1, blocks: [{ id: "x", t: "button", label: "Ir", href: "javascript:alert(1)", align: "center" }] });
  ok(!bad.ok && /enlace/.test(bad.error));
  ok(!parseDesignStrict({ v: 1, blocks: Array.from({ length: 41 }, (_, i) => ({ id: `d${i}`, t: "divider" })) }).ok, "máx. 40 bloques");
  ok(!parseDesignStrict({ v: 1, blocks: [{ id: "i", t: "image", url: "https://evil.io/x.png", alt: "", width: "full" }] }).ok, "imágenes solo de aquí");
});

test("emailImagePath: solo /media de la web y las de la demo", () => {
  eq(emailImagePath("/media/abc123/0123456789abcdef0123.jpg"), "/media/abc123/0123456789abcdef0123.jpg");
  eq(emailImagePath("/demo/hero.webp"), "/demo/hero.webp");
  eq(emailImagePath("https://evil.io/x.jpg"), null);
  eq(emailImagePath("/media/../x.jpg"), null);
});

test("renderDesignHtml: escapa, enlaces absolutos y seguros, variables con y sin nombre", () => {
  const d = design([
    { id: "t", t: "title", text: "Hola, {nombre} <b>", align: "center" },
    { id: "x", t: "text", body: "Te espero en **{producto}**. [Mi Instagram](https://instagram.com/ana)" },
    { id: "i", t: "image", url: "/media/abc123/0123456789abcdef0123.jpg", alt: 'Luna "llena"', href: "/sobre-mi", width: "narrow" },
    { id: "b", t: "button", label: "Reservar", href: "/ana/lectura", align: "center" },
    { id: "s", t: "spacer", size: "l" },
    { id: "d", t: "divider" },
  ]);
  const html = renderDesignHtml(d, { baseUrl: BASE, vars: { nombre: "Laura <3", producto: "Lectura & más" } });
  ok(html.includes("Hola, Laura &lt;3 &lt;b&gt;"), html);
  ok(html.includes("<strong style=\"font-weight:600\">Lectura &amp; más</strong>"), html);
  ok(html.includes(`src="${BASE}/media/abc123/0123456789abcdef0123.jpg"`) && html.includes('alt="Luna &quot;llena&quot;"'));
  ok(html.includes(`href="${BASE}/sobre-mi"`) && html.includes(`href="${BASE}/ana/lectura"`));
  ok(html.includes("(instagram.com)"), "antiphishing del texto con formato");
  const anon = renderDesignHtml(design([{ id: "t", t: "title", text: "Hola, {nombre}", align: "left" }]), { baseUrl: BASE, vars: {} });
  ok(anon.includes(">Hola</h2>"), anon);
});

test("applyVars y renderSubject", () => {
  eq(applyVars("Hola, {nombre}. Soy {mi_nombre}", { nombre: "Eva", mi_nombre: "Cirella" }, esc), "Hola, Eva. Soy Cirella");
  eq(applyVars("Hola, {nombre}.", {}, esc), "Hola.");
  eq(renderSubject("¡Bienvenida, {nombre}!", {}), "¡Bienvenida!");
  eq(renderSubject("Reserva · {fecha}", { fecha: "lunes 2" }), "Reserva · lunes 2");
  eq(applyVars("{{nombre-de-la-web}}", { nombre: "x" }, esc), "{{nombre-de-la-web}}", "no toca el marcador del nombre de la web");
});

test("lintDesign: solo imágenes, sin texto alternativo, botón sin enlace, vacío", () => {
  const img = { id: "i", t: "image", url: "/media/abc123/0123456789abcdef0123.jpg", alt: "", width: "full" };
  const w = lintDesign(design([img, { id: "b", t: "button", label: "Ir", href: "", align: "center" }]), "Asunto");
  ok(w.some((x) => /solo imágenes/.test(x)) && w.some((x) => /alternativo/.test(x)) && w.some((x) => /botón/.test(x)), w.join(" | "));
  ok(lintDesign({ v: 1, blocks: [] }, "").some((x) => /asunto/.test(x)));
  eq(lintDesign(defaultCampaignDesign({ siteUrl: `${BASE}/` }), "Hola"), []);
});

test("campaignEmail: baja, quién la envía, vista previa oculta, sin «Tu área»", () => {
  const m = campaignEmail({
    brand: "Cirella",
    subject: "Luna llena, {nombre}",
    preheader: "Tres preguntas",
    design: defaultCampaignDesign({ siteUrl: `${BASE}/` }),
    baseUrl: BASE,
    vars: { nombre: "Laura", mi_nombre: "Cirella" },
    footer: { senderName: "Cirella", legalName: "Cirella", legalAddress: "Calle de la Luna 7, 28004 Madrid (España)", legalEmail: "hola@cirella.app", legalUrl: `${BASE}/ana/legal`, unsubscribeUrl: `${BASE}/baja/newsletter?t=abc` },
  });
  eq(m.subject, "Luna llena, Laura");
  ok(m.html.includes(`href="${BASE}/baja/newsletter?t=abc"`) && m.html.includes("Darme de baja"));
  ok(m.html.includes("Cirella (Cirella) · Calle de la Luna 7, 28004 Madrid (España) · hola@cirella.app"));
  ok(m.html.includes("display:none") && m.html.includes("Tres preguntas"));
  ok(!m.html.includes(T.AREA_LINK_TOKEN));
  const test_ = campaignEmail({ brand: "Cirella", subject: "S", design: { v: 1, blocks: [] }, baseUrl: BASE, vars: {}, footer: { senderName: "Cirella", legalUrl: "x", unsubscribeUrl: null }, test: true });
  eq(test_.subject, "[Prueba] S");
  ok(test_.html.includes("en la prueba no hace nada"));
});

test("newsletterConfirmEmail: botón «Sí, quiero recibirla»", () => {
  const m = newsletterConfirmEmail({ creatorName: "Cirella", url: `${BASE}/novedades/confirmar?t=x`, name: "Eva" });
  ok(m.subject.includes("Cirella") && m.html.includes(">Sí, quiero recibirla</a>") && m.html.includes("Hola, Eva"));
});

test("layout: sin cambios para los emails de siempre (título, sin vista previa)", () => {
  const html = T.layout({ title: "Hola", body: "<p>x</p>" });
  ok(html.includes('<h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.25;margin:0 0 16px;color:#0E1024">Hola</h1>'));
  ok(html.includes('<body style="margin:0;background:#F6F1E7;font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif;color:#1B1A2E">\n<div style="max-width:520px'));
});

test("emails automáticos: el texto propio sustituye al saludo y la parte fija sigue", () => {
  const intro = "<p>MI TEXTO</p>";
  const access = T.accessGrantedEmail({ name: "Eva", creatorName: "Cirella", productTitle: "Mini-curso", productType: "COURSE", url: "https://x/acceso", newsletterUrl: "https://x/nl", introHtml: intro });
  ok(access.html.includes("MI TEXTO") && !access.html.includes("ya puedes entrar en") && access.html.includes(">Empezar el curso</a>") && access.html.includes("Confirmar que quiero recibir novedades"));
  const receipt = T.purchaseReceiptEmail({ creatorName: "Cirella", productTitle: "Lectura", amount: "45 €", orderId: "cm123", accountUrl: "https://x", introHtml: intro });
  ok(receipt.html.includes("MI TEXTO") && !receipt.html.includes("gracias por tu compra") && receipt.html.includes("45 €"));
  const booking = T.bookingConfirmedEmail({ creatorName: "Cirella", productTitle: "Lectura", when: "lunes 2 · 17:00", url: "https://x", introHtml: intro });
  ok(booking.html.indexOf("MI TEXTO") < booking.html.indexOf("lunes 2 · 17:00"));
  const welcome = T.welcomeCustomerEmail({ name: "Eva", creatorName: "Cirella", accountUrl: "https://x", introHtml: intro });
  ok(!welcome.html.includes("<h1") && welcome.html.includes(">Ver mi cuenta</a>"));
  // Sin texto propio, idénticos a los de siempre.
  eq(T.accessGrantedEmail({ creatorName: "Cirella", productTitle: "M", productType: "DIGITAL", url: "u", introHtml: null }).html, T.accessGrantedEmail({ creatorName: "Cirella", productTitle: "M", productType: "DIGITAL", url: "u" }).html);
});

test("catálogo: cada email editable tiene asunto, parte fija y un original válido", () => {
  for (const [t, m] of Object.entries(EDITABLE_EMAILS)) {
    ok(m!.subject && m!.fixed, t);
    ok(parseDesignStrict(m!.original()).ok, `${t}: original válido`);
  }
});

// ── Tokens y cabeceras ──

test("tokens: ida y vuelta, propósito distinto, manipulado y caducado", () => {
  eq(readConfirmToken(confirmToken("sub1")), "sub1");
  eq(readUnsubscribeToken(unsubscribeToken("sub1", "camp1")), { s: "sub1", c: "camp1" });
  eq(readUnsubscribeToken(unsubscribeToken("sub1")), { s: "sub1" });
  eq(readConfirmToken(unsubscribeToken("sub1")), null, "una baja no confirma");
  eq(readUnsubscribeToken(confirmToken("sub1")), null, "una confirmación no da de baja");
  const t = confirmToken("sub1");
  eq(readConfirmToken(`${t.slice(0, -2)}xx`), null);
  eq(readConfirmToken(confirmToken("sub1", Date.now() - 8 * 86_400_000)), null, "7 días");
  eq(readUnsubscribeToken(unsubscribeToken("sub1", null, Date.now() - 4 * 365 * 86_400_000))?.s, "sub1", "la baja dura años");
});

test("unsubscribeHeaders pasan safeHeaders y llevan la baja en un clic", () => {
  const h = unsubscribeHeaders("sub1", "camp1");
  eq(safeHeaders(h), h);
  ok(/^<https?:\/\/[^>]+\/baja\/newsletter\/un-clic\?t=/.test(h["List-Unsubscribe"]));
  eq(h["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

// ── Resend ──

test("Resend: la newsletter sale desde NEWSLETTER_FROM; lo demás, desde EMAIL_FROM", () => {
  const cfg = { apiKey: "re_x", fromAddress: "hola@cirella.app", defaultFromName: "Cirella", newsFromAddress: "newsletter@cirella.app", newsFromName: "Cirella" };
  const news = JSON.parse(buildResendRequest({ id: "1", to: "a@x.es", subject: "S", html: "h", stream: "news", fromName: null }, cfg).init.body);
  eq(news.from, "\"Cirella\" <newsletter@cirella.app>");
  const tx = JSON.parse(buildResendRequest({ id: "2", to: "a@x.es", subject: "S", html: "h", stream: "tx" }, cfg).init.body);
  eq(tx.from, "\"Cirella\" <hola@cirella.app>");
  const noNews = JSON.parse(buildResendRequest({ id: "3", to: "a@x.es", subject: "S", html: "h", stream: "news", fromName: "Cirella" }, { apiKey: "k", fromAddress: "hola@cirella.app", defaultFromName: "Cirella" }).init.body);
  eq(noNews.from, "\"Cirella\" <hola@cirella.app>");
});

test("webhook de Resend: firma Svix válida, manipulada y antigua", () => {
  const secret = `whsec_${Buffer.from("clave-de-prueba-del-webhook").toString("base64")}`;
  const body = JSON.stringify({ type: "email.bounced", data: { email_id: "re_1", bounce: { type: "Permanent" } } });
  const ts = "1761300000";
  const sig = signResendWebhook(secret, "msg_1", ts, body);
  const h = { id: "msg_1", timestamp: ts, signature: `v1,otra v1,${sig}` };
  ok(verifyResendWebhook(secret, h, body, 1761300100));
  ok(!verifyResendWebhook(secret, h, body.replace("Permanent", "Transient"), 1761300100), "cuerpo cambiado");
  ok(!verifyResendWebhook(secret, h, body, 1761300000 + 400), "más de 5 minutos");
  ok(!verifyResendWebhook(secret, { ...h, signature: null }, body, 1761300100));
  eq(readResendEvent(JSON.parse(body)), { kind: "bounced", emailId: "re_1", permanent: true });
  eq(readResendEvent({ type: "email.bounced", data: { email_id: "re_2", bounce: { type: "Transient" } } }), { kind: "bounced", emailId: "re_2", permanent: false });
  eq(readResendEvent({ type: "email.delivered", data: { email_id: "re_3" } }), { kind: "delivered", emailId: "re_3" });
  eq(readResendEvent({ type: "domain.created", data: {} }), { kind: "ignored" });
});

// ── Página ──

test("sección «Newsletter»: oculta en una página nueva y en las guardadas antes", () => {
  eq(defaultSections().find((s) => s.key === "newsletter")?.enabled, false);
  const old = readPageConfig({ displayName: "Cirella", sections: [{ key: "links", enabled: true }, { key: "contact", enabled: true }] });
  eq(old.sections.find((s) => s.key === "newsletter")?.enabled, false);
  eq(old.sections.map((s) => s.key).slice(-2), ["newsletter", "contact"]);
});

test("las pantallas públicas de la newsletter viven en rutas reservadas (el modo personal no las da por 404)", () => {
  const slug = readFileSync("lib/slug.ts", "utf8");
  ok(/"novedades"/.test(slug) && /"baja"/.test(slug));
  ok(readFileSync("app/baja/newsletter/un-clic/route.ts", "utf8").includes('"ONE_CLICK"'), "solo el POST da de baja");
});
