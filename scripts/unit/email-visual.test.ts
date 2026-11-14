/**
 * Editor visual de la newsletter: cada bloque nuevo en HTML de email (portada con foto de fondo,
 * título de color, texto, botón, destacado, vídeo, dos columnas, redes, separador), limpieza de lo
 * que llega (colores solo hex, enlaces seguros), contraste, estilo general, plantillas, texto plano
 * y compatibilidad con los diseños guardados antes.
 */
import { contrastRatio, mixHex, normalizeHex, textOn } from "../../lib/colors";
import { DEFAULT_EMAIL_STYLE, lintDesign, parseDesignStrict, readDesign, readStyle, videoWatchPath, type EmailDesign } from "../../lib/email-blocks";
import { STARTERS, brandPalette, starterDesign } from "../../lib/email-starters";
import { renderDesignHtml, renderDesignParts, socialLink } from "../../lib/email/blocks-html";
import { designEmailHtml, webFontsLink } from "../../lib/email/design-layout";
import { campaignEmail } from "../../lib/email/newsletter-templates";
import { htmlToText } from "../../lib/email/plain-text";
import { buildResendRequest } from "../../lib/email/providers/resend";
import { eq, ok, test } from "./harness";

const BASE = "https://cirella.app";
const IMG = "/media/abc123/0123456789abcdef0123.jpg";
const VIDEO = "/media/video/cabc1234567/0123456789abcdef01234567.mp4";
const design = (blocks: unknown[], style?: unknown): EmailDesign => readDesign({ v: 1, blocks, ...(style ? { style } : {}) })!;
const html = (blocks: unknown[], style?: unknown) => renderDesignParts(design(blocks, style), { baseUrl: BASE, vars: { nombre: "Laura" } }).map((p) => p.html).join("");

// ── Colores ──

test("normalizeHex: solo #RRGGBB (también #abc), nada de CSS colado", () => {
  eq(normalizeHex("#abc"), "#AABBCC");
  eq(normalizeHex("b4583f"), "#B4583F");
  for (const bad of ["red", "#12345", "#1234567", "url(x)", "#000;background:url(x)", "", null, 5]) eq(normalizeHex(bad), null, String(bad));
});

test("contraste WCAG: negro/blanco 21, iguales 1, gris claro sobre blanco no llega a 4,5", () => {
  eq(contrastRatio("#000000", "#FFFFFF"), 21);
  eq(contrastRatio("#777777", "#777777"), 1);
  ok(contrastRatio("#AAAAAA", "#FFFFFF") < 4.5);
  eq(textOn("#0E1024"), "#FFFFFF");
  eq(textOn("#F6F1E7"), "#0E1024");
  eq(mixHex("#000000", "#FFFFFF", 0.5), "#808080");
});

// ── Limpieza ──

