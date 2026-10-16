/**
 * Crea (o pone al día) la cuenta de la dueña de una web en modo personal.
 *
 *   npm run personal:setup -- --email tu@email.com --name "Tu Nombre"
 *   (opcional: --username tu-usuario, que tiene que ser igual que OWNER_USERNAME;
 *    --password …, si no se pregunta por la terminal sin que se vea al escribir)
 *
 * Hace, y se puede repetir sin miedo (no duplica ni borra nada):
 *   · los datos base (diseños, categorías, planes) si faltan;
 *   · el plan «Personal»: gratis, comisión 0 y todas las funciones;
 *   · tu usuario: administradora, email confirmado y la contraseña que elijas;
 *   · tu página (OWNER_USERNAME): con el asistente ya hecho, publicada y con el plan «Personal».
 * Solo funciona con SITE_MODE=personal.
 */
import "./load-env";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { appUrl } from "../lib/env";
import { parseSetupArgs, passwordProblem } from "../lib/personal-setup";
import { ensurePersonalOwner, OwnerSetupError } from "../prisma/personal-owner";

const prisma = new PrismaClient();

/** Pregunta sin mostrar lo que se escribe (contraseñas). */
async function askHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(question);
  muted = true;
  const answer = await new Promise<string>((resolve) => rl.question("", resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function choosePassword(hasPassword: boolean): Promise<string | null> {
  if (!process.stdin.isTTY) {
    if (hasPassword) return null;
    throw new Error("No se puede preguntar la contraseña aquí: añade --password \"tu contraseña\" al comando.");
  }
  for (;;) {
    const first = await askHidden(hasPassword ? "Nueva contraseña (Enter para dejar la que tienes): " : "Elige tu contraseña (mínimo 8 caracteres): ");
    if (!first && hasPassword) return null;
    const problem = passwordProblem(first);
    if (problem) {
      console.log(`  ${problem}`);
      continue;
    }
    const second = await askHidden("Repítela: ");
    if (first === second) return first;
    console.log("  No coinciden. Vuelve a intentarlo.");
  }
}

async function main() {
  const parsed = parseSetupArgs(process.argv.slice(2), { SITE_MODE: process.env.SITE_MODE, OWNER_USERNAME: process.env.OWNER_USERNAME });
  if (!parsed.ok) {
    for (const e of parsed.errors) console.error(`✗ ${e}`);
    console.error('\nUso: npm run personal:setup -- --email tu@email.com --name "Tu Nombre"');
    process.exit(1);
  }
  const { email, username, name } = parsed.args;
  // La contraseña se pregunta antes de tocar nada (si la cuenta ya tiene una, Enter la conserva).
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const taken = await prisma.creator.findUnique({ where: { username }, include: { user: { select: { email: true } } } });
  if (taken && taken.userId !== existing?.id) {
    console.error(`✗ El usuario «${username}» ya es de otra cuenta (${taken.user.email}). Usa ese email o elige otro OWNER_USERNAME.`);
    process.exit(1);
  }
  const password = parsed.args.password ?? (await choosePassword(!!existing?.passwordHash));
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  let result;
  try {
    result = await ensurePersonalOwner(prisma, { email, username, name, passwordHash });
  } catch (e) {
    if (e instanceof OwnerSetupError) {
      console.error(`✗ ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
  const { plan, creator } = result;
  console.log(`✓ Plan «${plan.name}»: comisión 0 % y todas las funciones.`);
  console.log(`✓ Cuenta ${email}: administradora${passwordHash ? ", contraseña guardada" : ""}${result.existed ? " (ya existía: puesta al día)" : " (nueva)"}.`);
  console.log(`✓ Página «${creator.displayName}» (${username}): publicada y lista.`);
  console.log(`\nEntra en ${appUrl()}/entrar con tu email y tu contraseña. Tu página está en ${appUrl()}/`);
}

main()
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
