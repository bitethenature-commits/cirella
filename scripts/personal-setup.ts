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
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { appUrl } from "../lib/env";
import { defaultPageConfig } from "../lib/page-config";
import { parseSetupArgs, passwordProblem, PERSONAL_PLAN } from "../lib/personal-setup";
import { randomCode, slugify } from "../lib/slug";
import { ensureBaseData } from "../prisma/base-data";

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

async function uniqueReferralCode(base: string) {
  const clean = slugify(base).replace(/-/g, "").toUpperCase().slice(0, 8);
  for (let i = 0; i < 5; i++) {
    const code = i === 0 && clean.length >= 4 ? clean : `${clean.slice(0, 4)}${randomCode(4)}`;
    if (!(await prisma.creator.findUnique({ where: { referralCode: code } }))) return code;
  }
  return randomCode(10);
}

async function main() {
  const parsed = parseSetupArgs(process.argv.slice(2), { SITE_MODE: process.env.SITE_MODE, OWNER_USERNAME: process.env.OWNER_USERNAME });
  if (!parsed.ok) {
    for (const e of parsed.errors) console.error(`✗ ${e}`);
    console.error('\nUso: npm run personal:setup -- --email tu@email.com --name "Tu Nombre"');
    process.exit(1);
  }
  const { email, username, name } = parsed.args;

  // 1. Datos base y plan «Personal» (si ya existe, se le vuelve a dejar sin comisión y con todo).
  await ensureBaseData(prisma);
  const { key, features, ...planData } = PERSONAL_PLAN;
  const plan = await prisma.plan.upsert({
    where: { key },
    create: { key, ...planData, features: features as Prisma.InputJsonValue },
    update: { ...planData, features: features as Prisma.InputJsonValue },
  });

  // 2. Usuario: administradora, con el email confirmado.
  const existing = await prisma.user.findUnique({ where: { email }, include: { creator: true } });
  const taken = await prisma.creator.findUnique({ where: { username }, include: { user: { select: { email: true } } } });
  if (taken && taken.userId !== existing?.id) {
    console.error(`✗ El usuario «${username}» ya es de otra cuenta (${taken.user.email}). Usa ese email o elige otro OWNER_USERNAME.`);
    process.exit(1);
  }
  const password = parsed.args.password ?? (await choosePassword(!!existing?.passwordHash));
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true, status: "ACTIVE", emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), ...(passwordHash ? { passwordHash } : {}), ...(name && !existing.name ? { name } : {}) },
      })
    : await prisma.user.create({ data: { email, name, isAdmin: true, emailVerifiedAt: new Date(), passwordHash } });

  // 3. Página: con el asistente hecho, publicada y con el plan «Personal».
  const now = new Date();
  let creator = existing?.creator ?? null;
  if (!creator) {
    const displayName = name ?? user.name ?? username;
    const page = defaultPageConfig({ displayName }) as unknown as Prisma.InputJsonValue;
    creator = await prisma.creator.create({
      data: {
        userId: user.id,
        username,
        displayName,
        planId: plan.id,
        pageDraft: page,
        pagePublished: page,
        published: true,
        publishedAt: now,
        onboardedAt: now,
        contactEmail: email,
        referralCode: await uniqueReferralCode(username),
      },
    });
    // Disponibilidad por defecto, por si algún día una sesión se reserva aquí: L–V 10–14 y 16–19.
    await prisma.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5].flatMap((weekday) => [
        { weekday, startMinute: 600, endMinute: 840, creatorId: creator!.id },
        { weekday, startMinute: 960, endMinute: 1140, creatorId: creator!.id },
      ]),
    });
  } else {
    creator = await prisma.creator.update({
      where: { id: creator.id },
      data: {
        username,
        planId: plan.id,
        status: "ACTIVE",
        onboardedAt: creator.onboardedAt ?? now,
        published: true,
        publishedAt: creator.publishedAt ?? now,
        ...(creator.pagePublished === null ? { pagePublished: creator.pageDraft as Prisma.InputJsonValue } : {}),
      },
    });
  }

  console.log(`✓ Plan «${plan.name}»: comisión 0 % y todas las funciones.`);
  console.log(`✓ Cuenta ${email}: administradora${passwordHash ? ", contraseña guardada" : ""}${existing ? " (ya existía: puesta al día)" : " (nueva)"}.`);
  console.log(`✓ Página «${creator.displayName}» (${username}): publicada y lista.`);
  console.log(`\nEntra en ${appUrl()}/entrar con tu email y tu contraseña. Tu página está en ${appUrl()}/`);
}

main()
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
