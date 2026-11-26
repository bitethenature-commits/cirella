/**
 * Convierte una cuenta ya registrada en administradora de la plataforma.
 *   npm run admin:promote -- tu@email.com
 * La cuenta se crea antes de forma normal en /signup: ninguna contraseña pasa por la terminal.
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { appUrl } from "../lib/env";

const prisma = new PrismaClient();

async function main() {
  const parsed = z.string().trim().toLowerCase().email().safeParse(process.argv[2] ?? "");
  if (!parsed.success) {
    console.error("Uso: npm run admin:promote -- tu@email.com");
    process.exit(1);
  }
  const email = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`✗ No existe ninguna cuenta con ese email. Regístrate primero en ${appUrl()}/signup y vuelve a ejecutar este comando.`);
    process.exit(1);
  }
  if (user.isAdmin) {
    console.log(`✓ ${email} ya era administradora.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  console.log(`✓ ${email} ahora es administradora.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
