/**
 * Bloques del editor visual (lib/email-blocks.ts) → HTML de email: tablas y estilos en línea (lo
 * único que entienden bien Gmail, Outlook y el Mail del iPhone). Todo lo escrito se escapa; los
 * colores son siempre #RRGGBB (hexOr), los enlaces pasan por safeLinkHref y las imágenes solo pueden
 * ser las subidas aquí. Puro (salvo appUrl por defecto en el texto con formato).
 *
 * Dos sitios:
 *   · la newsletter (lib/email/design-layout.ts): bloques «a sangre» (la portada) de lado a lado de
 *     la tarjeta y los demás con su margen;
 *   · los emails automáticos (dentro de la tarjeta de layout(), templates.ts): todo con el margen de
 *     la tarjeta y la portada con las esquinas redondeadas.
 *
 * Trucos de email:
 *   · Portada: imagen de fondo con `background` + background-image + VML para Outlook, siempre con un
 *     color de reserva (bgcolor) por si el buzón no enseña la foto.
 *   · Botón «a prueba de balas»: una celda con bgcolor y el enlace dentro (en Outlook sale recto).
 *   · Vídeo: los buzones no reproducen vídeo; sale su portada (con el ▶ ya dibujado en la imagen) con
 *     un enlace a YouTube/Vimeo o a la página «ver vídeo» de la web.
 *   · Dos columnas: bloques en línea de 50 % que se apilan solos en el móvil (y tabla para Outlook).
 */
import { DEFAULT_EMAIL_STYLE, DEFAULT_HIGHLIGHT, EMAIL_FONTS, RADIUS_PX, SOCIAL_NETWORKS, applyVars, buttonColors, emailImagePath, hexOr, videoWatchPath, type EmailBlock, type EmailDesign, type EmailFontKey, type EmailStyle, type EmailVars, type SocialNetwork } from "../email-blocks";
import { contrastRatio, mixHex, rgba, textOn } from "../colors";
import { socialHref } from "../page-config";
import { safeLinkHref } from "../rich-text";
import { videoEmbed } from "../video-embed";
import { esc } from "./html";
import { richToEmailHtml } from "./rich-html";

const SPACER = { s: 12, m: 24, l: 40 } as const;
const TITLE_PX = { s: 20, m: 24, l: 30, xl: 38 } as const;
const TEXT_PX = { s: 13, m: 15, l: 17 } as const;
const HERO_PAD = { s: 40, m: 72, l: 112 } as const;
const IMG_RADIUS = { none: 0, s: 6, l: 12 } as const;

/** Margen lateral de los bloques normales en la newsletter. */
export const BLOCK_PAD_X = 32;

type Ctx = {
  base: string;
  s: EmailStyle;
  /** Ancho útil del contenido en px (para Outlook y las columnas). */
  inner: number;
  /** Ancho total de la tarjeta (la portada «a sangre»). */
  full: number;
  /** true: newsletter (la portada va de lado a lado); false: dentro de la tarjeta de otro email. */
  bleed: boolean;
};

export const fontStack = (k: EmailFontKey | undefined, fallback: EmailFontKey) => EMAIL_FONTS[k ?? fallback]?.stack ?? EMAIL_FONTS[fallback].stack;

/** Dirección absoluta de un enlace del email (las rutas /… de la web, con su dominio). */
function absHref(raw: string | undefined, base: string): string | null {
  if (!raw) return null;
  const safe = safeLinkHref(raw.trim());
  if (!safe) return null;
  return safe.href.startsWith("/") ? `${base}${safe.href}` : safe.href;
}

const rich = (body: string, c: Ctx, highlight?: string) =>
  richToEmailHtml(body, "MD", {
    baseUrl: c.base,
    theme: { heading: c.s.heading, headingFont: fontStack(c.s.headingFont, "georgia"), link: c.s.link, rule: mixHex(c.s.content, c.s.text, 0.15) },
    highlight,
  });

const BAND_PAD = { s: 12, m: 20, l: 32 } as const;

/**
 * «Fondo» de un bloque: una franja de color de todo el ancho (celda con bgcolor y background-color en
 * línea, que entienden todos los buzones) con su margen interior y, si se pide, esquinas redondeadas
 * (Outlook las deja rectas). Sin «Fondo», el bloque tal cual.
 */
