import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globalErrorTitle, isPersonalModeInBrowser, toClientSiteBrand } from "../../lib/site-brand-client";
import { resolveSiteBrand } from "../../lib/site-brand";
import { eq, ok, test } from "./harness";

const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const owner = { username: "ana", displayName: "Cirella", avatarUrl: "/media/ana/a.webp", email: "ana@example.com" };
const brand = (personal: boolean, withOwner = true) =>
  resolveSiteBrand({ personal, platformName: "Cirella", supportEmail: "hola@cirella.app", owner: withOwner ? owner : null });

test("marca para las pantallas de error: null en la plataforma (logo de siempre)", () => {
  eq(toClientSiteBrand(false, brand(false)), null);
  eq(toClientSiteBrand(false, null), null);
});

test("marca para las pantallas de error en modo personal: nombre y foto de la dueña", () => {
  eq(toClientSiteBrand(true, brand(true)), { name: "Cirella", avatarUrl: "/media/ana/a.webp" });
});

test("modo personal sin dueña o sin BD: sin símbolo, nunca el nombre de la plataforma", () => {
  eq(toClientSiteBrand(true, brand(true, false)), { name: "", avatarUrl: null });
  eq(toClientSiteBrand(true, null), { name: "", avatarUrl: null });
});

test("error global: título neutro en la web personal y el de siempre en la plataforma", () => {
  eq(globalErrorTitle(false), "Cirella no está disponible en este momento");
  ok(!globalErrorTitle(true).includes("Cirella"));
  eq(isPersonalModeInBrowser("personal"), true);
  eq(isPersonalModeInBrowser(" personal "), true);
  eq(isPersonalModeInBrowser(undefined), false);
  eq(isPersonalModeInBrowser("platform"), false);
});

test("app/global-error.tsx usa el título según el modo y quita el símbolo en la web personal", () => {
  const src = read("app/global-error.tsx");
  ok(src.includes("title={globalErrorTitle(personal)}"));
  ok(src.includes("mark={personal ? null : undefined}"));
  ok(!src.includes('title="Cirella no está disponible'), "el título sigue fijo");
});

test("ErrorView pinta la marca del sitio (no el logo fijo de la plataforma)", () => {
  const src = read("components/error-view.tsx");
  ok(!src.includes("<LogoMark"), "sigue pintando el logo de la plataforma siempre");
  ok(src.includes('mark === undefined ? <SiteMark className="h-10 w-10" dark={dark} /> : mark'));
  const ctx = read("components/site-brand-context.tsx");
  ok(ctx.includes("if (!brand) return <LogoMark className={className} />;"), "en la plataforma, el logo de siempre");
  ok(ctx.includes("if (!brand.name) return null;"));
});

test("el layout raíz solo inyecta la marca y el favicon de la dueña en modo personal", () => {
  const src = read("app/layout.tsx");
  ok(src.includes("{personal ? <SiteBrandProvider value={brand}>{children}</SiteBrandProvider> : children}"));
  ok(src.includes("icons: { icon: [{ url: `/${owner}/icon`, type: \"image/png\", sizes: \"64x64\" }] }"));
  // El favicon va en la rama personal de generateMetadata, después del return de la plataforma.
  ok(src.indexOf("icons:") > src.indexOf("if (!isPersonalMode())"));
  ok(src.indexOf("icons:") > src.indexOf('siteName: "Cirella"'));
});

test("automatizaciones: el aviso de email no entregado no menciona Cirella en modo personal", () => {
  const src = read("app/panel/automatizaciones/page.tsx");
  const personal = /const FAILED_NOTE_PERSONAL = "([^"]+)";/.exec(src)?.[1] ?? "";
  ok(personal && !personal.includes("Cirella"), "falta el aviso de la web personal");
  ok(src.includes("const failedNote = isPersonalMode() ? FAILED_NOTE_PERSONAL : FAILED_NOTE;"));
  ok(!src.includes("{FAILED_NOTE}"), "se sigue pintando el aviso fijo");
});

test("404 de /<usuaria> sin marca: en la web personal, la marca de la dueña y no el logo de la plataforma", () => {
  const src = read("app/[username]/not-found.tsx");
  ok(src.includes('{personal ? <SiteMark className="h-10 w-10" dark /> : <LogoMark className="mx-auto h-10 w-10" />}'));
});
