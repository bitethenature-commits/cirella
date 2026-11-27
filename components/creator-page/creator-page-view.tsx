import { productPath } from "@/lib/public-paths";
import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { CanvaPart, HomeEdit, TextEdit } from "./home-edit";
import { siteText, type SiteTextKey, type TextVars } from "@/lib/site-texts";
import { ArrowRight, ArrowUpRight, ExternalLink, FileText, Gift, Mail, Moon, Plus, Video } from "lucide-react";
import { productTopics, readingLabel } from "@/lib/course-categories";
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
import {
  NEWSLETTER_FORM_DEFAULTS,
  socialList,
  safeHref,
  sectionTitle,
  socialHref,
  visibleTextBlocks,
  homeLayout,
  type PageConfig,
  type SectionKey,
} from "@/lib/page-config";
import { designFor, READINGS_DEFAULTS } from "@/lib/page-config";
import type { PublicPortalItem } from "@/lib/portal-rules";
import type { GiftsPreview } from "@/lib/site-pages";
import { giftPath, sectionPagePath } from "@/lib/site-sections";
import { MoreRows } from "./more-rows";
import { LanguageSwitch } from "./language-switch";
import { Tr } from "@/lib/i18n/client";
import { resolveTheme, themeAttrs, themeStyle } from "@/lib/templates";
import { DesignBackdrop } from "@/components/design-backdrop";
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
import { PieceStyles } from "./piece-styles";
import { ShowMore } from "@/components/ui/show-more";
import { SectionFolds, type Fold } from "./section-dropdown";
import { DesignScope } from "./design-scope";
import { visibleBlocks } from "@/lib/page-blocks";
import { TestimonialsRotator } from "./testimonials-rotator";
import { OracleCard } from "./oracle-card";
import { CourseMiniCard } from "./course-mini-card";
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

/** Cursos que salen en la portada (los demás, en su página «/courses»). */
const HOME_COURSES = 3;

/** Secciones plegables seguidas («Actualidades», «Portal», «Ofertas»): juntas, como una lista de filas. */
/** Los desplegables de la portada: van todos juntos en una fila (components/creator-page/section-dropdown.tsx). */
const FOLD_KEYS: ReadonlySet<SectionKey> = new Set(["posts", "portal", "offers", "gifts"]);

/** En el Canva, lo que dice una sección vacía (en la web no sale). */
const EMPTY_NOTE: Partial<Record<SectionKey, string>> = {
  bubbles: "Aún no hay accesos: toca aquí para añadir el primero.",
  systems: "Aún no hay sistemas: toca aquí para añadir el primero.",
  readings: "Aún no hay tarjetas: toca aquí para ponerlas.",
  codes: "Aún no hay códigos: toca aquí para añadir el primero.",
  testimonials: "Aún no hay testimonios: toca aquí para añadir el primero.",
  faq: "Aún no hay preguntas: toca aquí para añadir la primera.",
  contact: "Falta tu email de contacto: toca aquí para ponerlo.",
  about: "Aún no tiene título: toca aquí para escribirlo.",
  products: "Sale sola cuando publiques uno.",
  sessions: "Sale sola cuando publiques una.",
  courses: "Sale sola cuando publiques uno.",
  memberships: "Sale sola cuando publiques una.",
};
/** Las secciones vacías que se rellenan en su ventanita (al tocarlas, se abre). */
const EMPTY_PART: Partial<Record<SectionKey, CanvaPart>> = { bubbles: "bubbles", systems: "systems", readings: "readings", codes: "codes", testimonials: "testimonials", faq: "faq", contact: "contact", about: "about" };
/** Las que llevan título en la web. */
const HEADED = new Set<SectionKey>(["systems", "readings", "codes", "testimonials", "faq", "products", "sessions", "courses", "memberships"]);
/** Lo que dice cada desplegable vacío en el Canva. */
const EMPTY_FOLD: Record<string, { id: string; note: string }> = {
  posts: { id: "actualidades", note: "Aún no hay novedades: salen solas cuando publicas algo nuevo." },
  portal: { id: "portal", note: "Aún no hay noticias en el portal." },
  offers: { id: "ofertas", note: "No hay ofertas ahora: sale sola cuando pones algo en oferta." },
  gifts: { id: "gifts", note: "Aún no hay gifts: se añaden en su página (Mis páginas › Gifts)." },
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
  /** Modo Canva (app/panel/canva): se escribe encima de la página (home-edit.ts). */
  edit?: HomeEdit;
};

