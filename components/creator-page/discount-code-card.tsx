"use client";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicDiscountCode } from "./creator-page-view";
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
 * Tarjeta de un código de descuento de otra marca: «Copiar código» (con aviso «Copiado») e «Ir a
 * la tienda». Los dos clics se miden en /api/track sin cookies. Si el navegador no deja copiar, se
 * selecciona el código para copiarlo a mano.
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

  return (
    <article className="cp-card flex h-full flex-col p-5" aria-label={`Código de descuento de ${code.brand}`}>
      <div className="flex items-center gap-3">
        {code.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={code.imageUrl} alt="" loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="cp-display grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg"
            style={{ background: "color-mix(in oklab, var(--c-accent) 22%, transparent)" }}
          >
            {code.brand.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[1.02rem] font-semibold">{code.brand}</h3>
          {code.expiresLabel && <p className="cp-faint text-xs">{code.expiresLabel}</p>}
        </div>
      </div>
      {code.description && <p className="cp-muted mt-3 text-[0.9rem] leading-relaxed">{code.description}</p>}
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-stretch gap-2">
          {/* Sin truncate: un código largo (hasta 40 caracteres) se parte en varias líneas y se ve entero, nunca recortado.
              Uno corto cabe siempre en una línea: si no hay sitio al lado, el botón pasa debajo. */}
          <code
            ref={codeRef}
            className={`flex flex-1 select-all items-center justify-center break-all rounded-xl border border-dashed px-3 py-2 text-center font-mono text-base font-semibold ${code.code.length > 16 ? "tracking-[0.04em]" : "tracking-[0.12em]"}`}
            style={{ borderColor: "color-mix(in oklab, var(--c-text) 35%, transparent)", minWidth: `min(100%, ${Math.ceil(code.code.length * 1.2) + 3}ch)` }}
          >
            {code.code}
          </code>
          <button type="button" onClick={onCopy} className="cp-btn-ghost shrink-0" aria-label={state === "copied" ? `Copiado: ${code.code}` : `Copiar código ${code.code}`}>
            {/* Los dos textos ocupan el mismo sitio: el botón no cambia de ancho al copiar y nada salta de línea. */}
            <span className="grid place-items-center">
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${state === "copied" ? "invisible" : ""}`}>
                <Copy className="h-4 w-4" /> Copiar código
              </span>
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${state === "copied" ? "" : "invisible"}`}>
                <Check className="h-4 w-4" /> Copiado
              </span>
            </span>
          </button>
        </div>
        <p className="cp-faint mt-1.5 min-h-[1rem] text-xs" aria-live="polite">
          {state === "copied" ? "Código copiado. Pégalo al pagar en la tienda." : state === "manual" ? "Mantén pulsado el código para copiarlo." : ""}
        </p>
        <a
          href={code.url}
          target="_blank"
          rel="noopener nofollow sponsored"
          className="cp-btn mt-2 w-full"
          onClick={() => event("CODE_CLICK")}
        >
          Ir a la tienda <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}
