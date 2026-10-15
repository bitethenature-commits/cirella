/**
 * Revisión del modo personal (8): al guardar un código de descuento, el aviso dice si se ve de verdad
 * en la página (visible, oculto o ya caducado). Funciones puras.
 */
import { createdFlash, savedFlash, savedParam } from "../../app/panel/codigos/saved-note";
import { codeState } from "../../lib/discount-codes";
import { eq, test } from "./harness";

const now = new Date("2026-10-15T12:00:00Z");
const past = new Date("2026-10-13T00:00:00Z");
const future = new Date("2026-11-01T00:00:00Z");

test("crear un código caducado u oculto no dice «Ya se ve»", () => {
  const flash = (c: { active: boolean; expiresAt: Date | null }) => createdFlash(savedParam(codeState(c, now)));
  eq(flash({ active: true, expiresAt: past }), "Código añadido. Ha caducado: no se ve en tu página.");
  eq(flash({ active: false, expiresAt: null }), "Código añadido. Está oculto: no se ve en tu página.");
  eq(flash({ active: true, expiresAt: future }), "Código añadido. Ya se ve en tu página.");
  eq(flash({ active: true, expiresAt: null }), "Código añadido. Ya se ve en tu página.");
});

test("?guardado= usa el estado en minúsculas; el «1» de antes sigue siendo «visible»", () => {
  eq([savedParam("ACTIVE"), savedParam("INACTIVE"), savedParam("EXPIRED")], ["active", "inactive", "expired"]);
  eq(createdFlash("1"), "Código añadido. Ya se ve en tu página.");
  eq(createdFlash("cualquier-cosa"), "Código añadido. Ya se ve en tu página.");
});

test("editar un código activo con fecha pasada avisa de que ha caducado", () => {
  eq(savedFlash(codeState({ active: true, expiresAt: past }, now)), "Guardado. Ha caducado: no se ve en tu página.");
  // Caducado y además oculto: manda la caducidad, como en la insignia de la lista.
  eq(savedFlash(codeState({ active: false, expiresAt: past }, now)), "Guardado. Ha caducado: no se ve en tu página.");
  eq(savedFlash(codeState({ active: false, expiresAt: future }, now)), "Guardado. Está oculto: no se ve en tu página.");
  eq(savedFlash(codeState({ active: true, expiresAt: null }, now)), "Guardado. Ya se ve en tu página.");
});
