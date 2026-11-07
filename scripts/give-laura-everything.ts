/**
 * Da a Laura Martín (laura@example.com) acceso a todo lo de Ana (prisma/demo-full-access.ts) en una BD
 * ya sembrada. Se puede repetir: lo que ya tiene no se toca.   npx tsx scripts/give-laura-everything.ts
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { FULL_ACCESS_EMAIL, grantFullAccess } from "../prisma/demo-full-access";

const prisma = new PrismaClient();

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const n = await grantFullAccess(prisma, { creatorId: ana.id, ownerUserId: ana.userId });
  console.log(`✓ ${FULL_ACCESS_EMAIL}: ${n} accesos nuevos, «Mi energía» y sus datos de nacimiento`);
}

main().finally(() => prisma.$disconnect());