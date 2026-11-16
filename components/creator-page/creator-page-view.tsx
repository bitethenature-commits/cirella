import Link from "next/link";
import type { ComponentType, CSSProperties, SVGProps } from "react";
import { ArrowRight, ArrowUpRight, ExternalLink, FileText, Gift, Layers, Mail, Moon, Plus, Sparkles, Video } from "lucide-react";
import { courseCategoriesLabel, courseCategoriesOf, productTopics, readingLabel } from "@/lib/course-categories";
import { AstrologyIcon } from "./astrology-icon";
import { CategoryIcons } from "./category-icons";
import { EnergyIcon } from "./energy-icon";
import { GeneKeysIcon } from "./gene-keys-icon";
import { HumanDesignIcon } from "./human-design-icon";
import { MoonIcon } from "./moon-icon";
import { systemIcon } from "./system-icon";
import { nextMoonCircles } from "@/lib/moon-circles";
import { AccountEntry } from "./account-entry";
import { ContentBlocks } from "./content-blocks";
import { SiteNav, type SiteNavPage } from "./site-nav";
import { externalButtonLabel, linksToProduct } from "@/lib/access-mode";
import { imageSrcSet } from "@/lib/media-url";
import { formatPrice } from "@/lib/money";
import { postPath } from "@/lib/posts";
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
import type { GiftsPreview } from "@/lib/site-pages";
import { sectionPagePath } from "@/lib/site-sections";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { requestCta, type ProductType } from "@/lib/types";
import { SocialIcon } from "../social-icons";
import { CodesCarousel } from "./codes-carousel";
import { DiscountCodeCard } from "./discount-code-card";
import { LegalLinks } from "./legal-links";
import { NewsletterSignup } from "./newsletter-signup";
import { creatorLegalHref } from "@/lib/legal";
import type { CodePhoto, CodeRecommendation } from "@/lib/discount-codes";
import type { OracleDecks } from "@/components/models/data/oracle";
import { Avatar, ProductImage } from "./product-art";
import { PortalSection } from "./portal-section";
import { PostCard } from "./post-card";
import { SectionFolds, type Fold } from "./section-dropdown";
import { TestimonialsRotator } from "./testimonials-rotator";
import { OracleCard } from "./oracle-card";
import { HomeRows, MegaphoneIcon, PercentIcon, PortalNoteIcon } from "./home-rows";
import { offerRow } from "./offer-rows";
import type { NewsItem } from "@/lib/web-news";
import { TrackedAnchor, TrackedLink } from "./tracking";
import { TemplateDecor } from "@/components/template-decor";

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
  /** Oferta activa (lib/offers.ts): el precio de ahora, el normal tachado, la etiqueta y hasta cuándo. */
  sale?: { priceCents: number; regularCents: number; percentOff: number; label: string | null; endsLabel: string | null; startedAt: string } | null;
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
  /** El texto del botón de su carta, si la dueña lo ha cambiado («Escríbeme»). */
  cardCta?: string | null;
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
  /** Fotos de lo que recomienda de la marca (al desplegar con «Ver más»). */
  photos: CodePhoto[];
  /** «Recomendaciones»: la lista de lo que recomienda de la marca, cada una con su enlace opcional. */
  recommendations: CodeRecommendation[];
  /** «Válido hasta el 31 de diciembre» o null si no caduca. */
  expiresLabel: string | null;
};

const TYPE_EYEBROW: Record<ProductType, string> = {
  DIGITAL: "Lectura",
  SESSION: "Sesión",
  COURSE: "Curso",
  MEMBERSHIP: "Comunidad",
};

/** Cursos que salen en la portada (los demás, en su página «/cursos»). */
const HOME_COURSES = 3;

/** Secciones plegables seguidas («Actualidades», «Portal», «Ofertas»): juntas, como una lista de filas. */
/** Los desplegables de la portada: van todos juntos en una fila (components/creator-page/section-dropdown.tsx). */
const FOLD_KEYS: ReadonlySet<SectionKey> = new Set(["posts", "portal", "offers", "gifts"]);

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
  /** «Actualidades»: lo que se va subiendo a la web (lib/web-news.ts). */
  news?: NewsItem[];
  /** Portal de Noticias, bloqueado (el navegador pide lo desbloqueado con su sesión). */
  portal?: PublicPortalItem[];
  /** «Gifts»: las primeras tarjetas de su página (lib/site-pages.ts → giftsPreview). */
  gifts?: GiftsPreview;
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
  /** Barajas propias de los bloques «Oráculo» (lib/oracle-decks.ts → oracleDecksForBlocks). */
  oracleDecks?: OracleDecks;
};

