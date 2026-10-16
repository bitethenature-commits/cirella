/**
 * Cuenta de la dueña creada en el despliegue (modo personal con OWNER_EMAIL).
 *   npx tsx --conditions=react-server scripts/revision-personal-owner-test.ts      (BD sembrada)
 *
 *   · ownerBootstrapPlan: solo en modo personal y con OWNER_EMAIL; normaliza email y usuario;
 *   · `npm run deploy` (prisma/bootstrap.ts) crea la cuenta (administradora, sin contraseña, email
 *     confirmado) y la página publicada con el plan «Personal»; el segundo despliegue no la toca;
 *   · si el usuario ya es de otra cuenta, el despliegue se para y explica por qué;
 *   · ensurePersonalOwner con contraseña (personal:setup) la guarda sin duplicar nada.
 * Usa un usuario de prueba y borra todo lo que crea.
 */
import "./load-env";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/db";
import { ensurePersonalOwner, ownerBootstrapPlan, OwnerSetupError } from "../prisma/personal-owner";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? `\n    ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const stamp = `${Date.now()}`.slice(-6);
const USERNAME = `duena${stamp}`;
const EMAIL = `duena-${stamp}@example.com`;

/** `npm run deploy` sin la comprobación de entorno ni las migraciones: solo el último paso. */
function bootstrap(extra: Record<string, string>) {
  try {
    const out = execFileSync("npx", ["tsx", "prisma/bootstrap.ts"], { env: { ...process.env, ...extra }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `duena-${stamp}` } }, select: { id: true } });
  const creators = await prisma.creator.findMany({ where: { username: { startsWith: `duena${stamp}` } }, select: { id: true } });
  const ids = creators.map((c) => c.id);
  await prisma.availabilityRule.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.creator.deleteMany({ where: { id: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
}

async function main() {
  // ── Plan puro ──
  check("plataforma: nada que crear", ownerBootstrapPlan({ SITE_MODE: "platform", OWNER_EMAIL: EMAIL, OWNER_USERNAME: USERNAME }) === null);
  check("personal sin OWNER_EMAIL: nada que crear (se usa personal:setup)", ownerBootstrapPlan({ SITE_MODE: "personal", OWNER_USERNAME: USERNAME }) === null);
  const plan = ownerBootstrapPlan({ SITE_MODE: "personal", OWNER_EMAIL: `  ${EMAIL.toUpperCase()} `, OWNER_USERNAME: USERNAME.toUpperCase(), OWNER_NAME: "  Ana Prueba " });
  check("personal con OWNER_EMAIL: email y usuario normalizados, nombre recortado", JSON.stringify(plan) === JSON.stringify({ email: EMAIL, username: USERNAME, name: "Ana Prueba" }), plan);

  const env = { SITE_MODE: "personal", OWNER_USERNAME: USERNAME, OWNER_EMAIL: EMAIL, OWNER_NAME: "Ana Prueba" };

  // ── Primer despliegue: crea la cuenta y la página ──
  const first = bootstrap(env);
  check("el primer despliegue termina bien", first.code === 0, first.out);
  check("y dice que la cuenta y la página están creadas", first.out.includes(`Cuenta de ${EMAIL}`) && first.out.includes("Pide un enlace para entrar"), first.out);
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, include: { creator: { include: { plan: true } } } });
  check("cuenta administradora, con el email confirmado y sin contraseña", !!user && user.isAdmin && !!user.emailVerifiedAt && user.passwordHash === null, user);
  check("página publicada con el nombre y el plan «Personal» (comisión 0)", user?.creator?.username === USERNAME && user.creator.published && user.creator.displayName === "Ana Prueba" && user.creator.plan.key === "personal" && user.creator.plan.commissionBps === 0, user?.creator);

  // ── Segundo despliegue: no toca lo que ya existe ──
  await prisma.creator.update({ where: { username: USERNAME }, data: { displayName: "Nombre cambiado por ella", published: false } });
  const second = bootstrap({ ...env, OWNER_NAME: "Otro nombre" });
  check("el segundo despliegue termina bien", second.code === 0, second.out);
  check("y dice que la página ya existe", second.out.includes("ya existe: no se toca"), second.out);
  const after = await prisma.creator.findUniqueOrThrow({ where: { username: USERNAME } });
  check("lo que ella cambió sigue igual (nombre y página sin publicar)", after.displayName === "Nombre cambiado por ella" && !after.published, after);
  check("no se ha duplicado nada", (await prisma.user.count({ where: { email: EMAIL } })) === 1 && (await prisma.creator.count({ where: { username: USERNAME } })) === 1);

  // ── Usuario de otra cuenta: el despliegue se para y lo explica ──
  const clash = bootstrap({ ...env, OWNER_EMAIL: `duena-${stamp}-otra@example.com`, OWNER_USERNAME: `${USERNAME}b` });
  check("usuario libre con otro email: se crea (control)", clash.code === 0, clash.out);
  await prisma.creator.update({ where: { username: `${USERNAME}b` }, data: { username: `${USERNAME}c` } });
  let threw: unknown = null;
  try {
    await ensurePersonalOwner(prisma, { email: `duena-${stamp}-tercera@example.com`, username: `${USERNAME}c`, name: null });
  } catch (e) {
    threw = e;
  }
  check("usuario ya ocupado por otra cuenta: error explicado", threw instanceof OwnerSetupError && /ya es de otra cuenta/.test((threw as Error).message), String(threw));
  check("y no crea la cuenta nueva", (await prisma.user.count({ where: { email: `duena-${stamp}-tercera@example.com` } })) === 0);

  // ── Cambiar OWNER_USERNAME (mismo email): la página pasa al usuario nuevo con su contenido ──
  const page = await prisma.creator.findUniqueOrThrow({ where: { username: USERNAME } });
  const renamed = bootstrap({ ...env, OWNER_USERNAME: `${USERNAME}n` });
  check("cambiar OWNER_USERNAME: el despliegue termina bien", renamed.code === 0, renamed.out);
  const moved = await prisma.creator.findUnique({ where: { username: `${USERNAME}n` } });
  check("y su página (la misma) pasa al usuario nuevo", moved?.id === page.id && (await prisma.creator.count({ where: { username: USERNAME } })) === 0, moved);
  await prisma.creator.update({ where: { id: page.id }, data: { username: USERNAME } });

  // ── personal:setup con contraseña sobre la cuenta creada en el despliegue ──
  const { user: withPassword, existed } = await ensurePersonalOwner(prisma, { email: EMAIL, username: USERNAME, name: null, passwordHash: "hash-de-prueba" });
  check("personal:setup después: la reconoce y guarda la contraseña", existed && withPassword.passwordHash === "hash-de-prueba");
  check("y vuelve a publicar su página", (await prisma.creator.findUniqueOrThrow({ where: { username: USERNAME } })).published);
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nLa cuenta de la dueña se crea en el despliegue ✓");
    process.exit(failures ? 1 : 0);
  });
