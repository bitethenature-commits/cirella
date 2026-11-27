import { productPath } from "@/lib/public-paths";
import { cloneElement, isValidElement, type ComponentType, type ReactElement, type SVGProps } from "react";
import { ArrowRight, ArrowUpRight, Mail, Moon } from "lucide-react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { RichContent } from "@/components/rich-text/rich-content";
import { linksToProduct } from "@/lib/access-mode";
import { imageSrcSet } from "@/lib/media-url";
import type { OracleDecks } from "@/components/models/data/oracle";
import { InteractiveModel, ModelGateBelow } from "@/components/models/interactive-model";
import { ModelGateScope, type ModelGateInfo } from "@/components/models/model-gate-scope";
import { SacredGeometry } from "@/components/models/sacred-geometry";
import { formatPrice } from "@/lib/money";
import { MODEL_LABEL, hasQuickVersion, isOwnImageSrc, isOwnVideoSrc, type ContentBlock, type PageImage } from "@/lib/page-blocks";
import { readDesign, safeHref } from "@/lib/page-config";
import type { Design } from "@/lib/templates";
import { DesignScope, hasOwnDesign } from "./design-scope";
import { videoEmbed } from "@/lib/video-embed";
import { PageVideo } from "./page-video";
import { OracleIcon } from "./oracle-icon";
import { RuneIcon } from "./rune-icon";
import { knownSystemIcon, SystemIconMark } from "./system-icon";
import { VideoFacade } from "./video-facade";
import type { PublicProduct } from "./creator-page-view";
import type { WebTiers } from "@/lib/web-tiers";
import { TiersShow } from "./tiers-block";
import { Tr } from "@/lib/i18n/client";

/**
 * Bloques de la portada y de las páginas extra (lib/page-blocks.ts), con las clases del tema
 * (cp-card, cp-display, cp-muted…): las 5 plantillas y los colores propios se aplican solos.
 * Sin hooks: vale en el servidor y en la vista previa del editor.
 *
 *   · texto: el marcado de siempre (los bloques de antes se ven igual), con formato si lo tiene;
 *   · imagen: con sus medidas reales (sin saltos), srcset de /media, carga diferida; con enlace, lo
 *     abre; sin enlace, se amplía al tocarla (pellizcar para leer el texto de un gráfico);
 *   · galería: carrusel deslizable o cuadrícula;
 *   · vídeo: subido (<video> nativo, sin reproducción automática) o de YouTube/Vimeo (no carga nada
 *     de fuera hasta pulsar ▶);
 *   · foto y texto: la foto a un lado y el texto al otro (en el móvil, la foto encima);
 *   · tarjetas: rejilla de 2 columnas (1 en el móvil); la tarjeta entera es el enlace;
 *   · cita: una frase destacada con su autora;
 *   · trayectoria: un cordel dorado con sus hitos (en el ordenador, a un lado y a otro); sin cajas,
 *     aparecen al deslizar ([data-reveal]: SitePageView monta <Reveal />);
 *   · modelo interactivo: título y entradilla aquí (en el HTML) y el modelo, que se carga aparte y solo
 *     en el navegador (components/models); la geometría sagrada es una frase grande sobre la figura. En
 *     «Versión rápida», solo el dibujo, y «Calcular con mis datos» debajo de la caja;
 *   · enlaces en burbuja: de 1 a 4 píldoras alargadas, centradas (en el móvil, una debajo de otra);
 *   · próximos círculos de la luna: los dos próximos (lib/moon-circles.ts), en tarjetas pequeñas;
 *   · niveles de la comunidad: sus portales en arco, más anchos que la página (tiers-block.tsx).
 * Un src que no sea propio no se pinta (además de comprobarse al guardar).
 */
export const BLOCK_IMAGE_SIZES = "(min-width: 768px) 704px, calc(100vw - 40px)";

