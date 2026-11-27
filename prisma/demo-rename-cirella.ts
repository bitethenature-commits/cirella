/**
 * La dueña de la web pasa de «Ana Luna» a «Cirella» en una base ya creada (sin volver a sembrar):
 * nombre, nombre legal, correos, redes y textos. Recorre todas las columnas de texto y JSON.
 * «Ana» suelta se cambia en todo menos en los datos de nacimiento y los pedidos (lugares como
 * «Santa Ana»). Además, lo que se pagaba en otra web (Hotmart, Calendly) pasa a «Con solicitud».
 *   npx tsx prisma/demo-rename-cirella.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PAIRS: [string, string][] = [
  ["Ana Luna Pérez", "Cirella"],
  ["Ana Luna", "Cirella"],
  ["ana luna", "cirella"],
  ["analuna.es", "cirella.app"],
  ["ANALUNA", "CIRELLA"],
  ["AnaLuna", "Cirella"],
  ["ana-luna", "cirella"],
  ["ana.luna.astro", "cirella"],
  ["ana.luna", "cirella"],
  ["analunacielo", "cirella"],
  ["analuna", "cirella"],
];
const SKIP_BARE = new Set(["BirthProfile", "Order", "_prisma_migrations"]);

async function main() {
  const cols = await prisma.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'jsonb')`;
  let total = 0;
  for (const c of cols) {
    if (c.table_name === "_prisma_migrations") continue;
    const t = `"${c.table_name}"`;
    const col = `"${c.column_name}"`;
    const asText = c.data_type === "jsonb" ? `${col}::text` : col;
    let expr = asText;
    for (const [a, b] of PAIRS) expr = `replace(${expr}, '${a}', '${b}')`;
    if (!SKIP_BARE.has(c.table_name)) expr = `regexp_replace(${expr}, '\\mAna\\M', 'Cirella', 'g')`;
    const set = c.data_type === "jsonb" ? `(${expr})::jsonb` : expr;
    const n = await prisma.$executeRawUnsafe(`UPDATE ${t} SET ${col} = ${set} WHERE ${asText} ~* '(ana luna|analuna|ana-luna|ana\\.luna|\\mAna\\M)'`);
    if (n) {
      total += n;
      console.log(`${c.table_name}.${c.column_name}: ${n}`);
    }
  }
  const ext = await prisma.product.updateMany({ where: { accessMode: "EXTERNAL" }, data: { accessMode: "PAID", externalUrl: null, externalLabel: null } });
  console.log(`Filas cambiadas: ${total}. Productos de otra web → con solicitud: ${ext.count}`);
}

main().finally(() => prisma.$disconnect());
