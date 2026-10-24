/**
 * Texto con formato («MD», lib/rich-text.ts): analizador, texto de antes (HTML de oro), RichContent,
 * correo (lib/email/rich-html.ts), operaciones del editor (lib/rich-text-edit.ts), campos de formato
 * tolerantes y seguridad. Puro (sin BD ni servidor).
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { esc, p } from "../../lib/email/html";
import { emailLinkText, richToEmailHtml } from "../../lib/email/rich-html";
import { pageConfigSchema, readPageConfig } from "../../lib/page-config";
import { postExcerpt, postFormSchema, readingMinutes } from "../../lib/posts";
import {
  cleanRichInput,
  formatToStore,
  linkifyLine,
  parseRich,
  parseTextFormat,
  richImageSrc,
  richToPlain,
  safeLinkHref,
  type RichBlock,
} from "../../lib/rich-text";
import {
  applySplice,
  continueListOnEnter,
  insertDivider,
  insertImage,
  insertLink,
  normalizeLinkInput,
  toggleInline,
  toggleLinePrefix,
} from "../../lib/rich-text-edit";
import { LEGACY_GOLDEN, LEGACY_LINKS_CLASS } from "./fixtures/legacy-text-golden";
import { eq, ok, test } from "./harness";

// tsx compila el JSX de los componentes con React global (Next no lo necesita).
(globalThis as { React?: typeof React }).React = React;
const components = async () => {
  const { RichContent } = await import("../../components/rich-text/rich-content");
  return { RichContent };
};

const BASE = "https://cirella.es";

// ── Bloques ──
test("parseRich: párrafos, saltos de línea y encabezados con espacio", () => {
  eq(parseRich("Hola\nque tal\n\nOtro"), [
    { t: "p", c: [{ t: "text", v: "Hola" }, { t: "br" }, { t: "text", v: "que tal" }] },
    { t: "p", c: [{ t: "text", v: "Otro" }] },
  ]);
  eq(parseRich("# Uno\n## Dos\n### Tres").map((b) => (b.t === "h" ? b.level : 0)), [2, 2, 3]);
  eq(parseRich("#astrología #tarot")[0].t, "p");
  eq(parseRich("#x")[0].t, "p");
  eq(parseRich("###x")[0].t, "p");
});

test("parseRich: listas con -, *, • y •x; continuación perezosa; una línea en blanco termina la lista", () => {
  const b = parseRich("- uno\nsigue\n* dos\n•tres\n• cuatro\n\nfuera");
  eq(b.length, 2);
  const ul = b[0] as Extract<RichBlock, { t: "ul" }>;
  eq(ul.t, "ul");
  eq(ul.items.length, 4);
  eq(ul.items[0], [{ t: "text", v: "uno" }, { t: "br" }, { t: "text", v: "sigue" }]);
  eq(ul.items[2], [{ t: "text", v: "tres" }]);
  eq(b[1].t, "p");
});

test("parseRich: numeradas «3.» y «3)» empiezan en 3; «2026. Un año» es un párrafo", () => {
  const b = parseRich("3. x\n4) y");
  eq(b[0], { t: "ol", start: 3, items: [[{ t: "text", v: "x" }], [{ t: "text", v: "y" }]] });
  eq(parseRich("3) x")[0].t, "ol");
  eq(parseRich("2026. Un año")[0].t, "p");
});

test("parseRich: cita de varias líneas", () => {
  eq(parseRich("> uno\n> dos"), [{ t: "quote", c: [{ t: "text", v: "uno" }, { t: "br" }, { t: "text", v: "dos" }] }]);
});

test("parseRich: líneas ---, ***, —- y ——, pero no una sola —", () => {
  for (const d of ["---", "***", "—-", "——", "___"]) eq(parseRich(d), [{ t: "hr" }], d);
  eq(parseRich("—")[0].t, "p");
  eq(parseRich("--")[0].t, "p");
});

test("parseRich: imagen solo sola en su línea y de aquí", () => {
  const src = "/media/abc123/0123456789abcdef0123.webp";
  eq(parseRich(`![Luna](${src})`), [{ t: "img", src, alt: "Luna" }]);
  eq(parseRich(`Mira ![Luna](${src})`)[0].t, "p");
  eq(parseRich("![x](https://evil.io/a.webp)")[0].t, "p");
});

// ── Línea: orden de escapes, enlaces, autoenlaces y énfasis ──
test("inline: [texto](url) es un enlace con su texto", () => {
  eq(parseRich("[Mi curso](https://cirella.es/curso)")[0], {
    t: "p",
    c: [{ t: "a", href: "https://cirella.es/curso", external: true, c: [{ t: "text", v: "Mi curso" }] }],
  });
});

test("inline: **https://cirella.es** → negrita con un enlace dentro", () => {
  eq(parseRich("**https://cirella.es**")[0], {
    t: "p",
    c: [{ t: "b", c: [{ t: "a", href: "https://cirella.es/", external: true, c: [{ t: "text", v: "https://cirella.es" }] }] }],
  });
});

test("inline: _www.cirella.es_ → cursiva con enlace a https://www.cirella.es/", () => {
  eq(parseRich("_www.cirella.es_")[0], {
    t: "p",
    c: [{ t: "i", c: [{ t: "a", href: "https://www.cirella.es/", external: true, c: [{ t: "text", v: "www.cirella.es" }] }] }],
  });
});

test("inline: *https://cirella.es/a_b* → negrita con enlace …/a_b", () => {
  const b = parseRich("*https://cirella.es/a_b*")[0] as { c: { t: string; c: { href: string }[] }[] };
  eq(b.c[0].t, "b");
  eq(b.c[0].c[0].href, "https://cirella.es/a_b");
});

test("inline: los paréntesis de Wikipedia se quedan en el enlace", () => {
  const a = (parseRich("[Luna](https://es.wikipedia.org/wiki/Luna_(satélite))")[0] as { c: { t: string; href: string }[] }).c[0];
  eq(a.t, "a");
  ok(a.href.endsWith("Luna_(sat%C3%A9lite)"), a.href);
});

test("inline: _hola@analuna.es_ → cursiva con mailto", () => {
  eq(parseRich("_hola@analuna.es_")[0], {
    t: "p",
    c: [{ t: "i", c: [{ t: "a", href: "mailto:hola@analuna.es", external: false, c: [{ t: "text", v: "hola@analuna.es" }] }] }],
  });
});

test("inline: sin énfasis en 5 * 3 * 2, snake_case_word ni URLs con guiones bajos", () => {
  eq(parseRich("5 * 3 * 2")[0], { t: "p", c: [{ t: "text", v: "5 * 3 * 2" }] });
  eq(parseRich("snake_case_word")[0], { t: "p", c: [{ t: "text", v: "snake_case_word" }] });
  const c = (parseRich("ver https://x.es/a_b_c_d y fin")[0] as { c: { t: string }[] }).c;
  eq(c.map((n) => n.t), ["text", "a", "text"]);
});

test("inline: escapes \\* \\_ \\# \\[", () => {
  eq(parseRich("\\*no\\* \\_x\\_ \\# \\[a]")[0], { t: "p", c: [{ t: "text", v: "*no* _x_ # [a]" }] });
  eq(parseRich("\\# no es título")[0].t, "p");
});

test("inline: negrita, cursiva y anidadas", () => {
  eq(parseRich("**Hola** _mundo_ y *a _b_ c*")[0], {
    t: "p",
    c: [
      { t: "b", c: [{ t: "text", v: "Hola" }] },
      { t: "text", v: " " },
      { t: "i", c: [{ t: "text", v: "mundo" }] },
      { t: "text", v: " y " },
      { t: "b", c: [{ t: "text", v: "a " }, { t: "i", c: [{ t: "text", v: "b" }] }, { t: "text", v: " c" }] },
    ],
  });
  eq(parseRich("**sin cerrar")[0], { t: "p", c: [{ t: "text", v: "**sin cerrar" }] });
});

test("inline: linkifyLine de antes no cambia", () => {
  eq(linkifyLine("Mira https://ejemplo.com/a?b=1."), [
    { kind: "text", text: "Mira " },
    { kind: "link", text: "https://ejemplo.com/a?b=1", href: "https://ejemplo.com/a?b=1" },
    { kind: "text", text: "." },
  ]);
  eq(linkifyLine("_www.x.es_").filter((s) => s.kind === "link").length, 0, "el de antes no enlaza tras «_»");
});

// ── Campos de formato tolerantes ──
test("parseTextFormat y formatToStore", () => {
  eq(parseTextFormat("MD"), "MD");
  eq(parseTextFormat(""), null);
  eq(parseTextFormat("HTML"), null);
  eq(parseTextFormat(null), null);
  eq(parseTextFormat(undefined), undefined);
  eq(formatToStore("", "MD", null), null);
  eq(formatToStore("x", undefined, "MD"), "MD");
  eq(formatToStore("x", undefined, null), null);
  eq(formatToStore("x", null, "MD"), null);
  eq(formatToStore("x", "MD", null), "MD");
});

test("postFormSchema acepta bodyFormat vacío (texto de antes sin tocar)", () => {
  const base = { title: "Una publicación", body: "Texto", status: "PUBLISHED" };
  const r = postFormSchema.safeParse({ ...base, bodyFormat: "" });
  ok(r.success, "no falla con ''");
  eq(r.data.bodyFormat, null);
  eq(postFormSchema.parse({ ...base, bodyFormat: "MD" }).bodyFormat, "MD");
  eq(postFormSchema.parse(base).bodyFormat, undefined);
});

// ── Enlaces e imágenes seguros ──
test("safeLinkHref rechaza lo peligroso", () => {
  for (const bad of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<b>x</b>",
    "vbscript:msgbox(1)",
    "//evil.com",
    "/\\evil.com",
    "http://localhost",
    "mailto:nadie",
    "https://x.es/a b",
    'https://x.es/"a',
    "https://x.es/'a",
    "https://x.es/<a>",
    "tel:12",
  ])
    eq(safeLinkHref(bad), null, bad);
});

test("safeLinkHref acepta https, http, www, mailto, tel y rutas", () => {
  eq(safeLinkHref("https://x.es/a"), { href: "https://x.es/a", external: true });
  eq(safeLinkHref("http://x.es"), { href: "http://x.es/", external: true });
  eq(safeLinkHref("www.x.es"), { href: "https://www.x.es/", external: true });
  eq(safeLinkHref("mailto:hola@x.es"), { href: "mailto:hola@x.es", external: false });
  eq(safeLinkHref("tel:+34600111222"), { href: "tel:+34600111222", external: false });
  eq(safeLinkHref("/ruta?x=1#a"), { href: "/ruta?x=1#a", external: false });
});

test("normalizeLinkInput: dominio suelto, wa.me, email, teléfono; «hola» da error", () => {
  eq(normalizeLinkInput("instagram.com/cirella"), { href: "https://instagram.com/cirella" });
  eq(normalizeLinkInput("wa.me/34600111222"), { href: "https://wa.me/34600111222" });
  eq(normalizeLinkInput("hola@x.es"), { href: "mailto:hola@x.es" });
  eq(normalizeLinkInput("+34 600 11 12 22"), { href: "tel:+34600111222" });
  eq(normalizeLinkInput("/mi-curso"), { href: "/mi-curso" });
  ok("error" in normalizeLinkInput("hola"));
  ok("error" in normalizeLinkInput("javascript:alert(1)"));
});

test("richImageSrc: solo /media/<c>/<20hex>.webp y /demo/", () => {
  eq(richImageSrc("/media/abc123/0123456789abcdef0123.webp"), "/media/abc123/0123456789abcdef0123.webp");
  eq(richImageSrc("/demo/ana-cover.webp"), "/demo/ana-cover.webp");
  eq(richImageSrc("/demo/foto.jpg"), "/demo/foto.jpg");
  for (const bad of ["https://evil.io/a.webp", "/media/../api/x", "/media/abc/0123.webp", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "/demo/x.svg"])
    eq(richImageSrc(bad), null, bad);
});

// ── XSS: web y correo ──
const XSS = [
  "<script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  "[x](javascript:alert(1))",
  "[x](JaVaScRiPt:alert(1))",
  "[x](java\tscript:alert(1))",
  "[x]( javascript:alert(1))",
  "[x](data:text/html,<script>alert(1)</script>)",
  "[x](vbscript:msgbox(1))",
  '[x](https://x.es/" onmouseover="alert(1))',
  "[x](https://x.es/'onmouseover='alert(1))",
  "[x](//evil.com)",
  "[x](/\\evil.com)",
  '![x](javascript:alert(1))',
  "![x](data:image/svg+xml,<svg onload=alert(1)>)",
  '![x" onerror="alert(1)](/demo/a.jpg)',
  "**<b onclick=alert(1)>x</b>**",
  "_<svg/onload=alert(1)>_",
  "# <iframe src=javascript:alert(1)>",
  "> <a href=javascript:alert(1)>x</a>",
  "- [x](javascript:alert(1))",
  "1. <script>alert(1)</script>",
  "javascript:alert(1)",
  "https://x.es/<script>",
  'hola@x.es"><script>alert(1)</script>',
  "[<script>](https://x.es)",
];

function assertSafe(html: string, label: string) {
  ok(!/<script/i.test(html), `${label}: <script`);
  // Sin los valores de los atributos (ya escapados), no puede quedar ningún on…= dentro de una etiqueta.
  const tags = html.replace(/="[^"]*"/g, '=""');
  ok(!/<[^>]+\son[a-z]+=/i.test(tags), `${label}: atributo on…=`);
  ok(!/(href|src)="\s*(javascript|data|vbscript):/i.test(html), `${label}: href peligroso`);
  // Los iconos (lucide) del visor de imágenes son los únicos <svg>.
  ok(!/<iframe/i.test(html) && !/<svg(?![^>]*class="lucide)/i.test(html), `${label}: etiqueta peligrosa`);
  for (const m of html.matchAll(/<img [^>]*src="([^"]*)"/g)) ok(m[1].startsWith("/demo/") || m[1].startsWith("/media/"), `${label}: imagen de fuera`);
}

test("XSS: RichContent (MD) y richToEmailHtml nunca dejan pasar HTML ni enlaces peligrosos", async () => {
  const { RichContent } = await components();
  for (const payload of XSS) {
    const web = renderToStaticMarkup(createElement(RichContent, { text: payload, format: "MD", legacy: "links", tone: "page" }));
    assertSafe(web, `web ${JSON.stringify(payload)}`);
    const mail = richToEmailHtml(payload, "MD", { baseUrl: BASE });
    assertSafe(mail, `email ${JSON.stringify(payload)}`);
    // Las comillas de los atributos nunca quedan sin escapar dentro de un valor.
    for (const m of mail.matchAll(/href="([^"]*)"/g)) ok(!m[1].includes("<") && !m[1].includes(">"), "href escapado");
  }
});

test("XSS: en el texto de antes salen como el texto de antes (escapado)", async () => {
  const { RichContent } = await components();
  for (const payload of XSS) {
    const html = renderToStaticMarkup(createElement(RichContent, { text: payload, format: null, legacy: "preline", tone: "account" }));
    ok(!/<script/i.test(html), "sin script");
    eq(richToEmailHtml(payload, null), p(esc(payload)));
  }
});

// ── Texto de antes: HTML de oro ──
test("golden: RichContent con formato null pinta byte a byte lo de 0e516de (4 sabores)", async () => {
  const { RichContent } = await components();
  for (const [i, g] of LEGACY_GOLDEN.entries()) {
    const render = (legacy: "links" | "description" | "paragraphs" | "preline", className?: string) =>
      renderToStaticMarkup(createElement(RichContent, { text: g.text, format: null, legacy, tone: "page", className }));
    eq(render("links", LEGACY_LINKS_CLASS), g.links, `links #${i}`);
    eq(render("description"), g.description, `description #${i}`);
    eq(render("paragraphs"), g.paragraphs, `paragraphs #${i}`);
    eq(render("preline"), g.preline, `preline #${i}`);
    eq(richToEmailHtml(g.text, null), p(esc(g.text)), `email #${i}`);
  }
});

test("golden: el RichText exportado de antes sigue igual", async () => {
  const { RichText } = await import("../../components/creator-page/rich-text");
  for (const g of LEGACY_GOLDEN) eq(renderToStaticMarkup(createElement(RichText, { text: g.text, className: LEGACY_LINKS_CLASS })), g.links);
});

// ── RichContent con formato ──
test("RichContent MD: niveles de encabezado, ✦, enlaces e imágenes", async () => {
  const { RichContent } = await components();
  const text = "## Título\n### Sub\n- uno\n\n[fuera](https://x.es) [dentro](/curso) [mail](mailto:a@b.es) [tel](tel:+34600111222)\n\n![Luna](/media/abc123/0123456789abcdef0123.webp)";
  const r = (headingLevel: 2 | 3 | 4, listMarker: "dot" | "star" = "dot") =>
    renderToStaticMarkup(createElement(RichContent, { text, format: "MD", legacy: "links", tone: "account", headingLevel, listMarker }));
  ok(r(2).includes("<h2") && r(2).includes("<h3"), "2 → h2/h3");
  ok(r(3).includes("<h3") && r(3).includes("<h4") && !r(3).includes("<h2"), "3 → h3/h4");
  ok(r(4).includes("<h4") && r(4).includes("<h5"), "4 → h4/h5");
  ok(r(3, "star").includes("✦") && r(3, "star").includes("text-gold"), "✦ en dorado");
  ok(!r(3).includes("✦"));
  const html = r(3);
  ok(/<a href="https:\/\/x.es\/" target="_blank" rel="noopener nofollow"/.test(html), "externo: _blank + noopener nofollow");
  for (const href of ["/curso", "mailto:a@b.es", "tel:+34600111222"]) {
    const m = html.match(new RegExp(`<a href="${href.replace(/[+.]/g, "\\$&")}"[^>]*>`));
    ok(m && !m[0].includes("target") && !m[0].includes("rel="), `${href}: misma pestaña`);
  }
  ok(/srcSet="[^"]*-w400\.webp 400w/i.test(html), "srcset");
  ok(html.includes('alt="Luna"'));
  const page = renderToStaticMarkup(createElement(RichContent, { text: "## T\n- a", format: "MD", legacy: "links", tone: "page", listMarker: "star" }));
  ok(page.includes("cp-display") && page.includes("cp-gold"), "tono de la página");
});

// ── Texto plano ──
test("richToPlain, postExcerpt y readingMinutes entienden el formato", () => {
  eq(richToPlain("**Hola** _mundo_", "MD"), "Hola mundo");
  eq(richToPlain("**Hola** _mundo_", null), "**Hola** _mundo_");
  eq(richToPlain("## T\n- a\n- b\n\n[x](https://x.es)\n\n![i](/demo/a.jpg)\n\n---", "MD"), "T\n\n• a\n• b\n\nx");
  eq(postExcerpt({ excerpt: null, body: "**Hola** _mundo_", bodyFormat: "MD" }), "Hola mundo");
  eq(postExcerpt({ excerpt: null, body: "**Hola** _mundo_" }), "**Hola** _mundo_");
  eq(readingMinutes("**a** ".repeat(400), "MD"), 2);
});

test("cleanRichInput: CRLF, controles, bidi e imágenes de otra creadora", () => {
  eq(cleanRichInput("a\r\nb\rc", { creatorId: "c1", images: true }), "a\nb\nc");
  eq(cleanRichInput("a\u0000b\u202Ec\u2066d\te", { creatorId: "c1", images: true }), "abcd\te");
  const own = "![a](/media/c1/0123456789abcdef0123.webp)";
  const other = "![a](/media/c2/0123456789abcdef0123.webp)";
  eq(cleanRichInput(`x\n${own}\n${other}\n![d](/demo/a.jpg)`, { creatorId: "c1", images: true }), `x\n${own}\n![d](/demo/a.jpg)`);
  eq(cleanRichInput(`x\n${own}`, { creatorId: "c1", images: false }), "x");
});

// ── Correo ──
test("richToEmailHtml MD: estilos en línea, enlaces absolutos, escapado y sin imágenes", () => {
  const html = richToEmailHtml("## Hola\n\n**negrita** <b>\n\n- uno\n\n[curso](/ana/curso)\n\n![i](/demo/a.jpg)\n\n> cita\n\n---", "MD", { baseUrl: BASE });
  ok(html.includes('<h2 style="font-family:Georgia'), "h2 con estilo");
  ok(html.includes('<strong style="font-weight:600">negrita</strong>'));
  ok(html.includes("&lt;b&gt;"), "escapado");
  ok(html.includes('<ul style="margin:0 0 12px;padding-left:20px">'));
  ok(html.includes('href="https://cirella.es/ana/curso"'), "relativo → absoluto");
  ok(!html.includes("<img"), "sin imágenes por defecto");
  ok(html.includes("border-left:3px solid #E9E2D3"));
  ok(html.includes("border-top:1px solid #E9E2D3"));
  ok(richToEmailHtml("![i](/demo/a.jpg)", "MD", { baseUrl: BASE, image: (s) => `${BASE}${s}` }).includes('<img src="https://cirella.es/demo/a.jpg"'));
});

test("emailLinkText: antiphishing", () => {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  eq(strip(emailLinkText("mi Instagram", "https://instagram.com/x", "cirella.es")), "mi Instagram (instagram.com)");
  eq(emailLinkText("cirella.com", "https://evil.io/", "cirella.es"), "https://evil.io/");
  eq(emailLinkText("mi curso", "https://cirella.es/curso", "cirella.es"), "mi curso");
  eq(emailLinkText("escríbeme", "mailto:a@b.es", "cirella.es"), "escríbeme (a@b.es)");
  eq(emailLinkText("a@b.es", "mailto:a@b.es", "cirella.es"), "a@b.es");
  eq(emailLinkText("https://x.es", "https://x.es/", "cirella.es"), "https://x.es");
  eq(emailLinkText("x.es", "https://www.x.es/", "cirella.es"), "x.es");
  const html = richToEmailHtml("[mi web](https://evil.io)", "MD", { baseUrl: BASE });
  ok(strip(html).includes("mi web (evil.io)"), html);
});

// ── Editor ──
test("toggleInline: pone y quita; sin selección deja el ejemplo seleccionado", () => {
  const v = "hola mundo";
  const on = toggleInline(v, 5, 10, "**", "negrita");
  eq(applySplice(v, on), "hola **mundo**");
  eq([on.selStart, on.selEnd], [7, 12]);
  const v2 = applySplice(v, on);
  eq(applySplice(v2, toggleInline(v2, 7, 12, "**", "negrita")), "hola mundo");
  eq(applySplice(v2, toggleInline(v2, 5, 14, "**", "negrita")), "hola mundo");
  const empty = toggleInline("ab", 1, 1, "_", "cursiva");
  eq(applySplice("ab", empty), "a_cursiva_b");
  eq("a_cursiva_b".slice(empty.selStart, empty.selEnd), "cursiva");
  eq(applySplice("x hola y", toggleInline("x hola y", 1, 7, "**", "n")), "x **hola** y", "los espacios quedan fuera");
});

test("toggleLinePrefix: tres líneas a lista numerada (renumera) y vuelta", () => {
  const v = "uno\ndos\ntres";
  const sp = toggleLinePrefix(v, 0, v.length, "ol");
  const v2 = applySplice(v, sp);
  eq(v2, "1. uno\n2. dos\n3. tres");
  eq(applySplice(v2, toggleLinePrefix(v2, 0, v2.length, "ol")), v);
  eq(applySplice("- a\n- b", toggleLinePrefix("- a\n- b", 0, 7, "ol")), "1. a\n2. b");
  eq(applySplice("hola", toggleLinePrefix("hola", 2, 2, "h2")), "## hola");
  eq(applySplice("## hola", toggleLinePrefix("## hola", 4, 4, "h3")), "### hola");
  eq(applySplice("## hola", toggleLinePrefix("## hola", 4, 4, "h2")), "hola");
  eq(applySplice("a\nb", toggleLinePrefix("a\nb", 0, 3, "quote")), "> a\n> b");
});

test("insertDivider e insertImage dejan líneas en blanco alrededor", () => {
  eq(applySplice("ab", insertDivider("ab", 1)), "a\n\n---\n\nb");
  eq(applySplice("a\n\nb", insertDivider("a\n\nb", 3)), "a\n\n---\n\nb");
  eq(applySplice("", insertDivider("", 0)), "---\n\n");
  eq(applySplice("a", insertImage("a", 1, "/demo/a.jpg", "Lu[n]a")), "a\n\n![Lu n a](/demo/a.jpg)\n\n");
});

test("insertLink codifica ( ) y espacios y escapa ]", () => {
  eq(applySplice("ver aquí", insertLink("ver aquí", 4, 8, "aquí ]", "https://x.es/a (b)")), "ver [aquí \\]](https://x.es/a%20%28b%29)");
  const v = applySplice("", insertLink("", 0, 0, "Luna", "https://es.wikipedia.org/wiki/Luna_(satélite)"));
  eq((parseRich(v)[0] as { c: { t: string; href: string }[] }).c[0].t, "a");
});

test("continueListOnEnter: sigue la lista y un punto vacío la termina", () => {
  const a = "- uno";
  const sp = continueListOnEnter(a, a.length)!;
  eq(applySplice(a, sp), "- uno\n- ");
  const b = "2. dos";
  eq(applySplice(b, continueListOnEnter(b, b.length)!), "2. dos\n3. ");
  const c = "- uno\n- ";
  eq(applySplice(c, continueListOnEnter(c, c.length)!), "- uno\n");
  eq(continueListOnEnter("hola", 4), null);
  eq(continueListOnEnter("*negrita*", 9), null);
});

// ── Rendimiento ──
test("parseRich: 20.000 caracteres patológicos en menos de 50 ms cada uno", () => {
  parseRich("calentar **a** _b_ [c](https://x.es)");
  for (const s of ["*", "[", "**a", "_", "](", "[a](", "_a", "a_", "*a ", "![", "https://x.es/" + "a_"]) {
    const text = s.repeat(Math.ceil(20000 / s.length)).slice(0, 20000);
    const t0 = performance.now();
    parseRich(text);
    const ms = performance.now() - t0;
    ok(ms < 50, `${JSON.stringify(s)}: ${ms.toFixed(1)} ms`);
  }
});

// ── Página ──
test("page-config: format «MD» se lee; sin formato también; uno desconocido es de antes y no borra la página", () => {
  const block = { id: "b1", title: "Sobre mí", body: "Hola", enabled: true };
  const base = { displayName: "Ana", sections: [], links: [], socials: {}, testimonials: [], faqs: [] };
  // Los bloques de antes (sin `kind`) son de texto (lib/page-blocks.ts).
  const text = (b: unknown) => b as { kind: string; format?: string; body: string };
  eq(text(pageConfigSchema.parse({ ...base, blocks: [{ ...block, format: "MD" }] }).blocks?.[0]).format, "MD");
  eq(text(pageConfigSchema.parse({ ...base, blocks: [block] }).blocks?.[0]).format, undefined);
  const cfg = readPageConfig({ ...base, tagline: "Mi frase", blocks: [{ ...block, format: "HTML" }] });
  eq(cfg.tagline, "Mi frase", "no vuelve a la página por defecto");
  eq(text(cfg.blocks?.[0]).kind, "text");
  eq(text(cfg.blocks?.[0]).format, undefined);
  eq(text(cfg.blocks?.[0]).body, "Hola");
});
