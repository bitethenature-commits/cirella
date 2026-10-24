import { ArrowUpRight } from "lucide-react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { RichContent } from "@/components/rich-text/rich-content";
import { linksToProduct } from "@/lib/access-mode";
import { imageSrcSet } from "@/lib/media-url";
import { isOwnImageSrc, isOwnVideoSrc, type ContentBlock, type PageImage } from "@/lib/page-blocks";
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
 *     de fuera hasta pulsar ▶).
 * Un src que no sea propio no se pinta (además de comprobarse al guardar).
 */
export const BLOCK_IMAGE_SIZES = "(min-width: 768px) 704px, calc(100vw - 40px)";

export function ContentBlocks({
  blocks,
  username,
  titleLevel,
  hiddenSlugs,
  siteOrigin,
}: {
  blocks: ContentBlock[];
  username: string;
  /** Nivel del título de cada bloque: 3 bajo el título de la sección, 2 si no lo hay. */
  titleLevel: 2 | 3;
  /** Productos que no se ven (web personal sin cobros): sin botón ni enlace hacia ellos. */
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin?: string;
}) {
  const linkTo = (url: string | undefined) => (url && !linksToProduct(url, username, hiddenSlugs, siteOrigin) ? safeHref(url) : null);
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
