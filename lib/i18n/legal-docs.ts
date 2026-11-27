import type { Locale } from "./config";
import { tr } from "./dict";

/**
 * Un texto legal de plantilla (lib/legal-templates.ts) en el idioma de la página, línea a línea con el diccionario
 * (lib/i18n/dict/legal-docs.ts). Los datos que cambian (su nombre, las horas, cómo se paga…) se cambian por su hueco
 * antes de buscar la línea y se vuelven a poner después. Una línea que no está en el diccionario sale tal cual.
 */
export function translateLegalDoc(text: string, locale: Locale, vars: Record<string, string> = {}): string {
  if (locale === "es" || !text) return text;
  // Los valores más largos primero: así uno corto no rompe uno largo que lo contiene.
  const list = Object.entries(vars)
    .filter(([, v]) => v.trim())
    .sort((a, b) => b[1].length - a[1].length);
  const filled = Object.fromEntries(list.map(([k, v]) => [k, tr(locale, v)]));
  const whole = tr(locale, text);
  if (whole !== text) return whole;
  return text
    .split("\n")
    .map((line) => {
      const m = line.match(/^(## |• )?([\s\S]*)$/);
      const prefix = m?.[1] ?? "";
      let body = m?.[2] ?? line;
      if (!body.trim()) return line;
      // Primero la línea tal cual (un nombre corto puede ir dentro de otras palabras) y luego con sus huecos.
      const plain = tr(locale, body);
      if (plain !== body) return prefix + plain;
      for (const [k, v] of list) body = body.split(v).join(`{${k}}`);
      const found = tr(locale, body);
      if (found === body) return line;
      let out = found;
      for (const [k, v] of Object.entries(filled)) out = out.split(`{${k}}`).join(v);
      return prefix + out;
    })
    .join("\n");
}
