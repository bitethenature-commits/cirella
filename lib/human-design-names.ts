/**
 * Nombres y símbolos de la carta de Diseño Humano calculada (lib/human-design-calc.ts), sin dependencias:
 * los modelos los usan al dibujar sin cargar las efemérides hasta que hay un perfil que calcular.
 */

export const HD_BODIES = ["sun", "earth", "northNode", "southNode", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
export type HdBody = (typeof HD_BODIES)[number];

export const HD_BODY_ES: Record<HdBody, string> = {
  sun: "Sol",
  earth: "Tierra",
  northNode: "Nodo Norte",
  southNode: "Nodo Sur",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Neptuno",
  pluto: "Plutón",
};

export const HD_BODY_GLYPH: Record<HdBody, string> = {
  sun: "☉",
  earth: "⊕",
  northNode: "☊",
  southNode: "☋",
  moon: "☽",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
};

export type DefinitionKind = "none" | "single" | "split" | "triple" | "quadruple";
export const DEFINITION_ES: Record<DefinitionKind, string> = {
  none: "Sin definición",
  single: "Definición simple",
  split: "Definición partida",
  triple: "Triple partida",
  quadruple: "Cuádruple partida",
};

export type CrossAngle = "right" | "juxtaposition" | "left";
export const CROSS_ANGLE_ES: Record<CrossAngle, string> = {
  right: "Cruz de Ángulo Derecho",
  juxtaposition: "Cruz de Yuxtaposición",
  left: "Cruz de Ángulo Izquierdo",
};

