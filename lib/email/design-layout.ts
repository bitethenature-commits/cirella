/**
 * Plantilla de la newsletter hecha con el editor visual: su estilo (fondo, tarjeta, colores, tipos de
 * letra, esquinas y ancho), tablas para Outlook, ancho máximo de 600 px por defecto y márgenes de
 * móvil. El pie legal (quién la envía y la baja, newsletterFooterHtml) va tal cual, debajo.
 *
 * Tipos de letra «web» (Playfair, Cormorant, Lora, Montserrat): un <link> de Google Fonts que solo
 * usan Apple Mail, el Mail del iPhone y algunos más; Gmail y Outlook enseñan el de reserva de cada
 * pila. Outlook de escritorio, además, recibe la reserva a la fuerza (si no, pondría Times New Roman).
 * Puro.
 */
import { DEFAULT_EMAIL_STYLE, EMAIL_FONTS, RADIUS_PX, type EmailDesign, type EmailFontKey, type EmailVars } from "../email-blocks";
import { contrastRatio, mixHex, textOn } from "../colors";
import { BLOCK_PAD_X, fontStack, mutedOn, renderDesignParts } from "./blocks-html";
import { esc } from "./html";

/** Enlace de Google Fonts con los tipos de letra «web» que use el diseño (o vacío). */
export function webFontsLink(keys: (EmailFontKey | undefined)[]): string {
  const families = [...new Set(keys.map((k): string | null => (k ? EMAIL_FONTS[k]?.web : null)).filter((f): f is string => !!f))];
  if (!families.length) return "";
  return `<link href="https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&amp;")}&amp;display=swap" rel="stylesheet">`;
}

/** Tipos de letra que usa un diseño (estilo general y los propios de cada bloque). */
export function designFonts(d: EmailDesign): EmailFontKey[] {
  const s = d.style ?? DEFAULT_EMAIL_STYLE;
  const out: EmailFontKey[] = [s.headingFont, s.bodyFont];
  for (const b of d.blocks) if ((b.t === "title" || b.t === "text" || b.t === "hero") && b.font) out.push(b.font);
  return out;
}

/** Último tipo de la pila (el que Outlook sí tiene). */
const fallbackOf = (k: EmailFontKey) => EMAIL_FONTS[k].stack.split(",").slice(1).join(",") || EMAIL_FONTS[k].stack;

export function designEmailHtml(o: { brand: string; subject: string; preheader?: string | null; design: EmailDesign; baseUrl: string; vars: EmailVars; footer: string }): string {
  const s = o.design.style ?? DEFAULT_EMAIL_STYLE;
  const parts = renderDesignParts(o.design, { baseUrl: o.baseUrl, vars: o.vars });
  const radius = RADIUS_PX[s.radius];
  const bodyFont = fontStack(s.bodyFont, "system");
  const headFont = fontStack(s.headingFont, "georgia");
  // Filas: los bloques «a sangre» (la portada) de lado a lado; los demás, juntos y con su margen.
  const rows: string[] = [];
  let group: string[] = [];
  const flush = (last: boolean) => {
    if (!group.length) return;
    const top = rows.length ? 24 : 32;
    rows.push(
      `<tr><td class="px bf" style="padding:${top}px ${BLOCK_PAD_X}px ${last ? 32 : 8}px;font-family:${bodyFont};font-size:15px;line-height:1.65;color:${s.text}">${group.join("")}</td></tr>`,
    );
    group = [];
  };
  parts.forEach((p, i) => {
    if (p.bleed) {
      flush(false);
      const first = rows.length === 0;
      const last = i === parts.length - 1;
      const corners = `${first ? `${radius}px ${radius}px` : "0 0"} ${last ? `${radius}px ${radius}px` : "0 0"}`;
      rows.push(`<tr><td style="padding:0;border-radius:${corners};overflow:hidden">${p.html}</td></tr>`);
    } else group.push(p.html);
  });
  flush(true);
  if (!rows.length) rows.push(`<tr><td style="padding:32px">&nbsp;</td></tr>`);

  const brandColor = contrastRatio(s.heading, s.bg) >= 3 ? s.heading : textOn(s.bg);
  const muted = mutedOn(s.bg);
  const border = mixHex(s.bg, s.text, 0.08);
  const pre = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${esc(o.preheader)}${"&#847;&zwnj;&nbsp;".repeat(30)}</div>\n`
    : "";
  const fonts = webFontsLink(designFonts(o.design));
  return `<!doctype html><html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(o.subject)}</title>
${fonts ? `<!--[if !mso]><!-->${fonts}<!--<![endif]-->\n` : ""}<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>.hf{font-family:${fallbackOf(s.headingFont)}!important}.bf,.bf p,.bf li,.bf td{font-family:${fallbackOf(s.bodyFont)}!important}</style><![endif]-->
<style>:root{color-scheme:light;supported-color-schemes:light}body{margin:0;padding:0;-webkit-text-size-adjust:100%}img{-ms-interpolation-mode:bicubic}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media (max-width:${s.width + 20}px){.px{padding-left:20px!important;padding-right:20px!important}.hero-pad{padding-left:20px!important;padding-right:20px!important}.outer{padding:16px 8px!important}}</style>
</head><body style="margin:0;padding:0;background:${s.bg};font-family:${bodyFont};color:${s.text}" bgcolor="${s.bg}">
${pre}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${s.bg}" style="background:${s.bg}"><tr><td class="outer" align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="${s.width}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${s.width}px;margin:0 auto">
<tr><td class="hf" style="padding:0 6px 20px;font-family:${headFont};font-size:20px;letter-spacing:.02em;color:${brandColor}">${esc(o.brand)}</td></tr>
<tr><td bgcolor="${s.content}" style="background:${s.content};border:1px solid ${border};border-radius:${radius}px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>
</td></tr>
${o.footer ? `<tr><td style="padding:22px 6px 0;font-family:${bodyFont};font-size:12px;line-height:1.6;color:${muted}">${o.footer}</td></tr>` : ""}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