test("colores: lo que no es hex se descarta (opcionales) o vuelve al de por defecto (obligatorios)", () => {
  const d = design([
    { id: "t", t: "title", text: "Hola", align: "left", color: "red;background:url(javascript:alert(1))", bg: "#fff" },
    { id: "s", t: "spotlight", icon: "✨", title: "X", body: "", bg: "expression(alert(1))", accent: "#6b58c4", border: "left" },
  ]);
  const t = d.blocks[0] as { color?: string; bg?: string };
  eq(t.color, undefined);
  eq(t.bg, "#FFFFFF");
  eq((d.blocks[1] as { bg: string }).bg, "#F4EFFC");
  eq((d.blocks[1] as { accent: string }).accent, "#6B58C4");
  const out = html(d.blocks);
  ok(!/javascript|expression|url\(x/i.test(out), out);
});

test("enlaces: javascript: y data: no pasan; las rutas de la web salen absolutas", () => {
  const bad = parseDesignStrict({ v: 1, blocks: [{ id: "b", t: "button", label: "Ir", href: "javascript:alert(1)", align: "center" }] });
  ok(!bad.ok && /enlace/.test(bad.error));
  const heroBad = parseDesignStrict({ v: 1, blocks: [{ id: "h", t: "hero", image: "", alt: "", overlay: "#000000", opacity: 0, title: "T", subtitle: "", color: "#FFFFFF", align: "center", height: "m", buttonLabel: "x", buttonHref: "data:text/html,hi" }] });
  ok(!heroBad.ok);
  const out = html([{ id: "b", t: "button", label: "Reservar", href: "/ana/lectura", align: "center" }]);
  ok(out.includes(`href="${BASE}/ana/lectura"`), out);
});

test("imágenes y vídeos: solo los subidos aquí; el vídeo, YouTube/Vimeo o /media/video", () => {
  eq((design([{ id: "h", t: "hero", image: "https://evil.io/x.jpg", alt: "", overlay: "#000000", opacity: 0, title: "T", subtitle: "", color: "#FFFFFF", align: "center", height: "m" }]).blocks[0] as { image: string }).image, "");
  ok(!parseDesignStrict({ v: 1, blocks: [{ id: "v", t: "video", url: "https://evil.io/watch?v=x", src: "", cover: "", title: "" }] }).ok);
  ok(!parseDesignStrict({ v: 1, blocks: [{ id: "v", t: "video", url: "", src: "/media/video/../../etc/passwd", cover: "", title: "" }] }).ok);
  ok(!parseDesignStrict({ v: 1, blocks: [{ id: "v", t: "video", url: "https://youtu.be/dQw4w9WgXcQ", src: VIDEO, cover: "", title: "" }] }).ok, "enlace y archivo a la vez");
  ok(parseDesignStrict({ v: 1, blocks: [{ id: "v", t: "video", url: "https://youtu.be/dQw4w9WgXcQ", src: "", cover: IMG, title: "Mira" }] }).ok);
});

test("compatibilidad: los bloques de antes se leen tal cual y sin estilo salen como siempre", () => {
  const old = { v: 1, blocks: [{ id: "t", t: "title", text: "Hola", align: "left" }, { id: "x", t: "text", body: "Uno" }, { id: "b", t: "button", label: "Ir", href: "/x", align: "center" }, { id: "d", t: "divider" }, { id: "s", t: "spacer", size: "m" }] };
  const d = readDesign(old)!;
  eq(d, old as EmailDesign);
  eq(d.style, undefined);
  const out = renderDesignHtml(d, { baseUrl: BASE });
  ok(out.includes("font-size:24px") && out.includes("color:#0E1024") && out.includes('border-top:1px solid #E9E2D3'), out);
  ok(out.includes('bgcolor="#0E1024"') && out.includes("color:#F6F1E7"), "el botón de siempre: tinta y crema");
});

test("readStyle: lo que falta o no vale, el de siempre", () => {
  eq(readStyle({}), DEFAULT_EMAIL_STYLE);
  eq(readStyle({ bg: "#000", width: 9999, headingFont: "comic-sans", radius: "xxl" }), { ...DEFAULT_EMAIL_STYLE, bg: "#000000" });
});

// ── Cada bloque ──

test("portada: foto de fondo con color de reserva, VML para Outlook, capa, título, subtítulo y botón", () => {
  const out = html([{ id: "h", t: "hero", image: IMG, alt: "El mar", overlay: "#14163a", opacity: 40, title: "Luna <llena>", subtitle: "Hola, {nombre}", color: "#ffffff", align: "center", height: "l", buttonLabel: "Reservar", buttonHref: "/ana/lectura" }]);
  ok(out.includes(`background="${BASE}${IMG}"`) && out.includes('bgcolor="#14163A"') && out.includes(`background-image:url('${BASE}${IMG}')`), out);
  ok(out.includes("<v:rect") && out.includes(`<v:fill type="frame" src="${BASE}${IMG}" color="#14163A"`), "VML");
  ok(out.includes("background-color:rgba(20,22,58,0.4)"), "capa");
  ok(out.includes("Luna &lt;llena&gt;") && out.includes("Hola, Laura") && out.includes(">Reservar</a>") && out.includes("El mar"), out);
  const plain = html([{ id: "h", t: "hero", image: "", alt: "", overlay: "#B4583F", opacity: 40, title: "Solo color", subtitle: "", color: "#FFFFFF", align: "left", height: "s" }]);
  ok(plain.includes('bgcolor="#B4583F"') && !plain.includes("v:rect") && !plain.includes("rgba("), plain);
});

test("título: color, fondo, tamaño, alineación y tipo de letra", () => {
  const out = html([{ id: "t", t: "title", text: "Novedades", align: "right", size: "xl", color: "#ffffff", bg: "#b4583f", font: "playfair" }]);
  ok(out.includes("font-size:38px") && out.includes("color:#FFFFFF") && out.includes('bgcolor="#B4583F"') && out.includes("text-align:right") && out.includes("'Playfair Display',Georgia,serif"), out);
});

test("texto: color, tipo de letra, alineación y tamaño", () => {
  const out = html([{ id: "x", t: "text", body: "Hola **{nombre}** [web](/sobre-mi)", color: "#333333", font: "lora", align: "center", size: "l" }]);
  ok(out.includes("color:#333333") && out.includes("font-family:Lora,Georgia,serif") && out.includes("text-align:center") && out.includes("font-size:17px"), out);
  ok(out.includes("Laura") && out.includes(`href="${BASE}/sobre-mi"`), out);
});

test("botón «a prueba de balas»: relleno, solo borde y todo el ancho", () => {
  const filled = html([{ id: "b", t: "button", label: "Ir", href: "https://x.es", align: "left", style: "filled", bg: "#ffffff", full: true }]);
  ok(filled.includes('bgcolor="#FFFFFF"') && filled.includes('<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">') && filled.includes("display:block") && filled.includes("color:#0E1024"), filled);
  const outline = html([{ id: "b", t: "button", label: "Ir", href: "https://x.es", align: "center", style: "outline", bg: "#6b58c4" }]);
  ok(!outline.includes('bgcolor="#6B58C4"') && outline.includes("border:2px solid #6B58C4") && outline.includes("color:#6B58C4"), outline);
});

test("destacado: fondo, borde a la izquierda o recuadro, icono, título y texto", () => {
  const out = html([{ id: "s", t: "spotlight", icon: "🌕<b>", title: "Ritual", body: "- uno\n- dos", bg: "#f1eefb", accent: "#4b3fa0", border: "left" }]);
  ok(out.includes('bgcolor="#F1EEFB"') && out.includes("border-left:4px solid #4B3FA0") && out.includes("🌕b") && out.includes("Ritual") && out.includes("<li"), out);
  ok(html([{ id: "s", t: "spotlight", icon: "", title: "R", body: "", bg: "#ffffff", accent: "#4b3fa0", border: "box" }]).includes("border:1px solid #4B3FA0"));
});

test("vídeo: portada con enlace a YouTube o a la página «ver vídeo»; sin portada, recuadro con ▶", () => {
  const yt = html([{ id: "v", t: "video", url: "https://youtu.be/dQw4w9WgXcQ", src: "", cover: IMG, title: "Mira esto" }]);
  ok(yt.includes(`href="https://youtu.be/dQw4w9WgXcQ"`) && yt.includes(`src="${BASE}${IMG}"`) && yt.includes("Mira esto"), yt);
  const own = html([{ id: "v", t: "video", url: "", src: VIDEO, cover: "", title: "" }]);
  ok(own.includes(`href="${BASE}/media/ver/cabc1234567/0123456789abcdef01234567.mp4"`) && own.includes('bgcolor="#0E1024"') && own.includes("Ver el vídeo"), own);
  eq(videoWatchPath(VIDEO), "/media/ver/cabc1234567/0123456789abcdef01234567.mp4");
  eq(videoWatchPath("/media/video/x/../y.mp4"), null);
  eq(html([{ id: "v", t: "video", url: "", src: "", cover: IMG, title: "x" }]), "", "sin vídeo no sale nada");
});

test("dos columnas: se apilan en el móvil (bloques en línea) y tabla para Outlook; imagen a la derecha con dir=rtl", () => {
  const out = html([{ id: "c", t: "columns", image: IMG, alt: "Carta", side: "right", title: "Lo nuevo", body: "Texto", buttonLabel: "Ver", buttonHref: "/x" }]);
  ok(out.includes('dir="rtl"') && out.includes("display:inline-block;width:100%;max-width:258px") && out.includes("<!--[if mso]>") && out.includes(">Ver</a>"), out);
});

test("redes: usuario o enlace → enlaces seguros; vacías no salen", () => {
  eq(socialLink("instagram", "@cirella"), "https://instagram.com/cirella");
  eq(socialLink("web", "cirella.app"), "https://cirella.app/");
  ok(!(socialLink("web", "javascript:alert(1)") ?? "").startsWith("javascript:"));
  const out = html([{ id: "r", t: "social", links: { instagram: "@ana", youtube: "", email: "hola@cirella.app" }, align: "center" }]);
  ok(out.includes("https://instagram.com/ana") && out.includes("mailto:hola@cirella.app") && !out.includes("YouTube"), out);
  eq(html([{ id: "r", t: "social", links: {}, align: "center" }]), "");
});

test("separador: línea, discontinuo y estrellitas con color", () => {
  ok(html([{ id: "d", t: "divider", style: "dashed", color: "#c8a86e" }]).includes("1px dashed #C8A86E"));
  ok(html([{ id: "d", t: "divider", style: "stars" }]).includes("✦✦✦"));
});

// ── Avisos ──

test("lintDesign: contraste bajo, vídeo sin portada, redes vacías", () => {
  const w = lintDesign(
    design([
      { id: "t", t: "title", text: "Hola", align: "left", size: "s", color: "#EEEEEE" },
      { id: "v", t: "video", url: "https://youtu.be/dQw4w9WgXcQ", src: "", cover: "", title: "" },
      { id: "r", t: "social", links: {}, align: "center" },
      { id: "x", t: "text", body: "Un texto con suficientes letras para que no sea solo imágenes, de verdad." },
    ]),
    "Asunto",
  );
  ok(w.some((x) => /contraste en el título/.test(x)) && w.some((x) => /portada de un vídeo/.test(x)) && w.some((x) => /redes sociales/.test(x)), w.join(" | "));
  eq(lintDesign(design([{ id: "x", t: "text", body: "Hola" }]), "S"), []);
});

// ── Estilo general, plantillas y envío ──

test("plantilla de la newsletter: estilo, ancho, fuentes web con reserva, sin «Tu área» y el pie legal de siempre", () => {
  const d = design([{ id: "h", t: "hero", image: "", alt: "", overlay: "#14163A", opacity: 0, title: "Luna", subtitle: "", color: "#FFFFFF", align: "center", height: "m" }, { id: "x", t: "text", body: "Hola" }], { ...DEFAULT_EMAIL_STYLE, bg: "#14163A", headingFont: "cormorant", width: 680 });
  const out = designEmailHtml({ brand: "Cirella", subject: "S", design: d, baseUrl: BASE, vars: {}, footer: "PIE LEGAL", preheader: "Pre" });
  ok(out.includes("max-width:680px") && out.includes('bgcolor="#14163A"') && out.includes("fonts.googleapis.com/css2?family=Cormorant+Garamond") && out.includes(".hf{font-family:Georgia,serif!important}"), "estilo");
  ok(out.includes('<meta name="color-scheme" content="light">') && out.includes("PIE LEGAL") && out.includes("display:none") && out.includes("Pre"), "meta y pie");
  eq(webFontsLink(["georgia", "helvetica"]), "");
  const m = campaignEmail({ brand: "Cirella", subject: "Hola {nombre}", design: d, baseUrl: BASE, vars: { nombre: "Eva" }, footer: { senderName: "Cirella", legalUrl: `${BASE}/ana/legal`, unsubscribeUrl: `${BASE}/baja/newsletter?t=x` } });
  ok(m.subject === "Hola Eva" && m.html.includes(`href="${BASE}/baja/newsletter?t=x"`) && m.html.includes("Darme de baja"), m.subject);
});

test("plantillas: Luna llena, Novedades y Lanzamiento son válidas y usan la paleta", () => {
  eq(STARTERS.map((s) => s.key), ["luna", "novedades", "lanzamiento"]);
  for (const s of STARTERS) {
    const d = starterDesign(s.key, { palette: ["#B4583F"], siteUrl: `${BASE}/` });
    const r = parseDesignStrict(JSON.parse(JSON.stringify(d)));
    ok(r.ok && r.value.blocks.length === d.blocks.length && !!r.value.style, s.key);
  }
  ok(JSON.stringify(starterDesign("novedades", { palette: ["#B4583F"], siteUrl: "/" })).includes("#B4583F"));
  const pal = brandPalette({ displayName: "Cirella", template: "editorial", theme: { accent: "#123456" } });
  ok(pal[0] === "#123456" && pal.includes("#FFFFFF") && new Set(pal).size === pal.length, pal.join());
});

test("texto plano: sin vista previa ni comentarios de Outlook, enlaces con su dirección; Resend lo envía", () => {
  const d = design([{ id: "x", t: "text", body: "Hola [mi web](https://cirella.app/x)" }, { id: "b", t: "button", label: "Reservar", href: "/r", align: "center" }]);
  const m = campaignEmail({ brand: "Cirella", subject: "S", preheader: "OCULTO", design: d, baseUrl: BASE, vars: {}, footer: { senderName: "Cirella", legalUrl: "l", unsubscribeUrl: null } });
  const t = htmlToText(m.html);
  ok(t.includes("Reservar (https://cirella.app/r)") && t.includes("mi web") && !t.includes("OCULTO") && !t.includes("mso") && !t.includes("<"), t);
  const body = JSON.parse(buildResendRequest({ id: "1", to: "a@x.es", subject: "S", html: m.html }, { apiKey: "k", fromAddress: "a@x.es", defaultFromName: "A" }).init.body);
  ok(typeof body.text === "string" && body.text.includes("Reservar"));
});

test("emails automáticos: la portada va con las esquinas de la tarjeta (sin sangrar)", () => {
  const out = renderDesignHtml(design([{ id: "h", t: "hero", image: IMG, alt: "", overlay: "#000000", opacity: 20, title: "Hola", subtitle: "", color: "#FFFFFF", align: "center", height: "s" }]), { baseUrl: BASE });
  ok(out.includes("width:416px") && out.includes("border-radius:20px"), out);
});

// ── Fondo de los bloques y resaltado ──

test("«Fondo» de un bloque: franja con bgcolor y background-color, margen S/M/L y esquinas; solo hex", () => {
  const out = html([{ id: "x", t: "text", body: "Hola", band: "#f4efe4", bandPad: "l", bandRound: true }]);
  ok(out.includes('bgcolor="#F4EFE4"') && out.includes("background-color:#F4EFE4") && out.includes("padding:32px 36px") && out.includes("border-radius:16px"), out);
  for (const t of [
    { id: "b", t: "button", label: "Ir", href: "/x", align: "center", band: "#14163a" },
    { id: "i", t: "image", url: IMG, alt: "x", width: "full", band: "#14163a" },
    { id: "v", t: "video", url: "https://youtu.be/dQw4w9WgXcQ", src: "", cover: IMG, title: "Mira", band: "#14163a" },
    { id: "c", t: "columns", image: IMG, alt: "x", side: "left", title: "T", body: "B", band: "#14163a" },
    { id: "r", t: "social", links: { instagram: "@ana" }, align: "center", band: "#14163a" },
  ])
    ok(html([t]).includes('bgcolor="#14163A"'), t.t);
  const bad = design([{ id: "x", t: "text", body: "Hola", band: "red;background:url(x)", bandPad: "xxl" }]).blocks[0] as { band?: string; bandPad?: string };
  eq([bad.band, bad.bandPad], [undefined, undefined]);
  ok(!html([{ id: "x", t: "text", body: "Hola", band: "url(x)" }]).includes("bgcolor"), "sin color válido no hay franja");
  eq(html([{ id: "b", t: "button", label: "", href: "", align: "center", band: "#000000" }]), "", "un botón vacío no deja franja");
});

test("botón de solo borde sobre un fondo: el contraste se mira contra la franja", () => {
  const w = lintDesign(design([{ id: "b", t: "button", label: "Reservar", href: "/x", align: "center", style: "outline", bg: "#14163A", band: "#14163A" }, { id: "x", t: "text", body: "Texto suficiente para que no sea solo imágenes en este email." }]), "S");
  ok(w.some((x) => /contraste en el botón/.test(x)), w.join(" | "));
});

test("resaltar: ==palabras== con el color del bloque; marcas sueltas se quedan; texto plano sin marcas", () => {
  const out = html([{ id: "x", t: "text", body: "Hola ==plazas **abiertas**== y 2==3", highlight: "#f9d9e3" }]);
  ok(out.includes('<span style="background-color:#F9D9E3;padding:0 2px;border-radius:3px">plazas <strong style="font-weight:600">abiertas</strong></span>'), out);
  ok(out.includes("2==3"), "la marca impar es texto");
  ok(html([{ id: "x", t: "text", body: "Un ==resaltado==" }]).includes("background-color:#FCEFB4"), "amarillo por defecto");
  ok(!html([{ id: "x", t: "text", body: "<b>==x==</b>" }]).includes("<b>"), "escapado");
  ok(html([{ id: "s", t: "spotlight", icon: "", title: "", body: "a ==b==", bg: "#ffffff", accent: "#000000", border: "none" }]).includes("==b=="), "solo en el bloque Texto");
  const d = design([{ id: "x", t: "text", body: "Hola ==plazas== abiertas" }]);
  const m = campaignEmail({ brand: "Cirella", subject: "S", design: d, baseUrl: BASE, vars: {}, footer: { senderName: "Cirella", legalUrl: "l", unsubscribeUrl: null } });
  ok(htmlToText(m.html).includes("Hola plazas abiertas"), htmlToText(m.html));
  const w = lintDesign(design([{ id: "x", t: "text", body: "Hola ==plazas== abiertas, un texto largo para que no sea solo imágenes.", color: "#FFFFFF", band: "#000000", highlight: "#FFFFEE" }]), "S");
  ok(w.some((x) => /texto resaltado/.test(x)) && !w.some((x) => /contraste en el texto \(/.test(x)), w.join(" | "));
});
