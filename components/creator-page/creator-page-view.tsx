import Link from "next/link";
import { ArrowRight, ArrowUpRight, ExternalLink, Mail, MessageCircle, Plus, Quote, UserRound } from "lucide-react";
import { externalButtonLabel, linksToProduct } from "@/lib/access-mode";
import { imageSrcSet } from "@/lib/media-url";
import { formatPrice } from "@/lib/money";
import {
  SOCIAL_KEYS,
  safeHref,
  sectionTitle,
  socialHref,
  visibleTextBlocks,
  type PageConfig,
  type SectionKey,
} from "@/lib/page-config";
import { postPath } from "@/lib/posts";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { DEFAULT_CTA, type ProductType } from "@/lib/types";
import { SocialIcon } from "../social-icons";
import { DiscountCodeCard } from "./discount-code-card";
import { LegalLinks } from "./legal-links";
import { Avatar, ProductImage } from "./product-art";
import { RichText } from "./rich-text";
import { TrackedAnchor, TrackedLink } from "./tracking";

export type PublicProduct = {
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
  meta?: string | null; // "75 min", "7 lecciones"…
  /** El precio lleva IVA (lib/tax). Las vistas previas del editor no lo pasan. */
  vatIncluded?: boolean;
  /** Cómo se consigue (lib/access-mode.ts). Sin valor: pago en la web (PAID). */
  accessMode?: string;
  /** Pago fuera (EXTERNAL): la web externa, el texto del botón y su dominio («hotmart.com»). */
  externalUrl?: string | null;
  externalLabel?: string | null;
  externalHost?: string | null;
};

/** Publicación de la sección «Novedades» (lib/public.ts). */
export type PublicPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: Date;
  /** «12 de octubre de 2026», ya en la zona horaria de la creadora. */
  dateLabel: string;
};

/** Código de descuento de otra marca (lib/public.ts): solo los activos y sin caducar. */
export type PublicDiscountCode = {
  id: string;
  brand: string;
  code: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  /** «Válido hasta el 31 de diciembre» o null si no caduca. */
  expiresLabel: string | null;
};

const TYPE_EYEBROW: Record<ProductType, string> = {
  DIGITAL: "Digital",
  SESSION: "Sesión",
  COURSE: "Curso",
  MEMBERSHIP: "Membresía",
};

const SECTION_TYPE: Partial<Record<SectionKey, ProductType>> = {
  products: "DIGITAL",
  sessions: "SESSION",
  courses: "COURSE",
  memberships: "MEMBERSHIP",
};

type Props = {
  creatorId: string;
  username: string;
  config: PageConfig;
  products: PublicProduct[];
  allowCustom: boolean;
  showPoweredBy: boolean;
  platformName: string;
  referralCode?: string;
  /** Nombre fiscal de quien vende (pie de página). */
  sellerName?: string | null;
  /** Vista previa del editor: sin tracking y sin animaciones de entrada. */
  preview?: boolean;
  /** Las últimas publicaciones (sección «Novedades») y cuántas hay en total. */
  posts?: PublicPost[];
  postCount?: number;
  /** Códigos de descuento visibles (sección «Códigos de descuento»). */
  discountCodes?: PublicDiscountCode[];
  /**
   * Web personal (SITE_MODE=personal): nada se cobra aquí, así que no se enseñan los productos de
   * pago en la web, ni «Powered by», ni las condiciones de venta en el pie.
   */
  personal?: boolean;
  /** Dirección de la web (APP_URL), para reconocer los enlaces absolutos a sus propios productos. */
  siteOrigin?: string;
};

