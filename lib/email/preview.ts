/**
 * HTML de un email para verlo en el buzón de demostración (/dev/email), que lo enseña en un iframe
 * con sandbox (sin scripts ni formularios). Sin más, un enlace del email («Entrar», «Completar mi
 * compra»…) se abriría dentro del iframe, donde la página no funciona. Con <base target="_top"> los
 * enlaces abren la página de verdad, en la pestaña; el sandbox lo permite al pulsar
 * (allow-top-navigation-by-user-activation).
 */
const BASE = '<base target="_top">';

export function previewEmailHtml(html: string): string {
  // Si el email ya trae su propio <base>, manda el nuestro (el primero gana): lo ponemos delante.
  const head = html.match(/<head(\s[^>]*)?>/i);
  if (head) return html.replace(head[0], `${head[0]}${BASE}`);
  const root = html.match(/<html(\s[^>]*)?>/i);
  if (root) return html.replace(root[0], `${root[0]}<head>${BASE}</head>`);
  return `${BASE}${html}`;
}
