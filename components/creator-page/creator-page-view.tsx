import Link from "next/link";
import { ArrowRight, ArrowUpRight, ExternalLink, Mail, MessageCircle, Moon, Plus, Quote } from "lucide-react";
import { AccountEntry } from "./account-entry";
import { ContentBlocks } from "./content-blocks";
import { SiteNav, type SiteNavPage } from "./site-nav";
import { externalButtonLabel, linksToProduct } from "@/lib/access-mode";
import { imageSrcSet } from "@/lib/media-url";
import { formatPrice } from "@/lib/money";
import {
  NEWSLETTER_FORM_DEFAULTS,
  SOCIAL_KEYS,
  safeHref,
  sectionTitle,
  socialHref,
  visibleTextBlocks,
  type PageConfig,
  type SectionKey,
} from "@/lib/page-config";
import { READINGS_DEFAULTS } from "@/lib/page-config";
import type { PublicPortalItem } from "@/lib/portal-rules";
import { sectionPagePath } from "@/lib/site-sections";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { DEFAULT_CTA, type ProductType } from "@/lib/types";
import { SocialIcon } from "../social-icons";
import { DiscountCodeCard } from "./discount-code-card";
import { LegalLinks } from "./legal-links";
import { NewsletterSignup } from "./newsletter-signup";
import { creatorLegalHref } from "@/lib/legal";
import { Avatar, ProductImage } from "./product-art";
import { PortalSection } from "./portal-section";
import { PostCard } from "./post-card";
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
  /** Oferta activa (lib/offers.ts): el precio de ahora, el normal tachado, la etiqueta y hasta cuándo. */
  sale?: { priceCents: number; regularCents: number; percentOff: number; label: string | null; endsLabel: string | null } | null;
  /** Curso: su método (lib/course-categories.ts). */
  courseCategory?: string | null;
  /** Taller (sesión de grupo con fecha) y si es un círculo de la luna. */
  groupSession?: boolean;
  moonCircle?: boolean;
  /** «Jue 5 nov · 20:00 (hora de España)» de un taller. */
  eventLabel?: string | null;
  eventStartAt?: string | null;
  /** «Lectura», «Sesión», «Taller», «Curso»… (lib/channel-kind.ts). */
  kindLabel?: string;
  /** Cómo se consigue (lib/access-mode.ts). Sin valor: pago en la web (PAID). */
  accessMode?: string;
  /** Pago fuera (EXTERNAL): la web externa, el texto del botón y su dominio («hotmart.com»). */
  externalUrl?: string | null;
  externalLabel?: string | null;
  externalHost?: string | null;
};

/** Publicación de la sección «Actualidades» (lib/public.ts). */
export type PublicPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: Date;
  /** «12 de octubre de 2026», ya en la zona horaria de la creadora. */
  dateLabel: string;
  /** La fecha en grande de la tarjeta: «05» y «nov». */
  dateBadge: { day: string; month: string };
  /** Lleva vídeo o audio (se avisa en la portada de la tarjeta). */
  mediaKind: "VIDEO" | "AUDIO" | null;
  /** Llamada a la acción: botón con su enlace y código de descuento opcional. */
  cta: { label: string; url: string; code: string | null } | null;
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
  MEMBERSHIP: "Comunidad",
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
  /** Las últimas publicaciones (sección «Actualidades») y cuántas hay en total. */
  posts?: PublicPost[];
  postCount?: number;
  /** Portal de Noticias, bloqueado (el navegador pide lo desbloqueado con su sesión). */
  portal?: PublicPortalItem[];
  /** Códigos de descuento visibles (sección «Códigos de descuento»). */
  discountCodes?: PublicDiscountCode[];
  /** Web personal (SITE_MODE=personal): sin «Powered by». */
  personal?: boolean;
  /**
   * Web personal sin cobros (PAYMENT_PROVIDER=none): nada se cobra aquí, así que no se enseñan los
   * productos de pago en la web ni las condiciones de venta en el pie.
   */
  signupsOnly?: boolean;
  /** Dirección de la web (APP_URL), para reconocer los enlaces absolutos a sus propios productos. */
  siteOrigin?: string;
  /** Páginas extra publicadas que salen en el pie («Sobre mí», «Preguntas frecuentes»…). */
  pages?: SiteNavPage[];
};

