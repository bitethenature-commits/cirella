/**
 * Piezas de HTML de los emails, sin dependencias: las usan templates.ts (que las reexporta) y
 * rich-html.ts, sin importarse entre sí.
 */

/** Escapa texto para HTML. Todo lo que escribe una persona (nombres, mensajes) pasa por aquí. */
export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
