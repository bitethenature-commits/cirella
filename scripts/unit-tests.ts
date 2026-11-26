/**
 * Pruebas unitarias de funciones puras (sin BD ni servidor).
 *   npm run test:unit
 *
 * Ejecuta los casos de este archivo y los de cada scripts/unit/<tema>.test.ts
 * (ver scripts/unit/harness.ts). Los temas nuevos van en su propio archivo.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { detectSource } from "../lib/analytics";
import { safeNext } from "../lib/auth-utils";
import { parseMoneyToCents } from "../lib/money";
import { eq, runAll, setCurrentFile, test } from "./unit/harness";

// Precios en formato español
for (const [input, cents] of [["49", 4900], ["49,90", 4990], ["49.90", 4990], ["1.200", 120000], ["1.234,56", 123456], ["1.500,00", 150000], ["0,5", 50], ["€ 79", 7900]] as const)
  test(`parseMoneyToCents("${input}")`, () => eq(parseMoneyToCents(input), cents));

// Origen del tráfico: dominios exactos, no subcadenas
for (const [host, utm, want] of [
  ["about.me", null, "other"], ["t.me", null, "telegram"], ["l.instagram.com", null, "instagram"], [null, "ig", "instagram"],
  ["start.me", null, "other"], ["www.google.es", null, "google"], ["wa.me", null, "whatsapp"], [null, null, "direct"],
] as const)
  test(`detectSource(${host}, ${utm})`, () => eq(detectSource(host, utm), want));

// Redirecciones internas seguras
for (const [next, want] of [
  ["/area", "/area"], ["//evil.com", "/x"], ["/\\evil.com", "/x"], ["/\t/evil.com", "/x"], ["https://evil.com", "/x"], ["/panel?a=1", "/panel?a=1"],
] as const)
  test(`safeNext(${JSON.stringify(next)})`, () => eq(safeNext(next, "/x"), want));

async function main() {
  const dir = path.join(__dirname, "unit");
  const files = readdirSync(dir).filter((f) => f.endsWith(".test.ts")).sort();
  for (const file of files) {
    setCurrentFile(file);
    await import(pathToFileURL(path.join(dir, file)).href);
  }
  const failures = await runAll();
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