export function ContentBlocks({
  blocks,
  username,
  titleLevel,
  hiddenSlugs,
  siteOrigin,
  oracleDecks,
  modelGate,
  moonCircles,
  tiers,
  bare = false,
  luxe = false,
  modelIcon,
  designBase,
}: {
  /** Los niveles de la comunidad (lib/web-tiers.server.ts) para su sección; sin pasar, un aviso (vista previa). */
  tiers?: WebTiers;
  /** Con cajas pero con el estilo de lujo de la portada (páginas de los sistemas). */
  luxe?: boolean;
  blocks: ContentBlock[];
  /** Página de un método: su icono delante del título de los modelos interactivos. */
  modelIcon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Sin cajas: texto, foto y texto, y cita van sueltos sobre el fondo (página «Sobre mí»). */
  bare?: boolean;
  username: string;
  /** Nivel del título de cada bloque: 3 bajo el título de la sección, 2 si no lo hay. */
  titleLevel: 2 | 3;
  /** Productos que no se ven (web personal sin cobros): sin botón ni enlace hacia ellos. */
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin?: string;
  /** Barajas propias de los bloques «Oráculo», cargadas en el servidor (lib/oracle-decks.ts). */
  oracleDecks?: OracleDecks;
  /** Web personal: «Calcular con mis datos» de los modelos solo con cuenta y newsletter (model-gate.tsx). */
  modelGate?: ModelGateInfo | null;
  /**
   * Los próximos círculos de la luna (lib/moon-circles.ts) para el bloque «Próximos círculos de la luna».
   * Sin pasar (vista previa en vivo del editor): un aviso de lo que saldrá ahí.
   */
  moonCircles?: PublicProduct[];
  /** El diseño de la página: los bloques con diseño propio (su «Diseño» en Mi página) lo cambian encima. */
  designBase?: Design;
}) {
  const linkTo = (url: string | undefined) => (url && !linksToProduct(url, username, hiddenSlugs, siteOrigin) ? safeHref(url) : null);
  // Las webs de fuera, en otra pestaña; los enlaces internos y mailto:/tel:, en la misma.
  const target = (href: string | null) => (href && /^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {});
  /** Un bloque con el aspecto que le toca: `bare` (sin cajas) o `luxe` (paneles dorados). */
  const renderOne = (b: ContentBlock, bare: boolean, luxe: boolean) => {
    const title = (text: string) =>
      titleLevel === 3 ? (
        <h3 className="cp-display text-[1.6rem] leading-tight"><Tr s={text} /></h3>
      ) : (
        <h2 className={`cp-display leading-tight ${bare || luxe ? "cp-thin text-[1.95rem] sm:text-[2.3rem]" : "text-[1.75rem] sm:text-[2rem]"}`}><Tr s={text} /></h2>
      );
    // «Sobre mí» (sin cajas): los títulos de sección centrados, con la estrella y la raya dorada de la portada.
    const luxeTitle = (text: string) => (
      <div className="cp-section-heading">
        <span className="cp-section-star" aria-hidden>
          ✦
        </span>
        <h2 className="cp-display cp-thin text-[2.2rem] leading-tight sm:text-[2.6rem]"><Tr s={text} /></h2>
        <div aria-hidden className="cp-section-rule">
          <span />
          <i>✦</i>
          <span />
        </div>
      </div>
    );
  
      switch (b.kind) {
        case "text": {
          // Sin botón hacia lo que no se ve (un producto oculto en la web personal); el texto se queda.
          const href = linkTo(b.buttonUrl);
          // Las webs de fuera, en otra pestaña; los enlaces internos y mailto:/tel:, en la misma.
          const newTab = !!href && /^https?:/i.test(href);
          if (bare) {
            // «Sobre mí»: título centrado con oro y texto fino; si lleva botón, en un panel con doble borde dorado.
            const panel = !!(href && b.buttonLabel);
            return (
              <div key={b.id} className={`mx-auto max-w-2xl text-center ${panel ? "cp-include-panel" : ""}`} data-block="text" data-reveal>
                {b.title && luxeTitle(b.title)}
                {b.body && (
                  <RichContent
                    text={b.body}
                    format={b.format}
                    legacy="links"
                    tone="page"
                    headingLevel={3}
                    className={`cp-muted cp-thin-text mx-auto max-w-xl space-y-3 text-[1.05rem] leading-relaxed ${b.title ? "mt-6" : ""}`}
                  />
                )}
                {href && b.buttonLabel && (
                  <div className="mt-8 flex justify-center">
                    <a href={href} className="cp-sacred-btn" {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      <span className="cp-sacred-label">
                        {href.startsWith("mailto:") && <Mail className="h-5 w-5" strokeWidth={1.3} />}
                        <Tr s={b.buttonLabel} />
                      </span>
                    </a>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={b.id} className={luxe ? "cp-include-panel" : "cp-card p-6 sm:p-7"} data-block="text">
              {b.title && title(b.title)}
              {b.title && luxe && <span aria-hidden className="cp-luxe-underline" />}
              {b.body && (
                <RichContent
                  text={b.body}
                  format={b.format}
                  legacy="links"
                  tone="page"
                  headingLevel={titleLevel === 3 ? 4 : 3}
                  className={`cp-muted space-y-3 leading-relaxed ${luxe ? "cp-thin-text text-[1.02rem]" : "text-[0.95rem]"} ${b.title ? (luxe ? "mt-5" : "mt-3") : ""}`}
                />
              )}
              {href && b.buttonLabel && (
                <a href={href} className="cp-btn-ghost mt-5" {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  <Tr s={b.buttonLabel} />
                  <ArrowUpRight className="h-4 w-4 opacity-70" />
                </a>
              )}
            </div>
          );
        }
        case "image": {
          if (!b.image || !isOwnImageSrc(b.image.src)) return null;
          const href = linkTo(b.href);
          const newTab = !!href && /^https?:/i.test(href);
          return (
            <figure key={b.id} data-block="image">
              {b.title && (
                <div className="mb-3">
                  {title(b.title)}
                </div>
              )}
              {href ? (
                <a href={href} className="block overflow-hidden rounded-[var(--r-card)]" {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  <BlockImg img={b.image} />
                </a>
              ) : (
                <ZoomableImage
                  src={b.image.src}
                  srcSet={imageSrcSet(b.image.src, b.image.width)}
                  sizes={BLOCK_IMAGE_SIZES}
                  alt={b.image.alt}
                  width={b.image.width}
                  height={b.image.height}
                  className="overflow-hidden rounded-[var(--r-card)]"
                />
              )}
              {b.image.caption && <figcaption className="cp-muted mt-2 text-center text-[0.85rem]"><Tr s={b.image.caption} /></figcaption>}
            </figure>
          );
        }
        case "gallery": {
          const images = b.images.filter((i) => isOwnImageSrc(i.src));
          if (!images.length) return null;
          return (
            <section key={b.id} data-block="gallery" aria-label={b.title || "Galería"}>
              {(b.title || (b.layout === "carousel" && images.length > 1)) && (
                <div className="mb-3 flex items-end justify-between gap-4">
                  {b.title ? title(b.title) : <span />}
                  {b.layout === "carousel" && images.length > 1 && <span className="cp-faint pb-1 text-xs tabular-nums">{images.length}{" "}<Tr s={"· desliza →"} /></span>}
                </div>
              )}
              {b.layout === "grid" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {images.map((img, i) => (
                    <figure key={`${img.src}-${i}`}>
                      <ZoomableImage
                        src={img.src}
                        srcSet={imageSrcSet(img.src, img.width)}
                        sizes="(min-width: 768px) 230px, 50vw"
                        alt={img.alt}
                        width={img.width}
                        height={img.height}
                        className="overflow-hidden rounded-[calc(var(--r-card)*0.7)]"
                      />
                      {img.caption && <figcaption className="cp-muted mt-1 text-center text-xs"><Tr s={img.caption} /></figcaption>}
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="-mx-5 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
                  {images.map((img, i) => (
                    <figure key={`${img.src}-${i}`} className={`shrink-0 snap-center ${images.length === 1 ? "w-full" : "w-[82%] sm:w-[60%]"}`}>
                      <ZoomableImage
                        src={img.src}
                        srcSet={imageSrcSet(img.src, img.width)}
                        sizes="(min-width: 768px) 420px, 82vw"
                        alt={img.alt}
                        width={img.width}
                        height={img.height}
                        className="overflow-hidden rounded-[var(--r-card)]"
                      />
                      {img.caption && <figcaption className="cp-muted mt-2 text-center text-[0.85rem]"><Tr s={img.caption} /></figcaption>}
                    </figure>
                  ))}
                </div>
              )}
            </section>
          );
        }
        case "video": {
          const poster = b.poster && isOwnImageSrc(b.poster) ? b.poster : null;
          const upload = b.upload && isOwnVideoSrc(b.upload.src) ? b.upload : null;
          const embed = !upload && b.embedUrl && videoEmbed(b.embedUrl) ? b.embedUrl : null;
          if (!upload && !embed) return null;
          return (
            <figure key={b.id} data-block="video">
              {b.title && (
                <div className="mb-3">
                  {title(b.title)}
                </div>
              )}
              <div className="overflow-hidden rounded-[var(--r-card)]">
                {upload ? <PageVideo video={upload} poster={poster} title={b.title} /> : <VideoFacade url={embed!} poster={poster} title={b.title} />}
              </div>
              {b.caption && <figcaption className="cp-muted mt-2 text-center text-[0.85rem]"><Tr s={b.caption} /></figcaption>}
            </figure>
          );
        }
        case "photoText": {
          if (!b.image || !isOwnImageSrc(b.image.src)) return null;
          const href = linkTo(b.buttonUrl);
          const sysIcon = b.title ? knownSystemIcon(b.title) : null;
          // Sin cajas («Sobre mí»): si el título es un sistema, su icono dorado delante, en la misma línea.
          // En el móvil, el título va encima de la foto y el texto debajo; en el ordenador, junto al texto.
          const heading = (where: string) =>
            b.title ? (
              <div className={where}>
                <div className="flex items-center gap-3">
                  {sysIcon && <SystemIconMark icon={sysIcon} scale={0.75} />}
                  {title(b.title)}
                </div>
                {bare && <span aria-hidden className="cp-luxe-underline" />}
              </div>
            ) : null;
          return (
            <div key={b.id} className={`${photoTextCols(b.imageSide)} ${bare ? "grid items-center gap-4 sm:grid-cols-2 sm:gap-10" : "cp-card grid items-center gap-1 p-2 sm:grid-cols-2 sm:gap-0 sm:p-4"}`} data-block="photo-text" data-side={b.imageSide} {...(bare ? { "data-reveal": "" } : {})}>
              {bare && heading("col-span-2 block sm:hidden")}
              <div
                className={`relative aspect-[9/16] ${bare ? "cp-luxe-frame" : "cp-photo-bubble"} w-full sm:mx-auto sm:max-w-[20rem] ${b.imageSide === "right" ? "order-last" : ""}`}
              >
                {/* Foto y texto: siempre en vertical 9:16 (formato reel), un hueco fijo. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.image.src}
                  srcSet={imageSrcSet(b.image.src, b.image.width)}
                  sizes="(min-width: 768px) 352px, 40vw"
                  alt={b.image.alt}
                  width={b.image.width}
                  height={b.image.height}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className={`flex min-w-0 flex-col justify-center ${bare ? "" : "p-3 sm:p-7"}`}>
                {bare ? heading("hidden sm:block") : b.title && title(b.title)}
                {!bare && luxe && b.title && <span aria-hidden className="cp-luxe-underline" />}
                {b.body && (
                  <RichContent
                    text={b.body}
                    format={b.format}
                    legacy="links"
                    tone="page"
                    headingLevel={titleLevel === 3 ? 4 : 3}
                    className={`cp-muted space-y-3 leading-relaxed ${bare || luxe ? "cp-thin-text text-[0.9rem] sm:text-[1.02rem]" : "text-[0.85rem] sm:text-[0.95rem]"} ${b.title ? (bare ? "sm:mt-5" : luxe ? "mt-5" : "mt-3") : ""}`}
                  />
                )}
                {href && b.buttonLabel && (
                  <a href={href} className="cp-btn-ghost mt-5 self-start" {...target(href)}>
                    <Tr s={b.buttonLabel} />
                    <ArrowUpRight className="h-4 w-4 opacity-70" />
                  </a>
                )}
              </div>
            </div>
          );
        }
        case "cards": {
          if (!b.cards.length) return null;
          return (
            <section key={b.id} data-block="cards" aria-label={b.title || "Tarjetas"}>
              {b.title && <div className={bare || luxe ? "mb-8 text-center" : "mb-4"}>{bare || luxe ? luxeTitle(b.title) : title(b.title)}</div>}
              <div className={`grid gap-4 ${b.cards.length % 3 === 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"} ${bare || luxe ? "sm:gap-6" : ""}`}>
                {b.cards.map((c, i) => {
                  const href = linkTo(c.href);
                  const img = c.image && isOwnImageSrc(c.image.src) ? c.image : null;
                  const inner = (
                    <>
                      {img && (
                        <div className={`relative w-full ${bare || luxe ? "cp-gift-photo aspect-[4/5]" : "cp-photo-bubble cp-photo-in aspect-[4/3]"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.src}
                            srcSet={imageSrcSet(img.src, img.width)}
                            sizes="(min-width: 768px) 344px, calc(100vw - 40px)"
                            alt={img.alt}
                            width={img.width}
                            height={img.height}
                            loading="lazy"
                            decoding="async"
                            className="cp-img absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                      )}
                      {bare || luxe ? (
                        // Sin burbuja o en panel dorado: como «Lo que te llevas» de la 1:1 (centrada, con su estrella y la raya dorada).
                        <div className="flex flex-1 flex-col items-center px-5 py-8 text-center">
                          {!img && (
                            <span aria-hidden className="cp-gold text-sm">
                              ✦
                            </span>
                          )}
                          <span data-card-title className="cp-display cp-thin mt-3 text-[1.7rem] italic leading-tight">{c.title}</span>
                          <span aria-hidden className="cp-section-rule mt-3 !w-24">
                            <span />
                            <i>✦</i>
                            <span />
                          </span>
                          {c.text && <span className="cp-muted cp-thin-text mt-3 max-w-[15rem] text-[0.98rem] leading-relaxed"><Tr s={c.text} /></span>}
                          {c.price && <span className="cp-gold cp-display mt-4 text-[1.35rem]">{c.price}</span>}
                          {href && (
                            <span className="cp-gift-cta mt-5">
                              {/^mailto:/i.test(href) ? <Tr s={"Pedirlo"} /> : <Tr s={"Ver más"} />} <span aria-hidden>✦</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-col p-5">
                          <span className="flex items-start justify-between gap-3">
                            <span data-card-title className="cp-display text-[1.3rem] leading-tight">{c.title}</span>
                            {href && <ArrowUpRight className="cp-faint mt-1 h-4 w-4 shrink-0" aria-hidden />}
                          </span>
                          {c.text && <span className="cp-muted mt-2 text-[0.9rem] leading-relaxed"><Tr s={c.text} /></span>}
                          {c.price && <span className="cp-gold mt-3 font-semibold">{c.price}</span>}
                        </div>
                      )}
                    </>
                  );
                  return href ? (
                    <a key={i} href={href} className={`cp-card cp-card-hover group flex flex-col ${bare || luxe ? "cp-uno-gift" : ""}`} data-card {...target(href)}>
                      {inner}
                    </a>
                  ) : (
                    <div key={i} className={`cp-card flex flex-col ${bare || luxe ? "cp-uno-gift" : ""}`} data-card>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        }
        case "quote":
          if (bare)
            return (
              <figure key={b.id} className="cp-luxe-quote relative mx-auto max-w-2xl px-4 text-center" data-block="quote" data-reveal>
                <span aria-hidden className="cp-luxe-quote-mark">
                  “
                </span>
                <blockquote className="cp-display cp-thin text-[1.75rem] italic leading-snug sm:text-[2.2rem]"><Tr s={b.text} /></blockquote>
                <div aria-hidden className="cp-section-rule mt-6">
                  <span />
                  <i>✦</i>
                  <span />
                </div>
                {b.author && <figcaption className="cp-gold mt-4 text-[0.78rem] uppercase tracking-[0.4em]"><Tr s={b.author} /></figcaption>}
              </figure>
            );
          return (
            <figure key={b.id} className={`relative px-7 pb-8 pt-12 text-center sm:px-12 ${bare ? "" : "cp-card"}`} data-block="quote">
              <span aria-hidden className="cp-gold cp-display pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[4.5rem] leading-none">
                “
              </span>
              <blockquote className="cp-display text-[1.45rem] leading-snug sm:text-[1.7rem]"><Tr s={b.text} /></blockquote>
              {b.author && <figcaption className="cp-eyebrow mt-5">— <Tr s={b.author} /></figcaption>}
            </figure>
          );
        case "timeline":
          if (!b.items.length) return null;
          // Un cordel dorado: a la izquierda en el móvil y en el centro en el ordenador, con los hitos a
          // un lado y a otro. El año, grande y dorado; cada hito aparece al deslizar.
          return (
            <section key={b.id} className={bare ? "py-2" : "cp-card p-6 sm:p-7"} data-block="timeline" aria-label={b.title || "Trayectoria"}>
              {b.title && <div className="mb-10 text-center">{bare ? luxeTitle(b.title) : title(b.title)}</div>}
              <ol className="relative">
                <span
                  aria-hidden
                  className="absolute bottom-2 left-[11px] top-2 w-[2px] rounded-full sm:left-1/2 sm:-translate-x-1/2"
                  style={{ background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--c-gold) 70%, transparent) 6%, color-mix(in oklab, var(--c-gold) 45%, transparent) 88%, transparent)" }}
                />
                {b.items.map((it, i) => {
                  const odd = i % 2 === 1;
                  return (
                    <li key={i} className="relative pb-11 pl-10 last:pb-0 sm:grid sm:grid-cols-2 sm:gap-x-16 sm:pl-0" {...(bare ? { "data-reveal": "" } : {})} style={{ ["--reveal-delay" as string]: `${Math.min(i, 4) * 40}ms` }}>
                      {/* El nudo del cordel */}
                      {bare ? (
                        <span aria-hidden className="cp-luxe-knot absolute left-0 top-[0.55rem] z-[1] grid h-6 w-6 place-items-center sm:left-1/2 sm:-translate-x-1/2">
                          ✦
                        </span>
                      ) : (
                        <span aria-hidden className="absolute left-0 top-[0.55rem] z-[1] grid h-6 w-6 place-items-center rounded-full border sm:left-1/2 sm:-translate-x-1/2" style={{ borderColor: "var(--c-gold)", background: "var(--c-bg)" }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: "var(--c-gold)" }} />
                        </span>
                      )}
                      <div className={odd ? "sm:order-2" : "sm:text-right"}>
                        {it.label && <p className={`cp-display cp-gold leading-none ${bare ? "cp-luxe-year text-[2.2rem] sm:text-[2.8rem]" : "text-[2.1rem] sm:text-[2.7rem]"}`}><Tr s={it.label} /></p>}
                      </div>
                      <div className={`${odd ? "sm:order-1 sm:text-right" : ""} ${it.label ? "mt-2 sm:mt-0" : ""}`}>
                        <p className={`cp-display leading-snug ${bare ? "cp-thin text-[1.45rem] sm:text-[1.6rem]" : "text-[1.35rem] sm:text-[1.5rem]"}`}>{it.title}</p>
                        {it.text && <p className={`cp-muted mt-1.5 leading-relaxed ${bare ? "cp-thin-text text-[0.98rem]" : "text-[0.93rem]"}`}><Tr s={it.text} /></p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        case "model":
          if (b.model === "geometry")
            return (
              <figure key={b.id} className="cp-card relative isolate flex min-h-[20rem] flex-col items-center justify-center px-6 py-16 text-center sm:px-12" data-block="model" data-model="geometry">
                <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-35">
                  <div className="aspect-square w-[min(26rem,120%)]">
                    <SacredGeometry figure={b.figure} />
                  </div>
                </div>
                {b.title && <blockquote className="cp-display whitespace-pre-line text-[1.7rem] italic leading-snug sm:text-[2.2rem]">{b.title}</blockquote>}
                {(b.title || b.intro) && <span aria-hidden className="mt-8 block h-px w-20 bg-[var(--c-gold)] opacity-70" />}
                {b.intro && <figcaption className="cp-muted mt-6 max-w-md text-[0.95rem] leading-relaxed"><Tr s={b.intro} /></figcaption>}
              </figure>
            );
        {
          const quick = !!b.quick && hasQuickVersion(b.model);
          // El oráculo y las runas llevan su propio icono (la carta y la piedra); los demás, el del método.
          const titleIcon = !modelIcon ? undefined : b.model === "oracle" ? OracleIcon : b.model === "runes" ? RuneIcon : modelIcon;
          const box = (
            <section key={b.id} className="cp-card p-5 sm:p-7" data-block="model" data-model={b.model} data-quick={quick ? "" : undefined} aria-label={b.title || MODEL_LABEL[b.model]}>
              {b.title &&
                (titleIcon ? (
                  <div className="flex items-center gap-3">
                    <SystemIconMark icon={titleIcon} scale={0.75} />
                    {title(b.title)}
                  </div>
                ) : (
                  title(b.title)
                ))}
              {b.intro && <p className={`cp-muted text-[0.95rem] leading-relaxed ${b.title ? "mt-3" : ""}`}><Tr s={b.intro} /></p>}
              <div className={b.title || b.intro ? "mt-6" : ""}>
                <InteractiveModel model={b.model} deck={b.model === "oracle" && b.deck ? oracleDecks?.[b.deck] : undefined} gate={modelGate} compact={quick} />
              </div>
            </section>
          );
          // Versión rápida en la web personal: el modelo dentro de su caja y «Calcular con mis datos» fuera, debajo.
          if (quick && modelGate && hasQuickVersion(b.model))
            return (
              <ModelGateScope key={b.id} model={b.model} gate={modelGate}>
                {box}
                <ModelGateBelow />
              </ModelGateScope>
            );
          return box;
        }
        case "pills": {
          const items = b.items.flatMap((it) => {
            const href = it.label.trim() ? linkTo(it.href) : null;
            return href ? [{ label: it.label, href }] : [];
          });
          if (!items.length) return null;
          return (
            <nav key={b.id} data-block="pills" aria-label={b.title || "Enlaces"} className="pt-2">
              {b.title && <div className={`text-center ${bare || luxe ? "mb-8" : "mb-5"}`}>{bare || luxe ? luxeTitle(b.title) : title(b.title)}</div>}
              <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                {items.map((it, i) => (
                  <li key={i} className="sm:min-w-[11rem] sm:max-w-[18rem] sm:flex-1">
                    <a
                      href={it.href}
                      {...target(it.href)}
                      data-pill
                      data-luxe={bare || luxe ? "yes" : undefined}
                      className="group flex min-h-14 w-full items-center justify-center gap-2 rounded-full border px-7 py-3 text-center text-[0.95rem] font-semibold sm:px-4 sm:text-[0.9rem] leading-snug transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--c-gold)_14%,transparent)]"
                      style={{ borderColor: "color-mix(in oklab, var(--c-gold) 45%, transparent)", background: "color-mix(in oklab, var(--c-gold) 6%, transparent)" }}
                    >
                      <span><Tr s={it.label} /></span>
                      <ArrowRight className="cp-gold h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          );
        }
        case "moonCircles": {
          const label = b.title || "Los próximos círculos de la luna";
          if (!moonCircles)
            return (
              <section key={b.id} data-block="moon-circles" className="cp-line rounded-[var(--r-card)] border border-dashed p-5 text-center">
                <p className="cp-eyebrow flex items-center justify-center gap-1.5">
                  <Moon className="h-3.5 w-3.5" aria-hidden /> <Tr s={label} />
                </p>
                <p className="cp-muted mt-2 text-[0.85rem]"><Tr s={"Aquí salen solos tus dos próximos círculos de la luna publicados, con su fecha, el precio y «Apuntarme»."} /></p>
              </section>
            );
          const circles = moonCircles.filter((c) => !hiddenSlugs.has(c.slug.toLowerCase()));
          if (!circles.length) return null;
          return (
            <section key={b.id} data-block="moon-circles" aria-label={label}>
              <p className="cp-eyebrow flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5" aria-hidden /> <Tr s={label} />
              </p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {circles.map((c) => {
                  const free = (c.accessMode ?? "PAID") === "FREE_EMAIL";
                  const price = c.sale ? c.sale.priceCents : c.priceCents;
                  return (
                    <li key={c.id} className="cp-card flex items-center gap-3 p-4" data-moon-circle={c.slug}>
                      <span aria-hidden className="text-[1.6rem] leading-none">
                        <Tr s={c.emoji || "🌙"} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <a href={`${productPath(username, c)}`} className="block text-[0.92rem] font-semibold leading-snug underline-offset-4 hover:underline">
                          {c.title}
                        </a>
                        {c.eventLabel && <span className="cp-muted block text-[0.78rem] leading-snug"><Tr s={c.eventLabel} /></span>}
                        <span className="cp-gold block text-[0.78rem] font-semibold">
                          {free || price === 0 ? <Tr s={"Gratis"} /> : formatPrice(price, c.currency)}
                          {c.sale && <span className="cp-faint font-normal line-through"> {formatPrice(c.sale.regularCents, c.currency)}</span>}
                        </span>
                      </span>
                      <a href={free ? `${productPath(username, c)}` : `${productPath(username, c, "request")}`} className="cp-btn shrink-0 !min-h-9 !px-3.5 !text-[0.8rem]" aria-label={`${free ? "Apuntarme" : "Escríbeme para apuntarme"}: ${c.title}`}>
                        {free ? <Tr s={"Apuntarme"} /> : <><Mail className="h-3.5 w-3.5" />{" "}<Tr s={"Quiero ir"} /></>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }
        case "tiers": {
          if (!tiers)
            return (
              <section key={b.id} data-block="tiers" className="cp-line rounded-[var(--r-card)] border border-dashed p-5 text-center">
                <p className="cp-eyebrow">{b.title || <Tr s={"Niveles de la comunidad"} />}</p>
                <p className="cp-muted mt-2 text-[0.85rem]"><Tr s={"Aquí salen tus niveles de la comunidad, cada uno con su precio, lo que incluye y su botón."} /></p>
              </section>
            );
          return (
            <section key={b.id} data-block="tiers" aria-label={b.title || "Niveles de la comunidad"}>
              {b.title && <div className="mb-10 text-center">{bare || luxe ? luxeTitle(b.title) : title(b.title)}</div>}
              <TiersShow b={b} data={tiers} />
            </section>
          );
        }
      }
  };

  return (
    <>
      {blocks.map((b) => {
        // El estilo elegido en el bloque manda sobre el de la página.
        const look = b.look;
        // Panel dorado: el texto ya es un panel; lo demás va suelto dentro de uno.
        const panelWrap = look === "panel" && b.kind !== "text";
        const node = look ? renderOne(b, look === "bare" || panelWrap, look === "panel" && !panelWrap) : renderOne(b, bare, luxe);
        if (!node) return null;
        // Su nombre (data-bid): las piezas sueltas de dentro (lib/pieces.ts) se encuentran desde él.
        const one =
          !look && !b.goldTitle ? (
            isValidElement(node) ? (
              cloneElement(node as ReactElement<Record<string, unknown>>, { "data-bid": b.id })
            ) : (
              node
            )
          ) : (
            <div key={b.id} data-bid={b.id} data-look={look} data-gold-title={b.goldTitle ? "" : undefined} className={panelWrap ? "cp-include-panel" : undefined}>
              {node}
            </div>
          );
        // Con su diseño propio (letras, colores, tarjetas…), encima del de la página.
        const own = b.design ? readDesign(b.design) : null;
        return designBase && hasOwnDesign(own) ? (
          <DesignScope key={b.id} base={designBase} design={own}>
            {one}
          </DesignScope>
        ) : (
          one
        );
      })}
    </>
  );
}

function BlockImg({ img }: { img: PageImage }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.src}
      srcSet={imageSrcSet(img.src, img.width)}
      sizes={BLOCK_IMAGE_SIZES}
      alt={img.alt}
      width={img.width}
      height={img.height}
      loading="lazy"
      decoding="async"
      className="h-auto w-full"
    />
  );
}

/** Foto y texto: en el móvil también uno al lado del otro (la foto más estrecha), como en el ordenador. */
export function photoTextCols(side: string | undefined): string {
  return side === "right" ? "grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]";
}
