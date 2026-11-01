import { ArrowUpRight } from "lucide-react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { RichContent } from "@/components/rich-text/rich-content";
import { linksToProduct } from "@/lib/access-mode";
import { imageSrcSet } from "@/lib/media-url";
import type { OracleDecks } from "@/components/models/data/oracle";
import { InteractiveModel } from "@/components/models/interactive-model";
import type { ModelGateInfo } from "@/components/models/model-gate";
import { SacredGeometry } from "@/components/models/sacred-geometry";
import { MODEL_LABEL, isOwnImageSrc, isOwnVideoSrc, type ContentBlock, type PageImage } from "@/lib/page-blocks";
import { safeHref } from "@/lib/page-config";
import { videoEmbed } from "@/lib/video-embed";
import { PageVideo } from "./page-video";
import { VideoFacade } from "./video-facade";

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
 *   · trayectoria: línea de tiempo con sus hitos;
 *   · modelo interactivo: título y entradilla aquí (en el HTML) y el modelo, que se carga aparte y solo
 *     en el navegador (components/models); la geometría sagrada es una frase grande sobre la figura.
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
}: {
  blocks: ContentBlock[];
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
}) {
  const linkTo = (url: string | undefined) => (url && !linksToProduct(url, username, hiddenSlugs, siteOrigin) ? safeHref(url) : null);
  // Las webs de fuera, en otra pestaña; los enlaces internos y mailto:/tel:, en la misma.
  const target = (href: string | null) => (href && /^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {});
  const title = (text: string) =>
    titleLevel === 3 ? <h3 className="cp-display text-[1.6rem] leading-tight">{text}</h3> : <h2 className="cp-display text-[1.75rem] leading-tight sm:text-[2rem]">{text}</h2>;

  return (
    <>
      {blocks.map((b) => {
        switch (b.kind) {
          case "text": {
            // Sin botón hacia lo que no se ve (un producto oculto en la web personal); el texto se queda.
            const href = linkTo(b.buttonUrl);
            // Las webs de fuera, en otra pestaña; los enlaces internos y mailto:/tel:, en la misma.
            const newTab = !!href && /^https?:/i.test(href);
            return (
              <div key={b.id} className="cp-card p-6 sm:p-7" data-block="text">
                {b.title && title(b.title)}
                {b.body && (
                  <RichContent
                    text={b.body}
                    format={b.format}
                    legacy="links"
                    tone="page"
                    headingLevel={titleLevel === 3 ? 4 : 3}
                    className={`cp-muted space-y-3 text-[0.95rem] leading-relaxed ${b.title ? "mt-3" : ""}`}
                  />
                )}
                {href && b.buttonLabel && (
                  <a href={href} className="cp-btn-ghost mt-5" {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {b.buttonLabel}
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
                {b.image.caption && <figcaption className="cp-muted mt-2 text-center text-[0.85rem]">{b.image.caption}</figcaption>}
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
                    {b.layout === "carousel" && images.length > 1 && <span className="cp-faint pb-1 text-xs tabular-nums">{images.length} · desliza →</span>}
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
                        {img.caption && <figcaption className="cp-muted mt-1 text-center text-xs">{img.caption}</figcaption>}
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
                        {img.caption && <figcaption className="cp-muted mt-2 text-center text-[0.85rem]">{img.caption}</figcaption>}
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
                {b.caption && <figcaption className="cp-muted mt-2 text-center text-[0.85rem]">{b.caption}</figcaption>}
              </figure>
            );
          }
          case "photoText": {
            if (!b.image || !isOwnImageSrc(b.image.src)) return null;
            const href = linkTo(b.buttonUrl);
            return (
              <div key={b.id} className="cp-card grid sm:grid-cols-2" data-block="photo-text" data-side={b.imageSide}>
                <div className={`relative aspect-[4/3] sm:aspect-auto sm:min-h-[20rem] ${b.imageSide === "right" ? "sm:order-last" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.image.src}
                    srcSet={imageSrcSet(b.image.src, b.image.width)}
                    sizes="(min-width: 768px) 352px, calc(100vw - 40px)"
                    alt={b.image.alt}
                    width={b.image.width}
                    height={b.image.height}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-7">
                  {b.title && title(b.title)}
                  {b.body && (
                    <RichContent
                      text={b.body}
                      format={b.format}
                      legacy="links"
                      tone="page"
                      headingLevel={titleLevel === 3 ? 4 : 3}
                      className={`cp-muted space-y-3 text-[0.95rem] leading-relaxed ${b.title ? "mt-3" : ""}`}
                    />
                  )}
                  {href && b.buttonLabel && (
                    <a href={href} className="cp-btn-ghost mt-5 self-start" {...target(href)}>
                      {b.buttonLabel}
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
                {b.title && <div className="mb-4">{title(b.title)}</div>}
                <div className="grid gap-4 sm:grid-cols-2">
                  {b.cards.map((c, i) => {
                    const href = linkTo(c.href);
                    const img = c.image && isOwnImageSrc(c.image.src) ? c.image : null;
                    const inner = (
                      <>
                        {img && (
                          <div className="relative aspect-[4/3] overflow-hidden">
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
                        <div className="flex flex-1 flex-col p-5">
                          <span className="flex items-start justify-between gap-3">
                            <span className="cp-display text-[1.3rem] leading-tight">{c.title}</span>
                            {href && <ArrowUpRight className="cp-faint mt-1 h-4 w-4 shrink-0" aria-hidden />}
                          </span>
                          {c.text && <span className="cp-muted mt-2 text-[0.9rem] leading-relaxed">{c.text}</span>}
                        </div>
                      </>
                    );
                    return href ? (
                      <a key={i} href={href} className="cp-card cp-card-hover flex flex-col" data-card {...target(href)}>
                        {inner}
                      </a>
                    ) : (
                      <div key={i} className="cp-card flex flex-col" data-card>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }
          case "quote":
            return (
              <figure key={b.id} className="cp-card relative px-7 pb-8 pt-12 text-center sm:px-12" data-block="quote">
                <span aria-hidden className="cp-gold cp-display pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[4.5rem] leading-none">
                  “
                </span>
                <blockquote className="cp-display text-[1.45rem] leading-snug sm:text-[1.7rem]">{b.text}</blockquote>
                {b.author && <figcaption className="cp-eyebrow mt-5">— {b.author}</figcaption>}
              </figure>
            );
          case "timeline":
            if (!b.items.length) return null;
            return (
              <section key={b.id} className="cp-card p-6 sm:p-7" data-block="timeline" aria-label={b.title || "Trayectoria"}>
                {b.title && <div className="mb-6">{title(b.title)}</div>}
                <ol className="cp-line relative ml-1.5 space-y-7 border-l">
                  {b.items.map((it, i) => (
                    <li key={i} className="relative pl-6">
                      <span aria-hidden className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--c-gold)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--c-gold)_22%,transparent)]" />
                      {it.label && <p className="cp-eyebrow cp-gold">{it.label}</p>}
                      <p className={`cp-display text-[1.2rem] leading-snug ${it.label ? "mt-1" : ""}`}>{it.title}</p>
                      {it.text && <p className="cp-muted mt-1.5 text-[0.92rem] leading-relaxed">{it.text}</p>}
                    </li>
                  ))}
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
                  {b.intro && <figcaption className="cp-muted mt-6 max-w-md text-[0.95rem] leading-relaxed">{b.intro}</figcaption>}
                </figure>
              );
            return (
              <section key={b.id} className="cp-card p-5 sm:p-7" data-block="model" data-model={b.model} aria-label={b.title || MODEL_LABEL[b.model]}>
                {b.title && title(b.title)}
                {b.intro && <p className={`cp-muted text-[0.95rem] leading-relaxed ${b.title ? "mt-3" : ""}`}>{b.intro}</p>}
                <div className={b.title || b.intro ? "mt-6" : ""}>
                  <InteractiveModel model={b.model} deck={b.model === "oracle" && b.deck ? oracleDecks?.[b.deck] : undefined} gate={modelGate} />
                </div>
              </section>
            );
        }
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
