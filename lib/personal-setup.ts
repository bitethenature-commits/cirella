/**
 * Partes puras de `npm run personal:setup` (scripts/personal-setup.ts): lectura de los argumentos
 * y el plan «Personal». Sin BD, para poder probarlas sin servidor.
 */
import { z } from "zod";
import type { PlanFeatures } from "./plans";
import { normalizeUsername, validateUsername } from "./slug";
import { PRODUCT_TYPES } from "./types";

/**
 * Plan de la dueña en modo personal: gratis, sin comisión, sin límite de productos y con todas las
 * funciones. Inactivo, para que no salga en ninguna lista de planes.
 */
export const PERSONAL_PLAN = {
  key: "personal",
  name: "Personal",
  tagline: "Tu web personal, con todo incluido",
  priceMonthlyCents: 0,
  commissionBps: 0,
  maxProducts: null,
  active: false,
  isDefault: false,
  highlighted: false,
  sortOrder: 99,
  features: {
    productTypes: [...PRODUCT_TYPES],
    customDesign: true,
    removeBranding: true,
    analytics: "advanced",
    customerArea: true,
    automations: true,
  } satisfies PlanFeatures,
};

export type SetupArgs = { email: string; username: string; name: string | null; password: string | null };

const MIN_PASSWORD = 8;

/** Lee `--email x --username y --name "Nombre" --password z` (también `--email=x`). */
export function readFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = "";
  }
  return out;
}

/**
 * Valida los argumentos contra la configuración. El usuario es OWNER_USERNAME (si se pasa
 * --username tiene que coincidir: si no, la web enseñaría otra página). Devuelve todos los
 * errores a la vez.
 */
export function parseSetupArgs(argv: string[], env: { SITE_MODE?: string; OWNER_USERNAME?: string }): { ok: true; args: SetupArgs } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (env.SITE_MODE?.trim() !== "personal")
    errors.push("Este comando solo funciona en modo personal: pon SITE_MODE=personal y OWNER_USERNAME=<tu usuario> en la configuración (.env) y vuelve a ejecutarlo.");
  const flags = readFlags(argv);
  const email = z.string().trim().toLowerCase().email().safeParse(flags.email ?? "");
  if (!email.success) errors.push("Falta --email con tu email (el que usarás para entrar).");
  const owner = normalizeUsername(env.OWNER_USERNAME ?? "");
  const wanted = normalizeUsername(flags.username ?? "") || owner;
  if (!wanted) errors.push("Falta el usuario: pon OWNER_USERNAME en la configuración (o --username).");
  else {
    const problem = validateUsername(wanted);
    if (problem) errors.push(`El usuario «${wanted}» no vale: ${problem.toLowerCase()}.`);
    if (owner && wanted !== owner) errors.push(`--username (${wanted}) no coincide con OWNER_USERNAME (${owner}). Tienen que ser el mismo.`);
  }
  const name = flags.name?.trim() ? flags.name.trim().slice(0, 80) : null;
  const password = flags.password ?? null;
  if (password !== null && password.length < MIN_PASSWORD) errors.push(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  if (errors.length) return { ok: false, errors };
  return { ok: true, args: { email: email.data!, username: wanted, name, password } };
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (password.length > 100) return "La contraseña es demasiado larga.";
  return null;
}
