/**
 * Contenido de la página: publicaciones («Novedades»), códigos de descuento de otras marcas y
 * bloques de texto. Funciones puras (sin BD ni servidor).
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  codeState,
  dateKeyFromExpiry,
  discountCodeFormSchema,
  expiryFromDateKey,
  expiryLabel,
  isCodeVisible,
  parseShopUrl,
} from "../../lib/discount-codes";
import { pageConfigSchema, readPageConfig, SECTION_KEYS, visibleTextBlocks, withAllSections } from "../../lib/page-config";
import { isPostPublic, ownImageUrl, postExcerpt, postFormSchema, postSlugBase, postState, readingMinutes, resolvePublishedAt } from "../../lib/posts";
import { linkifyLine, parseRichText, safeUrl, truncateWords } from "../../lib/rich-text";
import { RESERVED_PRODUCT_SLUGS, validateUsername } from "../../lib/slug";
import { EVENT_TYPES, isCodeEvent, SERVER_ONLY_EVENT_TYPES } from "../../lib/types";
import { eq, ok, test } from "./harness";

const TZ = "Europe/Madrid";

// ── Texto con párrafos y enlaces automáticos ──
test("rich text: párrafos por línea en blanco y saltos de línea dentro del párrafo", () => {
  const p = parseRichText("Hola\nque tal\n\n\nSegundo párrafo\r\n\r\n   \n");
  eq(p.length, 2);
  eq(p[0].length, 2, "dos líneas en el primer párrafo");
  eq(p[1], [[{ kind: "text", text: "Segundo párrafo" }]]);
});

test("rich text: enlaces https, http y www; la puntuación final se queda fuera", () => {
  eq(linkifyLine("Mira https://ejemplo.com/a?b=1."), [
    { kind: "text", text: "Mira " },
    { kind: "link", text: "https://ejemplo.com/a?b=1", href: "https://ejemplo.com/a?b=1" },
    { kind: "text", text: "." },
  ]);
  eq(linkifyLine("(en www.ejemplo.es)")[1], { kind: "link", text: "www.ejemplo.es", href: "https://www.ejemplo.es/" });
  eq(linkifyLine("https://es.wikipedia.org/wiki/Luna_(satélite)")[0].kind, "link");
  eq((linkifyLine("https://es.wikipedia.org/wiki/Luna_(sat)")[0] as { text: string }).text, "https://es.wikipedia.org/wiki/Luna_(sat)");
});

test("rich text: emails como mailto", () => {
  eq(linkifyLine("Escríbeme a hola@analuna.es.")[1], { kind: "link", text: "hola@analuna.es", href: "mailto:hola@analuna.es", email: true });
});

test("rich text: nada de javascript: ni HTML", () => {
  eq(safeUrl("javascript:alert(1)"), null);
  const segs = linkifyLine('<a href="javascript:alert(1)">x</a> <script>alert(1)</script>');
  ok(segs.every((s) => s.kind === "text"), "ningún enlace");
});

test("RichText: escapa el HTML y los enlaces llevan rel=noopener nofollow", async () => {
  // tsx compila el JSX del componente con React global (Next no lo necesita).
  (globalThis as { React?: typeof React }).React = React;
  const { RichText } = await import("../../components/creator-page/rich-text");
  const html = renderToStaticMarkup(createElement(RichText, { text: "<script>alert(1)</script>\n\nVisita https://ejemplo.com" }));
  ok(!html.includes("<script>"), "no hay etiqueta script");
  ok(html.includes("&lt;script&gt;"), "el texto se ve escapado");
  ok(html.includes('href="https://ejemplo.com/"'), html);
  ok(html.includes('rel="noopener nofollow"') && html.includes('target="_blank"'), html);
  eq((html.match(/<p/g) ?? []).length, 2);
});

test("truncateWords corta en una palabra y añade «…»", () => {
  eq(truncateWords("uno dos tres cuatro cinco", 12), "uno dos…");
  eq(truncateWords("corto", 12), "corto");
});

// ── Publicaciones ──
test("postFormSchema: título obligatorio, extracto vacío → null, estado válido", () => {
  ok(!postFormSchema.safeParse({ title: "a", body: "x", status: "DRAFT" }).success);
  ok(!postFormSchema.safeParse({ title: "Hola", body: "", status: "DRAFT" }).success);
  ok(!postFormSchema.safeParse({ title: "Hola", body: "x", status: "OTRO" }).success);
  ok(!postFormSchema.safeParse({ title: "Hola", body: "x", status: "DRAFT", publishedOn: "15/10/2026" }).success);
  const r = postFormSchema.parse({ title: " Hola ", body: "Texto", status: "PUBLISHED", excerpt: "  ", publishedOn: "" });
  eq([r.title, r.excerpt], ["Hola", null]);
});

test("postSlugBase: del slug escrito, si no del título; nunca vacío", () => {
  eq(postSlugBase("Eclipse de octubre: qué cierra"), "eclipse-de-octubre-que-cierra");
  eq(postSlugBase("Título", "Mi Dirección"), "mi-direccion");
  eq(postSlugBase("¡¡!!"), "publicacion");
});

test("ownImageUrl: solo imágenes subidas aquí o de la demo", () => {
  eq([ownImageUrl("/media/abc/x.webp"), ownImageUrl("/demo/a.webp"), ownImageUrl("https://evil.com/x.png"), ownImageUrl("/media/../x"), ownImageUrl("")], [
    "/media/abc/x.webp",
    "/demo/a.webp",
    null,
    null,
    null,
  ]);
});

test("resolvePublishedAt: publicar sin fecha → ahora; conserva la fecha ya publicada; borrador sin fecha → null", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  eq(resolvePublishedAt({ status: "PUBLISHED", current: null, timeZone: TZ, now }), now);
  const before = new Date("2026-10-01T08:00:00Z");
  eq(resolvePublishedAt({ status: "PUBLISHED", current: before, timeZone: TZ, now }), before);
  eq(resolvePublishedAt({ status: "DRAFT", current: null, timeZone: TZ, now }), null);
});

test("resolvePublishedAt: una fecha elegida es a las 9:00 en su zona; hoy es ahora", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  eq(resolvePublishedAt({ status: "PUBLISHED", publishedOn: "2026-10-20", current: null, timeZone: TZ, now }), new Date("2026-10-20T07:00:00Z"));
  eq(resolvePublishedAt({ status: "PUBLISHED", publishedOn: "2026-10-15", current: null, timeZone: TZ, now }), now);
  const kept = new Date("2026-10-03T16:30:00Z");
  eq(resolvePublishedAt({ status: "PUBLISHED", publishedOn: "2026-10-03", current: kept, timeZone: TZ, now }), kept);
});

test("isPostPublic / postState: borrador, programada y publicada", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  eq(isPostPublic({ status: "DRAFT", publishedAt: new Date("2026-10-01") }, now), false);
  eq(isPostPublic({ status: "PUBLISHED", publishedAt: null }, now), false);
  eq(postState({ status: "PUBLISHED", publishedAt: new Date("2026-10-20") }, now), "SCHEDULED");
  eq(postState({ status: "PUBLISHED", publishedAt: new Date("2026-10-01") }, now), "PUBLISHED");
  eq(postState({ status: "DRAFT", publishedAt: null }, now), "DRAFT");
});

test("postExcerpt y readingMinutes", () => {
  eq(postExcerpt({ excerpt: "  Resumen  ", body: "x" }), "Resumen");
  eq(postExcerpt({ excerpt: null, body: "Primera línea\n\nSegunda" }), "Primera línea Segunda");
  eq(readingMinutes("hola"), 1);
  eq(readingMinutes(Array(1000).fill("palabra").join(" ")), 5);
});

test("«novedades» está reservado como slug de producto y como usuario", () => {
  ok(RESERVED_PRODUCT_SLUGS.has("novedades"));
  eq(validateUsername("novedades"), "Este nombre está reservado");
});

// ── Códigos de descuento ──
test("parseShopUrl: https obligatoria; sin esquema se añade https", () => {
  eq(parseShopUrl("https://tienda.com/x"), { ok: true, url: "https://tienda.com/x" });
  eq(parseShopUrl("tienda.com"), { ok: true, url: "https://tienda.com/" });
  ok(!parseShopUrl("http://tienda.com").ok);
  ok(!parseShopUrl("javascript:alert(1)").ok);
  ok(!parseShopUrl("").ok);
  ok(!parseShopUrl("https://localhost").ok);
});

test("discountCodeFormSchema: código sin espacios y marca obligatoria", () => {
  ok(!discountCodeFormSchema.safeParse({ brand: "Marca", code: "ANA 15" }).success);
  ok(!discountCodeFormSchema.safeParse({ brand: "", code: "ANA15" }).success);
  eq(discountCodeFormSchema.parse({ brand: " Marca ", code: "ANA15", description: "" }).description, null);
});

test("caducidad: vale todo el día elegido en la zona de la creadora", () => {
  const exp = expiryFromDateKey("2026-12-31", TZ)!;
  eq(exp, new Date("2026-12-31T23:00:00Z"));
  eq(dateKeyFromExpiry(exp, TZ), "2026-12-31");
  eq(expiryFromDateKey("", TZ), null);
  eq(isCodeVisible({ active: true, expiresAt: exp }, new Date("2026-12-31T22:59:00Z")), true);
  eq(isCodeVisible({ active: true, expiresAt: exp }, new Date("2026-12-31T23:00:00Z")), false);
  eq(isCodeVisible({ active: false, expiresAt: null }), false);
  eq(codeState({ active: false, expiresAt: new Date("2020-01-01") }), "EXPIRED");
  eq(expiryLabel(exp, TZ), "Válido hasta el 31 de diciembre");
});

// ── Bloques de texto y secciones nuevas ──
test("withAllSections: las secciones nuevas entran visibles tras la anterior del orden por defecto", () => {
  const old = ["links", "products", "sessions", "courses", "memberships", "testimonials", "faq", "contact"].map((key) => ({ key, enabled: true })) as never;
  const keys = withAllSections(old).map((s) => s.key);
  eq(keys, ["links", "blocks", "products", "sessions", "courses", "memberships", "posts", "codes", "testimonials", "faq", "contact"]);
  // Respeta el orden elegido y no duplica.
  const custom = withAllSections([{ key: "faq", enabled: false }, { key: "links", enabled: true }, { key: "faq", enabled: true }]);
  eq(custom.filter((s) => s.key === "faq").length, 1);
  eq(custom[0], { key: "faq", enabled: false });
  eq(custom.length, SECTION_KEYS.length);
  ok(custom.filter((s) => s.key !== "faq" && s.key !== "links").every((s) => s.enabled), "las nuevas, visibles");
});

test("readPageConfig: una página guardada antes de los bloques sigue valiendo", () => {
  const cfg = readPageConfig({ displayName: "Ana", sections: [{ key: "links", enabled: true }] });
  eq(cfg.displayName, "Ana");
  eq(cfg.blocks, []);
  ok(cfg.sections.some((s) => s.key === "posts" && s.enabled));
});

test("bloques de texto: título o texto obligatorio; botón con texto y enlace", () => {
  const base = { displayName: "Ana" };
  ok(pageConfigSchema.safeParse({ ...base, blocks: [{ id: "a", title: "Sobre mí", body: "" }] }).success);
  ok(!pageConfigSchema.safeParse({ ...base, blocks: [{ id: "a", title: "", body: "" }] }).success);
  ok(!pageConfigSchema.safeParse({ ...base, blocks: [{ id: "a", title: "x", body: "", buttonLabel: "Reservar" }] }).success);
  ok(!pageConfigSchema.safeParse({ ...base, blocks: [{ id: "a", title: "x", body: "", buttonUrl: "https://x.com" }] }).success);
  const cfg = pageConfigSchema.parse({ ...base, blocks: [{ id: "a", title: "x", body: "" }, { id: "b", title: "y", body: "", enabled: false }] });
  eq(visibleTextBlocks(cfg).map((b) => b.id), ["a"]);
});

// ── Métricas ──
test("eventos: los de códigos van por /api/track; compras e inscripciones solo el servidor", () => {
  ok(EVENT_TYPES.includes("CODE_COPY") && EVENT_TYPES.includes("CODE_CLICK"));
  eq([isCodeEvent("CODE_COPY"), isCodeEvent("CODE_CLICK"), isCodeEvent("PRODUCT_CLICK")], [true, true, false]);
  eq([...SERVER_ONLY_EVENT_TYPES], ["PURCHASE", "SIGNUP"]);
});
