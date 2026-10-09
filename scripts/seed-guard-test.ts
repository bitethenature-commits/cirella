/**
 * Protección del seed y datos base de producción, contra una BD de usar y tirar.
 *   npm run test:seed-guard        (Postgres local; no toca la BD de la demo)
 *
 * Crea la base de datos `<tu BD>_guardtest` en el mismo Postgres, le aplica las migraciones y comprueba:
 *   · bootstrap crea 3 planes, 10 categorías y 5 diseños, es idempotente y no pisa lo editado
 *   · el seed se niega con una cuenta real, en producción y contra un host remoto, sin borrar nada
 *   · el seed funciona en una BD vacía y deja la marca que le permite volver a sembrarla
 *   · admin:promote solo promociona cuentas que ya existen
 * Al terminar borra la base de datos de prueba.
 */
import "./load-env";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { env, isLocalDatabaseUrl } from "../lib/env";
import { DEMO_MARKER_KEY } from "../prisma/seed-guard";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? `\n    ${detail.trim().split("\n").slice(-6).join("\n    ")}` : ""}`);
  if (!ok) failures++;
}

const baseUrl = env().DATABASE_URL;
if (!baseUrl || !isLocalDatabaseUrl(baseUrl)) {
  console.error("✗ Esta prueba crea y borra una base de datos: necesita un DATABASE_URL local.");
  process.exit(1);
}
const scratch = new URL(baseUrl);
const scratchDb = `${scratch.pathname.slice(1) || "cirella"}_guardtest`;
scratch.pathname = `/${scratchDb}`;
const SCRATCH_URL = scratch.toString();
const storage = mkdtempSync(path.join(tmpdir(), "cirella-guardtest-"));
const bin = (name: string) => path.join(process.cwd(), "node_modules", ".bin", name);

/** Ejecuta un comando contra la BD de prueba (y una carpeta de archivos temporal). */
function run(cmd: string, args: string[], extraEnv: Record<string, string> = {}) {
  const r = spawnSync(bin(cmd), args, {
    env: { ...process.env, DATABASE_URL: SCRATCH_URL, DIRECT_URL: SCRATCH_URL, STORAGE_DIR: storage, ...extraEnv },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { status: r.status, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const admin = new PrismaClient();
const db = new PrismaClient({ datasources: { db: { url: SCRATCH_URL } } });

async function counts() {
  const [plans, categories, templates, users] = await Promise.all([db.plan.count(), db.category.count(), db.template.count(), db.user.count()]);
  return { plans, categories, templates, users };
}

async function main() {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${scratchDb}"`);

  const migrate = run("prisma", ["migrate", "deploy"]);
  check("las migraciones se aplican en una BD vacía", migrate.status === 0, migrate.output);

  // ── Datos base (npm run deploy) ──
  const first = run("tsx", ["prisma/bootstrap.ts"]);
  check("bootstrap en una BD vacía", first.status === 0 && first.output.includes("3 planes, 10 categorías, 5 diseños"), first.output);
  const second = run("tsx", ["prisma/bootstrap.ts"]);
  check("bootstrap es idempotente", second.status === 0, second.output);
  check("tras dos ejecuciones: 3 planes, 10 categorías, 5 diseños", JSON.stringify(await counts()) === JSON.stringify({ plans: 3, categories: 10, templates: 5, users: 0 }));

  await db.plan.update({ where: { key: "pro" }, data: { priceMonthlyCents: 3900 } });
  await db.category.delete({ where: { slug: "yoga" } });
  const third = run("tsx", ["prisma/bootstrap.ts"]);
  check("bootstrap no pisa el precio editado en /admin", third.status === 0 && (await db.plan.findUniqueOrThrow({ where: { key: "pro" } })).priceMonthlyCents === 3900);
  check("bootstrap vuelve a crear lo que falta", !!(await db.category.findUnique({ where: { slug: "yoga" } })));

  // ── El seed no borra una BD con cuentas reales ──
  await db.user.create({ data: { email: "fundadora@cirella.es", name: "Cuenta real" } });
  const refused = run("tsx", ["prisma/seed.ts"]);
  check("el seed se niega con una cuenta real", refused.status === 1 && refused.output.includes("no la creó el script"), refused.output);
  const assertLocal = run("tsx", ["scripts/assert-local-db.ts"]);
  check("assert-local-db (setup, db:reset) también se niega", assertLocal.status === 1 && assertLocal.output.includes("no la creó el script"), assertLocal.output);
  const prod = run("tsx", ["prisma/seed.ts"], { APP_ENV: "production" });
  check("el seed se niega en producción", prod.status === 1 && prod.output.includes("nunca en producción"), prod.output);
  const remoteUrl = "postgresql://u:p@example.com:5432/cirella";
  const remote = run("tsx", ["prisma/seed.ts"], { DATABASE_URL: remoteUrl, DIRECT_URL: remoteUrl });
  check("el seed se niega con un host remoto (sin conectar)", remote.status === 1 && remote.output.includes("no es una base de datos local"), remote.output);
  const after = await counts();
  check("no se ha borrado nada", after.users === 1 && after.plans === 3 && after.categories === 10, JSON.stringify(after));

  // ── Alta de la administradora ──
  const missing = run("tsx", ["scripts/make-admin.ts", "nadie@cirella.es"]);
  check("admin:promote con un email sin cuenta → error", missing.status === 1 && missing.output.includes("No existe ninguna cuenta"), missing.output);
  const promote = run("tsx", ["scripts/make-admin.ts", "Fundadora@Cirella.es"]);
  const promoted = await db.user.findUniqueOrThrow({ where: { email: "fundadora@cirella.es" } });
  check("admin:promote convierte la cuenta en administradora", promote.status === 0 && promoted.isAdmin, promote.output);

  // ── El seed sí funciona en una BD vacía y puede repetirse ──
  await db.user.deleteMany();
  const seeded = run("tsx", ["prisma/seed.ts"]);
  check("el seed funciona en una BD local sin cuentas", seeded.status === 0, seeded.output);
  check("el seed deja su marca", !!(await db.platformSetting.findUnique({ where: { key: DEMO_MARKER_KEY } })));
  await db.user.create({ data: { email: "local@cirella.es", name: "Cuenta de prueba local" } });
  const reseeded = run("tsx", ["prisma/seed.ts"]);
  check("con la marca, el seed puede volver a sembrar su propia BD", reseeded.status === 0, reseeded.output);
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`).catch(() => {});
    await admin.$disconnect();
    rmSync(storage, { recursive: true, force: true });
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nLa protección del seed y los datos base funcionan ✓");
    process.exit(failures ? 1 : 0);
  });
