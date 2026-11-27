import { productPath } from "@/lib/public-paths";
import Link from "next/link";
import { courseCategoriesLabel, courseCategoriesOf } from "@/lib/course-categories";
import { formatPrice } from "@/lib/money";
import { CategoryIcons } from "./category-icons";
import type { PublicProduct } from "./creator-page-view";
import { ProductImage } from "./product-art";
import { Tr } from "@/lib/i18n/client";

/**
 * Curso en pequeño (sección «Cursos» de la portada): la imagen, el título y el precio; toda la tarjeta lleva a su
 * ficha. En el panel (los borradores de Cursos), `href` lleva a su estudio.
 * En su propio archivo para que la lista de Cursos del panel no cargue toda la portada.
 */
export function CourseMiniCard({ p, username, href }: { p: PublicProduct; username: string; href?: string }) {
  const mode = p.accessMode ?? "PAID";
  const topics = courseCategoriesOf(p.courseCategory);
  const external = mode === "EXTERNAL" && !!p.externalUrl;
  const price = mode === "FREE_EMAIL" ? "Gratis" : external && p.priceCents <= 0 ? null : formatPrice(p.sale ? p.sale.priceCents : p.priceCents, p.currency, p.billingInterval);
  return (
    <Link href={href ?? `${productPath(username, p)}`} className="cp-card cp-card-hover group flex h-full flex-col overflow-hidden" data-course-mini={p.slug}>
      <span className="cp-photo-bubble cp-photo-in relative block aspect-[4/3]">
        <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} sizes="(min-width: 640px) 220px, 46vw" />
        {/* El icono (o los iconos) del tema del curso, en dorado, como en las tarjetas grandes. */}
        {topics.length > 0 && (
          <span
            className="absolute left-2 top-2 inline-flex items-center rounded-full px-2 py-1"
            style={{ background: "color-mix(in oklab, var(--c-bg) 72%, transparent)", backdropFilter: "blur(10px)" }}
            title={courseCategoriesLabel(topics)}
          >
            <CategoryIcons categories={topics} size={1.45} className="cp-gold" gap={0.15} />
          </span>
        )}
        {p.sale && (
          <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold" style={{ background: "var(--c-gold)", color: "var(--c-bg)" }}>
            −{p.sale.percentOff} %
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="cp-display line-clamp-2 text-[1.05rem] leading-tight">{p.title}</span>
        <span className="mt-auto pt-1 text-[0.85rem] font-semibold">
          {p.sale && <s className="cp-muted mr-1 font-normal">{formatPrice(p.sale.regularCents, p.currency)}</s>}
          {price}
          {external && p.externalHost && <span className="cp-faint block text-[0.68rem] font-normal"><Tr s={"Pago en"} />{" "}<Tr s={p.externalHost} /></span>}
        </span>
      </span>
    </Link>
  );
}
