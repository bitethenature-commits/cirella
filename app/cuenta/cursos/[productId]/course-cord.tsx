"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Lock } from "lucide-react";
import type { OutlineModule } from "./course-outline";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

type Tip = { key: string; top: number; left: number; title: string; sub: string; href: string | null };

/**
 * El programa del curso como un cordel dorado (como la trayectoria de «Sobre mí»): cada lección es un
 * nudo con su número romano; los módulos, un rombo pequeño. Al pasar el ratón (o al tocarlo en una
 * pantalla táctil) sale el nombre en una ventanita; con el ratón, el clic abre la lección; al tocar,
 * el primer toque enseña el nombre y el segundo la abre. La ventanita se pinta fuera de la página (en
 * <body>, por encima de todo): dentro, la animación de entrada del área la dejaba detrás.
 */
export function CourseCord({ modules, base, done, currentId }: { modules: OutlineModule[]; base: string; done: string[]; currentId: string | null }) {
  const router = useRouter();
  const doneSet = new Set(done);
  const [tip, setTip] = useState<Tip | null>(null);
  const pointer = useRef<string>("mouse");
  // La ventanita va fija en pantalla: al desplazar la página se cierra.
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [tip]);

  const show = (el: HTMLElement, t: Omit<Tip, "top" | "left">) => {
    const r = el.getBoundingClientRect();
    setTip({ ...t, top: r.top + r.height / 2, left: r.right + 10 });
  };

  let n = 0;
  return (
    <div className="relative" onMouseLeave={() => pointer.current === "mouse" && setTip(null)}>
      <span
        aria-hidden
        className="absolute bottom-4 left-1/2 top-4 w-[2px] -translate-x-1/2 rounded-full"
        style={{ background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-gold, #B08D4F) 75%, transparent) 4%, color-mix(in oklab, var(--color-gold, #B08D4F) 45%, transparent) 92%, transparent)" }}
      />
      <ol className="relative flex flex-col items-center gap-3 py-2" aria-label="Lecciones del curso">
        {modules.map((m, mi) => (
          <li key={m.id} className="flex w-full flex-col items-center gap-3">
            <button
              type="button"
              className="grid h-6 w-6 rotate-45 place-items-center rounded-[4px] border border-gold bg-paper"
              aria-label={`Módulo ${mi + 1}: ${m.title}`}
              onPointerDown={(e) => (pointer.current = e.pointerType)}
              onMouseEnter={(e) => show(e.currentTarget, { key: m.id, title: m.title, sub: `Módulo ${mi + 1} · ${m.lessons.length} ${m.lessons.length === 1 ? "lección" : "lecciones"}`, href: null })}
              onClick={(e) => show(e.currentTarget, { key: m.id, title: m.title, sub: `Módulo ${mi + 1} · ${m.lessons.length} ${m.lessons.length === 1 ? "lección" : "lecciones"}`, href: null })}
            >
              <span className="-rotate-45 text-[0.55rem] font-semibold text-gold">{mi + 1}</span>
            </button>
            <ol className="flex flex-col items-center gap-2.5">
              {m.lessons.map((l) => {
                n++;
                const num = n;
                const href = `${base}?leccion=${l.id}`;
                const active = l.id === currentId;
                const isDone = doneSet.has(l.id);
                const sub = l.lockedLabel ?? (active ? "Estás aquí" : isDone ? "Completada" : `Lección ${roman(num)}`);
                const t = { key: l.id, title: l.title, sub, href };
                return (
                  <li key={l.id}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      aria-label={`Lección ${num}: ${l.title}${isDone ? ", completada" : ""}${l.lockedLabel ? `, ${l.lockedLabel}` : ""}`}
                      onPointerDown={(e) => (pointer.current = e.pointerType)}
                      onMouseEnter={(e) => pointer.current === "mouse" && show(e.currentTarget, t)}
                      onFocus={(e) => show(e.currentTarget, t)}
                      onBlur={() => setTip(null)}
                      onClick={(e) => {
                        // Al tocar: el primer toque enseña el nombre; el segundo abre la lección.
                        if (pointer.current !== "mouse" && tip?.key !== l.id) {
                          e.preventDefault();
                          show(e.currentTarget, t);
                        }
                      }}
                      className={`relative grid h-11 w-11 place-items-center rounded-full border font-[Georgia,serif] text-[0.85rem] transition ${
                        active
                          ? "border-ink bg-ink text-gold shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-gold,#B08D4F)_25%,transparent)]"
                          : isDone
                            ? "border-gold bg-gold/90 text-ink"
                            : l.lockedLabel
                              ? "border-line bg-paper text-muted"
                              : "border-gold/70 bg-paper text-ink hover:bg-sand"
                      }`}
                      data-locked={l.lockedLabel ? "" : undefined}
                    >
                      {roman(num)}
                      {isDone && !active && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-cream">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {l.lockedLabel && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-sand text-muted">
                          <Lock className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {tip &&
        createPortal(
        <div
          role="tooltip"
          className="fixed z-[100] w-64 -translate-y-1/2 rounded-2xl bg-ink p-3.5 text-sm text-cream shadow-[0_18px_40px_-12px_rgba(14,16,36,0.55)]"
          style={{ top: tip.top, left: tip.left }}
          onMouseLeave={() => setTip(null)}
        >
          <span aria-hidden className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-ink" />
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-gold">{tip.sub}</p>
          <p className="display mt-0.5 text-[1.15rem] leading-snug">{tip.title}</p>
          {tip.href && pointer.current !== "mouse" && (
            <button type="button" className="mt-2 text-xs font-semibold text-gold underline underline-offset-2" onClick={() => router.push(tip.href!)}>
              Abrir la lección →
            </button>
          )}
        </div>,
          document.body,
        )}
    </div>
  );
}