export function CreatorPageView(props: Props) {
  const { config, username, preview, personal, signupsOnly, edit } = props;
  /** Un texto de la página: en el Canva, escrito encima; si no, tal cual. */
  const T = (path: string, value: string, o?: Parameters<HomeEdit["text"]>[2]): ReactNode => (edit ? edit.text(path, value, o) : value);
  /** El título de una sección (en el Canva, editable). */
  const ST = (key: SectionKey) => T(`section:${key}`, sectionTitle(config, key), { placeholder: "Título de la sección" });
  /** El botón para cambiar un enlace (solo en el Canva). */
  const L = (path: string, url: string) => (edit ? <span className="relative z-10 mt-1.5 inline-flex">{edit.link(path, url)}</span> : null);
  /** Un texto fijo de la web (lib/site-texts.ts): en el Canva se escribe encima y cambia en toda la web. */
  const TX = (key: SiteTextKey, vars?: TextVars): ReactNode => {
    const v = siteText(config.texts, key, vars);
    return edit ? edit.text(`text:${key}`, v, { vars }) : v;
  };
  /**
   * «3 novedades este mes»: el número lo pone la web (cuenta lo que hay) y no se cambia; en el Canva se escribe
   * encima solo del texto de alrededor.
   */
  const TXn = (key: SiteTextKey, n: number): ReactNode => {
    const tpl = siteText(config.texts, key); // con su {n}
    const at = tpl.indexOf("{n}");
    if (!edit || at < 0) return TX(key, { n });
    const before = tpl.slice(0, at);
    const after = tpl.slice(at + "{n}".length);
    // Los espacios de los bordes, fuera de lo que se escribe (si no, se perderían).
    const piece = (text: string, join: (v: string) => string) => {
      const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
      if (!body) return text;
      return (
        <>
          <Tr s={lead} />
          {edit.text(`text:${key}`, body, { commit: (v) => (v ? join(lead + v + trail) : "") })}
          <Tr s={trail} />
        </>
      );
    };
    return (
      <>
        {piece(before, (v) => v + "{n}" + after)}
        {n}
        {piece(after, (v) => before + "{n}" + v)}
      </>
    );
  };
  /** El texto del botón de la newsletter («Apuntarme»): en el Canva, escrito encima. */
  const NB = edit ? T("newsletter.button", config.newsletter?.button || NEWSLETTER_FORM_DEFAULTS.button, { placeholder: NEWSLETTER_FORM_DEFAULTS.button }) : undefined;
  /** Lo mismo para las piezas que van en todas las páginas (newsletter, entrar, pie). */
  const TE: TextEdit | undefined = edit ? (key, value, vars) => edit.text(`text:${key}`, value, { vars }) : undefined;
  /** Una parte que en el Canva se cambia en su ventanita al pulsarla (redes, botones, testimonios, códigos, el pie…). */
  const P = (part: CanvaPart, node: ReactNode): ReactNode => (edit ? edit.part(part, node) : node);
  // Lo de pago se ve siempre: se solicita por formulario (lib/requests.ts).
  const products = props.products;
  // Ni un botón hacia lo que no se ve: en la web personal sin cobros, un enlace a un producto oculto daría 404.
  const hiddenSlugs = new Set<string>();
  const links = config.links.filter((l) => !linksToProduct(l.url, username, hiddenSlugs, props.siteOrigin));
  const codes = props.discountCodes ?? [];
  // El diseño de la web con los cambios de la portada encima (Panel › Mi página › Diseño).
  const theme = resolveTheme(null, designFor(config, "home"), props.allowCustom);
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
        // Se ven las tres últimas y «Ver más» abre el resto aquí mismo (no hay página de actualidades). El número
        // cuenta solo lo reciente (30 días).
        const since = Date.now() - 30 * 86_400_000;
        const recent = all.filter((n) => Date.parse(n.at) >= since);
        if (!all.length) return null;
        return {
          id: "actualidades",
          section: "posts",
          title: ST(key),
          countLabel: recent.length === 0 ? TX("news.last") : TXn(recent.length === 1 ? "news.count1" : "news.countN", recent.length),
          stamps: recent.map((n) => Date.parse(n.at)),
          icon: <MegaphoneIcon className={icon} />,
          content: (
            <MoreRows
                first={3}
                moreLabel={TX("news.all")}
                fallbackImage={fallbackImage}
                rows={all.map((n) => ({
                  key: n.key,
                  href: n.href,
                  image: n.image,
                  icon: <MegaphoneIcon className="h-7 w-7 opacity-80" />,
                  eyebrow: (
                    <>
                      <span>{n.dateLabel}</span>
                      <span>· <Tr s={n.label} /></span>
                    </>
                  ),
                  title: n.title,
                  text: n.text,
                }))}
              />
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
          title: ST(key),
          countLabel: TXn(n === 1 ? "portal.count1" : "portal.countN", n),
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
          title: ST(key),
          countLabel: TXn(onSale.length === 1 ? "offers.count1" : "offers.countN", onSale.length),
          stamps: onSale.map((p) => Date.parse(p.sale!.startedAt)),
          icon: <PercentIcon className={icon} />,
          content: (
            // La primera y «Ver más» abre las demás aquí mismo (no hay página de ofertas).
            <MoreRows first={1} moreLabel={TX("offers.more")} fallbackImage={fallbackImage} rows={onSale.map((p) => offerRow(p, username))} />
          ),
        };
      }
      case "gifts": {
        // «Gifts»: lo que hace para regalar (calendarios, manualidades…), de su página (Páginas → Gifts).
        const g = props.gifts;
        if (!g?.items.length) return null;
        return {
          id: "gifts",
          title: ST(key),
          countLabel: TXn(g.total === 1 ? "gifts.count1" : "gifts.countN", g.total),
          stamps: [],
          icon: <Gift className={icon} strokeWidth={1.15} />,
          content: (
            <>
              {g.subtitle && <p className="cp-muted mb-3 text-[0.92rem]"><Tr s={g.subtitle} /></p>}
              {/* Los tres primeros y «Ver más» abre los demás aquí mismo; cada regalo abre su página. */}
              <MoreRows
                first={3}
                moreLabel={TX("gifts.all")}
                fallbackImage={fallbackImage}
                rows={g.items.map((it, n) => ({
                  key: `gift-${n}`,
                  // Cada regalo abre su página (/gifts/<regalo>).
                  href: giftPath(username, it.slug, !!personal),
                  image: it.image,
                  icon: <Gift className="h-7 w-7 opacity-80" strokeWidth={1.3} />,
                  eyebrow: <span>{TX("gifts.eyebrow")}</span>,
                  title: it.title,
                  text: it.text,
                }))}
              />
            </>
          ),
        };
      }
      default:
        return null;
    }
  };
  /** Canva: un desplegable que ahora no tiene nada (sale igual, más tenue, con lo que falta). */
  const emptyFold = (key: SectionKey): Fold => {
    const icon = "h-10 w-10";
    const e = EMPTY_FOLD[key] ?? { id: key, note: "" };
    return {
      id: e.id,
      title: ST(key),
      countLabel: "Vacío",
      stamps: [],
      icon:
        key === "posts" ? <MegaphoneIcon className={icon} /> : key === "portal" ? <PortalNoteIcon className={icon} /> : key === "offers" ? <PercentIcon className={icon} /> : <Gift className={icon} strokeWidth={1.15} />,
      content: <p className="cp-muted text-[0.92rem]"><Tr s={e.note} /></p>,
    };
  };
  /** Los desplegables, en su orden, y dónde van juntos: donde está el primero que se ve (si no hay, el primero). */
  const foldList = config.sections.filter((s) => FOLD_KEYS.has(s.key) && !s.removed);
  const foldAnchor = (foldList.find((s) => s.enabled) ?? foldList[0])?.key;
  /** Canva: una sección vacía (en la web no sale), con su título y lo que le falta. Al tocarla se abre su ventanita. */
  const emptySection = (key: SectionKey): ReactNode => {
    const box = (
      <section key={key} className="mt-14">
        {HEADED.has(key) && <SectionHeading title={ST(key)} />}
        <div className="cp-muted mt-5 rounded-2xl border border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--c-line)" }}>
          {EMPTY_NOTE[key] ?? <Tr s={"Aún no hay nada que enseñar aquí."} />}
        </div>
      </section>
    );
    const part = EMPTY_PART[key];
    return part ? P(part, box) : box;
  };
  /** Canva: las que se pintan para escribirlas aunque en la web no salgan (sin título o sin bloques). */
  const emptyAnyway = (key: SectionKey) => (key === "about" ? !config.about?.title : key === "blocks" ? !visibleTextBlocks(config).length : key === "links" ? !links.length : false);
  /** Una sección con su diseño propio (su «Diseño» en Mi página), encima del de la portada. */
  const scoped = (key: string, node: ReactNode): ReactNode =>
    node ? (
      <DesignScope base={theme.design} design={config.sectionThemes?.[key]} allowCustom={props.allowCustom}>
        {node}
      </DesignScope>
    ) : (
      node
    );
  /** La cabecera (nombre, foto, frase, redes): con su diseño propio y, en el Canva, su botón «Diseño». */
  const H = (node: ReactNode): ReactNode => {
    const s = scoped("header", node);
    return edit ? edit.header(s) : s;
  };

  const renderSection = (key: SectionKey) => {
    const type = SECTION_TYPE[key];
    if (type) {
      const items = products.filter((p) => p.type === type);
      if (!items.length) return null;
      // Cursos: con más de uno, su página propia los agrupa por método (/courses).
      const more =
        key === "courses" && courseCount > 1 ? (
          <Link href={path("cursos")} className="cp-btn-ghost mt-5 w-full">
            {TX("courses.all")} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null;
      // Cursos: tres tarjetas pequeñas como mucho (dos por fila en el móvil, tres en el ordenador); el resto, en «Ver todos».
      if (key === "courses" && items.length > 1)
        return (
          <section key={key} id="cursos" className="mt-14" {...reveal}>
            <SectionHeading title={ST(key)} />
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
          <SectionHeading title={ST(key)} count={items.length} />
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
      case "blocks":
        // Ya no es una sección: cada bloque va en su sitio entre las secciones (homeLayout, abajo).
        return null;
      case "bubbles": {
        const bubbles = (config.bubbles ?? []).filter((b) => !linksToProduct(b.url, username, hiddenSlugs, props.siteOrigin));
        if (!bubbles.length) return null;
        return P(
          "bubbles",
          <nav key={key} aria-label="Accesos" className="mt-12 grid gap-3" style={{ gridTemplateColumns: `repeat(${bubbles.length}, minmax(0, 1fr))` }} {...reveal}>
            {bubbles.map((b) => {
              const img = b.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image} srcSet={imageSrcSet(b.image)} sizes="104px" alt="" loading="lazy" decoding="async" className="cp-bubble-img transition duration-300 group-hover:-translate-y-0.5" />
              ) : (
                <span className="cp-bubble-img grid place-items-center" aria-hidden>
                  <span className="cp-display grid h-full w-full place-items-center rounded-full text-[1.8rem]" style={{ background: "var(--c-surface)" }}>
                    {b.label.trim().charAt(0).toUpperCase()}
                  </span>
                </span>
              );
              const a = (
                <a key={b.id} href={safeHref(b.url)} className="group flex flex-col items-center gap-2.5 text-center" {...(isExternal(b.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {edit ? edit.image(`bubble:${b.id}:image`, img, { round: true }) : img}
                  <span className="text-[0.9rem] font-semibold leading-tight">{T(`bubble:${b.id}:label`, b.label, { placeholder: "Nombre" })}</span>
                </a>
              );
              return edit ? (
                <Fragment key={b.id}>
                  {edit.item(
                    "bubbles",
                    b.id,
                    bubbles.map((x) => x.id),
                    <div className="flex flex-col items-center">
                      {a}
                      {L(`bubble:${b.id}:url`, b.url)}
                    </div>,
                    "x",
                  )}
                </Fragment>
              ) : (
                a
              );
            })}
          </nav>,
        );
      }
      case "posts":
      case "portal":
      case "offers":
      case "gifts": {
        // Los cuatro desplegables van juntos en una fila (como «Sistemas»), donde está el primero de ellos.
        if (key !== foldAnchor) return null;
        if (edit) {
          // En el Canva salen todos: los ocultos y los que ahora no tienen nada, más tenues.
          const all = foldList.filter((s) => personal || s.key !== "portal");
          const ids = all.map((s) => s.key);
          const list = all.map((s) => {
            const f = foldFor(s.key);
            return { f: f ?? emptyFold(s.key), hidden: !s.enabled, empty: !f };
          });
          return (
            <section key="desplegables" id="desplegables" className="mt-14">
              <SectionFolds
                folds={list.map((x) => x.f)}
                username={username}
                preview={preview}
                editing
                wrap={(i, node) => edit.item("folds", ids[i], ids, node, "x", { hidden: list[i].hidden, empty: list[i].empty })}
              />
            </section>
          );
        }
        const shown = foldList.filter((s) => s.enabled).flatMap((s) => {
          const f = foldFor(s.key);
          return f ? [f] : [];
        });
        if (!shown.length) return null;
        return (
          <section key="desplegables" id="desplegables" className="mt-14" {...reveal}>
            <SectionFolds folds={shown} username={username} preview={preview} />
          </section>
        );
      }
      case "about": {
        const a = config.about;
        if (!a || (!a.title && !edit)) return null;
        const href = a.url || path("actualidades");
        // La forma y el marco, en Diseño › Fotos; el tamaño y el lado, en la tarjeta.
        const size = ABOUT_PHOTO[a.imageSize ?? "tall"];
        // Su ancho va en lo de fuera: en el Canva, la caja de «Cambiar foto» (si no, la foto se queda sin ancho).
        // En el móvil también al lado del texto (más estrecha), como en el ordenador.
        const place = `shrink-0 ${size.width}`;
        const frame = `cp-luxe-frame relative block shrink-0 ${size.aspect} ${size.width}`;
        return P(
          "about",
          <section key={key} id="sobre-mi" className="mt-16" {...reveal}>
            {/* Sin caja: solo la imagen lleva las esquinas redondeadas. */}
            <a href={safeHref(href)} className={`group flex items-center gap-4 sm:gap-8 ${a.imageSide === "left" ? "flex-row" : "flex-row-reverse"}`} {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {edit
                ? edit.image(
                    "about.image",
                    <span className={`cp-luxe-frame relative block w-full ${size.aspect}`}>
                      {a.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image} srcSet={imageSrcSet(a.image)} sizes="(min-width: 640px) 290px, 40vw" alt="" className="cp-img absolute inset-0 h-full w-full object-cover" />
                      )}
                    </span>,
                    { removable: true, className: place },
                  )
                : a.image && (
                <span className={frame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.image} srcSet={imageSrcSet(a.image)} sizes="(min-width: 640px) 290px, 40vw" alt="" loading="lazy" decoding="async" className="cp-img absolute inset-0 h-full w-full object-cover group-hover:scale-[1.035]" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 sm:gap-2">
                {(a.eyebrow || edit) && <span className="cp-eyebrow">{T("about.eyebrow", a.eyebrow ?? "", { placeholder: "Antetítulo" })}</span>}
                <span className="cp-display text-[1.6rem] leading-[1.05] sm:text-[2.3rem]">{T("about.title", a.title, { placeholder: "Título" })}</span>
                {(a.text || edit) && <span className="cp-muted text-[0.85rem] leading-relaxed sm:text-[0.95rem]">{T("about.text", a.text ?? "", { multiline: true, placeholder: "Texto" })}</span>}
                <span className="cp-gold mt-1 inline-flex items-center gap-1 text-[0.8rem] font-semibold sm:text-sm">
                  {T("about.linkLabel", a.linkLabel || "Conoce mi historia")} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </a>
            {L("about.url", a.url ?? "")}
          </section>,
        );
      }
      case "systems": {
        const systems = config.systems ?? [];
        if (!systems.length) return null;
        return P(
          "systems",
          <section key={key} id="sistemas" className="mt-16" {...reveal}>
            <SectionHeading title={ST(key)} />
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
                    <span className="cp-display text-[1.15rem] leading-tight">{T(`system:${sys.id}:title`, sys.title, { placeholder: "Nombre" })}</span>
                  </>
                );
                if (edit)
                  return (
                    <Fragment key={sys.id}>
                      {edit.item(
                        "systems",
                        sys.id,
                        systems.map((s) => s.id),
                        <div className="flex flex-col items-center gap-2 text-center">
                          {inner}
                          {L(`system:${sys.id}:url`, sys.url)}
                        </div>,
                        "x",
                      )}
                    </Fragment>
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
          </section>,
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
        return P(
          "readings",
          <section key={key} id="lecturas" className="mt-16" {...reveal}>
            <SectionHeading title={ST(key)} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {cards.map(({ c, d, href, Icon, tone }, ci) => (
                <Link key={href} href={href} className="cp-card cp-card-hover flex flex-col gap-2 p-6" style={tone.box}>
                  <Icon className="h-8 w-8" strokeWidth={1.5} style={{ color: tone.ink }} aria-hidden />
                  <span className="cp-eyebrow">{T(`readings.${ci === 0 ? "session" : "reading"}.eyebrow`, c.eyebrow || d.eyebrow)}</span>
                  <span className="cp-display text-[1.7rem] leading-tight">{T(`readings.${ci === 0 ? "session" : "reading"}.title`, c.title || d.title)}</span>
                  <span className="cp-muted text-[0.9rem] leading-relaxed">{T(`readings.${ci === 0 ? "session" : "reading"}.text`, c.text || d.text, { multiline: true })}</span>
                  <span className="cp-gold mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold">
                    {TX("readings.steps")} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
            {circles.length > 0 && (
              <div className="cp-card mt-4 p-5 sm:p-6" data-moon-circles style={TONE_CIRCLES.box}>
                <p className="cp-eyebrow flex items-center gap-1.5">
                  <Moon className="h-4 w-4" style={{ color: TONE_CIRCLES.ink }} /> {T("readings.circlesTitle", r.circlesTitle || READINGS_DEFAULTS.circlesTitle)}
                </p>
                <ul className="mt-3 divide-y" style={{ borderColor: "var(--c-line)" }}>
                  {circles.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3" style={{ borderColor: "var(--c-line)" }}>
                      <span className="min-w-0">
                        <Link href={`${productPath(username, c)}`} className="block font-semibold underline-offset-4 hover:underline">
                          {c.title}
                        </Link>
                        <span className="cp-muted block text-[0.82rem]"><Tr s={c.eventLabel} /></span>
                        {c.sale && <span className="cp-gold block text-[0.78rem]">{formatPrice(c.sale.priceCents, c.currency)}{" "}<Tr s={"· antes"} />{" "}{formatPrice(c.sale.regularCents, c.currency)}</span>}
                      </span>
                      <TrackedLink
                        href={(c.accessMode ?? "PAID") === "FREE_EMAIL" ? `${productPath(username, c)}` : `${productPath(username, c, "request")}`}
                        event={trackId ? { creatorId: trackId, type: "PRODUCT_CLICK" as const, productId: c.id } : null}
                        className="cp-btn shrink-0 !min-h-[2.5rem] !text-[0.85rem]"
                        ariaLabel={`${(c.accessMode ?? "PAID") === "FREE_EMAIL" ? siteText(config.texts, "circles.free") : siteText(config.texts, "circles.paid")}: ${c.title}`}
                      >
                        {(c.accessMode ?? "PAID") === "FREE_EMAIL" ? TX("circles.free") : <><Mail className="h-4 w-4" /> {TX("circles.paid")}</>}
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>,
        );
      }
      case "codes": {
        if (!codes.length) return null;
        return P(
          "codes",
          <section key={key} id="codigos" className="mt-16" {...reveal}>
            <SectionHeading title={ST(key)} count={codes.length} />
            {/* Tarjetas verticales: en el ordenador caben tres juntas; si hay más (o en el móvil), carrusel. */}
            <CodesCarousel>
              {codes.map((c) => (
                <div key={c.id} className="w-[72%] shrink-0 snap-start sm:w-[45%] md:w-[calc((100%-1.5rem)/3)]">
                  {edit
                    ? edit.item(
                        "codes",
                        c.id,
                        codes.map((x) => x.id),
                        P(`code:${c.id}`, <DiscountCodeCard code={c} trackCreatorId={trackId} />),
                        "x",
                      )
                    : P(`code:${c.id}`, <DiscountCodeCard code={c} trackCreatorId={trackId} />)}
                </div>
              ))}
            </CodesCarousel>
          </section>,
        );
      }
      case "links":
        if (!links.length)
          // Canva: un botón de muestra, tenue, para poner el primero.
          return edit
            ? P(
                "links",
                <section key={key} className="mt-9 space-y-3">
                  <span className="cp-link" style={{ borderStyle: "dashed" }}>
                    <span><Tr s={"Añade tu primer botón"} /></span>
                    <Plus className="h-4 w-4 shrink-0 opacity-70" />
                  </span>
                </section>,
              )
            : null;
        return P(
          "links",
          <section key={key} className="mt-9 space-y-3" {...reveal}>
            {links.map((l) => {
              const a = (
                <a key={l.id} href={safeHref(l.url)} className={`cp-link ${edit ? "min-w-0 flex-1" : ""}`} data-highlight={l.highlight ? "true" : "false"} {...(l.url.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
                  <span>{T(`link:${l.id}:label`, l.label, { placeholder: "Texto del botón" })}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />
                </a>
              );
              return edit ? (
                <div key={l.id} className="flex items-center gap-2">
                  {a}
                  {edit.link(`link:${l.id}:url`, l.url)}
                </div>
              ) : (
                a
              );
            })}
          </section>,
        );
      case "testimonials":
        if (!config.testimonials.length) return null;
        return P(
          "testimonials",
          <section key={key} className="mt-16" {...reveal}>
            <SectionHeading title={ST(key)} />
            {/* En el Canva, todos uno debajo de otro para escribirlos y ordenarlos; en la web, van pasando uno a uno. */}
            {edit ? (
              <div className="mt-6 space-y-8">
                {config.testimonials.map((t) => (
                  <Fragment key={t.id}>
                    {edit.item(
                      "testimonials",
                      t.id,
                      config.testimonials.map((x) => x.id),
                      <figure className="mx-auto max-w-xl text-center">
                        <blockquote className="cp-display text-[1.45rem] leading-snug sm:text-[1.7rem]">
                          “{T(`testimonial:${t.id}:quote`, t.quote, { multiline: true, placeholder: "Lo que dijo" })}”
                        </blockquote>
                        <figcaption className="mt-3 text-sm">
                          <span className="font-semibold">{T(`testimonial:${t.id}:author`, t.author, { placeholder: "Nombre" })}</span>
                          <span className="cp-muted"> · {T(`testimonial:${t.id}:role`, t.role ?? "", { placeholder: "Quién es (opcional)" })}</span>
                        </figcaption>
                      </figure>,
                      "y",
                    )}
                  </Fragment>
                ))}
              </div>
            ) : (
              <TestimonialsRotator items={config.testimonials} />
            )}
          </section>,
        );
      case "faq":
        if (!config.faqs.length) return null;
        return P(
          "faq",
          <section key={key} className="mt-16" {...reveal}>
            <SectionHeading title={ST(key)} />
            {/* En el Canva, todas para escribirlas; en la web, las 3 primeras y «Ver más» para abrirlas todas. */}
            {edit ? (
            <div className="mt-4 divide-y" style={{ borderColor: "var(--c-line)" }}>
              {config.faqs.map((f) => (
                <Fragment key={f.id}>
                  {edit.item(
                    "faq",
                    f.id,
                    config.faqs.map((x) => x.id),
                    <div className="py-3" style={{ borderColor: "var(--c-line)" }}>
                      <p className="py-1 text-[0.98rem] font-medium">{T(`faq:${f.id}:q`, f.q, { placeholder: "Pregunta" })}</p>
                      <p className="cp-muted pb-2 pr-8 text-[0.92rem] leading-relaxed">{T(`faq:${f.id}:a`, f.a, { multiline: true, placeholder: "Respuesta" })}</p>
                    </div>,
                    "y",
                  )}
                </Fragment>
              ))}
            </div>
            ) : (
            <ShowMore className="mt-4 divide-y" style={{ borderColor: "var(--c-line)" }} buttonClassName="cp-btn-ghost">
              {config.faqs.map((f) => (
                <details key={f.id} className="group py-1" style={{ borderColor: "var(--c-line)" }}>
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-[0.98rem] font-medium">
                    <Tr s={f.q} />
                    <Plus className="cp-faq-icon h-4 w-4 shrink-0 opacity-70" />
                  </summary>
                  <p className="cp-muted pb-5 pr-8 text-[0.92rem] leading-relaxed"><Tr s={f.a} /></p>
                </details>
              ))}
            </ShowMore>
            )}
          </section>,
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
              privacyHref={creatorLegalHref(username, "privacidad")} opensPortal={personal} texts={config.texts} editText={TE} editButton={NB}
              preview={preview}
            />
          </section>
        );
      case "contact": {
        // Solo el email (sin WhatsApp) y, en la web personal, debajo el formulario de la newsletter.
        const c = config.contact;
        if (!c.email) return null;
        return P(
          "contact",
          <section key={key} className="mt-16" {...reveal}>
            <div className="cp-card p-7 text-center sm:p-9">
              <p className="cp-eyebrow">{ST(key)}</p>
              <p className="cp-display mx-auto mt-3 max-w-md text-[1.7rem]">{T("contact.message", c.message || "¿Tienes alguna pregunta? Escríbeme.", { multiline: true })}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <a href={`mailto:${c.email}`} className="cp-btn-ghost">
                  <Mail className="h-4 w-4" /> {TX("contact.email")}
                </a>
              </div>
              {contactNewsletter && (
                <div className="mx-auto mt-7 flex max-w-md justify-center border-t pt-6" style={{ borderColor: "var(--c-line)" }}>
                  <NewsletterSignup
                    variant="footer"
                    title={T("section:newsletter", sectionTitle(config, "newsletter"), { placeholder: "Título del formulario" })}
                    button={config.newsletter?.button ?? NEWSLETTER_FORM_DEFAULTS.button}
                    creatorName={config.displayName}
                    privacyHref={creatorLegalHref(username, "privacidad")} opensPortal={personal} texts={config.texts} editText={TE} editButton={NB}
                    preview={preview}
                  />
                </div>
              )}
            </div>
          </section>,
        );
      }
      default:
        return null;
    }
  };

  const socials = socialList(config);

  return (
    <>
    {/* Las piezas sueltas de la portada (solo en la web: en el editor y el Canva la página lleva más cosas dentro). */}
    {!preview && !edit && props.allowCustom && <PieceStyles pieces={config.pieces?.home} gold={theme.colors.gold} />}
    <div className="cp cp-luxe" style={themeStyle(theme)} {...themeAttrs(theme)}>
      <DesignBackdrop theme={theme} contained={!!preview} />
      <TemplateDecor decor={theme.decor} contained={!!preview} />

      {/* Barra superior discreta: el idioma y la entrada al área (sin el @usuario). En el editor, sin el idioma. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-end gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        {!edit && !preview && <LanguageSwitch variant="pill" />}
        <AccountEntry username={username} personal={personal} variant="pill" texts={config.texts} editText={TE} />
      </div>

      {/* Portada */}
      {edit ? (
        edit.image(
          "coverUrl",
          <div className={`relative w-full overflow-hidden ${config.coverUrl ? "cp-cover h-[14vh] min-h-[112px] sm:h-[18vh] sm:min-h-[150px]" : "h-14 sm:h-16"}`}>
            {config.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.coverUrl} alt="" className="cp-cover-img h-full w-full scale-105 object-cover" />
            )}
          </div>,
          { label: config.coverUrl ? "Cambiar portada" : "Añadir portada", removable: true },
        )
      ) : config.coverUrl ? (
        // Portada baja: la presentación empieza arriba del todo (la foto asoma detrás de la cara).
        <div className="cp-cover relative h-[14vh] min-h-[112px] w-full overflow-hidden sm:h-[18vh] sm:min-h-[150px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.coverUrl}
            srcSet={imageSrcSet(config.coverUrl)}
            sizes="100vw"
            fetchPriority="high"
            decoding="async"
            alt=""
            className="cp-cover-img h-full w-full scale-105 object-cover"
          />
        </div>
      ) : (
        <div className="h-14 sm:h-16" />
      )}

      <main className="relative mx-auto w-full max-w-[44rem] px-5 pb-16">
        {/* Presentación */}
        {H(
        <header className={`flex flex-col items-center text-center ${config.coverUrl ? "-mt-14 sm:-mt-20" : "pt-2 sm:pt-4"}`}>
          <div className="rounded-full p-[3px]" style={{ background: "linear-gradient(135deg, var(--c-gold), var(--c-accent))" }}>
            <div className="rounded-full p-[3px]" style={{ background: "var(--c-bg)" }}>
              {edit ? (
                edit.image("avatarUrl", <Avatar src={config.avatarUrl} name={config.displayName} className="h-24 w-24 sm:h-32 sm:w-32" />, { round: true })
              ) : (
                <Avatar src={config.avatarUrl} name={config.displayName} className="h-24 w-24 sm:h-32 sm:w-32" />
              )}
            </div>
          </div>
          <h1 className="cp-display mt-4 text-[2.6rem] sm:mt-5 sm:text-[3.2rem]">{T("displayName", config.displayName, { placeholder: "Tu nombre" })}</h1>
          {(config.tagline || edit) && <p className="cp-eyebrow mt-3">{T("tagline", config.tagline, { placeholder: "Descripción corta" })}</p>}
          {(config.headline || edit) && (
            <p className="cp-display mt-4 max-w-lg text-[1.65rem] italic leading-tight sm:mt-6 sm:text-[2rem]" style={{ color: "var(--c-gold)" }}>
              {T("headline", config.headline, { placeholder: "Tu frase" })}
            </p>
          )}
          {(config.bio || edit) && <p className="cp-muted mt-4 max-w-md text-[0.95rem] leading-relaxed">{T("bio", config.bio, { multiline: true, placeholder: "Sobre ti" })}</p>}
          {(socials.length > 0 || !!edit) &&
            P(
              "socials",
            <div className="mt-6 flex items-center gap-2">
              {!socials.length && (
                <span className="cp-faint rounded-full border border-dashed px-3.5 py-2 text-xs" style={{ borderColor: "var(--c-line)" }}><Tr s={"+ Redes sociales"} /></span>
              )}
              {socials.map((k) => {
                const a = (
                  <a
                    key={k}
                    href={socialHref(k, config.socials[k]!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={k}
                    title={edit ? `${config.socials[k]} · toca para cambiarla` : undefined}
                    className="grid h-10 w-10 place-items-center rounded-full border transition hover:-translate-y-0.5"
                    style={{ borderColor: "var(--c-line)" }}
                  >
                    <SocialIcon name={k} className="h-[18px] w-[18px]" />
                  </a>
                );
                // Canva: con sus flechas para cambiarla de sitio; al tocarla se abren todas para cambiarlas.
                return edit ? <Fragment key={k}>{edit.item("socials", k, socials, a, "x")}</Fragment> : a;
              })}
              {edit && socials.length > 0 && (
                <span className="cp-faint grid h-10 w-10 place-items-center rounded-full border border-dashed" style={{ borderColor: "var(--c-line)" }} title="Añadir otra red">
                  <Plus className="h-4 w-4" />
                </span>
              )}
            </div>,
            )}
        </header>,
        )}

        {config.sections
          .filter((s) => s.key === "links" && !s.removed && (s.enabled || !!edit))
          .map((s) =>
            edit ? (
              <Fragment key={s.key}>{edit.section(s.key, scoped("links", renderSection(s.key)), { hidden: !s.enabled, empty: emptyAnyway(s.key) })}</Fragment>
            ) : (
              <Fragment key={s.key}>{scoped("links", renderSection(s.key))}</Fragment>
            ),
          )}

        {/* El antiguo «Destacado» ya no se pinta aparte: cada producto sale en su sección (Product.featured no hace nada aquí). */}
        {/* Las secciones y, entre ellas, sus bloques (Texto, Tarjetas, Cita…), cada uno en su sitio. */}
        {homeLayout(config).map((item) => {
          if (item.kind === "block") {
            const b = item.block;
            if (edit) return <Fragment key={`b:${b.id}`}>{edit.block(b)}</Fragment>;
            if (!visibleBlocks([b]).length) return null;
            return (
              <div key={`b:${b.id}`} className="mt-14" {...reveal}>
                <ContentBlocks
                  blocks={[b]}
                  username={username}
                  titleLevel={2}
                  hiddenSlugs={hiddenSlugs}
                  siteOrigin={props.siteOrigin}
                  oracleDecks={props.oracleDecks}
                  modelGate={personal && !preview ? { username, creatorName: config.displayName, privacyHref: creatorLegalHref(username, "privacidad") } : null}
                  moonCircles={nextMoonCircles(products)}
                  designBase={props.allowCustom ? theme.design : undefined}
                />
              </div>
            );
          }
          const key = item.key;
          const s = config.sections.find((x) => x.key === key)!;
          const fold = FOLD_KEYS.has(key);
          // Los desplegables van juntos donde está el primero; su diseño, el del grupo («folds»).
          if (fold && key !== foldAnchor) return null;
          const scope = fold ? "folds" : key;
          if (!edit) return s.enabled ? <Fragment key={key}>{scoped(scope, renderSection(key))}</Fragment> : null;
          // En el Canva, todas en su sitio: las ocultas y las vacías también (más tenues).
          if (key === "newsletter") return null;
          const node = renderSection(key);
          return (
            <Fragment key={key}>
              {edit.section(key, scoped(scope, node ?? emptySection(key)), { hidden: !fold && !s.enabled, empty: !fold && (node == null || emptyAnyway(key)) })}
            </Fragment>
          );
        })}

        {edit?.footer}

        {P(
          "footer",
        <footer className="mt-20 flex flex-col items-center gap-4 text-center text-xs">
          {personal && config.newsletter?.footer && !newsletterSection && !contactNewsletter && (
            <NewsletterSignup
              variant="footer"
              button={config.newsletter.button}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(username, "privacidad")} opensPortal={personal} texts={config.texts} editText={TE} editButton={NB}
              preview={preview}
            />
          )}
          <SiteNav pages={props.pages} />
          <AccountEntry username={username} personal={personal} variant="footer" texts={config.texts} editText={TE} />
          <LegalLinks username={username} sellerName={props.sellerName} signupsOnly={signupsOnly} texts={config.texts} editText={TE} />
          {props.showPoweredBy && !personal && (
            <a
              href={`/?ref=${props.referralCode ?? ""}&utm_source=powered_by`}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition hover:opacity-100"
              style={{ borderColor: "var(--c-line)", opacity: 0.75 }}
            >
              <span className="cp-gold">✦</span>{" "}<Tr s={"Powered by"} />{" "}<span className="font-semibold"><Tr s={props.platformName} /></span>
            </a>
          )}
        </footer>,
        )}
      </main>
    </div>
    </>
  );
}

export function ProductCard({ p, large = false, username, trackCreatorId }: { p: PublicProduct; large?: boolean; username: string; trackCreatorId: string | null }) {
  const mode = p.accessMode ?? "PAID";
  const free = mode === "FREE_EMAIL";
  const external = mode === "EXTERNAL" && !!p.externalUrl;
  const cta = free
    ? p.ctaLabel || null
    : external
      ? externalButtonLabel({ type: p.type, externalLabel: p.externalLabel ?? null, externalUrl: p.externalUrl ?? null })
      : requestCta(p.type, p.ctaLabel);
  const productHref = `${productPath(username, p)}`;
  const topics = p.type === "COURSE" || p.type === "DIGITAL" ? productTopics(p) : [];
  const event = trackCreatorId ? { creatorId: trackCreatorId, type: "PRODUCT_CLICK" as const, productId: p.id } : null;
  // Gratis: «Gratis». Pago fuera: el precio (informativo, si lo hay) y dónde se paga. Pago aquí: el precio.
  const price = free ? <Tr s="Gratis" /> : external && p.priceCents <= 0 ? null : formatPrice(p.sale ? p.sale.priceCents : p.priceCents, p.currency, p.billingInterval);
  const priceNote = external ? p.externalHost ? <Tr s="Pago en {host}" vars={{ host: p.externalHost }} /> : <Tr s="Pago en otra web" /> : null;
  return (
    <article className="cp-card cp-card-hover group flex h-full flex-col">
      <Link href={productHref} className="cp-photo-bubble cp-photo-in relative block aspect-[4/3]">
        <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} sizes="(min-width: 768px) 360px, 85vw" />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "color-mix(in oklab, var(--c-bg) 72%, transparent)", color: "var(--c-text)", backdropFilter: "blur(10px)" }}
        >
          {/* Un curso con tema lleva el icono de su tema (o sus temas) en dorado; si no, su emoji. */}
          {topics.length ? <CategoryIcons categories={topics} size={1.05} className="cp-gold" gap={0.1} /> : p.emoji && <span aria-hidden><Tr s={p.emoji} /></span>}
          {p.type === "DIGITAL" ? readingLabel(p) : <Tr s={TYPE_EYEBROW[p.type as ProductType]} />}
          {p.meta ? <span className="cp-muted normal-case tracking-normal">· <Tr s={p.meta} /></span> : null}
        </span>
        {large && (
          <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ background: "var(--c-gold)", color: "var(--c-bg)" }}>
            <Tr s="Destacado" />
          </span>
        )}
      </Link>
      <div className={`flex flex-1 flex-col ${large ? "p-5 sm:p-7" : "p-5"}`}>
        <Link href={productHref} className="block">
          <h3 className={`cp-display ${large ? "text-[1.85rem] sm:text-[2.3rem]" : "text-[1.55rem]"}`}>{p.title}</h3>
          {p.summary && <p className={`cp-muted mt-2 leading-relaxed ${large ? "text-[0.95rem]" : "line-clamp-2 text-[0.88rem]"}`}><Tr s={p.summary} /></p>}
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
            <TrackedAnchor href={p.externalUrl!} event={event} className="cp-btn shrink-0" ariaLabel={`${cta ?? ""}: ${p.title}`}>
              <Tr s={cta} />
              <ExternalLink className="h-4 w-4" />
            </TrackedAnchor>
          ) : (
            <TrackedLink href={free ? productHref : `${productHref}/request`} event={event} className="cp-btn shrink-0" ariaLabel={`${cta ?? ""}: ${p.title}`}>
              {free ? (
                <>
                  {cta ?? <Tr s="Acceder gratis" />}
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {cta === requestCta(p.type, null) ? <Tr s="Escríbeme" /> : cta}
                </>
              )}
            </TrackedLink>
          )}
        </div>
      </div>
    </article>
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
    <Link href={`${productPath(username, p)}`} className="cp-card cp-card-hover flex flex-col gap-1.5 p-5" data-offer={p.slug}>
      <span className="cp-tag">{saleTag(sale)}</span>
      <span className="cp-display mt-1.5 text-[1.5rem] leading-tight">{p.title}</span>
      <span className="text-[0.95rem]">
        <s className="cp-muted">{formatPrice(sale.regularCents, p.currency, p.billingInterval)}</s>{" "}
        <strong className="text-[1.15rem]">{formatPrice(sale.priceCents, p.currency, p.billingInterval)}</strong>
      </span>
      {p.billingInterval && <span className="cp-faint text-[0.72rem]"><Tr s={"El precio de oferta es el del primer pago; después, el normal."} /></span>}
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
/** El tamaño de la foto de «Sobre mí» (y su ancho en el ordenador). */
const ABOUT_PHOTO: Record<"tall" | "portrait" | "square", { aspect: string; width: string }> = {
  tall: { aspect: "aspect-[9/16]", width: "w-[38%] sm:w-[36%]" },
  portrait: { aspect: "aspect-[3/4]", width: "w-[40%] sm:w-[38%]" },
  square: { aspect: "aspect-square", width: "w-[40%] sm:w-[40%]" },
};
const TONE_CIRCLES = tone("color-mix(in oklab, var(--c-text) 70%, var(--c-accent))", 10);


function isExternal(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export function SectionHeading({ title, count }: { title: ReactNode; count?: number }) {
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
      {count != null && count > 1 && <span className="cp-faint mt-2 block text-[0.68rem] uppercase tracking-[0.3em] tabular-nums md:hidden">{count}{" "}<Tr s={"· desliza"} /></span>}
    </div>
  );
}
