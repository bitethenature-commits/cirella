/**
 * Prepara una base de datos real con los datos base (planes, categorías y diseños).
 * Último paso de `npm run deploy`, después de `prisma migrate deploy`.
 *
 * Idempotente y no destructivo: solo crea lo que falta y nunca borra ni sobrescribe lo que la
 * administradora haya editado en /admin. No crea cuentas: la administradora se registra en
 * /registro y se promociona con `npm run admin:promote -- su@email`.
 */
import "../scripts/load-env";
import { PrismaClient } from "@prisma/client";
import { ensureBaseData } from "./base-data";

const prisma = new PrismaClient();

async function main() {
  await ensureBaseData(prisma);
  const [plans, categories, templates] = await Promise.all([prisma.plan.count(), prisma.category.count(), prisma.template.count()]);
  console.log(`✓ Datos base listos: ${plans} planes, ${categories} categorías, ${templates} diseños (lo que ya existía no se ha tocado).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