export function CreatorPageView(props: Props) {
  const { config, username, preview, personal, signupsOnly } = props;
  // Lo de pago se ve siempre: se solicita por formulario (lib/requests.ts).
  const products = props.products;
  // Ni un botón hacia lo que no se ve: en la web personal sin cobros, un enlace a un producto oculto daría 404.
  const hiddenSlugs = new Set<string>();
  const links = config.links.filter((l) => !linksToProduct(l.url, username, hiddenSlugs, props.siteOrigin));
  const posts = props.posts ?? [];
  const codes = props.discountCodes ?? [];
  const theme = resolveTheme(config.template, config.theme, props.allowCustom);
  const reveal = preview ? {} : { "data-reveal": "" };
  const trackId = preview ? null : props.creatorId;
  const path = (page: Parameters<typeof sectionPagePath>[1]) => sectionPagePath(username, page, !!personal);
  const courseCount = products.filter((p) => p.type === "COURSE").length;
  // La newsletter va debajo de «Hablemos» (web personal); la antigua sección «Newsletter» ya no se pinta.
  const newsletterSection = false;
  const contactNewsletter = !!personal && !!config.contact.email && config.sections.some((s) => s.key === "contact" && s.enabled);

  /** El contenido de cada desplegable de la portada (null = no hay nada que enseñar). */
  const foldFor = (key: SectionKey): Fold | null => {
    const fallbackImage = config.coverUrl ?? config.avatarUrl ?? null;
    const icon = "h-10 w-10";
    switch (key) {
      case "posts": {
        // «Actualidades»: lo nuevo de la web (membresías, cursos, lecturas, códigos, el próximo círculo…).
        const all = props.news ?? [];
        // Solo lo reciente (30 días): sin agobiar con todo lo que hay. Si no hay nada reciente, lo último.
        const since = Date.now() - 30 * 86_400_000;
        const recent = all.filter((n) => Date.parse(n.at) >= since);
        const news = (recent.length ? recent : all).slice(0, 3);
        if (!news.length) return null;
        return {
          id: "actualidades",
          section: "posts",
          title: sectionTitle(config, key),
          countLabel: recent.length === 0 ? "Lo último de la web" : recent.length === 1 ? "1 novedad este mes" : `${recent.length} novedades este mes`,
          stamps: recent.map((n) => Date.parse(n.at)),
          icon: <MegaphoneIcon className={icon} />,
          content: (
            <>
              <HomeRows
                fallbackImage={fallbackImage}
                rows={news.map((n) => ({
                  key: n.key,
                  href: n.href,
                  image: n.image,
                  icon: <MegaphoneIcon className="h-7 w-7 opacity-80" />,
                  eyebrow: (
                    <>
                      <span>{n.dateLabel}</span>
                      <span>· {n.label}</span>
                    </>
                  ),
                  title: n.title,
                  text: n.text,
                }))}
              />
              <Link href={path("actualidades")} className="cp-btn-ghost mt-4 w-full">
                Ver todas las novedades <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ),
        };
      }
      case "portal": {
        // Solo en la web personal: lo desbloquea su newsletter, que es de la dueña.
        const items = props.portal ?? [];
        if (!items.length || !personal) return null;
        const n = items.length;
        return {
          id: "portal",
          section: "portal",
          title: sectionTitle(config, key),
          countLabel: n === 1 ? "1 aviso" : `${n} avisos`,
          stamps: items.map((i) => Date.parse(i.publishedAt)),
          icon: <PortalNoteIcon className={icon} />,
          content: (
            <PortalSection
              items={items}
              title={sectionTitle(config, key)}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(username, "privacidad")}
              portalHref={path("portal")}
              username={username}
              preview={!!preview}
              home
              limit={1}
              fallbackImage={fallbackImage}
            />
          ),
        };
      }
      case "offers": {
        const onSale = products.filter((p) => p.sale);
        if (!onSale.length) return null;
        return {
          id: "ofertas",
          section: "offers",
          title: sectionTitle(config, key),
          countLabel: onSale.length === 1 ? "1 oferta" : `${onSale.length} ofertas`,
          stamps: onSale.map((p) => Date.parse(p.sale!.startedAt)),
          icon: <PercentIcon className={icon} />,
          content: (
            <>
              <HomeRows fallbackImage={fallbackImage} rows={onSale.slice(0, 1).map((p) => offerRow(p, username))} />
              {onSale.length > 1 && (
                <Link href={path("ofertas")} className="cp-btn-ghost mt-4 w-full">
                  Ver más ofertas <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </>
          ),
        };
      }
      case "gifts": {
        // «Gifts»: lo que hace para regalar (calendarios, manualidades…), de su página (Páginas → Gifts).
        const g = props.gifts;
        if (!g?.items.length) return null;
        const href = path("gifts");
        return {
          id: "gifts",
          title: sectionTitle(config, key),
          countLabel: g.total === 1 ? "1 regalo" : `${g.total} regalos`,
          stamps: [],
          icon: <Gift className={icon} strokeWidth={1.15} />,
          content: (
            <>
              {g.subtitle && <p className="cp-muted mb-3 text-[0.92rem]">{g.subtitle}</p>}
              <HomeRows
                fallbackImage={fallbackImage}
                rows={g.items.map((it, n) => ({
                  key: `gift-${n}`,
                  href,
                  image: it.image,
                  icon: <Gift className="h-7 w-7 opacity-80" strokeWidth={1.3} />,
                  eyebrow: <span>Hecho por mí</span>,
                  title: it.title,
                  text: it.text,
                }))}
              />
              <Link href={href} className="cp-btn-ghost mt-4 w-full">
                Ver todos los regalos <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ),
        };
      }
      default:
        return null;
    }
  };

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
      // Cursos: tres tarjetas pequeñas como mucho (dos por fila en el móvil, tres en el ordenador); el resto, en «Ver todos».
      if (key === "courses" && items.length > 1)
        return (
          <section key={key} id="cursos" className="mt-14" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.slice(0, HOME_COURSES).map((p) => (
                <CourseMiniCard key={p.id} p={p} username={username} />
              ))}
            </div>
            {more}
          </section>
        );
      return (
        <section key={key} id={key === "courses" ? "cursos" : key} className="mt-14" {...reveal}>
          <SectionHeading title={sectionTitle(config, key)} count={items.length} />
          {items.length === 1 ? (
            <div className="mx-auto mt-6 max-w-[16rem]">
              <OracleCard p={items[0]} username={username} trackCreatorId={trackId} />
            </div>
          ) : (
            <div className="-mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 pt-2 scrollbar-none md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
              {items.map((p) => (
                <div key={p.id} className="w-[64%] shrink-0 snap-center sm:w-[42%] md:w-auto">
                  <OracleCard p={p} username={username} trackCreatorId={trackId} />
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
            <ContentBlocks
              blocks={blocks}
              username={username}
              titleLevel={heading ? 3 : 2}
              hiddenSlugs={hiddenSlugs}
              siteOrigin={props.siteOrigin}
              oracleDecks={props.oracleDecks}
              modelGate={personal && !preview ? { username, creatorName: config.displayName, privacyHref: creatorLegalHref(username, "privacidad") } : null}
              moonCircles={nextMoonCircles(products)}
            />
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
      case "posts":
      case "portal":
      case "offers":
      case "gifts": {
        // Los cuatro desplegables van juntos en una fila (como «Sistemas»), donde está el primero de ellos.
        const keys = config.sections.filter((s) => s.enabled && FOLD_KEYS.has(s.key)).map((s) => s.key);
        if (keys[0] !== key) return null;
        const list = keys.map(foldFor).filter((x): x is Fold => !!x);
        if (!list.length) return null;
        return (
          <section key="desplegables" id="desplegables" className="mt-14" {...reveal}>
            <SectionFolds folds={list} username={username} preview={preview} />
          </section>
        );
      }
      case "about": {
        const a = config.about;
        if (!a?.title) return null;
        const href = a.url || path("actualidades");
        return (
          <section key={key} id="sobre-mi" className="mt-16" {...reveal}>
            {/* Sin caja: solo la imagen lleva las esquinas redondeadas. */}
            <a href={safeHref(href)} className="group flex flex-col gap-5 sm:flex-row-reverse sm:items-center sm:gap-8" {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {a.image && (
                <span className="cp-luxe-frame relative mx-auto block aspect-[9/16] w-full max-w-[20rem] sm:mx-0 sm:w-[36%] sm:shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.image} srcSet={imageSrcSet(a.image)} sizes="(min-width: 640px) 290px, 92vw" alt="" loading="lazy" decoding="async" className="cp-img absolute inset-0 h-full w-full object-cover group-hover:scale-[1.035]" />
                </span>
              )}
              <span className="flex flex-1 flex-col justify-center gap-2">
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
            {/* Un icono y su nombre debajo, sin cajas: tres por fila en el móvil y todos en una en el ordenador. */}
            <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5">
              {systems.map((sys) => {
                const Icon = systemIcon(sys.title);
                // Los dibujados aquí (Human Design, Gene Keys, Astrología, Luna, Mi energía) tienen muchas piezas: van algo más grandes y finos en el mismo hueco.
                const round = Icon === AstrologyIcon || Icon === MoonIcon;
                const hd = round || Icon === HumanDesignIcon || Icon === GeneKeysIcon || Icon === EnergyIcon;
                const inner = (
                  <>
                    <span className="grid h-12 w-12 place-items-center">
                      {/* Los redondos (carta astral, luna) llenan todo su cuadrado: algo más pequeños para que pesen como los demás. */}
                      <Icon className={`cp-gold shrink-0 transition-transform duration-300 group-hover:-translate-y-1 ${round ? "h-10 w-10" : Icon === EnergyIcon ? "h-11 w-11" : hd ? "h-12 w-12" : "h-9 w-9"}`} strokeWidth={hd ? 1.05 : 1.4} aria-hidden />
                    </span>
                    <span className="cp-display text-[1.15rem] leading-tight">{sys.title}</span>
                  </>
                );
                return sys.url ? (
                  <a key={sys.id} href={safeHref(sys.url)} className="group flex flex-col items-center gap-2 text-center" title={sys.text || undefined} {...(isExternal(sys.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {inner}
                  </a>
                ) : (
                  <div key={sys.id} className="flex flex-col items-center gap-2 text-center" title={sys.text || undefined}>
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
        // Los 2 círculos más cercanos: luna nueva, llena o eclipse (los que ya pasaron no salen).
        const circles = nextMoonCircles(products);
        // Cada una con su icono (documento / vídeo) y su tono, para que no parezcan lo mismo.
        // Primero la sesión y después la lectura.
        const cards = [
          { c: r.session, d: READINGS_DEFAULTS.session, href: path("sesiones"), Icon: Video, tone: TONE_SESSION },
          { c: r.reading, d: READINGS_DEFAULTS.reading, href: path("lecturas"), Icon: FileText, tone: TONE_READING },
        ];
        return (
          <section key={key} id="lecturas" className="mt-16" {...reveal}>
            <SectionHeading title={sectionTitle(config, key)} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {cards.map(({ c, d, href, Icon, tone }) => (
                <Link key={href} href={href} className="cp-card cp-card-hover flex flex-col gap-2 p-6" style={tone.box}>
                  <Icon className="h-8 w-8" strokeWidth={1.5} style={{ color: tone.ink }} aria-hidden />
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
              <div className="cp-card mt-4 p-5 sm:p-6" data-moon-circles style={TONE_CIRCLES.box}>
                <p className="cp-eyebrow flex items-center gap-1.5">
                  <Moon className="h-4 w-4" style={{ color: TONE_CIRCLES.ink }} /> {r.circlesTitle || READINGS_DEFAULTS.circlesTitle}
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
                        href={(c.accessMode ?? "PAID") === "FREE_EMAIL" ? `/${username}/${c.slug}` : `/${username}/${c.slug}/solicitar`}
                        event={trackId ? { creatorId: trackId, type: "PRODUCT_CLICK" as const, productId: c.id } : null}
                        className="cp-btn shrink-0 !min-h-[2.5rem] !text-[0.85rem]"
                        ariaLabel={`${(c.accessMode ?? "PAID") === "FREE_EMAIL" ? "Apuntarme" : "Escríbeme para apuntarme"}: ${c.title}`}
                      >
                        {(c.accessMode ?? "PAID") === "FREE_EMAIL" ? "Apuntarme" : <><Mail className="h-4 w-4" /> Quiero ir</>}
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
            {/* Tarjetas verticales: en el ordenador caben tres juntas; si hay más (o en el móvil), carrusel. */}
            <CodesCarousel>
              {codes.map((c) => (
                <div key={c.id} className="w-[72%] shrink-0 snap-start sm:w-[45%] md:w-[calc((100%-1.5rem)/3)]">
                  <DiscountCodeCard code={c} trackCreatorId={trackId} />
                </div>
              ))}
            </CodesCarousel>
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
            <TestimonialsRotator items={config.testimonials} />
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
        // Ya no se pinta: el formulario sale debajo de «Hablemos» y en el pie.
        if (!personal || !newsletterSection) return null;
        return (
          <section key={key} id="newsletter" className="mt-16" {...reveal}>
            <NewsletterSignup
              variant="section"
              title={sectionTitle(config, key)}
              text={config.newsletter?.text ?? NEWSLETTER_FORM_DEFAULTS.text}
              button={config.newsletter?.button ?? NEWSLETTER_FORM_DEFAULTS.button}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(username, "privacidad")} opensPortal={personal}
              preview={preview}
            />
          </section>
        );
      case "contact": {
        // Solo el email (sin WhatsApp) y, en la web personal, debajo el formulario de la newsletter.
        const c = config.contact;
        if (!c.email) return null;
        return (
          <section key={key} className="mt-16" {...reveal}>
            <div className="cp-card p-7 text-center sm:p-9">
              <p className="cp-eyebrow">{sectionTitle(config, key)}</p>
              <p className="cp-display mx-auto mt-3 max-w-md text-[1.7rem]">{c.message || "¿Tienes alguna pregunta? Escríbeme."}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <a href={`mailto:${c.email}`} className="cp-btn-ghost">
                  <Mail className="h-4 w-4" /> Email
                </a>
              </div>
              {contactNewsletter && (
                <div className="mx-auto mt-7 flex max-w-md justify-center border-t pt-6" style={{ borderColor: "var(--c-line)" }}>
                  <NewsletterSignup
                    variant="footer"
                    title={sectionTitle(config, "newsletter")}
                    button={config.newsletter?.button ?? NEWSLETTER_FORM_DEFAULTS.button}
                    creatorName={config.displayName}
                    privacyHref={creatorLegalHref(username, "privacidad")} opensPortal={personal}
                    preview={preview}
                  />
                </div>
              )}
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
    <div className="cp cp-luxe" style={themeStyle(theme)} data-card={theme.card} data-template={config.template}>
      <TemplateDecor decor={theme.decor} contained={!!preview}>
        {theme.backgroundImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
      </TemplateDecor>

      {/* Barra superior discreta: solo la entrada al área (sin el @usuario) */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-end px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <AccountEntry username={username} personal={personal} variant="pill" />
      </div>

      {/* Portada */}
      {config.coverUrl ? (
        // Portada baja: la presentación empieza arriba del todo (la foto asoma detrás de la cara).
        <div className="relative h-[14vh] min-h-[112px] w-full overflow-hidden sm:h-[18vh] sm:min-h-[150px]">
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
        <div className="h-14 sm:h-16" />
      )}

      <main className="relative mx-auto w-full max-w-[44rem] px-5 pb-16">
        {/* Presentación */}
        <header className={`flex flex-col items-center text-center ${config.coverUrl ? "-mt-14 sm:-mt-20" : "pt-2 sm:pt-4"}`}>
          <div className="rounded-full p-[3px]" style={{ background: "linear-gradient(135deg, var(--c-gold), var(--c-accent))" }}>
            <div className="rounded-full p-[3px]" style={{ background: "var(--c-bg)" }}>
              <Avatar src={config.avatarUrl} name={config.displayName} className="h-24 w-24 sm:h-32 sm:w-32" />
            </div>
          </div>
          <h1 className="cp-display mt-4 text-[2.6rem] sm:mt-5 sm:text-[3.2rem]">{config.displayName}</h1>
          {config.tagline && <p className="cp-eyebrow mt-3">{config.tagline}</p>}
          {config.headline && (
            <p className="cp-display mt-4 max-w-lg text-[1.65rem] italic leading-tight sm:mt-6 sm:text-[2rem]" style={{ color: "var(--c-gold)" }}>
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
          {personal && config.newsletter?.footer && !newsletterSection && !contactNewsletter && (
            <NewsletterSignup
              variant="footer"
              button={config.newsletter.button}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(username, "privacidad")} opensPortal={personal}
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
      : requestCta(p.type, p.ctaLabel);
  const productHref = `/${username}/${p.slug}`;
  const topics = p.type === "COURSE" || p.type === "DIGITAL" ? productTopics(p) : [];
  const event = trackCreatorId ? { creatorId: trackCreatorId, type: "PRODUCT_CLICK" as const, productId: p.id } : null;
  // Gratis: «Gratis». Pago fuera: el precio (informativo, si lo hay) y dónde se paga. Pago aquí: el precio.
  const price = free ? "Gratis" : external && p.priceCents <= 0 ? null : formatPrice(p.sale ? p.sale.priceCents : p.priceCents, p.currency, p.billingInterval);
  const priceNote = external ? (p.externalHost ? `Pago en ${p.externalHost}` : "Pago en otra web") : null;
  return (
    <article className="cp-card cp-card-hover group flex h-full flex-col">
      <Link href={productHref} className="cp-photo-bubble cp-photo-in relative block aspect-[4/3]">
        <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} sizes="(min-width: 768px) 360px, 85vw" />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "color-mix(in oklab, var(--c-bg) 72%, transparent)", color: "var(--c-text)", backdropFilter: "blur(10px)" }}
        >
          {/* Un curso con tema lleva el icono de su tema (o sus temas) en dorado; si no, su emoji. */}
          {topics.length ? <CategoryIcons categories={topics} size={1.05} className="cp-gold" gap={0.1} /> : p.emoji && <span aria-hidden>{p.emoji}</span>}
          {p.type === "DIGITAL" ? readingLabel(p) : TYPE_EYEBROW[p.type as ProductType]}
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
            <TrackedLink href={free ? productHref : `${productHref}/solicitar`} event={event} className="cp-btn shrink-0" ariaLabel={`${cta}: ${p.title}`}>
              {free ? (
                <>
                  {cta}
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {cta === requestCta(p.type, null) ? "Escríbeme" : cta}
                </>
              )}
            </TrackedLink>
          )}
        </div>
      </div>
    </article>
  );
}

/** Curso en pequeño (sección «Cursos» de la portada): la imagen, el título y el precio; toda la tarjeta lleva a su ficha. */
function CourseMiniCard({ p, username }: { p: PublicProduct; username: string }) {
  const mode = p.accessMode ?? "PAID";
  const topics = courseCategoriesOf(p.courseCategory);
  const external = mode === "EXTERNAL" && !!p.externalUrl;
  const price = mode === "FREE_EMAIL" ? "Gratis" : external && p.priceCents <= 0 ? null : formatPrice(p.sale ? p.sale.priceCents : p.priceCents, p.currency, p.billingInterval);
  return (
    <Link href={`/${username}/${p.slug}`} className="cp-card cp-card-hover group flex h-full flex-col overflow-hidden" data-course-mini={p.slug}>
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
          {external && p.externalHost && <span className="cp-faint block text-[0.68rem] font-normal">Pago en {p.externalHost}</span>}
        </span>
      </span>
    </Link>
  );
}

/** «Early Bird · −20 % · hasta el 10 de noviembre». */
function saleTag(sale: NonNullable<PublicProduct["sale"]>) {
  // Sin repetir la rebaja si la etiqueta ya la dice («1.er mes −50 %»).
  return [sale.label, sale.percentOff && !sale.label?.includes("%") ? `−${sale.percentOff} %` : null, sale.endsLabel].filter(Boolean).join(" · ");
}

/** Tarjeta de la sección «Ofertas»: la etiqueta, el título y el precio de antes tachado. */
export function OfferCard({ p, username }: { p: PublicProduct; username: string }) {
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

/**
 * Tonos de «Lecturas, sesiones y círculos», sacados de los colores del tema para que valgan en
 * cualquier plantilla: la lectura en dorado, la sesión en el color de acento y los círculos en un
 * gris luna.
 */
type Tone = { box: CSSProperties; ink: string };
const tone = (color: string, amount: number): Tone => ({
  box: {
    background: `color-mix(in oklab, ${color} ${amount}%, var(--c-surface))`,
    borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
  },
  ink: color,
});
const TONE_READING = tone("var(--c-gold)", 14);
const TONE_SESSION = tone("var(--c-accent)", 22);
const TONE_CIRCLES = tone("color-mix(in oklab, var(--c-text) 70%, var(--c-accent))", 10);


function isExternal(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="cp-section-heading">
      <span className="cp-section-star" aria-hidden>
        ✦
      </span>
      <h2 className="cp-display cp-thin text-[2.2rem] leading-tight sm:text-[2.6rem]">{title}</h2>
      <div aria-hidden className="cp-section-rule">
        <span />
        <i>✦</i>
        <span />
      </div>
      {count != null && count > 1 && <span className="cp-faint mt-2 block text-[0.68rem] uppercase tracking-[0.3em] tabular-nums md:hidden">{count} · desliza</span>}
    </div>
  );
}