export function CreatorPageView(props: Props) {
  const { config, username, preview, personal } = props;
  const products = personal ? props.products.filter((p) => (p.accessMode ?? "PAID") !== "PAID") : props.products;
  // Ni un botón hacia lo que no se ve: en la web personal, un enlace a un producto oculto daría 404.
  const hiddenSlugs = new Set(personal ? props.products.filter((p) => (p.accessMode ?? "PAID") === "PAID").map((p) => p.slug.toLowerCase()) : []);
  const links = config.links.filter((l) => !linksToProduct(l.url, username, hiddenSlugs, props.siteOrigin));
  const posts = props.posts ?? [];
  const codes = props.discountCodes ?? [];
  const theme = resolveTheme(config.template, config.theme, props.allowCustom);
  const featured = products.find((p) => p.featured);
  const reveal = preview ? {} : { "data-reveal": "" };
  const trackId = preview ? null : props.creatorId;

  const renderSection = (key: SectionKey) => {
    const type = SECTION_TYPE[key];
    if (type) {
      const items = products.filter((p) => p.type === type && p.id !== featured?.id);
      if (!items.length) return null;
      return (
        <section key={key} id={key} className="mt-14" {...reveal}>
          <SectionHeading title={sectionTitle(config, key)} count={items.length} />
          {items.length === 1 ? (
            <div className="mt-5">
              <ProductCard p={items[0]} username={username} trackCreatorId={trackId} />
            </div>
          ) : (
            <div className="-mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scrollbar-none md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
              {items.map((p) => (
                <div key={p.id} className="w-[82%] shrink-0 snap-center sm:w-[60%] md:w-auto">
                  <ProductCard p={p} username={username} trackCreatorId={trackId} />
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }
    switch (key) {
      case "blocks": {
        const blocks = visibleTextBlocks(config);
        if (!blocks.length) return null;
        const heading = sectionTitle(config, key);
        return (
          <section key={key} id="bloques" className="mt-14 space-y-4" {...reveal}>
            {heading && <SectionHeading title={heading} />}
            {blocks.map((b) => {
              const href = b.buttonUrl ? safeHref(b.buttonUrl) : null;
              // Las webs de fuera, en otra pestaña; los enlaces internos y mailto:/tel:, en la misma.
              const newTab = !!href && /^https?:/i.test(href);
              return (
                <div key={b.id} className="cp-card p-6 sm:p-7">
                  {b.title && (heading ? <h3 className="cp-display text-[1.6rem] leading-tight">{b.title}</h3> : <h2 className="cp-display text-[1.75rem] leading-tight sm:text-[2rem]">{b.title}</h2>)}
                  {b.body && <RichText text={b.body} className={`cp-muted space-y-3 text-[0.95rem] leading-relaxed ${b.title ? "mt-3" : ""}`} />}
                  {href && b.buttonLabel && (
                    <a href={href} className="cp-btn-ghost mt-5" {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {b.buttonLabel}
                      <ArrowUpRight className="h-4 w-4 opacity-70" />
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        );
      }
      case "posts": {
        if (!posts.length) return null;
        const total = Math.max(props.postCount ?? posts.length, posts.length);
        return (
          <section key={key} id="novedades" className="mt-16" {...reveal}>
            <div className="flex items-end justify-between gap-4">
              <h2 className="cp-display text-[2rem] sm:text-[2.3rem]">{sectionTitle(config, key)}</h2>
              <Link href={`/${username}/novedades`} className="cp-muted inline-flex shrink-0 items-center gap-1 pb-1.5 text-sm font-medium underline-offset-4 hover:underline">
                Ver todas{total > posts.length ? ` (${total})` : ""} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} username={username} />
              ))}
            </div>
          </section>
        );
      }
      case "codes": {
        if (!codes.length) return null;
        return (
          <section key={key} id="codigos" className="mt-16" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} count={codes.length} />
            {codes.length === 1 ? (
              <div className="mt-5">
                <DiscountCodeCard code={codes[0]} trackCreatorId={trackId} />
              </div>
            ) : (
              <div className="-mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scrollbar-none md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
                {codes.map((c) => (
                  <div key={c.id} className="w-[86%] shrink-0 snap-center sm:w-[60%] md:w-auto">
                    <DiscountCodeCard code={c} trackCreatorId={trackId} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      }
      case "links":
        if (!links.length) return null;
        return (
          <section key={key} className="mt-9 space-y-3" {...reveal}>
            {links.map((l) => (
              <a key={l.id} href={safeHref(l.url)} className="cp-link" data-highlight={l.highlight ? "true" : "false"} {...(l.url.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
                <span>{l.label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />
              </a>
            ))}
          </section>
        );
      case "testimonials":
        if (!config.testimonials.length) return null;
        return (
          <section key={key} className="mt-16" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} />
            <div className="-mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scrollbar-none md:mx-0 md:grid md:grid-cols-2 md:px-0">
              {config.testimonials.map((t) => (
                <figure key={t.id} className="cp-card w-[85%] shrink-0 snap-center p-6 md:w-auto">
                  <Quote className="cp-gold h-5 w-5" />
                  <blockquote className="cp-display mt-3 text-[1.3rem] leading-snug">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <span className="font-semibold">{t.author}</span>
                    {t.role && <span className="cp-muted"> · {t.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      case "faq":
        if (!config.faqs.length) return null;
        return (
          <section key={key} className="mt-16" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} />
            <div className="mt-4 divide-y" style={{ borderColor: "var(--c-line)" }}>
              {config.faqs.map((f) => (
                <details key={f.id} className="group py-1" style={{ borderColor: "var(--c-line)" }}>
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-[0.98rem] font-medium">
                    {f.q}
                    <Plus className="cp-faq-icon h-4 w-4 shrink-0 opacity-70" />
                  </summary>
                  <p className="cp-muted pb-5 pr-8 text-[0.92rem] leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        );
      case "contact": {
        const c = config.contact;
        if (!c.email && !c.whatsapp) return null;
        return (
          <section key={key} className="mt-16" {...reveal}>
            <div className="cp-card p-7 text-center sm:p-9">
              <p className="cp-eyebrow">{sectionTitle(config, key)}</p>
              <p className="cp-display mx-auto mt-3 max-w-md text-[1.7rem]">{c.message || "¿Tienes alguna pregunta? Escríbeme."}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="cp-btn-ghost">
                    <Mail className="h-4 w-4" /> Email
                  </a>
                )}
                {c.whatsapp && (
                  <a href={socialHref("whatsapp", c.whatsapp)} target="_blank" rel="noopener noreferrer" className="cp-btn-ghost">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          </section>
        );
      }
      default:
        return null;
    }
  };

  const socials = SOCIAL_KEYS.filter((k) => config.socials[k]);

  return (
    <div className="cp" style={themeStyle(theme)} data-card={theme.card} data-template={config.template}>
      <div className={`cp-decor cp-decor-${theme.decor}`} aria-hidden>
        {theme.decor === "stars" && <div className="starfield absolute inset-0 opacity-70" />}
        {theme.backgroundImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
      </div>

      {/* Barra superior discreta */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "color-mix(in oklab, var(--c-bg) 55%, transparent)", backdropFilter: "blur(10px)" }}>
          @{username}
        </span>
        <Link
          href={`/${username}/entrar?next=%2Fcuenta`}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          style={{ background: "color-mix(in oklab, var(--c-bg) 55%, transparent)", backdropFilter: "blur(10px)" }}
        >
          <UserRound className="h-3.5 w-3.5" /> Mi área
        </Link>
      </div>

      {/* Portada */}
      {config.coverUrl ? (
        <div className="relative h-[34vh] min-h-[220px] w-full overflow-hidden sm:h-[42vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.coverUrl}
            srcSet={imageSrcSet(config.coverUrl)}
            sizes="100vw"
            fetchPriority="high"
            decoding="async"
            alt=""
            className="h-full w-full scale-105 object-cover"
          />
          <div className="cp-cover-fade absolute inset-0" />
        </div>
      ) : (
        <div className="h-20 sm:h-28" />
      )}

      <main className="relative mx-auto w-full max-w-[44rem] px-5 pb-16">
        {/* Presentación */}
        <header className={`flex flex-col items-center text-center ${config.coverUrl ? "-mt-16 sm:-mt-20" : "pt-4"}`}>
          <div className="rounded-full p-[3px]" style={{ background: "linear-gradient(135deg, var(--c-gold), var(--c-accent))" }}>
            <div className="rounded-full p-[3px]" style={{ background: "var(--c-bg)" }}>
              <Avatar src={config.avatarUrl} name={config.displayName} className="h-28 w-28 sm:h-32 sm:w-32" />
            </div>
          </div>
          <h1 className="cp-display mt-5 text-[2.6rem] sm:text-[3.2rem]">{config.displayName}</h1>
          {config.tagline && <p className="cp-eyebrow mt-3">{config.tagline}</p>}
          {config.headline && (
            <p className="cp-display mt-6 max-w-lg text-[1.65rem] italic leading-tight sm:text-[2rem]" style={{ color: "var(--c-gold)" }}>
              {config.headline}
            </p>
          )}
          {config.bio && <p className="cp-muted mt-4 max-w-md text-[0.95rem] leading-relaxed">{config.bio}</p>}
          {socials.length > 0 && (
            <div className="mt-6 flex items-center gap-2">
              {socials.map((k) => (
                <a
                  key={k}
                  href={socialHref(k, config.socials[k]!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={k}
                  className="grid h-10 w-10 place-items-center rounded-full border transition hover:-translate-y-0.5"
                  style={{ borderColor: "var(--c-line)" }}
                >
                  <SocialIcon name={k} className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          )}
        </header>

        {config.sections.filter((s) => s.key === "links" && s.enabled).map((s) => renderSection(s.key))}

        {featured && config.sections.find((s) => s.key === Object.entries(SECTION_TYPE).find(([, t]) => t === featured.type)?.[0])?.enabled !== false && (
          <section className="mt-12" {...reveal}>
            <ProductCard p={featured} large username={username} trackCreatorId={trackId} />
          </section>
        )}

        {config.sections.filter((s) => s.enabled && s.key !== "links").map((s) => renderSection(s.key))}

        <footer className="mt-20 flex flex-col items-center gap-4 text-center text-xs">
          <Link href={`/${username}/entrar?next=%2Fcuenta`} className="cp-muted underline-offset-4 hover:underline">
            {personal ? "¿Ya tienes acceso? Entra en tu área" : "¿Ya compraste? Accede a tu área de cliente"}
          </Link>
          <LegalLinks username={username} sellerName={props.sellerName} personal={personal} />
          {props.showPoweredBy && !personal && (
            <a
              href={`/?ref=${props.referralCode ?? ""}&utm_source=powered_by`}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition hover:opacity-100"
              style={{ borderColor: "var(--c-line)", opacity: 0.75 }}
            >
              <span className="cp-gold">✦</span> Powered by <span className="font-semibold">{props.platformName}</span>
            </a>
          )}
        </footer>
      </main>
    </div>
  );
}

function ProductCard({ p, large = false, username, trackCreatorId }: { p: PublicProduct; large?: boolean; username: string; trackCreatorId: string | null }) {
  const mode = p.accessMode ?? "PAID";
  const free = mode === "FREE_EMAIL";
  const external = mode === "EXTERNAL" && !!p.externalUrl;
  const cta = free
    ? p.ctaLabel || "Acceder gratis"
    : external
      ? externalButtonLabel({ type: p.type, externalLabel: p.externalLabel ?? null, externalUrl: p.externalUrl ?? null })
      : p.ctaLabel || DEFAULT_CTA[p.type as ProductType] || "Comprar";
  const productHref = `/${username}/${p.slug}`;
  const event = trackCreatorId ? { creatorId: trackCreatorId, type: "PRODUCT_CLICK" as const, productId: p.id } : null;
  // Gratis: «Gratis». Pago fuera: el precio (informativo, si lo hay) y dónde se paga. Pago aquí: precio e IVA.
  const price = free ? "Gratis" : external && p.priceCents <= 0 ? null : formatPrice(p.priceCents, p.currency, p.billingInterval);
  const priceNote = external ? (p.externalHost ? `Pago en ${p.externalHost}` : "Pago en otra web") : !free && p.vatIncluded ? "IVA incluido" : null;
  return (
    <article className="cp-card cp-card-hover group flex h-full flex-col">
      <Link href={productHref} className={`relative block overflow-hidden ${large ? "aspect-[16/11] sm:aspect-[16/9]" : "aspect-[4/3]"}`}>
        <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} sizes="(min-width: 768px) 360px, 85vw" />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "color-mix(in oklab, var(--c-bg) 72%, transparent)", color: "var(--c-text)", backdropFilter: "blur(10px)" }}
        >
          {p.emoji && <span aria-hidden>{p.emoji}</span>}
          {TYPE_EYEBROW[p.type as ProductType]}
          {p.meta ? <span className="cp-muted normal-case tracking-normal">· {p.meta}</span> : null}
        </span>
        {large && (
          <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ background: "var(--c-gold)", color: "var(--c-bg)" }}>
            Destacado
          </span>
        )}
      </Link>
      <div className={`flex flex-1 flex-col ${large ? "p-5 sm:p-7" : "p-5"}`}>
        <Link href={productHref} className="block">
          <h3 className={`cp-display ${large ? "text-[1.85rem] sm:text-[2.3rem]" : "text-[1.55rem]"}`}>{p.title}</h3>
          {p.summary && <p className={`cp-muted mt-2 leading-relaxed ${large ? "text-[0.95rem]" : "line-clamp-2 text-[0.88rem]"}`}>{p.summary}</p>}
        </Link>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <p className="min-w-0 text-lg font-semibold tracking-tight">
            {price}
            {priceNote && <span className={`cp-faint block font-normal ${price ? "text-[0.7rem]" : "text-xs"}`}>{priceNote}</span>}
          </p>
          {external ? (
            <TrackedAnchor href={p.externalUrl!} event={event} className="cp-btn shrink-0" ariaLabel={`${cta}: ${p.title}`}>
              {cta}
              <ExternalLink className="h-4 w-4" />
            </TrackedAnchor>
          ) : (
            <TrackedLink href={free ? productHref : `${productHref}/checkout`} event={event} className="cp-btn shrink-0" ariaLabel={`${cta}: ${p.title}`}>
              {cta}
              <ArrowRight className="h-4 w-4" />
            </TrackedLink>
          )}
        </div>
      </div>
    </article>
  );
}

function PostCard({ post, username }: { post: PublicPost; username: string }) {
  return (
    <Link href={postPath(username, post.slug)} className="cp-card cp-card-hover group flex items-stretch gap-4 overflow-hidden p-3 sm:p-4">
      {post.imageUrl && (
        <span className="relative block w-24 shrink-0 overflow-hidden rounded-[calc(var(--r-card)*0.7)] sm:w-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            srcSet={imageSrcSet(post.imageUrl)}
            sizes="128px"
            alt=""
            loading="lazy"
            decoding="async"
            className="cp-img absolute inset-0 h-full w-full object-cover transition duration-500"
          />
        </span>
      )}
      <span className="min-w-0 flex-1 py-1">
        <time dateTime={new Date(post.publishedAt).toISOString()} className="cp-eyebrow block">
          {post.dateLabel}
        </time>
        <span className="cp-display mt-1.5 block text-[1.35rem] leading-tight">{post.title}</span>
        {post.excerpt && <span className="cp-muted mt-1.5 line-clamp-2 block text-[0.86rem] leading-relaxed">{post.excerpt}</span>}
      </span>
    </Link>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="cp-display text-[2rem] sm:text-[2.3rem]">{title}</h2>
      {count != null && count > 1 && <span className="cp-faint pb-1.5 text-xs tabular-nums md:hidden">{count} · desliza →</span>}
    </div>
  );
}
