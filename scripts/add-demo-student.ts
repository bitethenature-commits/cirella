/**
 * Añade a Elena (la alumna de la demo con un poco de todo, prisma/demo-student.ts) a una BD ya
 * sembrada, sin volver a sembrar nada más.   npx tsx scripts/add-demo-student.ts
 */
import "./load-env";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEMO_STUDENT_EMAIL, seedDemoStudent } from "../prisma/demo-student";

const prisma = new PrismaClient();

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const id = await seedDemoStudent(prisma, { creatorId: ana.id, ownerUserId: ana.userId, passwordHash: await bcrypt.hash("demo1234", 10), timezone: ana.timezone });
  console.log(id ? `✓ ${DEMO_STUDENT_EMAIL} creada (contraseña demo1234)` : `${DEMO_STUDENT_EMAIL} ya existía: no se ha tocado nada`);
}

main().finally(() => prisma.$disconnect());
