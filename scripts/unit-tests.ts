/**
 * Pruebas unitarias de funciones puras (sin BD ni servidor).
 *   npm run test:unit
 */
import { detectSource } from "../lib/analytics";
import { safeNext } from "../lib/auth-utils";
import { parseMoneyToCents } from "../lib/money";

let failures = 0;
function eq<T>(name: string, got: T, want: T) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` → ${String(got)} (esperado ${String(want)})`}`);
}

// Precios en formato español
for (const [input, cents] of [["49", 4900], ["49,90", 4990], ["49.90", 4990], ["1.200", 120000], ["1.234,56", 123456], ["1.500,00", 150000], ["0,5", 50], ["€ 79", 7900]] as const)
  eq(`parseMoneyToCents("${input}")`, parseMoneyToCents(input), cents);

// Origen del tráfico: dominios exactos, no subcadenas
for (const [host, utm, want] of [
  ["about.me", null, "other"], ["t.me", null, "telegram"], ["l.instagram.com", null, "instagram"], [null, "ig", "instagram"],
  ["start.me", null, "other"], ["www.google.es", null, "google"], ["wa.me", null, "whatsapp"], [null, null, "direct"],
] as const)
  eq(`detectSource(${host}, ${utm})`, detectSource(host, utm), want);

// Redirecciones internas seguras
for (const [next, want] of [
  ["/cuenta", "/cuenta"], ["//evil.com", "/x"], ["/\\evil.com", "/x"], ["/\t/evil.com", "/x"], ["https://evil.com", "/x"], ["/panel?a=1", "/panel?a=1"],
] as const)
  eq(`safeNext(${JSON.stringify(next)})`, safeNext(next, "/x"), want);

console.log(failures ? `\n${failures} pruebas fallidas` : "\nTodas las pruebas unitarias pasan ✓");
process.exit(failures ? 1 : 0);
