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
 * Un código de descuento de otra marca, en una fila compacta (caben 3 o 4 en la pantalla de un móvil):
 * el logo, la marca y una línea de descripción; debajo, el código con «Copiar» e «Ir a la tienda», que
 * se usan sin desplegar nada (están fuera del <summary>, así que no abren ni cierran la fila). Al
 * desplegarla (un <details> nativo: funciona sin JavaScript) se ven la descripción entera y las fotos
 * de lo que recomienda de esa marca, que se amplían al tocarlas. Los dos clics se miden en /api/track
 * sin cookies. Si el navegador no deja copiar, se selecciona el código para copiarlo a mano.
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
  // Se despliega si hay algo más que ver: fotos o una descripción que no cabe en una línea.
  const expandable = photos.length > 0 || (code.description?.length ?? 0) > 60;
  const header = (
    <>
      {code.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={code.imageUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="cp-display grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
          style={{
            background: "color-mix(in oklab, var(--c-accent) 22%, transparent)",
          }}
        >
          {code.brand.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <h3 className="truncate text-[0.98rem] font-semibold leading-tight">{code.brand}</h3>
        {/* La misma línea dice «Código copiado»: el aviso no mueve nada. */}
        <span className="block truncate text-[0.8rem] leading-snug" aria-live="polite">
          {state === "copied" ? (
            <span className="cp-gold font-medium">Código copiado. Pégalo al pagar en la tienda.</span>
          ) : state === "manual" ? (
            <span className="cp-gold font-medium">Mantén pulsado el código para copiarlo.</span>
          ) : (
            <span className="cp-muted">{code.description || code.expiresLabel || "\u00a0"}</span>
          )}
        </span>
      </span>
    </>
  );

  return (
    <article className="cp-card group/code flex min-w-0 flex-col" style={{ overflow: "visible" }} aria-label={`Código de descuento de ${code.brand}`} data-code-row={code.code}>
      {expandable ? (
        <details className="group" data-code-details>
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 pt-3 [&::-webkit-details-marker]:hidden">
            {header}
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
        </details>
      ) : (
        <div className="flex items-center gap-3 px-4 pt-3">{header}</div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pt-2.5">
        {/* Un código corto cabe siempre en una línea; uno largo (hasta 40 caracteres) ocupa la fila entera
            y, si aun así no cabe, se parte: se ve entero, nunca recortado. Los botones pasan debajo. */}
        <code
          ref={codeRef}
          className={`flex min-h-[2.4rem] flex-1 select-all items-center justify-center break-all rounded-lg border border-dashed px-2 py-1 text-center font-mono text-[0.8rem] font-semibold leading-tight ${code.code.length > 12 ? "tracking-[0.02em]" : "tracking-[0.06em]"}`}
          style={{
            borderColor: "color-mix(in oklab, var(--c-text) 35%, transparent)",
            // El ancho justo del código (letras, su espaciado y el margen): nunca se parte uno corto.
            minWidth: `min(100%, calc(${code.code.length}ch + ${(code.code.length * (code.code.length > 12 ? 0.02 : 0.06)).toFixed(2)}em + 1.3rem))`,
          }}
        >
          {code.code}
        </code>
        <span className="flex shrink-0 grow gap-1.5">
          <button
            type="button"
            onClick={onCopy}
            className="cp-btn-ghost flex-[1_0_auto] whitespace-nowrap !min-h-[2.4rem] !px-2 !text-[0.8rem]"
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
            className="cp-btn flex-[1_0_auto] whitespace-nowrap !min-h-[2.4rem] !gap-1 !px-2 !text-[0.8rem]"
            onClick={() => event("CODE_CLICK")}
          >
            Ir a la tienda <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </span>
      </div>
      {expandable && (
        // Fuera del <details> para que se vea debajo de los botones; sale al desplegar la fila.
        <div className="hidden px-4 pb-4 group-has-[details[open]]/code:block" data-code-more>
          {code.description && <p className="cp-muted text-[0.88rem] leading-relaxed">{code.description}</p>}
          {code.expiresLabel && <p className="cp-faint mt-1 text-xs">{code.expiresLabel}</p>}
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2" aria-label={`Lo que me gusta de ${code.brand}`} role="group">
              {photos.map((ph, i) => (
                <ZoomableImage
                  key={`${ph.src}-${i}`}
                  src={ph.src}
                  srcSet={imageSrcSet(ph.src, ph.width)}
                  sizes="(min-width: 768px) 110px, 30vw"
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
      )}
    </article>
  );
}
