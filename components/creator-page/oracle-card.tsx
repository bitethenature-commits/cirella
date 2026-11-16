import Link from "next/link";
import { Sparkles } from "lucide-react";
import { COURSE_CATEGORY_LABEL, productTopics, type CourseCategory } from "@/lib/course-categories";
import { formatPrice } from "@/lib/money";
import { CategoryIcons } from "./category-icons";
import type { PublicProduct } from "./creator-page-view";
import { ProductImage } from "./product-art";
import { FlowerOfLife, SacredButton } from "./sacred-button";

/** La palabra en vertical: el sistema (Astrología, Gene Keys…) o, sin tema, qué es. */
function kindWord(p: PublicProduct): string {
  if (p.type === "SESSION" && p.groupSession) return p.moonCircle ? "Círculo" : "Taller";
  const topics = productTopics(p).filter((c) => c !== "ESPECIAL");
  if (topics.length) return COURSE_CATEGORY_LABEL[topics[0]];
  return p.type === "DIGITAL" ? "Lectura" : p.type === "SESSION" ? "Sesión" : p.type === "COURSE" ? "Curso" : "Comunidad";
}

/**
 * El costado de la foto: con un sistema, la línea de puntos, su emblema y su nombre en vertical; con
 * varios, solo sus emblemas, separados por la línea de puntos (sin nombre).
 */
export function OracleSide({ topics, word }: { topics: CourseCategory[]; word: string }) {
  if (topics.length > 1)
    return (
      <div className="cp-oracle-side" aria-hidden data-many>
        <span className="cp-oracle-dots" />
        {topics.map((c) => (
          <span key={c} className="contents">
            <span className="cp-oracle-emblem">
              <CategoryIcons categories={[c]} size={topics.length > 3 ? 1.3 : 1.6} />
            </span>
            <span className="cp-oracle-dots" />
          </span>
        ))}
      </div>
    );
  return (
    <div className="cp-oracle-side" aria-hidden>
      <span className="cp-oracle-dots" />
      <span className="cp-oracle-emblem">{topics.length ? <CategoryIcons categories={[topics[0]]} size={1.85} /> : <Sparkles className="h-7 w-7" strokeWidth={1.1} />}</span>
      <span className="cp-oracle-dots" />
      <span className="cp-oracle-word">{word}</span>
    </div>
  );
}

/**
 * Tarjeta de un producto como una carta de oráculo (portada, /lecturas, /sesiones): la foto con marco
 * dorado y, a su derecha, el costado con el sistema (OracleSide); debajo, el título, el texto breve,
 * la raya con la estrella, el precio y el botón «Escríbeme». Toda la tarjeta lleva a
 * su ficha; el botón, por encima, al formulario de solicitud (o a la web de pago, o a la ficha si es
 * gratis).
 */
export function OracleCard({
  p,
  username,
  trackCreatorId,
  editHref,
}: {
  p: PublicProduct;
  username: string;
  trackCreatorId: string | null;
  /** En el panel: toda la carta (y su botón) lleva a su editor. */
  editHref?: string;
}) {
  const topics = productTopics(p).filter((c) => c !== "ESPECIAL");
  const mode = p.accessMode ?? "PAID";
  const free = mode === "FREE_EMAIL";
  const external = mode === "EXTERNAL" && !!p.externalUrl;
  const priceCents = p.sale ? p.sale.priceCents : p.priceCents;
  const productHref = editHref ?? `/${username}/${p.slug}`;
  const href = editHref ?? (free ? productHref : external ? p.externalUrl! : `${productHref}/solicitar`);
  const label = free ? "Lo quiero" : external ? "Ver dónde" : p.cardCta || "Escríbeme";
  const event = trackCreatorId ? { creatorId: trackCreatorId, type: "PRODUCT_CLICK" as const, productId: p.id } : null;
  return (
    <article className="cp-oracle-card" data-oracle-card={p.slug}>
      <FlowerOfLife className="cp-oracle-geo" strokeWidth={0.18} />
      <Link href={productHref} className="cp-oracle-link" aria-label={p.title} />
      <div className="cp-oracle-top">
        <div className="cp-oracle-photo">
          <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} sizes="(min-width: 640px) 300px, 75vw" />
        </div>
        <OracleSide topics={topics} word={kindWord(p)} />
      </div>
      <h3 className="cp-oracle-title">{p.title}</h3>
      {p.summary && <p className="cp-oracle-text">{p.summary}</p>}
      <div className="cp-oracle-rule" aria-hidden>
        <span>✦</span>
      </div>
      {(free || priceCents > 0) && (
        <p className="cp-oracle-price">
          {p.sale && <s className="cp-faint mr-2 text-[1.1rem]">{formatPrice(p.sale.regularCents, p.currency)}</s>}
          {free ? "Gratis" : formatPrice(priceCents, p.currency, p.billingInterval)}
          {p.meta && p.type === "SESSION" && p.groupSession && <span className="cp-oracle-meta">{p.meta}</span>}
        </p>
      )}
      <SacredButton href={href} label={label} ariaLabel={`${label}: ${p.title}`} event={event} />
    </article>
  );
}
