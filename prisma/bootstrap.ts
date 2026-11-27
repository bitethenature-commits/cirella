/**
 * Prepara una base de datos real con los datos base (planes, categorías y diseños).
 * Último paso de `npm run deploy`, después de `prisma migrate deploy`.
 *
 * Idempotente y no destructivo: solo crea lo que falta y nunca borra ni sobrescribe lo que la
 * administradora haya editado en /admin. En la plataforma no crea cuentas: la administradora se
 * registra en /signup y se promociona con `npm run admin:promote -- su@email`.
 *
 * Modo personal con OWNER_EMAIL: si la página de la dueña (OWNER_USERNAME) aún no existe, crea su
 * cuenta (administradora, sin contraseña) y su página publicada, como `npm run personal:setup`.
 * Entra con «Pide un enlace para entrar» y elige su contraseña después. Si ya existe, no la toca.
 */
import "../scripts/load-env";
import { PrismaClient } from "@prisma/client";
import { ensureBaseData } from "./base-data";
import { ensurePersonalOwner, ownerBootstrapPlan, OwnerSetupError } from "./personal-owner";

const prisma = new PrismaClient();

async function main() {
  await ensureBaseData(prisma);
  const [plans, categories] = await Promise.all([prisma.plan.count(), prisma.category.count()]);
  console.log(`✓ Datos base listos: ${plans} planes, ${categories} categorías (lo que ya existía no se ha tocado).`);

  const owner = ownerBootstrapPlan(process.env);
  if (owner) {
    const page = await prisma.creator.findUnique({ where: { username: owner.username }, select: { id: true } });
    if (page) console.log(`✓ Tu página (${owner.username}) ya existe: no se toca.`);
    else {
      try {
        const { user } = await ensurePersonalOwner(prisma, owner);
        console.log(`✓ Cuenta de ${user.email} y página «${owner.username}» creadas y publicadas. Entra en /login con «Pide un enlace para entrar».`);
      } catch (e) {
        if (e instanceof OwnerSetupError) {
          console.error(`✗ ${e.message}`);
          process.exit(1);
        }
        throw e;
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
