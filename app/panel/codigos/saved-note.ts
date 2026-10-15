import type { CodeState } from "@/lib/discount-codes";

/** Lo que se dice al guardar un código: si se ve o no en la página depende de su estado real. */
export const SAVED_NOTE: Record<CodeState, string> = {
  ACTIVE: "Ya se ve en tu página.",
  INACTIVE: "Está oculto: no se ve en tu página.",
  EXPIRED: "Ha caducado: no se ve en tu página.",
};

/** Valor de ?guardado= tras crear un código (el estado en minúsculas). */
export function savedParam(state: CodeState): string {
  return state.toLowerCase();
}

/** Aviso de la lista tras crear un código, según ?guardado=. Valores desconocidos (o el «1» de antes): visible. */
export function createdFlash(param: string | undefined): string {
  const state: CodeState = param === "expired" ? "EXPIRED" : param === "inactive" ? "INACTIVE" : "ACTIVE";
  return `Código añadido. ${SAVED_NOTE[state]}`;
}

/** Aviso al guardar cambios de un código que ya existía. */
export function savedFlash(state: CodeState): string {
  return `Guardado. ${SAVED_NOTE[state]}`;
}
