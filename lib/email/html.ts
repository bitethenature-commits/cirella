/**
 * Piezas de HTML de los emails, sin dependencias: las usan templates.ts (que las reexporta) y
 * rich-html.ts, sin importarse entre sí.
 */

/** Escapa texto para HTML. Todo lo que escribe una persona (nombres, mensajes) pasa por aquí. */
export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;

/**
 * Los colores de los emails: noche y oro, como la web. Fondo azul noche, tarjeta un poco más clara con
 * doble línea dorada, letras crema y el oro para títulos, enlaces y el botón.
 */
export const MAIL = {
  bg: "#0D0B24",
  card: "#17143A",
  text: "#E8DFCB",
  strong: "#F4EBD8",
  muted: "#A99FC2",
  gold: "#D9BF8C",
  head: "#F3E3BF",
  line: "#3A3354",
  goldLine: "#6E5B3A",
  btnText: "#1A1408",
  box: "#211D49"
} as const;
