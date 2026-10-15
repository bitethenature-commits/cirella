/**
 * Revisión del modo personal (7): al editar una publicación con una dirección que ya usa otra,
 * se avisa de la dirección guardada de verdad. Funciones puras.
 */
import { slugTakenNotice } from "../../app/panel/publicaciones/slug-notice";
import { eq, test } from "./harness";

test("slugTakenNotice: avisa si la dirección escrita se guardó con otro nombre", () => {
  eq(slugTakenNotice("luna-llena", "luna-llena-2"), "Esa dirección ya la usa otra publicación; se ha guardado como «luna-llena-2».");
  // Se compara ya normalizada: mayúsculas y espacios no cuentan como cambio.
  eq(slugTakenNotice("Luna Llena", "luna-llena-2"), "Esa dirección ya la usa otra publicación; se ha guardado como «luna-llena-2».");
});

test("slugTakenNotice: sin aviso si se guardó tal cual o no escribió dirección", () => {
  eq(slugTakenNotice("Luna Llena", "luna-llena"), null);
  eq(slugTakenNotice("luna-llena", "luna-llena"), null);
  eq(slugTakenNotice("", "luna-llena-2"), null);
  eq(slugTakenNotice(undefined, "luna-llena-2"), null);
  eq(slugTakenNotice("---", "titulo"), null);
});