function block(b: EmailBlock, c: Ctx): string {
  const bandColor = "band" in b && b.band ? hexOr(b.band, "") : "";
  if (!bandColor || !("band" in b)) return blockInner(b, c);
  const pad = BAND_PAD[b.bandPad ?? "m"];
  const html = blockInner(b, { ...c, inner: Math.max(120, c.inner - pad * 2) });
  if (!html) return "";
  const radius = b.bandRound ? `border-radius:${Math.max(8, Math.min(RADIUS_PX[c.s.radius], 16))}px;` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px"><tr><td bgcolor="${bandColor}" style="background-color:${bandColor};${radius}padding:${pad}px ${pad + 4}px">${html}</td></tr></table>`;
}

/** Botón «a prueba de balas»: tabla con bgcolor y el enlace dentro. */
function button(o: { label: string; href: string; align: "left" | "center" | "right"; style?: "pill" | "filled" | "outline"; bg?: string; color?: string; full?: boolean; margin?: string }, c: Ctx): string {
  const { bg, fg, outline } = buttonColors(o, c.s);
  const radius = (o.style ?? "pill") === "pill" ? "999px" : `${Math.min(RADIUS_PX[c.s.radius], 8)}px`;
  const cellBg = outline ? "" : ` bgcolor="${bg}"`;
  const cellStyle = `border-radius:${radius};${outline ? `border:2px solid ${bg}` : `background:${bg};border:2px solid ${bg}`}`;
  const link = `<a href="${esc(o.href)}" style="display:${o.full ? "block" : "inline-block"};padding:13px 26px;font-family:${fontStack(c.s.bodyFont, "system")};font-size:15px;font-weight:600;line-height:1.2;color:${fg};text-decoration:none;border-radius:${radius};text-align:center">${esc(o.label)}</a>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${o.margin ?? "20px 0"}"><tr><td align="${o.align}">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${o.full ? ' width="100%"' : ""}><tr><td align="center"${cellBg} style="${cellStyle}">${link}</td></tr></table>` +
    `</td></tr></table>`
  );
}

function imageTag(path: string, alt: string, o: { width: number; radius: number; base: string; maxWidth?: number }) {
  const max = o.maxWidth ?? o.width;
  return `<img src="${esc(`${o.base}${path}`)}" alt="${esc(alt)}" width="${max}" style="display:block;width:100%;max-width:${max}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:${o.radius}px;margin:0 auto">`;
}

