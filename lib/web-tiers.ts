import type { TierEmblem } from "./tier-card";
import type { TierLook } from "./tier-look";
import type { TierFeature } from "./tier-features";

/**
 * Un nivel de la comunidad tal como sale en la web (la sección «Niveles de la comunidad», lib/page-blocks.ts) y en
 * Mi página, donde se escribe encima: lo saca lib/web-tiers.server.ts de lo que tiene publicado. Puro. (Los niveles
 * para el panel y el área de alumno, con quién incluye a quién, son otros: lib/community-tiers.ts.)
 */
export type WebTier = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  /** El precio con su moneda («33 €»), lo que se escribe para cambiarlo («33») y la moneda. */
  price: string;
  priceInput: string;
  currency: string;
  interval: "mes" | "año" | null;
  /** Con oferta: el precio normal tachado y su línea («Lunas nuevas · hasta el 5 · el primer pago»). */
  regular: string | null;
  saleLine: string | null;
  intro: string;
  features: TierFeature[];
  cta: string;
  /** La frase del área de alumno: se guarda con la carta tal cual (aquí no se cambia). */
  area: string;
  /** De pago en la web: «Escríbeme para unirte» con el sobre; si no, «Unirme a…». */
  paid: boolean;
  href: string;
  /** El nivel anterior que incluye entero («Todo lo de Esencia»). */
  includesPrevious: string | null;
  /** El más completo (lleva la etiqueta «La más elegida»). */
  highlight: boolean;
  level: number;
  emblem: TierEmblem;
  /** El diseño propio de su tarjeta (sin él, su foto o la noche y el oro): lib/tier-look.ts. */
  look?: TierLook;
};

/**
 * Los niveles, de menos a más, y los próximos círculos (salen en el más completo). `note`: con círculos, la línea de
 * debajo («¿Solo quieres venir a un círculo? Apúntate a un día suelto…»), con su enlace a las lecturas.
 */
export type WebTiers = { creatorId: string; tiers: WebTier[]; circles: string[]; note: { text: string; link: string; href: string } | null; /** Sin niveles: «Pronto abriré la comunidad.» */ empty: string };
