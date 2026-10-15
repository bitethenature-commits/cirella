/**
 * Lo que se vio al grabar la demo del modo personal: un producto de pago guardado no se regala, los
 * botones a productos ocultos no se enseñan, la duración del curso se escribe en español y el build
 * avisa si las variables cambian sin volver a compilar.
 */
import { accessModeOptions, linksToProduct, resolveAccessMode } from "../../lib/access-mode";
import { buildEnvDrift, buildEnvSnapshot } from "../../lib/security-headers";
import { formatCourseLength } from "../../lib/types";
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
    ["/ana/curso-conocete-tu-energia/checkout", "/Ana/Curso-Conocete-Tu-Energia?x=1", "/ana/curso-conocete-tu-energia#y"].map((u) => linksToProduct(u, "ana", hidden)),
    [true, true, true],
  ));
test("enlace absoluto a la propia web (con la dirección de la web)", () =>
  eq(linksToProduct("https://tudominio.com/ana/curso-conocete-tu-energia", "ana", hidden, "https://tudominio.com"), true));
test("enlace absoluto a otra web con la misma ruta: no es de aquí", () =>
  eq(linksToProduct("https://otra.com/ana/curso-conocete-tu-energia", "ana", hidden, "https://tudominio.com"), false));
test("enlace absoluto sin conocer la dirección de la web: no se toca", () => eq(linksToProduct("https://tudominio.com/ana/curso-conocete-tu-energia", "ana", hidden), false));
test("otros enlaces se enseñan", () =>
  eq(
    ["/ana/mini-curso", "/maria/curso-conocete-tu-energia", "/ana", "https://open.spotify.com", "//ana/curso-conocete-tu-energia", "mailto:hola@x.com"].map((u) => linksToProduct(u, "ana", hidden, "https://tudominio.com")),
    [false, false, false, false, false, false],
  ));
test("sin productos ocultos, ningún enlace se quita", () => eq(linksToProduct("/ana/curso-conocete-tu-energia", "ana", new Set()), false));

// ── Duración del curso ──
test("duración: minutos por debajo de una hora", () => eq([formatCourseLength(30), formatCourseLength(45), formatCourseLength(0.4)], ["30 min", "45 min", "1 min"]));
test("duración: horas con coma decimal", () => eq([formatCourseLength(60), formatCourseLength(90), formatCourseLength(135)], ["1 h", "1,5 h", "2,3 h"]));

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
