/**
 * Lo que se vio al grabar la demo del modo personal: un producto de pago guardado no se regala, los
 * botones a productos ocultos no se enseñan, la duración del curso se escribe en español y el build
 * avisa si las variables cambian sin volver a compilar.
 */
import { accessModeOptions, linksToProduct, resolveAccessMode } from "../../lib/access-mode";
import { validateEnv, withHostingDefaults } from "../../lib/env";
import { buildEnvDrift, buildEnvSnapshot } from "../../lib/security-headers";
import { lessonsLabel } from "../../lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, ok, test } from "./harness";

// ── Un producto de pago en la web personal se conserva (oculto) hasta elegir otro modo ──
test("web personal: guardar un producto de pago con su modo lo deja de pago", () => eq(resolveAccessMode("PAID", "PAID", "personal", "COURSE"), "PAID"));
test("web personal: elegir «Gratis con email» en un producto de pago sí lo cambia", () => eq(resolveAccessMode("FREE_EMAIL", "PAID", "personal", "COURSE"), "FREE_EMAIL"));
test("web personal: elegir «Pago en otra web» en un producto de pago sí lo cambia", () => eq(resolveAccessMode("EXTERNAL", "PAID", "personal", "SESSION"), "EXTERNAL"));
test("web personal: un gratis no puede pasar a pago en la web", () => eq(resolveAccessMode("PAID", "FREE_EMAIL", "personal", "DIGITAL"), "FREE_EMAIL"));
test("formulario: el modo actual no permitido va primero; si está permitido, no se repite", () => {
  eq(accessModeOptions(["FREE_EMAIL", "EXTERNAL"], "PAID"), ["PAID", "FREE_EMAIL", "EXTERNAL"]);
  eq(accessModeOptions(["FREE_EMAIL", "EXTERNAL"], "EXTERNAL"), ["FREE_EMAIL", "EXTERNAL"]);
  eq(accessModeOptions(["PAID"], "PAID"), ["PAID"]);
});

// ── Botones de la página que llevan a un producto oculto ──
const hidden = new Set(["curso-conocete-tu-energia"]);
test("enlace relativo a un producto oculto", () => eq(linksToProduct("/ana/curso-conocete-tu-energia", "ana", hidden), true));
test("enlace relativo con más ruta, consulta o mayúsculas", () =>
  eq(
    ["/ana/curso-conocete-tu-energia/checkout", "/Cirella/Curso-Conocete-Tu-Energia?x=1", "/ana/curso-conocete-tu-energia#y"].map((u) => linksToProduct(u, "ana", hidden)),
    [true, true, true],
  ));
test("enlace absoluto a la propia web (con la dirección de la web)", () =>
  eq(linksToProduct("https://tudominio.com/ana/curso-conocete-tu-energia", "ana", hidden, "https://tudominio.com"), true));
test("enlace a la propia web sin https://, con // o con www (la página lo pinta así)", () =>
  eq(
    ["tudominio.com/ana/curso-conocete-tu-energia", "//tudominio.com/ana/curso-conocete-tu-energia", "https://www.tudominio.com/ana/curso-conocete-tu-energia", "www.tudominio.com/ana/curso-conocete-tu-energia"].map((u) =>
      linksToProduct(u, "ana", hidden, "https://tudominio.com"),
    ),
    [true, true, true, true],
  ));
test("enlace absoluto a otra web con la misma ruta: no es de aquí", () =>
  eq(linksToProduct("https://otra.com/ana/curso-conocete-tu-energia", "ana", hidden, "https://tudominio.com"), false));
test("enlace absoluto sin conocer la dirección de la web: no se toca", () => eq(linksToProduct("https://tudominio.com/ana/curso-conocete-tu-energia", "ana", hidden), false));
test("otros enlaces se enseñan", () =>
  eq(
    ["/ana/mini-curso", "/maria/curso-conocete-tu-energia", "/ana", "https://open.spotify.com", "//ana/curso-conocete-tu-energia", "mailto:hola@x.com"].map((u) => linksToProduct(u, "ana", hidden, "https://tudominio.com")),
    [false, false, false, false, false, false],
  ));
test("sin productos ocultos, ningún enlace se quita", () => eq(linksToProduct("/ana/curso-conocete-tu-energia", "ana", new Set()), false));

// ── Lecciones del curso ──
test("lecciones: singular y plural", () => eq([lessonsLabel(1), lessonsLabel(3)], ["1 lección", "3 lecciones"]));

