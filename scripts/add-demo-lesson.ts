/**
 * Añade a una BD ya sembrada la lección larga de ejemplo «Marte, tu fuerza» (prisma/demo-lesson-mars.ts)
 * y los datos de nacimiento de Elena, sin tocar nada más.   npx tsx scripts/add-demo-lesson.ts
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { seedMarsLesson } from "../prisma/demo-lesson-mars";
import { seedSystemLessons } from "../prisma/demo-lessons-systems";
import { seedDeepLessons } from "../prisma/demo-lessons-deep";
import { addDemoStudentProfile, DEMO_STUDENT_EMAIL } from "../prisma/demo-student";

const prisma = new PrismaClient();

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const id = await seedMarsLesson(prisma, ana.id);
  console.log(id ? "✓ Lección «Marte, tu fuerza» creada" : "«Marte, tu fuerza» ya existía (o no está el curso)");
  const n = await seedSystemLessons(prisma, ana.id);
  console.log(`✓ ${n} lecciones nuevas de Human Design, Gene Keys y Luna`);
  const m = await seedDeepLessons(prisma, ana.id);
  console.log(`✓ ${m} lecciones con muchos modelos por partes`);
  const elena = await prisma.user.findUnique({ where: { email: DEMO_STUDENT_EMAIL } });
  if (elena) {
    await addDemoStudentProfile(prisma, ana.id, elena.id);
    console.log("✓ Datos de nacimiento de Elena");
  }
}

main().finally(() => prisma.$disconnect());