/**
 * Revisión 3 · tipos de archivo de producto que los navegadores nombran de otra forma.
 * Chrome y Edge en Windows llaman «application/x-zip-compressed» al ZIP; un EPUB sin lector
 * instalado llega sin tipo. Antes se rechazaban con «Formato no admitido (… ZIP)».
 */
import { PRIVATE_TYPES, privateFileType } from "../../lib/storage";
import { eq, ok, test } from "./harness";

test("privateFileType: los tipos admitidos se quedan igual", () => {
  for (const ct of Object.keys(PRIVATE_TYPES)) eq(privateFileType(ct, "x.bin"), ct, ct);
});
for (const [ct, want] of [
  ["application/x-zip-compressed", "application/zip"],
  ["application/x-zip", "application/zip"],
  ["audio/wave", "audio/wav"],
  ["audio/vnd.wave", "audio/wav"],
  ["audio/mp3", "audio/mpeg"],
  ["audio/x-mpeg", "audio/mpeg"],
] as const)
  test(`privateFileType: ${ct} → ${want}`, () => eq(privateFileType(ct, "pack.zip"), want));

test("privateFileType: sin tipo, lo deduce de la extensión", () => {
  eq(privateFileType("", "libro.epub"), "application/epub+zip");
  eq(privateFileType("", "Pack.ZIP"), "application/zip");
  eq(privateFileType("application/octet-stream", "pista.wav"), "audio/wav");
});
test("privateFileType: mayúsculas y parámetros no importan", () => eq(privateFileType("Application/PDF; charset=binary", "a.pdf"), "application/pdf"));
test("privateFileType: sigue rechazando lo no admitido", () => {
  eq(privateFileType("", "programa.exe"), null);
  eq(privateFileType("application/octet-stream", "sin-extension"), null);
  eq(privateFileType("text/html", "pagina.zip"), null, "un tipo conocido y no admitido no se cambia por la extensión");
  eq(privateFileType("application/x-msdownload", "x.exe"), null);
});
test("privateFileType: siempre devuelve una clave de PRIVATE_TYPES", () => {
  for (const ct of ["application/x-zip-compressed", "audio/wave", ""]) {
    const got = privateFileType(ct, "a.epub");
    ok(got && PRIVATE_TYPES[got], `${ct} → ${got}`);
  }
});
