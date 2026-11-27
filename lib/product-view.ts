/**
 * Lo que se pinta de un producto en la web (su tarjeta y su ficha), a partir de datos planos. Puro y
 * sin BD: lo usan la página pública (lib/public.ts, app/[username]/[slug]/page.tsx) y la vista previa
 * en vivo del panel (app/panel/productos/[id]/product-preview.tsx), que lo alimenta con lo que se está
 * escribiendo en el formulario. Así las dos enseñan exactamente lo mismo.
 */
import type { PublicProduct } from "@/components/creator-page/creator-page-view";
import { asAccessMode, externalHost } from "./access-mode";
import { channelKindLabel } from "./channel-kind";
import { saleEndsLabel, saleState } from "./offers";
import { eventLabel } from "./portal-rules";
import { readCardCta } from "./product-texts";
import { dateLang, formatInTz, shortDayLabel } from "./tz";
import { lessonsLabel } from "./types";

/** Los campos de un producto que deciden cómo se ve (las columnas de Product con el mismo nombre). */
export type ProductViewSource = {
  /** Textos propios de su ficha y su carta (lib/product-texts.ts). */
  pageTexts?: unknown;
  id: string;
  type: string;
  slug: string;
  title: string;
  emoji: string | null;
  summary: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  billingInterval: string | null;
  ctaLabel: string | null;
  featured: boolean;
  deliveryMode: string;
  accessMode: string;
  externalUrl: string | null;
  externalLabel: string | null;
  durationMin: number | null;
  groupSession: boolean;
  eventStartAt: Date | null;
  salePriceCents: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  saleLabel: string | null;
  courseCategory: string | null;
  moonCircle: boolean;
  intake?: unknown;
};

/** «Taller · jue 5 nov · 20:00», «75 min», «7 lecciones»… (lo pequeño junto al tipo en la tarjeta). */
export function productCardMeta(p: Pick<ProductViewSource, "type" | "groupSession" | "eventStartAt" | "durationMin">, lessons: number, timeZone: string): string | null {
  if (p.type === "SESSION" && p.groupSession && p.eventStartAt)
    return `${dateLang() === "es" ? "Taller" : "Workshop"} · ${shortDayLabel(p.eventStartAt, timeZone)} · ${formatInTz(p.eventStartAt, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  if (p.type === "SESSION" && p.durationMin) return `${p.durationMin} min`;
  if (p.type === "COURSE" && lessons) return lessonsLabel(lessons);
  return null;
}

/**
 * La tarjeta de un producto en la página de la creadora. `updatedAt`: desde cuándo cuenta una oferta sin
 * fecha de inicio.
 */
export function toPublicProduct(
  p: ProductViewSource,
  ctx: { lessons: number; timeZone: string; now?: Date; updatedAt?: Date },
): PublicProduct {
  const now = ctx.now ?? new Date();
  const accessMode = asAccessMode(p.accessMode);
  // Oferta: solo en lo que se paga en la web (lo gratuito y lo de fuera no se cobra aquí).
  const sale = accessMode === "PAID" ? saleState(p, now) : null;
  return {
    id: p.id,
    type: p.type,
    slug: p.slug,
    title: p.title,
    emoji: p.emoji,
    summary: p.summary,
    imageUrl: p.imageUrl,
    priceCents: p.priceCents,
    currency: p.currency,
    billingInterval: p.billingInterval,
    ctaLabel: p.ctaLabel,
    featured: p.featured,
    meta: productCardMeta(p, ctx.lessons, ctx.timeZone),
    accessMode,
    externalUrl: accessMode === "EXTERNAL" ? p.externalUrl : null,
    externalLabel: accessMode === "EXTERNAL" ? p.externalLabel : null,
    externalHost: accessMode === "EXTERNAL" ? externalHost(p.externalUrl) : null,
    sale: sale?.active
      ? {
          priceCents: sale.priceCents,
          regularCents: sale.regularCents,
          percentOff: sale.percentOff ?? 0,
          label: sale.label,
          endsLabel: saleEndsLabel(sale.endsAt, ctx.timeZone),
          // Para el aviso de novedades: desde su inicio o, sin fecha de inicio, desde el último cambio.
          startedAt: (p.saleStartsAt ?? ctx.updatedAt ?? now).toISOString(),
        }
      : null,
    courseCategory: p.courseCategory,
    groupSession: p.groupSession,
    moonCircle: p.groupSession && p.moonCircle,
    eventLabel: p.groupSession && p.eventStartAt ? eventLabel(p.eventStartAt, ctx.timeZone) : null,
    eventStartAt: p.groupSession && p.eventStartAt ? p.eventStartAt.toISOString() : null,
    kindLabel: channelKindLabel(p),
    cardCta: readCardCta(p.pageTexts),
  };
}
