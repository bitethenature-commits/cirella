import { formatPrice } from "@/lib/money";
import type { PublicProduct } from "./creator-page-view";
import { PercentIcon, type HomeRowData } from "./home-rows";

/**
 * Una oferta como fila (portada y página «Ofertas»): su foto con el «−30 %», la etiqueta y hasta cuándo, el
 * título y, a la derecha, el precio de antes tachado y el de ahora en oro. Solo salen las ofertas activas
 * (PublicProduct.sale ya es null cuando termina), así que al acabar una oferta desaparece sola.
 */
export function offerRow(p: PublicProduct, username: string): HomeRowData {
  const sale = p.sale!;
  return {
    key: p.id,
    href: `/${username}/${p.slug}`,
    image: p.imageUrl,
    icon: <PercentIcon className="h-8 w-8 opacity-80" />,
    badge: sale.percentOff ? <span className="cp-offer-badge absolute bottom-1.5 left-1.5 rounded-full px-1.5 py-0.5 text-[0.66rem] font-bold">−{sale.percentOff} %</span> : null,
    eyebrow: <span>{[sale.label, sale.endsLabel].filter(Boolean).join(" · ") || "Oferta"}</span>,
    title: p.title,
    text: p.billingInterval ? "El precio de oferta es el del primer pago; después, el normal." : p.summary,
    aside: (
      <span className="flex shrink-0 flex-col items-end text-right leading-tight">
        <s className="cp-faint text-[0.8rem]">{formatPrice(sale.regularCents, p.currency, p.billingInterval)}</s>
        <strong className="cp-gold cp-display text-[1.45rem]">{formatPrice(sale.priceCents, p.currency, p.billingInterval)}</strong>
      </span>
    ),
  };
}
