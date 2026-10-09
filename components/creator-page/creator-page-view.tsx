import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail, MessageCircle, Plus, Quote, UserRound } from "lucide-react";
import { imageSrcSet } from "@/lib/media-url";
import { formatPrice } from "@/lib/money";
import {
  SOCIAL_KEYS,
  safeHref,
  sectionTitle,
  socialHref,
  type PageConfig,
  type SectionKey,
} from "@/lib/page-config";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { DEFAULT_CTA, type ProductType } from "@/lib/types";
import { SocialIcon } from "../social-icons";
import { Avatar, ProductImage } from "./product-art";
import { TrackedLink } from "./tracking";

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
  /** Vista previa del editor: sin tracking y sin animaciones de entrada. */
  preview?: boolean;
};

export function CreatorPageView(props: Props) {
  const { config, products, username, preview } = props;
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
      case "links":
        if (!config.links.length) return null;
        return (
          <section key={key} className="mt-9 space-y-3" {...reveal}>
            {config.links.map((l) => (
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
          href="/cuenta"
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
          <Link href="/cuenta" className="cp-muted underline-offset-4 hover:underline">
            ¿Ya compraste? Accede a tu área de cliente
          </Link>
          {props.showPoweredBy && (
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
  const cta = p.ctaLabel || DEFAULT_CTA[p.type as ProductType] || "Comprar";
  const productHref = `/${username}/${p.slug}`;
  const event = trackCreatorId ? { creatorId: trackCreatorId, type: "PRODUCT_CLICK" as const, productId: p.id } : null;
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
          <p className="text-lg font-semibold tracking-tight">{formatPrice(p.priceCents, p.currency, p.billingInterval)}</p>
          <TrackedLink href={`${productHref}/checkout`} event={event} className="cp-btn" ariaLabel={`${cta}: ${p.title}`}>
            {cta}
            <ArrowRight className="h-4 w-4" />
          </TrackedLink>
        </div>
      </div>
    </article>
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