function hero(b: Extract<EmailBlock, { t: "hero" }>, c: Ctx): string {
  const overlay = hexOr(b.overlay, "#0E1024");
  const fg = hexOr(b.color, "#FFFFFF");
  const path = b.image ? emailImagePath(b.image) : null;
  const img = path ? `${c.base}${path}` : null;
  const width = c.bleed ? c.full : c.inner;
  const radius = c.bleed ? 0 : RADIUS_PX[c.s.radius] || 0;
  const pad = HERO_PAD[b.height] ?? HERO_PAD.m;
  const headFont = fontStack(b.font, c.s.headingFont);
  const title = b.title.trim()
    ? `<h1 class="hf" style="margin:0;font-family:${headFont};font-weight:400;font-size:${b.height === "s" ? 28 : 36}px;line-height:1.15;color:${fg};text-align:${b.align}">${esc(b.title)}</h1>`
    : "";
  const subtitle = b.subtitle.trim()
    ? `<p style="margin:${title ? "12px" : "0"} 0 0;font-family:${fontStack(c.s.bodyFont, "system")};font-size:16px;line-height:1.5;color:${fg};text-align:${b.align}">${esc(b.subtitle)}</p>`
    : "";
  const link = absHref(b.buttonHref, c.base);
  const btn =
    link && b.buttonLabel?.trim()
      ? button({ label: b.buttonLabel, href: link, align: b.align, style: "pill", bg: b.buttonBg ?? fg, color: b.buttonColor ?? overlay, margin: "22px 0 0" }, c)
      : "";
  // Capa de color sobre la foto (rgba: Outlook la ignora y enseña la foto tal cual).
  const layer = img ? `background-color:${rgba(overlay, b.opacity)};` : "";
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="hero-pad" style="${layer}padding:${pad}px 32px;text-align:${b.align};border-radius:${radius}px">${title}${subtitle}${btn}</td></tr></table>`;
  const alt = img && b.alt.trim() ? `<span style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;mso-hide:all">${esc(b.alt)}</span>` : "";
  if (!img)
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${c.bleed ? 0 : 16}px"><tr><td bgcolor="${overlay}" style="background-color:${overlay};border-radius:${radius}px">${inner}</td></tr></table>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${c.bleed ? 0 : 16}px"><tr>` +
    `<td background="${esc(img)}" bgcolor="${overlay}" valign="middle" style="background-color:${overlay};background-image:url('${esc(img)}');background-size:cover;background-position:center center;background-repeat:no-repeat;border-radius:${radius}px">` +
    `<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${width}px;"><v:fill type="frame" src="${esc(img)}" color="${overlay}" /><v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0"><![endif]-->` +
    `<div>${alt}${inner}</div>` +
    `<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->` +
    `</td></tr></table>`
  );
}

function spotlight(b: Extract<EmailBlock, { t: "spotlight" }>, c: Ctx): string {
  if (!b.title.trim() && !b.body.trim()) return "";
  const bg = hexOr(b.bg, "#F4EFFC");
  const accent = hexOr(b.accent, "#6B58C4");
  const fg = hexOr(b.color, c.s.text);
  const radius = RADIUS_PX[c.s.radius] ? Math.min(RADIUS_PX[c.s.radius], 14) : 0;
  const border = b.border === "left" ? `border-left:4px solid ${accent};` : b.border === "box" ? `border:1px solid ${accent};` : "";
  const icon = b.icon ? `<span style="font-size:22px;line-height:1;margin-right:8px">${esc(b.icon)}</span>` : "";
  const title = b.title.trim()
    ? `<p class="hf" style="margin:0 0 ${b.body.trim() ? 8 : 0}px;font-family:${fontStack(c.s.headingFont, "georgia")};font-size:19px;line-height:1.3;color:${hexOr(b.color, accent === bg ? c.s.heading : accent)}">${icon}${esc(b.title)}</p>`
    : icon
      ? `<p style="margin:0 0 6px">${icon}</p>`
      : "";
  const body = b.body.trim()
    ? `<div style="color:${fg}">${richToEmailHtml(b.body, "MD", { baseUrl: c.base, theme: { heading: fg, headingFont: fontStack(c.s.headingFont, "georgia"), link: fg, rule: accent } })}</div>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td bgcolor="${bg}" style="background-color:${bg};${border}border-radius:${radius}px;padding:20px 22px;color:${fg}">${title}${body}</td></tr></table>`;
}

/** Enlace del vídeo: YouTube/Vimeo tal cual (ya comprobado) o la página «ver vídeo» de la web. */
export function videoLink(b: Extract<EmailBlock, { t: "video" }>, base: string): string | null {
  if (b.url && videoEmbed(b.url)) return absHref(b.url, base);
  const watch = b.src ? videoWatchPath(b.src) : null;
  return watch ? `${base}${watch}` : null;
}

function video(b: Extract<EmailBlock, { t: "video" }>, c: Ctx): string {
  const link = videoLink(b, c.base);
  if (!link) return "";
  const cover = b.cover ? emailImagePath(b.cover) : null;
  const label = b.title.trim() ? `▶\uFE0E ${b.title}` : "▶\uFE0E Ver el vídeo";
  const accent = c.s.accent;
  const picture = cover
    ? `<a href="${esc(link)}" style="display:block;text-decoration:none">${imageTag(cover, label, { width: c.inner, radius: IMG_RADIUS.l, base: c.base })}</a>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#0E1024" height="220" style="background-color:#0E1024;height:220px;border-radius:12px;text-align:center"><a href="${esc(link)}" style="display:inline-block;color:#FFFFFF;text-decoration:none;font-size:46px;line-height:1">▶</a></td></tr></table>`;
  const caption = b.caption?.trim() ? `<br><span style="font-size:13px;color:${mixHex(c.s.text, c.s.content, 0.35)}">${esc(b.caption)}</span>` : "";
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td align="center">${picture}</td></tr>` +
    `<tr><td align="center" style="padding:10px 0 0;font-size:15px;line-height:1.5;text-align:center"><a href="${esc(link)}" style="color:${accent};font-weight:600;text-decoration:none">${esc(label)}</a>${caption}</td></tr></table>`
  );
}

function columns(b: Extract<EmailBlock, { t: "columns" }>, c: Ctx): string {
  const path = b.image ? emailImagePath(b.image) : null;
  if (!path && !b.title.trim() && !b.body.trim()) return "";
  const gap = 20;
  const col = Math.floor((c.inner - gap) / 2);
  const link = absHref(b.href, c.base);
  const img = path ? imageTag(path, b.alt, { width: col, radius: IMG_RADIUS.l, base: c.base }) : "";
  const pic = link && img ? `<a href="${esc(link)}">${img}</a>` : img;
  const title = b.title.trim() ? `<h3 class="hf" style="margin:0 0 8px;font-family:${fontStack(c.s.headingFont, "georgia")};font-weight:400;font-size:20px;line-height:1.3;color:${c.s.heading}">${esc(b.title)}</h3>` : "";
  const blink = absHref(b.buttonHref, c.base);
  const btn = blink && b.buttonLabel?.trim() ? button({ label: b.buttonLabel, href: blink, align: "left", style: "pill", margin: "12px 0 0" }, c) : "";
  const cell = (html: string) =>
    `<div style="display:inline-block;width:100%;max-width:${col}px;vertical-align:top;font-size:15px;line-height:1.65;text-align:left" dir="ltr"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 16px">${html}</td></tr></table></div>`;
  const text = `${title}${b.body.trim() ? rich(b.body, c) : ""}${btn}`;
  const dir = b.side === "right" ? "rtl" : "ltr";
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px"><tr><td dir="${dir}" style="font-size:0;text-align:center">` +
    `<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}"><tr><td width="${col}" valign="top" dir="ltr"><![endif]-->` +
    cell(pic) +
    `<!--[if mso]></td><td width="${gap}">&nbsp;</td><td width="${col}" valign="top" dir="ltr"><![endif]-->` +
    `<div style="display:inline-block;width:${gap}px;font-size:0;line-height:0">&nbsp;</div>` +
    cell(text) +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table>`
  );
}

/** Dirección de una red (usuario o enlace) → enlace seguro, o null. */
export function socialLink(n: SocialNetwork, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const raw = socialHref(n === "web" ? "website" : n, v);
  const safe = safeLinkHref(raw);
  return safe && !safe.href.startsWith("/") ? safe.href : null;
}

function social(b: Extract<EmailBlock, { t: "social" }>, c: Ctx): string {
  const color = hexOr(b.color, c.s.accent);
  const links = SOCIAL_NETWORKS.map((n) => ({ n, href: b.links[n] ? socialLink(n, b.links[n]!) : null })).filter((x): x is { n: SocialNetwork; href: string } => !!x.href);
  if (!links.length) return "";
  const label: Record<SocialNetwork, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", telegram: "Telegram", whatsapp: "WhatsApp", web: "Mi web", email: "Email" };
  return `<p style="margin:16px 0;text-align:${b.align};line-height:2.6">${links
    .map(
      (l) =>
        `<a href="${esc(l.href)}" style="display:inline-block;margin:0 3px;padding:7px 14px;border:1px solid ${color};border-radius:999px;color:${color};font-size:13px;font-weight:600;line-height:1.2;text-decoration:none">${label[l.n]}</a>`,
    )
    .join(" ")}</p>`;
}

function blockInner(b: EmailBlock, c: Ctx): string {
  const s = c.s;
  switch (b.t) {
    case "title": {
      if (!b.text.trim()) return "";
      const size = TITLE_PX[b.size ?? "m"];
      const color = hexOr(b.color, s.heading);
      const h = `<h2 class="hf" style="font-family:${fontStack(b.font, s.headingFont)};font-weight:400;font-size:${size}px;line-height:1.25;margin:0 0 14px;color:${color};text-align:${b.align}">${esc(b.text)}</h2>`;
      if (!b.bg) return h;
      const bg = hexOr(b.bg, s.content);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px"><tr><td bgcolor="${bg}" style="background-color:${bg};padding:14px 18px;border-radius:${Math.min(RADIUS_PX[s.radius], 12)}px">${h.replace("margin:0 0 14px", "margin:0")}</td></tr></table>`;
    }
    case "text": {
      if (!b.body.trim()) return "";
      const html = rich(b.body, c, b.body.includes("==") ? hexOr(b.highlight, DEFAULT_HIGHLIGHT) : undefined);
      if (!b.color && !b.font && !b.align && !b.size) return html;
      const style = [
        b.color ? `color:${hexOr(b.color, s.text)}` : "",
        b.font ? `font-family:${fontStack(b.font, s.bodyFont)}` : "",
        b.align ? `text-align:${b.align}` : "",
        b.size ? `font-size:${TEXT_PX[b.size]}px` : "",
      ]
        .filter(Boolean)
        .join(";");
      return `<div style="${style}">${html}</div>`;
    }
    case "image": {
      const path = emailImagePath(b.url);
      if (!path) return "";
      const max = b.width === "narrow" ? Math.min(320, c.inner) : c.inner;
      const img = imageTag(path, b.alt, { width: c.inner, maxWidth: max, radius: IMG_RADIUS[b.radius ?? "l"], base: c.base });
      const link = absHref(b.href, c.base);
      return `<p style="margin:0 0 16px;text-align:center">${link ? `<a href="${esc(link)}">${img}</a>` : img}</p>`;
    }
    case "button": {
      const link = absHref(b.href, c.base);
      if (!link || !b.label.trim()) return "";
      return button({ label: b.label, href: link, align: b.align, style: b.style, bg: b.bg, color: b.color, full: b.full }, c);
    }
    case "divider": {
      const color = hexOr(b.color, b.style === "stars" ? s.accent : "#6E5B3A");
      if (b.style === "stars") return `<p style="margin:20px 0;text-align:center;font-size:14px;letter-spacing:10px;color:${color}">✦✦✦</p>`;
      return `<hr style="border:0;border-top:1px ${b.style === "dashed" ? "dashed" : "solid"} ${color};margin:20px 0">`;
    }
    case "spacer":
      return `<div style="height:${SPACER[b.size]}px;line-height:${SPACER[b.size]}px">&nbsp;</div>`;
    case "hero":
      return hero(b, c);
    case "spotlight":
      return spotlight(b, c);
    case "video":
      return video(b, c);
    case "columns":
      return columns(b, c);
    case "social":
      return social(b, c);
  }
}

