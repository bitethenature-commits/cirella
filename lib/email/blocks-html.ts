/**
 * Bloques del editor visual (lib/email-blocks.ts) → HTML de email: estilos en línea a juego con
 * layout() de templates.ts, sin CSS externo ni fuentes web (los buzones no las cargan y, si lo
 * hicieran, revelarían la IP de quien lee). Todo lo escrito se escapa; los enlaces pasan por
 * safeLinkHref y las imágenes solo pueden ser las subidas aquí. Puro (salvo appUrl por defecto).
 */
import { applyVars, emailImagePath, type EmailBlock, type EmailDesign, type EmailVars } from "../email-blocks";
import { safeLinkHref } from "../rich-text";
import { esc } from "./html";
import { richToEmailHtml } from "./rich-html";

const SPACER = { s: 12, m: 24, l: 40 } as const;

/** Dirección absoluta de un enlace del email (las rutas /… de la web, con su dominio). */
function absHref(raw: string, base: string): string | null {
  const safe = safeLinkHref(raw.trim());
  if (!safe) return null;
  return safe.href.startsWith("/") ? `${base}${safe.href}` : safe.href;
}

function block(b: EmailBlock, base: string): string {
  switch (b.t) {
    case "title":
      return b.text.trim()
        ? `<h2 style="font-family:Georgia,serif;font-weight:400;font-size:24px;line-height:1.25;margin:0 0 14px;color:#0E1024;text-align:${b.align}">${esc(b.text)}</h2>`
        : "";
    case "text":
      return b.body.trim() ? richToEmailHtml(b.body, "MD", { baseUrl: base }) : "";
    case "image": {
      const path = emailImagePath(b.url);
      if (!path) return "";
      const width = b.width === "narrow" ? "max-width:320px;" : "";
      const img = `<img src="${esc(`${base}${path}`)}" alt="${esc(b.alt)}" style="display:block;${width}width:100%;height:auto;border:0;border-radius:12px;margin:0 auto">`;
      const link = b.href ? absHref(b.href, base) : null;
      return `<p style="margin:0 0 16px;text-align:center">${link ? `<a href="${esc(link)}">${img}</a>` : img}</p>`;
    }
    case "button": {
      const link = absHref(b.href, base);
      if (!link || !b.label.trim()) return "";
      return `<p style="margin:20px 0;text-align:${b.align}"><a href="${esc(link)}" style="display:inline-block;background:#0E1024;color:#F6F1E7;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:600;font-size:14px">${esc(b.label)}</a></p>`;
    }
    case "divider":
      return `<hr style="border:0;border-top:1px solid #E9E2D3;margin:20px 0">`;
    case "spacer":
      return `<div style="height:${SPACER[b.size]}px;line-height:${SPACER[b.size]}px">&nbsp;</div>`;
  }
}

/** HTML del cuerpo (va dentro de la tarjeta de layout()), con las variables ya puestas. */
export function renderDesignHtml(d: EmailDesign, o: { baseUrl: string; vars?: EmailVars }): string {
  const base = o.baseUrl.replace(/\/$/, "");
  return applyVars(d.blocks.map((b) => block(b, base)).join(""), o.vars ?? {}, esc);
}

/** El asunto con sus variables (texto plano: no se escapa). */
export function renderSubject(subject: string, vars: EmailVars): string {
  return applyVars(subject, vars, (s) => s).trim();
}