// ── Variables que fija el build ──
const BUILD = { APP_URL: "https://tudominio.com", STORAGE_DRIVER: "s3", S3_ENDPOINT: "https://abc.eu.r2.cloudflarestorage.com", SITE_MODE: "personal", PAYMENT_PROVIDER: "none" } as unknown as NodeJS.ProcessEnv;
const built = JSON.stringify(buildEnvSnapshot(BUILD));
test("build: mismas variables → nada que avisar", () => eq(buildEnvDrift(built, { ...BUILD }), []));
test("build: cambiar el almacenamiento o el modo del sitio se avisa", () =>
  eq(buildEnvDrift(built, { ...BUILD, S3_ENDPOINT: "https://otra.r2.cloudflarestorage.com", SITE_MODE: "platform" }), ["STORAGE_DRIVER/S3_ENDPOINT", "SITE_MODE"]));
test("build: APP_URL distinta se avisa", () => eq(buildEnvDrift(built, { ...BUILD, APP_URL: "https://www.tudominio.com" }), ["APP_URL"]));
test("build: SITE_MODE vacío equivale a plataforma", () =>
  eq(buildEnvDrift(JSON.stringify(buildEnvSnapshot({ ...BUILD, SITE_MODE: "" })), { ...BUILD, SITE_MODE: undefined }), []));
test("build: sin datos del build (desarrollo) o ilegibles → nada", () => eq([buildEnvDrift(undefined, BUILD), buildEnvDrift("{", BUILD)], [[], []]));

// ── El build no necesita la base de datos (en Railway no llega a ella durante el build) ──
test("las pantallas de entrar, contraseña y registro nunca se generan al compilar", () => {
  const src = readFileSync(join(process.cwd(), "app/(auth)/layout.tsx"), "utf8");
  ok(src.includes('export const dynamic = "force-dynamic";'), "app/(auth)/layout.tsx debe ser force-dynamic");
});

// ── Render: sin APP_URL, su dirección pública; render.yaml con lo que exige el modo personal ──
test("Render: sin APP_URL se usa RENDER_EXTERNAL_URL; con APP_URL, manda APP_URL", () => {
  eq(withHostingDefaults({ RENDER_EXTERNAL_URL: "https://mi-web.onrender.com" }).APP_URL, "https://mi-web.onrender.com");
  eq(withHostingDefaults({ APP_URL: "https://tudominio.com", RENDER_EXTERNAL_URL: "https://mi-web.onrender.com" }).APP_URL, "https://tudominio.com");
  eq(withHostingDefaults({ APP_URL: "  ", RENDER_EXTERNAL_URL: "https://mi-web.onrender.com" }).APP_URL, "https://mi-web.onrender.com");
  eq(withHostingDefaults({}).APP_URL, undefined);
});
test("Render: la configuración de producción es válida sin APP_URL", () => {
  const S = "x".repeat(44);
  const r = validateEnv({
    APP_ENV: "production", RENDER_EXTERNAL_URL: "https://mi-web.onrender.com", SITE_MODE: "personal", OWNER_USERNAME: "cirella", OWNER_EMAIL: "ana@example.com",
    PAYMENT_PROVIDER: "none", DEMO_MODE: "false", DATABASE_URL: "postgresql://u:p@db.internal:5432/x", DIRECT_URL: "postgresql://u:p@db.internal:5432/x",
    APP_SECRET: S, CRON_SECRET: S, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Cirella <onboarding@resend.dev>",
    STORAGE_DRIVER: "s3", S3_ENDPOINT: "https://abc.eu.r2.cloudflarestorage.com", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "i", S3_SECRET_ACCESS_KEY: "s", CLIENT_IP_HEADER: "cf-connecting-ip",
  });
  ok(r.ok, r.ok ? "" : r.errors.join(" | "));
  eq(r.ok && r.env.APP_URL, "https://mi-web.onrender.com");
});
test("render.yaml: modo personal, sin pagos, cuenta con OWNER_EMAIL, R2, Resend y la IP de Cloudflare", () => {
  const y = readFileSync(join(process.cwd(), "render.yaml"), "utf8");
  for (const key of ["SITE_MODE", "OWNER_USERNAME", "OWNER_EMAIL", "PAYMENT_PROVIDER", "DATABASE_URL", "DIRECT_URL", "APP_SECRET", "CRON_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "CLIENT_IP_HEADER"])
    ok(y.includes(`key: ${key}`), `falta ${key}`);
  ok(/startCommand: npm run deploy && npm run start/.test(y), "las migraciones y la cuenta antes de arrancar");
  ok(/value: personal/.test(y) && /value: none/.test(y) && /value: cf-connecting-ip/.test(y));
});
