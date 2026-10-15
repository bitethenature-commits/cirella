import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CODE_CODE_MAX, discountCodeFormSchema } from "../../lib/discount-codes";
import { ok, test } from "./harness";

const root = join(__dirname, "..", "..");
const card = readFileSync(join(root, "components/creator-page/discount-code-card.tsx"), "utf8");

/** className del <code> que muestra el código de descuento en la página pública. */
function codeClassName(): string {
  const m = card.match(/<code\s+ref=\{codeRef\}\s+className=\{?([^\n]+)/);
  ok(m, "no se encuentra el <code> del código de descuento");
  return m![1];
}

test("los códigos largos son válidos (hasta CODE_CODE_MAX caracteres)", () => {
  const long = "BLACKFRIDAY2026ANA".padEnd(CODE_CODE_MAX, "X");
  const r = discountCodeFormSchema.safeParse({ brand: "Marca", code: long, url: "https://tienda.example.com" });
  ok(r.success, "el código largo debe ser válido");
  ok(r.data.code === long, "el código largo debe llegar entero");
});

test("tarjeta de código: el código largo se parte en líneas y no se recorta por los dos lados", () => {
  const cls = codeClassName();
  ok(!/\btruncate\b/.test(cls), "el <code> no debe llevar truncate (en un contenedor flex centrado recorta ambos extremos)");
  ok(/\bbreak-all\b/.test(cls), "el <code> debe llevar break-all para mostrar el código entero");
  ok(/\btext-center\b/.test(cls), "el <code> debe centrar el texto partido en varias líneas");
  ok(!/\bwhitespace-nowrap\b/.test(cls), "el <code> no debe impedir el salto de línea");
});
