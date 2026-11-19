"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PagePieces, PieceKind } from "@/lib/pieces";
import type { Design } from "@/lib/templates";

/** La página se abre con esto en su dirección dentro de la vista en vivo de Diseño. */
export const LIVE_DESIGN_PARAM = "diseno-vivo";

/**
 * Lo que manda el editor (app/panel/pagina/live-frame.tsx): el diseño de esa página y sus piezas sueltas, aún sin
 * guardar; si se pueden tocar las piezas (picking) y la que se está cambiando (selected).
 */
export type LiveDesignMessage = { type: "cirella:design"; design: Design; allowCustom: boolean; pieces?: PagePieces; picking?: boolean; selected?: string | null };
/** Lo que manda la página al tocar una tarjeta, un panel o un botón: su dirección (lib/pieces.ts), qué es y su texto. */
export type LivePick = { id: string; kind: PieceKind; label: string; /** Una foto suelta (sin caja alrededor): no lleva adornos. */ img?: boolean };
export type LivePickMessage = LivePick & { type: "cirella:pick" };

// Solo se descarga dentro de la vista en vivo: quien visita la web no lo carga.
const Apply = dynamic(() => import("./live-design-apply"), { ssr: false });

/**
 * La vista en vivo de Mi página › Diseño: la página de verdad dentro de un marco del editor, con el diseño que
 * se está cambiando (sin guardar) puesto encima al momento (live-design-apply.tsx). Solo hace algo dentro de ese
 * marco (con ?diseno-vivo en la dirección); para quien visita la web, nada.
 */
export function LiveDesign() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // Se mira al abrir la página (la dirección no cambia mientras se mira).
    setOn(window.parent !== window && new URLSearchParams(window.location.search).has(LIVE_DESIGN_PARAM));
  }, []);
  return on ? <Apply /> : null;
}
