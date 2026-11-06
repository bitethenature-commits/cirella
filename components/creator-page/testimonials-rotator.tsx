"use client";

import { useEffect, useState } from "react";

type Testimonial = { id: string; quote: string; author: string; role?: string | null };

/** Cada cuánto pasa sola a la siguiente opinión. */
const EVERY_MS = 7000;

/**
 * «Lo que dicen»: una opinión cada vez, en texto y sin caja, con puntitos para pasar de una a otra.
 * Pasa sola cada 7 segundos (se para mientras el ratón está encima, y no se mueve si la persona
 * pidió menos movimiento en su sistema). Sin JavaScript se ve la primera.
 */
export function TestimonialsRotator({ items }: { items: Testimonial[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % n), EVERY_MS);
    return () => window.clearTimeout(t);
  }, [i, n, paused]);

  if (!n) return null;
  const t = items[Math.min(i, n - 1)];
  return (
    <div className="mt-6 text-center" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} data-testimonials>
      <figure key={t.id} className="mx-auto max-w-xl animate-[fade-in_.6s_ease]" aria-live="polite">
        <blockquote className="cp-display text-[1.45rem] leading-snug sm:text-[1.7rem]">“{t.quote}”</blockquote>
        <figcaption className="mt-4 text-sm">
          <span className="font-semibold">{t.author}</span>
          {t.role && <span className="cp-muted"> · {t.role}</span>}
        </figcaption>
      </figure>
      {n > 1 && (
        <div className="mt-6 flex justify-center gap-1" role="group" aria-label="Elegir opinión">
          {items.map((x, k) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setI(k)}
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
