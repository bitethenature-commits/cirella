import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ok, test } from "./harness";

const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// La portada de la web personal apunta og:image a /<dueña>/opengraph-image: la tarjeta que se ve al
// compartir el enlace de la bio no puede llevar la marca de la plataforma ni la ruta interna.
test("la imagen para redes de la dueña (modo personal) enseña su dominio, no «Cirella · /usuaria»", () => {
  const src = read("app/[username]/opengraph-image.tsx");
  ok(src.includes("{data?.personal ? appHost() : `${data?.platformName ?? \"Cirella\"} · /${username}`}"), "el pie no distingue la web personal");
  ok(src.includes('import { appHost } from "@/lib/env";'));
});

test("en modo personal la imagen para redes de otra usuaria es un 404 (sin tarjeta genérica de la plataforma)", () => {
  const src = read("app/[username]/opengraph-image.tsx");
  ok(src.includes("if (!data && isPersonalMode()) notFound();"), "falta el 404 en modo personal");
  ok(src.indexOf("notFound();") < src.indexOf("new ImageResponse"), "el 404 debe ir antes de pintar la imagen");
  ok(src.includes('import { isPersonalMode } from "@/lib/site-mode";'));
  ok(src.includes('import { notFound } from "next/navigation";'));
});

test("la portada personal apunta og:image y twitter:image a la imagen generada de la dueña", () => {
  const src = read("app/[username]/public-page.tsx");
  ok(src.includes("url: `/${creator.username}/opengraph-image`"));
  ok(src.includes("images: [image]") && src.includes("images: [image.url]"));
});

// Satori (next/og) rechaza un color suelto como capa de `background` («Invalid background image»):
// la imagen de redes daba error 500 y no se veía al compartir el enlace.
test("la imagen para redes separa el color de fondo de los degradados (Satori no acepta el atajo)", () => {
  const src = read("app/[username]/opengraph-image.tsx");
  ok(!/\bbackground:\s*`/.test(src), "un `background` con degradados y color juntos rompe Satori");
  ok(src.includes("backgroundColor: c.bg,"));
  ok(/backgroundImage: `radial-gradient\(/.test(src));
});
