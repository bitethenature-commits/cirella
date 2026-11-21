/**
 * Reinicio de emergencia de la verificación en dos pasos (la dueña ha perdido el móvil y los
 * códigos de recuperación). Se ejecuta en el servidor (Render › Shell):
 *   npm run auth:reset-2fa -- su@email.com --yes
 * Quita la verificación (secreto, códigos, dispositivos recordados), cierra TODAS sus sesiones y le
 * envía un email. Después entra con su contraseña o con un enlace y la vuelve a activar.
 * Ver docs/seguridad-dos-pasos.md.
 */
import "./load-env";
import { z } from "zod";
import { prisma } from "../lib/db";
import { resetTwoFactorFromServer } from "../lib/two-factor-notify";

async function main() {
  const args = process.argv.slice(2);
  const parsed = z.string().trim().toLowerCase().email().safeParse(args.find((a) => !a.startsWith("--")) ?? "");
  if (!parsed.success) {
    console.error("Uso: npm run auth:reset-2fa -- su@email.com --yes");
    process.exit(1);
  }
  const email = parsed.data;
  if (!args.includes("--yes")) {
    console.log(`Esto desactivará la verificación en dos pasos de ${email}, borrará sus códigos de recuperación y dispositivos`);
    console.log("recordados y cerrará todas sus sesiones. Le enviaremos un email avisando.");
    console.log(`Para hacerlo: npm run auth:reset-2fa -- ${email} --yes`);
    process.exit(1);
  }
  const r = await resetTwoFactorFromServer(email);
  if (r === null) {
    console.error("✗ No existe ninguna cuenta con ese email.");
    process.exit(1);
  }
  if (r === false) {
    console.log(`✓ ${email} no tenía la verificación en dos pasos activada. No se ha cambiado nada.`);
    return;
  }
  console.log(`✓ Desactivada para ${email}. Entra con tu contraseña o un enlace y vuelve a activarla en Ajustes › Seguridad.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
