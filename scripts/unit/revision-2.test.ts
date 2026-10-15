/**
 * Revisión 2 · ningún nombre de usuario puede tapar una ruta de primer nivel.
 *
 * Recorre app/ (y sus grupos «(…)») y comprueba que cada segmento estático o archivo servido en la raíz
 * (icon.svg, robots.txt, sitemap.xml…) está en RESERVED_USERNAMES. Así, una ruta nueva que se olvide de
 * reservarse rompe esta prueba en vez de dejar a una creadora con una página pública inalcanzable.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { RESERVED_USERNAMES, validateUsername } from "../../lib/slug";
import { eq, ok, test } from "./harness";

const APP = path.join(__dirname, "..", "..", "app");

// Archivos de metadatos en código que Next sirve como ruta (con otro nombre).
const SERVED_AS: Record<string, string> = {
  "robots.ts": "robots.txt", "sitemap.ts": "sitemap.xml", "manifest.ts": "manifest.webmanifest",
  "icon.tsx": "icon", "apple-icon.tsx": "apple-icon", "opengraph-image.tsx": "opengraph-image", "twitter-image.tsx": "twitter-image",
};
// El resto del código (.ts/.tsx/.css: layout, page, error, acciones…) no añade un segmento; los demás
// archivos (icon.svg, favicon.ico…) se sirven en la raíz con su nombre.
const isCode = (name: string) => /\.(tsx?|css)$/.test(name);

function topLevelNames(dir: string): string[] {
  const names: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    if (entry.isDirectory()) {
      if (/^\(.+\)$/.test(name)) names.push(...topLevelNames(path.join(dir, name))); // grupo: no añade segmento
      else if (!name.startsWith("[") && !name.startsWith("_")) names.push(name); // [username] es la página de la creadora
    } else if (SERVED_AS[name]) {
      names.push(SERVED_AS[name]);
    } else if (!isCode(name)) {
      names.push(name);
    }
  }
  return names;
}

const routes = topLevelNames(APP);

test("se encuentran las rutas de primer nivel (incluidas las de los grupos)", () => {
  for (const r of ["panel", "contrasena", "pago-simulado", "aviso-legal", "icon.svg", "robots.txt"]) ok(routes.includes(r), `falta ${r}`);
});

for (const r of routes) test(`«${r}» está reservado como nombre de usuario`, () => ok(RESERVED_USERNAMES.has(r), `«${r}» no está en RESERVED_USERNAMES`));

for (const name of ["contrasena", "pago-simulado", "icon.svg"])
  test(`validateUsername("${name}") lo rechaza`, () => eq(validateUsername(name), "Este nombre está reservado"));
