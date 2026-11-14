/**
 * Editor de la página: bloques con tipo (texto, imagen, galería, vídeo, foto y texto, tarjetas, cita y
 * trayectoria), páginas extra y sus rutas.
 * Funciones puras y render de los bloques (sin BD ni servidor).
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { ContentBlocks } from "../../components/creator-page/content-blocks";
import { LegacyText } from "../../components/rich-text/legacy-text";
import { processImage } from "../../lib/images";
import { imageSrcSet } from "../../lib/media-url";
import {
  contentBlockSchema,
  embedProblem,
  HOME_BLOCKS_MAX,
  isEmptyBlock,
  isOwnImageSrc,
  isOwnVideoSrc,
  newBlock,
  pageVideoUrl,
  parsePageVideoPath,
  readBlocks,
  videoOrientation,
  visibleBlocks,
  withoutEmptyBlocks,
  type ContentBlock,
} from "../../lib/page-blocks";
import { pageConfigSchema, readPageConfig, visibleTextBlocks } from "../../lib/page-config";
import { isForeignCreatorPath, ownerPageRewrite } from "../../lib/personal-routing";
import { linksToProduct } from "../../lib/access-mode";
import {
  readSitePageContent,
  sitePageContentSchema,
  sitePagePath,
  sitePageSlugBase,
  sitePageSlugProblem,
  sitePageState,
  SITE_PAGE_TEMPLATES,
  starterContent,
} from "../../lib/site-pages";
import { RESERVED_PRODUCT_SLUGS } from "../../lib/slug";
import { eq, ok, test } from "./harness";

void React;
const CID = "cabc1234567890";
const IMG = `/media/${CID}/0123456789abcdef0123.webp`;
const OTHER = "/media/cmaria99999999/0123456789abcdef0123.webp";
const VIDEO = `/media/video/${CID}/0123456789abcdef01234567.mov`;
const schema = contentBlockSchema({ bodyMax: 2000 });
const parse = (b: unknown) => schema.safeParse(b);
const err = (b: unknown) => {
  const r = parse(b);
  return r.success ? null : r.error.issues[0].message;
};
const image = { src: IMG, alt: "Texto del gráfico", width: 1080, height: 1920 };

// ── Esquema de los bloques ──
test("bloques: uno guardado sin `kind` se lee como texto con su título, texto y botón", () => {
  const r = parse({ id: "b1", title: "Cómo trabajo", body: "Hola", buttonLabel: "Agenda", buttonUrl: "https://calendly.com/x", enabled: true });
  ok(r.success);
  eq(r.data.kind, "text");
  const t = r.data as Extract<ContentBlock, { kind: "text" }>;
  eq([t.title, t.body, t.buttonLabel, t.buttonUrl, t.format], ["Cómo trabajo", "Hola", "Agenda", "https://calendly.com/x", undefined]);
});

test("bloques: los 3 mensajes del bloque de texto siguen saliendo", () => {
  eq(err({ id: "a", title: "", body: "" }), "Cada bloque de texto necesita un título o un texto");
  eq(err({ id: "a", title: "T", buttonLabel: "Ir" }), "Falta el enlace del botón «Ir»");
  eq(err({ id: "a", title: "T", buttonUrl: "https://x.es" }), "Escribe el texto del botón del bloque de texto");
});

test("bloques: imagen, galería y vídeo con sus errores", () => {
  eq(err({ id: "i", kind: "image", image: null }), "Falta la imagen de un bloque de imagen");
  eq(err({ id: "g", kind: "gallery", images: [] }), "Añade al menos una imagen a la galería");
  ok(err({ id: "g", kind: "gallery", images: Array.from({ length: 13 }, () => image) })?.includes("Máximo 12"));
  eq(err({ id: "v", kind: "video" }), "Falta el vídeo: súbelo o pega un enlace de YouTube o Vimeo");
  const upload = { src: VIDEO, width: 1080, height: 1920, durationSec: 5, codec: "HEVC", sizeBytes: 1000 };
  eq(err({ id: "v", kind: "video", upload, embedUrl: "https://youtu.be/dQw4w9WgXcQ" }), "Elige subir el vídeo o pegar un enlace, no las dos cosas");
  eq(err({ id: "v", kind: "video", embedUrl: "https://instagram.com/reel/abc" }), "Ese enlace de vídeo no es de YouTube ni de Vimeo");
  eq(err({ id: "x", kind: "producto" }) !== null, true, "un kind desconocido no valida");
  eq(err({ id: "i", kind: "image", image: { ...image, src: "https://evil.example/x.png" } }) !== null, true, "una imagen de fuera no valida");
});

test("bloques: layout y codec desconocidos se corrigen sin invalidar", () => {
  const g = parse({ id: "g", kind: "gallery", images: [image], layout: "mosaico" });
  ok(g.success);
  eq((g.data as Extract<ContentBlock, { kind: "gallery" }>).layout, "carousel");
  const v = parse({ id: "v", kind: "video", upload: { src: VIDEO, width: 1, height: 1, durationSec: 1, codec: "AV1", sizeBytes: 1 } });
  ok(v.success);
  eq((v.data as Extract<ContentBlock, { kind: "video" }>).upload?.codec, null);
});

test("readPageConfig: un bloque dañado se descarta y el resto de la página queda igual", () => {
  const raw = {
    displayName: "Cirella",
    tagline: "Mi frase",
    blocks: [{ id: "a", title: "Bueno" }, { id: "b", kind: "image", image: { src: "javascript:alert(1)" } }, { id: "c", kind: "gallery", images: [image] }],
  };
  const cfg = readPageConfig(raw);
  eq(cfg.tagline, "Mi frase", "no cae en la página por defecto");
  eq(cfg.blocks?.map((b) => b.id), ["a", "c"]);
  eq(readPageConfig({ displayName: "Cirella" }).blocks, [], "una página de antes de los bloques");
  eq(pageConfigSchema.safeParse({ displayName: "Cirella", blocks: Array.from({ length: HOME_BLOCKS_MAX + 1 }, (_, i) => ({ id: `b${i}`, title: "x" })) }).success, false);
});

test("visibleBlocks por tipo; visibleTextBlocks sigue siendo su alias", () => {
  const blocks = readBlocks(
    [
      { id: "a", title: "Visible" },
      { id: "b", title: "Oculto", enabled: false },
      { id: "c", kind: "image", image },
      { id: "d", kind: "video", embedUrl: "https://youtu.be/dQw4w9WgXcQ" },
    ],
    schema,
    20,
  );
  eq(visibleBlocks(blocks).map((b) => b.id), ["a", "c", "d"]);
  eq(visibleTextBlocks({ blocks }).map((b) => b.id), ["a", "c", "d"]);
});

test("isEmptyBlock: los nuevos de imagen, galería y vídeo están vacíos; un texto con solo el enlace no", () => {
  for (const k of ["image", "gallery", "video", "text"] as const) eq(isEmptyBlock(newBlock(k, k)), true, k);
  eq(isEmptyBlock({ ...(newBlock("text", "t") as Extract<ContentBlock, { kind: "text" }>), buttonUrl: "https://x.es" }), false);
  eq((newBlock("text", "t") as Extract<ContentBlock, { kind: "text" }>).format, "MD", "el texto nuevo nace con formato");
});

test("bloques: foto y texto, tarjetas, cita y trayectoria con sus errores", () => {
  eq(err({ id: "p", kind: "photoText", title: "Mi historia" }), "Falta la foto de un bloque «Foto y texto»");
  eq(err({ id: "p", kind: "photoText", image }), "Cada bloque «Foto y texto» necesita un título o un texto");
  ok(parse({ id: "p", kind: "photoText", image, title: "T", imageSide: "arriba" }).success, "un lado desconocido se corrige");
  ok(parse({ id: "p", kind: "photoText", image, title: "T" }).success, "el botón es opcional");
  eq(err({ id: "c", kind: "cards", cards: [] }), "Añade al menos una tarjeta al bloque de tarjetas");
  eq(err({ id: "c", kind: "cards", cards: [{ text: "x" }] }), "Cada tarjeta necesita un título");
  ok(err({ id: "c", kind: "cards", cards: Array.from({ length: 9 }, () => ({ title: "x" })) })?.includes("Máximo 8"));
  eq(err({ id: "q", kind: "quote", text: " " }), "Escribe la frase de la cita");
  eq(err({ id: "t", kind: "timeline", items: [] }), "Añade al menos un hito a la trayectoria");
  ok(parse({ id: "t", kind: "timeline", items: [{ label: "2020", title: "Certificación" }] }).success);
});

test("withoutEmptyBlocks: quita los bloques nuevos vacíos y las tarjetas e hitos en blanco", () => {
  for (const k of ["photoText", "cards", "quote", "timeline"] as const) eq(isEmptyBlock(newBlock(k, k)), true, k);
  const cards = { ...(newBlock("cards", "c") as Extract<ContentBlock, { kind: "cards" }>), cards: [{ image: null, title: "Uno", text: "" }, { image: null, title: "", text: "" }] };
  const out = withoutEmptyBlocks([newBlock("timeline", "t"), cards]);
  eq(out.map((b) => b.id), ["c"]);
  eq((out[0] as Extract<ContentBlock, { kind: "cards" }>).cards.length, 1);
});

// ── Imágenes y vídeos propios ──
test("isOwnImageSrc: /media/<cid>/<20hex>.webp y /demo; nada de fuera", () => {
  ok(isOwnImageSrc(IMG));
  ok(isOwnImageSrc(IMG, CID));
  ok(isOwnImageSrc("/demo/hero.webp"));
  for (const bad of ["/media/../x", "https://x.es/a.webp", "javascript:alert(1)", "data:image/png;base64,AAA", "//evil.example/a.webp", "/media/abc/0123.webp"]) eq(isOwnImageSrc(bad), false, bad);
  eq(isOwnImageSrc(OTHER, CID), false, "la de otra creadora");
});

test("vídeo de la página: dirección, propiedad y clave del almacenamiento", () => {
  eq(pageVideoUrl(CID, "0123456789abcdef01234567.mov"), VIDEO);
  ok(isOwnVideoSrc(VIDEO, CID));
  eq(isOwnVideoSrc(VIDEO, "cmaria99999999"), false);
  eq(parsePageVideoPath([CID, "0123456789abcdef01234567.mov"]), { creatorId: CID, file: "0123456789abcdef01234567.mov", ext: "mov", key: `public/video/${CID}/0123456789abcdef01234567.mov` });
  for (const bad of [
    [CID, "0123456789abcdef01234567.exe"],
    [CID, "0123456789abcdef0123456.mp4"],
    [CID, "0123456789ABCDEF01234567.mp4"],
    ["..", "0123456789abcdef01234567.mp4"],
    [CID, "x", "0123456789abcdef01234567.mp4"],
  ])
    eq(parsePageVideoPath(bad), null, bad.join("/"));
  eq(videoOrientation(1080, 1920), "vertical");
  eq(videoOrientation(1920, 1080), "horizontal");
  eq(videoOrientation(1000, 1010), "cuadrado");
  eq(videoOrientation(null, 10), null);
});

test("embedProblem: YouTube y Vimeo valen; Instagram no (con «súbelo» solo en la web personal)", () => {
  for (const u of ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://vimeo.com/123456789/abcdef1234"]) eq(embedProblem(u, true), null, u);
  ok(embedProblem("https://instagram.com/reel/abc", true)?.includes("súbelo"));
  ok(!embedProblem("https://instagram.com/reel/abc", false)?.includes("súbelo"));
});

test("imageSrcSet con el ancho real: sin variantes más grandes que la imagen", () => {
  eq(imageSrcSet(IMG, 1080), `${IMG.slice(0, -5)}-w400.webp 400w, ${IMG.slice(0, -5)}-w800.webp 800w, ${IMG} 1080w`);
  ok(imageSrcSet(IMG)?.endsWith(`${IMG} 1600w`), "sin ancho, como siempre");
});

// ── Páginas extra ──
test("sitePagePath y sitePageSlugBase", () => {
  eq(sitePagePath("ana", "sobre-mi", true), "/sobre-mi");
  eq(sitePagePath("ana", "sobre-mi", false), "/ana/p/sobre-mi");
  eq(sitePageSlugBase("Sobre mí"), "sobre-mi");
  eq(sitePageSlugBase("¡!", ""), "pagina");
});

test("sitePageSlugProblem: rutas de la web, la dueña y formatos no válidos", () => {
  for (const bad of ["panel", "cuenta", "novedades", "legal", "entrar", "ana", "", "a".repeat(61), "Sobre-Mi", "sobre_mi", "-x"]) ok(sitePageSlugProblem(bad, "ana"), `«${bad}» debería rechazarse`);
  eq(sitePageSlugProblem("mentoria-3-meses", "ana"), null);
});

test("ownerPageRewrite: /sobre-mi → la página de la dueña", () => {
  eq(ownerPageRewrite("/sobre-mi", "ana"), "/ana/p/sobre-mi");
  eq(ownerPageRewrite("/sobre-mi/", "ana"), "/ana/p/sobre-mi");
  eq(ownerPageRewrite("/%73obre-mi", "ana"), "/ana/p/sobre-mi");
  for (const p of ["/ana", "/panel", "/wp-login.php", "/Sobre-Mi", "/maria/yoga", "/", "/_no-existe", "/sobre_mi", "//sobre-mi"]) eq(ownerPageRewrite(p, "ana"), null, p);
  eq(ownerPageRewrite("/sobre-mi", null), null, "en la plataforma no hay alias en la raíz");
});

test("las reglas de otras usuarias no cambian: /maria/yoga sigue siendo ajeno", () => {
  eq(isForeignCreatorPath("/maria/yoga", "ana"), true);
  eq(isForeignCreatorPath("/ana/p/sobre-mi", "ana"), false);
  eq(isForeignCreatorPath("/panel/paginas", "ana"), false);
});

test("«p» es un slug de producto reservado y una página extra no parece un producto", () => {
  ok(RESERVED_PRODUCT_SLUGS.has("p"));
  eq(linksToProduct("/ana/p/sobre-mi", "ana", new Set(["sobre-mi"])), false);
});

test("contenido de una página: título obligatorio, 40 bloques como mucho y lectura tolerante", () => {
  eq(sitePageContentSchema.safeParse({ title: "" }).success, false);
  eq(sitePageContentSchema.safeParse({ title: "x", blocks: Array.from({ length: 41 }, (_, i) => ({ id: `b${i}`, title: "x" })) }).success, false);
  const c = readSitePageContent({ title: "Sobre mí", blocks: [{ id: "a", title: "Bien" }, { id: "b", kind: "image" }], cover: { src: "https://x" } }, "X");
  eq(c.blocks.map((b) => b.id), ["a"]);
  eq(c.cover, null);
  eq(readSitePageContent(null, "Respaldo").title, "Respaldo");
  for (const t of SITE_PAGE_TEMPLATES) ok(sitePageContentSchema.safeParse(starterContent(t)).success, t);
});

test("sitePageState: borrador, publicada y con cambios", () => {
  const a = { title: "A" };
  eq(sitePageState({ status: "DRAFT", draft: a, published: null }), "DRAFT");
  eq(sitePageState({ status: "DRAFT", draft: a, published: a }), "DRAFT", "despublicada");
  eq(sitePageState({ status: "PUBLISHED", draft: a, published: a }), "PUBLISHED");
  eq(sitePageState({ status: "PUBLISHED", draft: { title: "B" }, published: a }), "CHANGES");
});

// ── Perfil «graphic» ──
test("processImage graphic: una historia de 1080×1920 no se encoge (photo la deja en 900×1600)", async () => {
  const png = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#e0d0f0" } }).png().toBuffer();
  const g = await processImage(png, { profile: "graphic" });
  eq([g.width, g.height], [1080, 1920]);
  const p = await processImage(png);
  eq([p.width, p.height], [900, 1600]);
  const tall = await processImage(await sharp({ create: { width: 1200, height: 5000, channels: 3, background: "#fff" } }).png().toBuffer(), { profile: "graphic" });
  ok(tall.height <= 4000, `${tall.width}×${tall.height}`);
});

// ── Render ──
const render = (blocks: unknown[], hidden: string[] = []) =>
  renderToStaticMarkup(createElement(ContentBlocks, { blocks: readBlocks(blocks, schema, 20), username: "ana", titleLevel: 3, hiddenSlugs: new Set(hidden) }));

test("ContentBlocks: un bloque de antes pinta el mismo texto que LegacyText «links»", () => {
  const body = "Hola https://example.com/x\n\nSegundo";
  const html = render([{ id: "a", title: "T", body }]);
  const legacy = renderToStaticMarkup(createElement(LegacyText, { text: body, flavor: "links", className: "cp-muted space-y-3 text-[0.95rem] leading-relaxed mt-3" }));
  ok(html.includes(legacy), html);
  ok(html.includes('<h3 class="cp-display'));
});

test("ContentBlocks: imagen con medidas, srcset, alt y enlaces seguros", () => {
  const html = render([
    { id: "i", kind: "image", image, href: "https://shop.example/x" },
    { id: "j", kind: "image", image, href: "javascript:alert(1)" },
    { id: "z", kind: "image", image },
  ]);
  ok(html.includes('width="1080"') && html.includes('height="1920"'));
  ok(html.includes("-w400.webp 400w"));
  ok(html.includes('alt="Texto del gráfico"'));
  ok(html.includes('rel="noopener noreferrer"'));
  ok(!html.includes('href="javascript:'), "nunca un href javascript:");
  ok(html.includes('loading="lazy"'));
  ok(html.includes("Ampliar imagen"), "sin enlace, se amplía");
});

test("ContentBlocks: vídeo subido, YouTube sin cargar nada de fuera, y src ajenos fuera", () => {
  const upload = { src: VIDEO, width: 1080, height: 1920, durationSec: 5, codec: "H264", sizeBytes: 1000 };
  const html = render([{ id: "v", kind: "video", upload, poster: IMG }]);
  ok(/<video[^>]*playsInline|<video[^>]*playsinline/i.test(html), html);
  ok(html.includes(`src="${VIDEO}"`));
  ok(html.includes('preload="none"'), "con portada no descarga nada antes de ▶");
  ok(!/autoplay/i.test(html), "nunca en reproducción automática");
  const yt = render([{ id: "y", kind: "video", embedUrl: "https://youtu.be/dQw4w9WgXcQ" }]);
  ok(!yt.includes("<iframe"), "el reproductor de YouTube solo al pulsar ▶");
  ok(yt.includes("Reproducir"));
  const evil = render([{ id: "e", kind: "gallery", images: [{ ...image, src: "https://evil.example/a.webp" }] }]);
  eq(evil, "");
});

test("ContentBlocks: sin botón hacia un producto oculto (web personal sin cobros)", () => {
  const html = render([{ id: "a", title: "T", body: "x", buttonLabel: "Comprar", buttonUrl: "/ana/lectura" }], ["lectura"]);
  ok(!html.includes("Comprar"));
});

test("ContentBlocks: foto y texto, tarjetas enlazadas, cita y trayectoria", () => {
  const html = render([
    { id: "p", kind: "photoText", image, title: "Mi historia", body: "Hace **8 años**", format: "MD", imageSide: "right" },
    { id: "c", kind: "cards", title: "Mis métodos", cards: [{ title: "Human Design", text: "Tu manual", href: "/ana/p/human-design", image }, { title: "Oculta", href: "/ana/lectura" }] },
    { id: "q", kind: "quote", text: "Recordar quién eres", author: "Cirella" },
    { id: "t", kind: "timeline", title: "Mi trayectoria", items: [{ label: "2018", title: "Empiezo" }] },
  ], ["lectura"]);
  ok(html.includes('data-side="right"') && html.includes("sm:order-last"));
  ok(html.includes("<strong>8 años</strong>"), html);
  ok(/<a href="\/ana\/p\/human-design" class="cp-card cp-card-hover/.test(html), "la tarjeta entera es el enlace");
  ok(!html.includes('href="/ana/lectura"'), "sin enlace hacia un producto oculto");
  ok(html.includes("<blockquote") && html.includes("Cirella</figcaption>"));
  ok(html.includes("<ol") && html.includes("2018"));
});
