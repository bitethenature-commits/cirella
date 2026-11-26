"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tr } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";

type Testimonial = { id: string; quote: string; author: string; role?: string | null };

/** Cada cuánto pasa sola a la siguiente opinión. */
const EVERY_MS = 7000;

/**
 * «Lo que dicen»: una opinión cada vez, en texto y sin caja, con puntitos para pasar de una a otra.
 * Siempre ocupa lo mismo (cuatro líneas de texto, tenga la opinión 2, 3 o 4), así que nada salta al
 * cambiar. Si una es más larga, se corta y «Leer más» la abre entera. Pasa sola cada 7 segundos (se
 * para con el ratón encima o con una abierta, y no se mueve si la persona pidió menos movimiento en
 * su sistema). Sin JavaScript se ve la primera.
 */
export function TestimonialsRotator({ items }: { items: Testimonial[] }) {
  const tt = useT();
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const n = items.length;

  // ¿No cabe en las cuatro líneas? Se mide con el texto cortado (al cambiar de opinión o de ancho).
  useLayoutEffect(() => {
    const measure = () => {
      const el = quoteRef.current;
      if (el && !open) setLong(el.scrollHeight > el.clientHeight + 2);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [i, open]);

  useEffect(() => {
    if (n < 2 || hover || open) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % n), EVERY_MS);
    return () => window.clearTimeout(t);
  }, [i, n, hover, open]);

  const goTo = (k: number) => {
    setOpen(false);
    setI(k);
  };

  if (!n) return null;
  const t = items[Math.min(i, n - 1)];
  return (
    <div className="mt-6 text-center" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} data-testimonials>
      <figure key={t.id} className="mx-auto max-w-xl animate-[fade-in_.6s_ease]" aria-live="polite">
        {/* Cuatro líneas de alto siempre; las cortas quedan centradas en ese hueco. */}
        <div className={`flex flex-col justify-center ${open ? "" : "h-[calc(4*1.375*1.45rem)] sm:h-[calc(4*1.375*1.7rem)]"}`}>
          <blockquote ref={quoteRef} className={`cp-display text-[1.45rem] leading-snug sm:text-[1.7rem] ${open ? "" : "line-clamp-4"}`}>
            “<Tr s={t.quote} />”
          </blockquote>
        </div>
        {/* El hueco de «Leer más» está siempre (vacío si no hace falta): la altura no cambia. */}
        <div className="h-8">
          {(long || open) && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="cp-gold inline-flex items-center gap-1 py-1.5 text-sm font-semibold" aria-expanded={open}>
              {open ? <Tr s={"Leer menos"} /> : <Tr s={"Leer más"} />}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
          )}
        </div>
        <figcaption className="mt-2 text-sm">
          <span className="font-semibold"><Tr s={t.author} /></span>
          {t.role && <span className="cp-muted"> · <Tr s={t.role} /></span>}
        </figcaption>
      </figure>
      {n > 1 && (
        <div className="mt-5 flex justify-center gap-1" role="group" aria-label={tt("Elegir opinión")}>
          {items.map((x, k) => (
            <button
              key={x.id}
              type="button"
              onClick={() => goTo(k)}
              aria-label={`Opinión ${k + 1} de ${n}`}
              aria-current={k === i ? "true" : undefined}
              className="grid h-6 w-6 place-items-center"
            >
              <span
                className="block h-2 rounded-full transition-all duration-300"
                style={{ width: k === i ? "1.25rem" : "0.5rem", background: k === i ? "var(--c-gold)" : "color-mix(in oklab, var(--c-text) 30%, transparent)" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