/** Partes del cuerpo de la newsletter: cada bloque con su HTML y si va de lado a lado. */
export function renderDesignParts(d: EmailDesign, o: { baseUrl: string; vars?: EmailVars }): { html: string; bleed: boolean }[] {
  const base = o.baseUrl.replace(/\/$/, "");
  const s = d.style ?? DEFAULT_EMAIL_STYLE;
  const c: Ctx = { base, s, full: s.width, inner: s.width - BLOCK_PAD_X * 2, bleed: true };
  return d.blocks
    .map((b) => ({ html: applyVars(block(b, c), o.vars ?? {}, esc), bleed: b.t === "hero" }))
    .filter((p) => p.html);
}

/**
 * HTML del cuerpo para ir dentro de la tarjeta de layout() (los emails automáticos), con las
 * variables ya puestas.
 */
export function renderDesignHtml(d: EmailDesign, o: { baseUrl: string; vars?: EmailVars }): string {
  const base = o.baseUrl.replace(/\/$/, "");
  const s = d.style ?? DEFAULT_EMAIL_STYLE;
  // La tarjeta de layout(): 520 px menos los márgenes (24 + 28 a cada lado).
  const c: Ctx = { base, s, full: 416, inner: 416, bleed: false };
  return applyVars(d.blocks.map((b) => block(b, c)).join(""), o.vars ?? {}, esc);
}

/** El asunto con sus variables (texto plano: no se escapa). */
export function renderSubject(subject: string, vars: EmailVars): string {
  return applyVars(subject, vars, (s) => s).trim();
}

/** Color de un texto secundario que se lee sobre un fondo. */
export function mutedOn(bg: string, preferred = "#8A8698"): string {
  return contrastRatio(preferred, bg) >= 3.5 ? preferred : mixHex(textOn(bg), bg, 0.25);
}
