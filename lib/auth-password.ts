import bcrypt from "bcryptjs";

/** Contraseñas (bcrypt). Sin Next ni cookies: lo usan lib/auth.ts, lib/two-factor.ts y las pruebas. */
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}
