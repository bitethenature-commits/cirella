/**
 * Copia los recursos de pdf.js que se cargan en el navegador a public/assets/pdfjs/<versión>/
 * (npm los ejecuta antes de `build` y `dev`: prebuild/predev). La carpeta no va en git.
 *   · legacy/build/pdf.worker.min.mjs      → el «worker» que lee el PDF
 *   · wasm/*_nowasm_fallback.js            → decodificadores JPX/JBIG2 sin WebAssembly (useWasm: false)
 *   · standard_fonts/ y cmaps/             → fuentes estándar y tablas de caracteres
 * Es idempotente y borra otras versiones. Falla si falta pdfjs-dist.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "pdfjs-dist");
if (!existsSync(path.join(src, "package.json"))) {
  console.error("[pdfjs] Falta pdfjs-dist en node_modules: ejecuta npm install.");
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(path.join(src, "package.json"), "utf8"));
const base = path.join(root, "public", "assets", "pdfjs");
mkdirSync(base, { recursive: true });
for (const d of readdirSync(base)) if (d !== version) rmSync(path.join(base, d), { recursive: true, force: true });
const dest = path.join(base, version);
mkdirSync(path.join(dest, "wasm"), { recursive: true });
cpSync(path.join(src, "legacy", "build", "pdf.worker.min.mjs"), path.join(dest, "pdf.worker.min.mjs"));
for (const f of readdirSync(path.join(src, "wasm"))) if (f.endsWith("_nowasm_fallback.js")) cpSync(path.join(src, "wasm", f), path.join(dest, "wasm", f));
cpSync(path.join(src, "standard_fonts"), path.join(dest, "standard_fonts"), { recursive: true });
cpSync(path.join(src, "cmaps"), path.join(dest, "cmaps"), { recursive: true });
console.log(`[pdfjs] Recursos de pdf.js ${version} en public/assets/pdfjs/${version}/`);
