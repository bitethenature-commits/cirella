/**
 * Carga .env, .env.local, .env.development… igual que Next, para los scripts de tsx
 * (seed, bootstrap, check-env, make-admin, assert-local-db). Nunca pisa variables ya definidas.
 * Debe ser el PRIMER import de cada script que lea la configuración.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
