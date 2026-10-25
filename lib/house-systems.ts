/** Sistemas de casas de la carta natal (sin dependencias: lo usa también la tarjeta del panel). */
export const HOUSE_SYSTEMS = ["placidus", "whole", "equal"] as const;
export type HouseSystem = (typeof HOUSE_SYSTEMS)[number];
export const HOUSE_SYSTEM_LABEL: Record<HouseSystem | "porphyry", string> = {
  placidus: "Plácidus",
  whole: "Signos enteros",
  equal: "Casas iguales",
  porphyry: "Porfirio",
};
