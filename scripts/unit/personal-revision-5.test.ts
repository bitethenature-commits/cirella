import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RESERVED_PRODUCT_SLUGS, slugify } from "../../lib/slug";
import { ok, test } from "./harness";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Un segmento estático de app/[username] gana a app/[username]/[slug]: si un producto pudiera usar ese slug, quedaría inaccesible.
test("todo segmento estático de /<usuaria>/ que pueda ser un slug está reservado para productos", () => {
  const segments = readdirSync(join(root, "app/[username]"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("["))
    .map((d) => d.name)
    .filter((name) => slugify(name) === name);
  ok(segments.includes("novedades"), "debe existir app/[username]/novedades");
  for (const s of segments) ok(RESERVED_PRODUCT_SLUGS.has(s), `«${s}» debe estar en RESERVED_PRODUCT_SLUGS`);
});

test("la migración renombra los productos que ya usaban el slug «novedades»", () => {
  const sql = read("prisma/migrations/20261016100000_rename_reserved_product_slug/migration.sql");
  ok(/UPDATE\s+"Product"/.test(sql), "debe actualizar la tabla Product");
  ok(/WHERE\s+p\."slug"\s*=\s*'novedades'/.test(sql), "debe limitarse a los productos con slug «novedades»");
  ok(sql.includes("'novedades-1'"), "debe usar «novedades-1» cuando esté libre");
  ok(/q\."creatorId"\s*=\s*p\."creatorId"/.test(sql), "debe comprobar la colisión dentro de la misma creadora");
});

test("al guardar un producto con slug reservado se recalcula aunque no cambie", () => {
  const src = read("app/panel/productos/actions.ts");
  ok(
    /wantedSlug !== product\.slug \|\| RESERVED_PRODUCT_SLUGS\.has\(wantedSlug\)\s*\?\s*await uniqueProductSlug\(/.test(src),
    "updateProduct debe pasar por uniqueProductSlug cuando el slug actual está reservado",
  );
});
