"use client";
import { ArrowUpRight, Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicDiscountCode } from "./creator-page-view";
import { PhotoGallery } from "./photo-gallery";
import { track } from "./tracking";

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
 * código entero, «Copiar» e «Ir a la tienda». Si la marca tiene fotos, «Ver más» (un <details> nativo)
 * enseña solo las fotos de lo que recomienda, que al tocarlas se abren en una galería encima de la web. Los dos clics se miden en /api/track sin cookies. Si el navegador no deja
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
  const recs = code.recommendations ?? [];
  // «Ver más» enseña las recomendaciones y las fotos: sale si la marca tiene alguna de las dos.
  const expandable = photos.length > 0 || recs.length > 0;

  return (
    <article className="cp-card flex min-w-0 flex-col items-center p-4 text-center" style={{ overflow: "visible" }} aria-label={`Código de descuento de ${code.brand}`} data-code-row={code.code}>
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
        {/* El código con el icono de copiar dentro, a la derecha: al tocarlo se copia. Uno largo (hasta
            40 caracteres) se parte: se ve entero, nunca recortado. */}
        <button
          type="button"
          onClick={onCopy}
          className="cp-code-copy group"
          aria-label={state === "copied" ? `Copiado: ${code.code}` : `Copiar código ${code.code}`}
        >
          <code ref={codeRef} className={`cp-display min-w-0 flex-1 select-all break-all text-center text-[1.08rem] leading-tight ${code.code.length > 12 ? "tracking-[0.06em]" : "tracking-[0.2em]"}`}>
            {code.code}
          </code>
          <span className="cp-code-copy-icon" aria-hidden>
            {state === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </span>
        </button>
        <span className="flex">
          <a
            href={code.url}
            target="_blank"
            rel="noopener nofollow sponsored"
            className="cp-btn w-full whitespace-nowrap !min-h-[2.4rem] !gap-1 !px-2 !text-[0.95rem]"
            onClick={() => event("CODE_CLICK")}
          >
            Ir a la tienda <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </span>
      </div>
      {!expandable && (
        // Sin «Ver más», su hueco queda vacío: el código y los botones están a la misma altura en todas las tarjetas.
        <span aria-hidden className="invisible mt-2 inline-flex items-center gap-1 py-1 text-[0.78rem] font-medium">
          Ver más <ChevronDown className="h-3.5 w-3.5" />
        </span>
      )}
      {expandable && (
        <details className="group mt-2 w-full text-left" data-code-details>
          <summary className="cp-muted mx-auto flex w-fit cursor-pointer list-none items-center gap-1 py-1 text-[0.78rem] font-medium [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver más</span>
            <span className="hidden group-open:inline">Ver menos</span>
            <ChevronDown aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="pt-2" data-code-more>
            {recs.length > 0 && (
              <div className="mb-3">
                <p className="cp-display text-center text-[1.15rem] leading-tight">Recomendaciones</p>
                <ul className="mt-2 space-y-1.5 text-[0.84rem] leading-snug">
                  {recs.map((r, k) => (
                    <li key={k} className="flex gap-2">
                      <span aria-hidden className="cp-gold mt-[0.42em] h-1 w-1 shrink-0 rounded-full bg-current" />
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener nofollow sponsored"
                          className="group/rec inline-flex min-w-0 items-start gap-1 underline decoration-[color-mix(in_oklab,var(--c-gold)_45%,transparent)] underline-offset-[3px] transition hover:decoration-[var(--c-gold)]"
                          onClick={() => event("CODE_CLICK")}
                        >
                          <span>{r.text}</span>
                          <ArrowUpRight aria-hidden className="cp-gold mt-[0.15em] h-3.5 w-3.5 shrink-0 transition-transform group-hover/rec:-translate-y-0.5 group-hover/rec:translate-x-0.5" />
                        </a>
                      ) : (
                        <span>{r.text}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {photos.length > 0 && <PhotoGallery photos={photos} label={`Lo que me gusta de ${code.brand}`} />}
          </div>
        </details>
      )}
    </article>
  );
}
