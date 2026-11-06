"use client";
import { ArrowUpRight, Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicDiscountCode } from "./creator-page-view";
import { track } from "./tracking";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { imageSrcSet } from "@/lib/media-url";

/** Copia un texto al portapapeles: la API moderna o, si no está (http, navegadores antiguos), execCommand. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* se intenta la alternativa */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Un código de descuento de otra marca, en una tarjeta vertical (en el ordenador caben tres juntas; si
 * hay más, la portada las pone en carrusel): el logo, la marca y dos líneas de descripción; debajo, el
 * código entero, «Copiar» e «Ir a la tienda». Si hay algo más que ver, «Ver más» (un <details> nativo:
 * funciona sin JavaScript) enseña la descripción entera y las fotos de lo que recomienda de esa marca,
 * que se amplían al tocarlas. Los dos clics se miden en /api/track sin cookies. Si el navegador no deja
 * copiar, se selecciona el código para copiarlo a mano.
 */
export function DiscountCodeCard({ code, trackCreatorId }: { code: PublicDiscountCode; trackCreatorId: string | null }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const event = (type: "CODE_COPY" | "CODE_CLICK") => {
    if (trackCreatorId) track({ creatorId: trackCreatorId, type, codeId: code.id });
  };

  const onCopy = async () => {
    event("CODE_COPY");
    const ok = await copyText(code.code);
    if (!ok && codeRef.current) {
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    setState(ok ? "copied" : "manual");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), ok ? 2200 : 6000);
  };

  const photos = code.photos ?? [];
  // «Ver más» si hay algo más que ver: fotos o una descripción que no cabe en dos líneas.
  const expandable = photos.length > 0 || (code.description?.length ?? 0) > 70;

  return (
    <article className="cp-card flex h-full min-w-0 flex-col items-center p-4 text-center" style={{ overflow: "visible" }} aria-label={`Código de descuento de ${code.brand}`} data-code-row={code.code}>
      {code.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={code.imageUrl} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden className="cp-display grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl" style={{ background: "color-mix(in oklab, var(--c-accent) 22%, transparent)" }}>
          {code.brand.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <h3 className="mt-3 w-full truncate text-[1rem] font-semibold leading-tight">{code.brand}</h3>
      {/* El mismo sitio dice «Código copiado»: el aviso no mueve nada (siempre dos líneas de alto). */}
      <p className="mt-1 line-clamp-2 min-h-[2.6em] w-full text-[0.82rem] leading-snug" aria-live="polite">
        {state === "copied" ? (
          <span className="cp-gold font-medium">Código copiado. Pégalo al pagar en la tienda.</span>
        ) : state === "manual" ? (
          <span className="cp-gold font-medium">Mantén pulsado el código para copiarlo.</span>
        ) : (
          <span className="cp-muted">{code.description || code.expiresLabel || " "}</span>
        )}
      </p>
      <div className="mt-auto flex w-full flex-col gap-1.5 pt-3">
        {/* El código ocupa todo el ancho; uno largo (hasta 40 caracteres) se parte: se ve entero, nunca recortado. */}
        <code
          ref={codeRef}
          className={`flex min-h-[2.4rem] w-full select-all items-center justify-center break-all rounded-lg border border-dashed px-2 py-1 text-center font-mono text-[0.85rem] font-semibold leading-tight ${code.code.length > 12 ? "tracking-[0.02em]" : "tracking-[0.08em]"}`}
          style={{ borderColor: "color-mix(in oklab, var(--c-text) 35%, transparent)" }}
        >
          {code.code}
        </code>
        {/* Si la tarjeta es estrecha, «Ir a la tienda» pasa debajo de «Copiar» (nunca se sale de la tarjeta). */}
        <span className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onCopy}
            className="cp-btn-ghost flex-[1_1_auto] whitespace-nowrap !min-h-[2.4rem] !px-2 !text-[0.8rem]"
            aria-label={state === "copied" ? `Copiado: ${code.code}` : `Copiar código ${code.code}`}
          >
            {/* Los dos textos ocupan el mismo sitio: el botón no cambia de ancho al copiar. */}
            <span className="grid place-items-center">
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 ${state === "copied" ? "invisible" : ""}`}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </span>
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 ${state === "copied" ? "" : "invisible"}`}>
                <Check className="h-3.5 w-3.5" /> Copiado
              </span>
            </span>
          </button>
          <a
            href={code.url}
            target="_blank"
            rel="noopener nofollow sponsored"
            className="cp-btn flex-[1_1_auto] whitespace-nowrap !min-h-[2.4rem] !gap-1 !px-2 !text-[0.8rem]"
            onClick={() => event("CODE_CLICK")}
          >
            Ir a la tienda <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </span>
      </div>
      {expandable && (
        <details className="group mt-2 w-full text-left" data-code-details>
          <summary className="cp-muted mx-auto flex w-fit cursor-pointer list-none items-center gap-1 py-1 text-[0.78rem] font-medium [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver más</span>
            <span className="hidden group-open:inline">Ver menos</span>
            <ChevronDown aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="pt-2" data-code-more>
            {code.description && <p className="cp-muted text-[0.88rem] leading-relaxed">{code.description}</p>}
            {code.expiresLabel && <p className="cp-faint mt-1 text-xs">{code.expiresLabel}</p>}
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2" aria-label={`Lo que me gusta de ${code.brand}`} role="group">
                {photos.map((ph, i) => (
                  <ZoomableImage
                    key={`${ph.src}-${i}`}
                    src={ph.src}
                    srcSet={imageSrcSet(ph.src, ph.width)}
                    sizes="(min-width: 768px) 70px, 25vw"
                    alt={ph.alt}
                    width={ph.width}
                    height={ph.height}
                    className="overflow-hidden rounded-[calc(var(--r-card)*0.5)]"
                    imgClassName="aspect-square object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </article>
  );
}
