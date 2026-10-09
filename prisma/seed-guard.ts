/**
 * Protección del script de datos de ejemplo (prisma/seed.ts), que borra TODAS las tablas y crea
 * cuentas con la contraseña demo1234. Solo se ejecuta en una base de datos local que esté vacía
 * o que haya creado el propio seed (marca DEMO_MARKER_KEY en PlatformSetting).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { env, isLocalDatabaseUrl, type AppEnv } from "../lib/env";

export const DEMO_MARKER_KEY = "demoData";

/** Cuentas que crea el seed. Las de @example.com (dominio reservado) son las de la demo y de las pruebas e2e. */
const SEED_ACCOUNTS = ["admin@cirella.app", "ana@cirella.app", "maria@cirella.app", "sofia@cirella.app"];
const EXAMPLE_DOMAIN = "@example.com";

type GuardInput = {
  appEnv: AppEnv;
  databaseUrl: string | undefined;
  directUrl?: string;
  userCount: number;
  hasMarker: boolean;
  /** Todas las cuentas son de ejemplo: BD sembrada por una versión del seed anterior a la marca. */
  onlyDemoAccounts?: boolean;
};

export function seedGuardErrors({ appEnv, databaseUrl, directUrl, userCount, hasMarker, onlyDemoAccounts = false }: GuardInput): string[] {
  const errors: string[] = [];
  if (appEnv === "production" || appEnv === "staging")
    errors.push(`APP_ENV=${appEnv}: los datos de ejemplo no se cargan nunca en producción. Para preparar la base de datos real usa «npm run deploy».`);
  if (!databaseUrl) errors.push("Falta DATABASE_URL.");
  for (const [name, url] of [["DATABASE_URL", databaseUrl], ["DIRECT_URL", directUrl]] as const)
    if (url && !isLocalDatabaseUrl(url))
      errors.push(`${name} apunta a «${hostOf(url)}», que no es una base de datos local (localhost o el contenedor db). No se borra nada.`);
  if (userCount > 0 && !hasMarker && !onlyDemoAccounts)
    errors.push(`La base de datos tiene ${userCount} cuentas y no la creó el script de datos de ejemplo. No se borra nada.`);
  return errors;
}

/** Sale del proceso (exit 1) si no es seguro sembrar. Comprueba la configuración antes de conectar. */
export async function assertSafeToSeed(db: PrismaClient) {
  const { APP_ENV, DATABASE_URL, DIRECT_URL } = env();
  const config = { appEnv: APP_ENV, databaseUrl: DATABASE_URL, directUrl: DIRECT_URL };
  let errors = seedGuardErrors({ ...config, userCount: 0, hasMarker: false });
  if (!errors.length) {
    errors = seedGuardErrors({ ...config, ...(await demoState(db)) });
  }
  if (!errors.length) return;
  console.error("✗ El script de datos de ejemplo borra TODAS las tablas y crea cuentas con la contraseña demo1234. Solo se ejecuta en una base de datos local.");
  for (const e of errors) console.error(`  · ${e}`);
  await db.$disconnect();
  process.exit(1);
}

async function demoState(db: PrismaClient) {
  try {
    const [userCount, otherAccounts, marker] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { email: { notIn: SEED_ACCOUNTS }, NOT: { email: { endsWith: EXAMPLE_DOMAIN } } } }),
      db.platformSetting.findUnique({ where: { key: DEMO_MARKER_KEY } }),
    ]);
    return { userCount, hasMarker: !!marker, onlyDemoAccounts: otherAccounts === 0 };
  } catch (e) {
    // Sin tablas todavía (BD recién creada, antes de las migraciones): no hay nada que proteger.
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022"))
      return { userCount: 0, hasMarker: false, onlyDemoAccounts: true };
    throw e;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return "una dirección no válida";
  }
}
