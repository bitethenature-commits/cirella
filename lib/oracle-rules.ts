/**
 * Barajas de oráculo propias (Panel → Barajas): límites y esquemas de los formularios. Puro: lo usan
 * el panel (navegador) y las acciones del servidor. Lo que toca la BD está en lib/oracle-decks.ts.
 */
import { z } from "zod";

export const DECK_NAME_MAX = 80;
export const DECK_DESCRIPTION_MAX = 400;
export const DECKS_MAX = 30;
export const DECK_CARDS_MAX = 120;
/** Para publicarla: con menos no hay tirada de tres. */
export const DECK_CARDS_MIN = 3;
export const CARD_NAME_MAX = 80;
export const CARD_KEYWORD_MAX = 40;
export const CARD_MESSAGE_MAX = 2000;
export const CARD_QUESTION_MAX = 240;

export type OracleDeckStatus = "DRAFT" | "PUBLISHED";
export const asDeckStatus = (s: string): OracleDeckStatus => (s === "PUBLISHED" ? "PUBLISHED" : "DRAFT");

const id = z.string().trim().regex(/^[a-z0-9]{8,40}$/).optional().or(z.literal("").transform(() => undefined));
const url = z.string().trim().max(300).optional().default("");

export const deckFormSchema = z.object({
  id,
  name: z.string().trim().min(1, "Ponle un nombre a la baraja").max(DECK_NAME_MAX, `El nombre: máximo ${DECK_NAME_MAX} caracteres`),
  description: z.string().trim().max(DECK_DESCRIPTION_MAX, `La descripción: máximo ${DECK_DESCRIPTION_MAX} caracteres`).default(""),
  backImageUrl: url,
  backFrame: z.string().trim().max(40).default(""),
});

export const cardFormSchema = z.object({
  id,
  deckId: z.string().trim().regex(/^[a-z0-9]{8,40}$/, "Esta baraja ya no existe"),
  name: z.string().trim().min(1, "Ponle un nombre a la carta").max(CARD_NAME_MAX, `El nombre: máximo ${CARD_NAME_MAX} caracteres`),
  keyword: z.string().trim().max(CARD_KEYWORD_MAX, `La palabra clave: máximo ${CARD_KEYWORD_MAX} caracteres`).default(""),
  message: z.string().max(CARD_MESSAGE_MAX, `El mensaje: máximo ${CARD_MESSAGE_MAX} caracteres`).default(""),
  question: z.string().trim().max(CARD_QUESTION_MAX, `La pregunta: máximo ${CARD_QUESTION_MAX} caracteres`).default(""),
  imageUrl: url,
  imageFrame: z.string().trim().max(40).default(""),
  backImageUrl: url,
  backFrame: z.string().trim().max(40).default(""),
  motif: z.string().trim().max(40).default(""),
  reversible: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  reversedMessage: z.string().max(CARD_MESSAGE_MAX, `El mensaje invertida: máximo ${CARD_MESSAGE_MAX} caracteres`).default(""),
});
