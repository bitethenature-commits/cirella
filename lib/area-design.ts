/**
 * Los colores de lo de dentro para todas las alumnas (Creator.areaDesign), que la creadora pone en Mi página:
 *   · area: su área de alumna (en la web personal). La alumna que elige los suyos en «Colores de mi área» ve los suyos.
 *   · courses: la base de todos los cursos. El curso que tiene su propio diseño (su editor) usa el suyo.
 *   · memberships: la base de todas las membresías por dentro; tiers, la propia de un nivel (por su id), encima.
 *   · texts, pieces, kinds y order: los textos, el diseño de cada pieza, los colores de cada tipo de publicación y el
 *     orden de las partes (lib/area-pieces.ts), para todo lo de dentro.
 * Cada uno con lo mismo que «Colores de mi área» (lib/account-look.ts); sin nada elegido, la noche dorada de siempre.
 * Puro: lo usan el servidor (el área, los cursos, las membresías) y el editor.
 */
import { EMPTY_ACCOUNT_LOOK, hasAccountLook, readAccountLook, type AccountLook } from "./account-look";
import { hasLookColors, lookAsAccount, type CourseLook } from "./course-design";
import { EMPTY_AREA_PARTS, readAreaParts, type AreaParts } from "./area-pieces";

export type AreaDesign = AreaParts & {
  area: AccountLook;
  courses: AccountLook;
  memberships: AccountLook;
  tiers: Record<string, AccountLook>;
};

export const EMPTY_AREA_DESIGN: AreaDesign = { area: { ...EMPTY_ACCOUNT_LOOK }, courses: { ...EMPTY_ACCOUNT_LOOK }, memberships: { ...EMPTY_ACCOUNT_LOOK }, tiers: {}, ...EMPTY_AREA_PARTS };

/** Lo guardado, tolerante: lo que no se entiende vuelve a lo de siempre. Los niveles sin nada elegido no se guardan. */
export function readAreaDesign(raw: unknown): AreaDesign {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const tiers: Record<string, AccountLook> = {};
  const rawTiers = src.tiers && typeof src.tiers === "object" && !Array.isArray(src.tiers) ? (src.tiers as Record<string, unknown>) : {};
  for (const [id, v] of Object.entries(rawTiers)) {
    const look = readAccountLook(v);
    if (typeof id === "string" && id.length <= 40 && hasAccountLook(look)) tiers[id] = look;
  }
  return { area: readAccountLook(src.area), courses: readAccountLook(src.courses), memberships: readAccountLook(src.memberships), tiers, ...readAreaParts(src) };
}

/** Los colores de un curso para sus alumnas: los de su propio diseño o, si no tiene, la base de los cursos; null = los de cada alumna. */
export function courseColors(own: CourseLook, design: AreaDesign): AccountLook | null {
  if (hasLookColors(own)) return lookAsAccount(own);
  return hasAccountLook(design.courses) ? design.courses : null;
}

/** Los colores de una membresía por dentro: los de su nivel o, si no tiene, la base de las membresías; null = los de cada alumna. */
export function membershipColors(productId: string, design: AreaDesign): AccountLook | null {
  const own = design.tiers[productId];
  if (hasAccountLook(own)) return own;
  return hasAccountLook(design.memberships) ? design.memberships : null;
}
