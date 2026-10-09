/**
 * Comprueba la configuración antes de desplegar (primer paso de `npm run deploy`).
 *   npm run check:env
 * Sin APP_ENV se valida como production: es lo que se usa en un despliegue.
 */
async function main() {
  const vars: Record<string, string | undefined> = process.env;
  vars.NODE_ENV ||= "production";
  await import("./load-env");
  const { validateEnv } = await import("../lib/env");
  const r = validateEnv(process.env);
  if (r.ok) {
    console.log(`✓ Configuración válida (APP_ENV=${r.env.APP_ENV}).`);
    return;
  }
  console.error(`✗ La configuración no es válida para APP_ENV=${r.appEnv}:`);
  for (const e of r.errors) console.error(`  · ${e}`);
  console.error("Revisa las variables de entorno (ver .env.example y README «Configuración»).");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