export function CreatorPageView(props: Props) {
  const { config, username, preview, personal, signupsOnly } = props;
  const products = signupsOnly ? props.products.filter((p) => (p.accessMode ?? "PAID") !== "PAID") : props.products;
  // Ni un botón hacia lo que no se ve: en la web personal sin cobros, un enlace a un producto oculto daría 404.
  const hiddenSlugs = new Set(signupsOnly ? props.products.filter((p) => (p.accessMode ?? "PAID") === "PAID").map((p) => p.slug.toLowerCase()) : []);
  const links = config.links.filter((l) => !linksToProduct(l.url, username, hiddenSlugs, props.siteOrigin));
  const posts = props.posts ?? [];
  const codes = props.discountCodes ?? [];
  const theme = resolveTheme(config.template, config.theme, props.allowCustom);
  const reveal = preview ? {} : { "data-reveal": "" };
  const trackId = preview ? null : props.creatorId;
  const path = (page: Parameters<typeof sectionPagePath>[1]) => sectionPagePath(username, page, !!personal);
  const courseCount = products.filter((p) => p.type === "COURSE").length;

  const renderSection = (key: SectionKey) => {
    const type = SECTION_TYPE[key];
    if (type) {
      const items = products.filter((p) => p.type === type);
      if (!items.length) return null;
      // Cursos: con más de uno, su página propia los agrupa por método (/cursos).
      const more =
        key === "courses" && courseCount > 1 ? (
          <Link href={path("cursos")} className="cp-btn-ghost mt-5 w-full">
            Ver todos los cursos por método <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null;
      return (
        <section key={key} id={key === "courses" ? "cursos" : key} className="mt-14" {...reveal}>
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
          {more}
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
            <ContentBlocks blocks={blocks} username={username} titleLevel={heading ? 3 : 2} hiddenSlugs={hiddenSlugs} siteOrigin={props.siteOrigin} />
          </section>
        );
      }
      case "bubbles": {
        const bubbles = (config.bubbles ?? []).filter((b) => !linksToProduct(b.url, username, hiddenSlugs, props.siteOrigin));
        if (!bubbles.length) return null;
        return (
          <nav key={key} aria-label="Accesos" className="mt-12 grid gap-3" style={{ gridTemplateColumns: `repeat(${bubbles.length}, minmax(0, 1fr))` }} {...reveal}>
            {bubbles.map((b) => (
              <a key={b.id} href={safeHref(b.url)} className="group flex flex-col items-center gap-2.5 text-center" {...(isExternal(b.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {b.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image} srcSet={imageSrcSet(b.image)} sizes="104px" alt="" loading="lazy" decoding="async" className="cp-bubble-img transition duration-300 group-hover:-translate-y-0.5" />
                ) : (
                  <span className="cp-bubble-img grid place-items-center" aria-hidden>
                    <span className="cp-display grid h-full w-full place-items-center rounded-full text-[1.8rem]" style={{ background: "var(--c-surface)" }}>
                      {b.label.trim().charAt(0).toUpperCase()}
                    </span>
                  </span>
                )}
                <span className="text-[0.9rem] font-semibold leading-tight">{b.label}</span>
              </a>
            ))}
          </nav>
        );
      }
      case "posts": {
        if (!posts.length) return null;
        const total = Math.max(props.postCount ?? posts.length, posts.length);
        return (
          <section key={key} id="actualidades" className="mt-16" {...reveal}>
            <div className="flex items-end justify-between gap-4">
              <h2 className="cp-display text-[2rem] sm:text-[2.3rem]">{sectionTitle(config, key)}</h2>
              <Link href={path("actualidades")} className="cp-muted inline-flex shrink-0 items-center gap-1 pb-1.5 text-sm font-medium underline-offset-4 hover:underline">
                Ver todas{total > posts.length ? ` (${total})` : ""} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} username={username} />
              ))}
            </div>
          </section>
        );
      }
      case "portal": {
        // Solo en la web personal: lo desbloquea su newsletter, que es de la dueña.
        const items = props.portal ?? [];
        if (!items.length || !personal) return null;
        return (
          <section key={key} id="portal" className="mt-16" {...reveal}>
            <PortalSection
              items={items}
              title={sectionTitle(config, key)}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(username, "privacidad")}
              portalHref={path("portal")}
              username={username}
              preview={!!preview}
              home
            />
          </section>
        );
      }
      case "offers": {
        const onSale = products.filter((p) => p.sale);
        if (!onSale.length) return null;
        return (
          <section key={key} id="ofertas" className="mt-16" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {onSale.map((p) => (
                <OfferCard key={p.id} p={p} username={username} />
              ))}
            </div>
          </section>
        );
      }
      case "about": {
        const a = config.about;
        if (!a?.title) return null;
        const href = a.url || path("actualidades");
        return (
          <section key={key} id="sobre-mi" className="mt-16" {...reveal}>
            <a href={safeHref(href)} className="cp-card cp-card-hover group flex flex-col sm:flex-row-reverse sm:items-stretch" {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {a.image && (
                <span className="relative block aspect-[4/3] overflow-hidden sm:aspect-auto sm:w-[42%] sm:shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.image} srcSet={imageSrcSet(a.image)} sizes="(min-width: 640px) 290px, 92vw" alt="" loading="lazy" decoding="async" className="cp-img absolute inset-0 h-full w-full object-cover" />
                </span>
              )}
              <span className="flex flex-1 flex-col justify-center gap-2 p-6 sm:p-8">
                {a.eyebrow && <span className="cp-eyebrow">{a.eyebrow}</span>}
                <span className="cp-display text-[2rem] leading-[1.05] sm:text-[2.3rem]">{a.title}</span>
                {a.text && <span className="cp-muted text-[0.95rem] leading-relaxed">{a.text}</span>}
                <span className="cp-gold mt-1 inline-flex items-center gap-1 text-sm font-semibold">
                  {a.linkLabel || "Conoce mi historia"} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </a>
          </section>
        );
      }
      case "systems": {
        const systems = config.systems ?? [];
        if (!systems.length) return null;
        return (
          <section key={key} id="sistemas" className="mt-16" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {systems.map((sys) => {
                const inner = (
                  <>
                    <span className="relative block w-28 shrink-0 overflow-hidden sm:w-32">
                      {sys.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sys.image} srcSet={imageSrcSet(sys.image)} sizes="128px" alt="" loading="lazy" decoding="async" className="cp-img absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 45%, var(--c-bg)), color-mix(in oklab, var(--c-gold) 30%, var(--c-bg)))" }} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4">
                      <span className="cp-display text-[1.45rem] leading-tight">{sys.title}</span>
                      {sys.text && <span className="cp-muted line-clamp-2 text-[0.84rem] leading-snug">{sys.text}</span>}
                    </span>
                    {sys.url && <ArrowRight className="mr-4 h-4 w-4 shrink-0 self-center opacity-60" />}
                  </>
                );
                return sys.url ? (
                  <a key={sys.id} href={safeHref(sys.url)} className="cp-card cp-card-hover group flex min-h-[7rem] items-stretch" {...(isExternal(sys.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {inner}
                  </a>
                ) : (
                  <div key={sys.id} className="cp-card flex min-h-[7rem] items-stretch">
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }
      case "readings": {
        const r = config.readings;
        if (!r) return null;
        const circles = products
          .filter((p) => p.moonCircle && p.eventStartAt)
          .sort((a, b) => (a.eventStartAt! < b.eventStartAt! ? -1 : 1))
          .slice(0, 4);
        const cards = [
          { c: r.reading, d: READINGS_DEFAULTS.reading, href: path("lecturas") },
          { c: r.session, d: READINGS_DEFAULTS.session, href: path("sesiones") },
        ];
        return (
          <section key={key} id="lecturas" className="mt-16" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {cards.map(({ c, d, href }) => (
                <Link key={href} href={href} className="cp-card cp-card-hover flex flex-col gap-2 p-6">
                  <span className="cp-eyebrow">{c.eyebrow || d.eyebrow}</span>
                  <span className="cp-display text-[1.7rem] leading-tight">{c.title || d.title}</span>
                  <span className="cp-muted text-[0.9rem] leading-relaxed">{c.text || d.text}</span>
                  <span className="cp-gold mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold">
                    Ver los pasos <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
            {circles.length > 0 && (
              <div className="cp-card mt-4 p-5 sm:p-6" data-moon-circles>
                <p className="cp-eyebrow flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5" /> {r.circlesTitle || READINGS_DEFAULTS.circlesTitle}
                </p>
                <ul className="mt-3 divide-y" style={{ borderColor: "var(--c-line)" }}>
                  {circles.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3" style={{ borderColor: "var(--c-line)" }}>
                      <span className="min-w-0">
                        <Link href={`/${username}/${c.slug}`} className="block font-semibold underline-offset-4 hover:underline">
                          {c.title}
                        </Link>
                        <span className="cp-muted block text-[0.82rem]">{c.eventLabel}</span>
                        {c.sale && <span className="cp-gold block text-[0.78rem]">{formatPrice(c.sale.priceCents, c.currency)} · antes {formatPrice(c.sale.regularCents, c.currency)}</span>}
                      </span>
                      <TrackedLink
                        href={(c.accessMode ?? "PAID") === "FREE_EMAIL" ? `/${username}/${c.slug}` : `/${username}/${c.slug}/checkout`}
                        event={trackId ? { creatorId: trackId, type: "PRODUCT_CLICK" as const, productId: c.id } : null}
                        className="cp-btn shrink-0 !min-h-[2.5rem] !text-[0.85rem]"
                        ariaLabel={`Apuntarme: ${c.title}`}
                      >
                        Apuntarme
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
      case "newsletter":
        // Solo en la web personal (la newsletter es suya y sale con su dominio).
        if (!personal) return null;
        return (
          <section key={key} id="newsletter" className="mt-16" {...reveal}>
            <NewsletterSignup
              variant="section"
              title={sectionTitle(config, key)}
              text={config.newsletter?.text ?? NEWSLETTER_FORM_DEFAULTS.text}
              button={config.newsletter?.button ?? NEWSLETTER_FORM_DEFAULTS.button}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(username, "privacidad")}
              preview={preview}
            />
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
        <AccountEntry username={username} personal={personal} variant="pill" />
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

        {/* El antiguo «Destacado» ya no se pinta aparte: cada producto sale en su sección (Product.featured no hace nada aquí). */}
        {config.sections.filter((s) => s.enabled && s.key !== "links").map((s) => renderSection(s.key))}

        <footer className="mt-20 flex flex-col items-center gap-4 text-center text-xs">
          {personal && config.newsletter?.footer && !config.sections.some((s) => s.key === "newsletter" && s.enabled) && (
            <NewsletterSignup
              variant="footer"
              button={config.newsletter.button}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(username, "privacidad")}
              preview={preview}
            />
          )}
          <SiteNav pages={props.pages} />
          <AccountEntry username={username} personal={personal} variant="footer" />
          <LegalLinks username={username} sellerName={props.sellerName} signupsOnly={signupsOnly} />
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

export function ProductCard({ p, large = false, username, trackCreatorId }: { p: PublicProduct; large?: boolean; username: string; trackCreatorId: string | null }) {
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
  const price = free ? "Gratis" : external && p.priceCents <= 0 ? null : formatPrice(p.sale ? p.sale.priceCents : p.priceCents, p.currency, p.billingInterval);
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
            {p.sale && (
              <s className="cp-muted mr-1.5 text-[0.85rem] font-normal" aria-label={`Antes ${formatPrice(p.sale.regularCents, p.currency, p.billingInterval)}`}>
                {formatPrice(p.sale.regularCents, p.currency)}
              </s>
            )}
            {price}
            {p.sale && <span className="cp-gold block text-[0.7rem] font-semibold">{saleTag(p.sale)}</span>}
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

/** «Early Bird · −20 % · hasta el 10 de noviembre». */
function saleTag(sale: NonNullable<PublicProduct["sale"]>) {
  return [sale.label, sale.percentOff ? `−${sale.percentOff} %` : null, sale.endsLabel].filter(Boolean).join(" · ");
}

/** Tarjeta de la sección «Ofertas»: la etiqueta, el título y el precio de antes tachado. */
function OfferCard({ p, username }: { p: PublicProduct; username: string }) {
  const sale = p.sale!;
  return (
    <Link href={`/${username}/${p.slug}`} className="cp-card cp-card-hover flex flex-col gap-1.5 p-5" data-offer={p.slug}>
      <span className="cp-tag">{saleTag(sale)}</span>
      <span className="cp-display mt-1.5 text-[1.5rem] leading-tight">{p.title}</span>
      <span className="text-[0.95rem]">
        <s className="cp-muted">{formatPrice(sale.regularCents, p.currency, p.billingInterval)}</s>{" "}
        <strong className="text-[1.15rem]">{formatPrice(sale.priceCents, p.currency, p.billingInterval)}</strong>
      </span>
      {p.billingInterval && <span className="cp-faint text-[0.72rem]">El precio de oferta es el del primer pago; después, el normal.</span>}
    </Link>
  );
}

function isExternal(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="cp-display text-[2rem] sm:text-[2.3rem]">{title}</h2>
      {count != null && count > 1 && <span className="cp-faint pb-1.5 text-xs tabular-nums md:hidden">{count} · desliza →</span>}
    </div>
  );
}
