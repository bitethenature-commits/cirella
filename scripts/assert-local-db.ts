/**
 * Primer paso de `npm run setup` y `npm run db:reset`: aplica la protección del seed
 * (prisma/seed-guard.ts) antes de tocar la base de datos, también antes de las migraciones,
 * para que esos comandos de desarrollo no hagan nada contra una base de datos real.
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { assertSafeToSeed } from "../prisma/seed-guard";

const prisma = new PrismaClient();

assertSafeToSeed(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
