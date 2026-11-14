import "server-only";
import { cache } from "react";
import type { OracleCard, OracleDeck } from "@prisma/client";
import { oracleMotifFor, type OracleDeckView, type OracleDecks } from "@/components/models/data/oracle";
import type { ContentBlock } from "./page-blocks";
import { slugify, randomCode } from "./slug";
import { tenantDb, type TenantDb } from "./tenant";

/**
 * Barajas de oráculo propias (Panel → Barajas; modelos OracleDeck y OracleCard). Todo pasa por
 * tenantDb(creatorId): una baraja o una carta de otra creadora no se encuentra nunca, aunque su id
 * llegue en un bloque o en un formulario. Fuera del panel solo se leen las publicadas.
 */

const CARD_ORDER = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];
const DECK_ORDER = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

/** Una baraja de la BD tal como la pinta el modelo (components/models/oracle-model.tsx). */
export function toOracleDeckView(deck: OracleDeck & { cards: OracleCard[] }): OracleDeckView {
  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    backImageUrl: deck.backImageUrl,
    backFrame: deck.backFrame,
    cards: deck.cards.map((c, i) => ({
      id: c.id,
      name: c.name,
      keyword: c.keyword,
      message: c.message,
      messageFormat: "MD",
      question: c.question,
      imageUrl: c.imageUrl,
      imageFrame: c.imageFrame,
      backImageUrl: c.backImageUrl,
      backFrame: c.backFrame,
      motif: oracleMotifFor(c.motif, i),
      reversible: c.reversible,
      reversedMessage: c.reversible ? c.reversedMessage : null,
    })),
  };
}

/**
 * Las barajas publicadas de una creadora, con sus cartas y en su orden (las que no tienen cartas, no).
 * Para el selector del bloque «Oráculo», su vista previa y, más adelante, «Mi energía» del área de
 * alumnas. Una consulta por petición.
 */
export const getPublishedOracleDecks = cache(async (creatorId: string): Promise<OracleDeckView[]> => {
  const decks = await tenantDb(creatorId).oracleDeck.findMany({
    where: { status: "PUBLISHED" },
    orderBy: DECK_ORDER,
    include: { cards: { orderBy: CARD_ORDER } },
  });
  return decks.filter((d) => d.cards.length > 0).map(toOracleDeckView);
});

/** Ids de las barajas propias que usan unos bloques (los del oráculo que eligieron una). */
export function oracleDeckIds(blocks: readonly ContentBlock[]): string[] {
  return [...new Set(blocks.flatMap((b) => (b.kind === "model" && b.model === "oracle" && b.deck ? [b.deck] : [])))];
}

/**
 * Las barajas publicadas que necesitan unos bloques, por id, para pasárselas a la página
 * (ContentBlocks → InteractiveModel). Sin bloques de oráculo con baraja propia, ni una consulta. Lo
 * que no aparece (borrada, en borrador, de otra creadora) se pinta con la de serie.
 */
export async function oracleDecksForBlocks(creatorId: string, blocks: readonly ContentBlock[]): Promise<OracleDecks> {
  const ids = oracleDeckIds(blocks);
  if (!ids.length) return {};
  const decks = await tenantDb(creatorId).oracleDeck.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    include: { cards: { orderBy: CARD_ORDER } },
  });
  return Object.fromEntries(decks.filter((d) => d.cards.length > 0).map((d) => [d.id, toOracleDeckView(d)]));
}

/** Dirección libre entre sus barajas (oraculo-de-la-luna, oraculo-de-la-luna-2…). */
export async function uniqueDeckSlug(db: TenantDb, name: string, exceptId?: string): Promise<string> {
  const base = slugify(name).slice(0, 56) || "baraja";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.oracleDeck.findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base.slice(0, 52)}-${i}`;
  }
  return `${base.slice(0, 48)}-${randomCode(4).toLowerCase()}`;
}
