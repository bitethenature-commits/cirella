import qrcode from "qrcode-generator";

/**
 * Código QR en SVG, generado en el servidor (la clave de la app de códigos nunca sale hacia un
 * servicio de QR de fuera). Solo un <path> con los módulos oscuros: sin scripts ni atributos on*,
 * así que se puede pintar con dangerouslySetInnerHTML. Determinista para el mismo texto.
 * Sin `server-only`: lo prueban las unitarias.
 */
export function qrSvg(text: string, o: { margin?: number } = {}): string {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const m = o.margin ?? 4;
  const size = n + m * 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
