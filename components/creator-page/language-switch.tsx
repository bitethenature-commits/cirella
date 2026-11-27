"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LOCALE_COOKIE, LOCALE_NAME, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { useLocale, useT, Tr } from "@/lib/i18n/client";

/**
 * El idioma de la web (arriba a la derecha, junto a «Entrar» / «Mi área»): alemán, inglés o español. Al elegir uno se
 * guarda en una cookie y se abre la misma página en ese idioma (el alemán sin nada delante; /en/… y /es/…).
 *   · pill: barra de arriba de la portada (fondo sólido, como la entrada al área);
 *   · header: cabecera de las demás páginas.
 */
export function LanguageSwitch({ variant }: { variant: "pill" | "header" }) {
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (l: Locale) => {
    setOpen(false);
    if (l === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const { pathname, search, hash } = window.location;
    window.location.assign(`${localePath(pathname, l)}${search}${hash}`);
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("Idioma")}: ${LOCALE_NAME[locale]}`}
        className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold"
        style={
          variant === "pill"
            ? { background: "color-mix(in oklab, var(--c-bg) 92%, transparent)", color: "var(--c-text)", boxShadow: "0 1px 6px rgb(0 0 0 / 0.12)" }
            : { border: "1px solid var(--c-line)" }
        }
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span className="uppercase"><Tr s={locale} /></span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul
          role="menu"
          aria-label={t("Idioma")}
          className="absolute right-0 top-full z-40 mt-2 min-w-[10rem] overflow-hidden rounded-2xl p-1 text-sm"
          style={{ background: "var(--c-bg)", color: "var(--c-text)", border: "1px solid var(--c-line)", boxShadow: "0 14px 34px -12px rgb(0 0 0 / .45)" }}
        >
          {LOCALES.map((l) => (
            <li key={l} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                lang={l}
                onClick={() => choose(l)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:opacity-80"
                style={l === locale ? { background: "color-mix(in oklab, var(--c-gold) 16%, transparent)" } : undefined}
              >
                <span className="w-6 text-xs font-semibold uppercase" style={{ color: "var(--c-gold)" }}>
                  <Tr s={l} />
                </span>
                <span className="flex-1"><Tr s={LOCALE_NAME[l]} /></span>
                {l === locale && <Check className="h-4 w-4" style={{ color: "var(--c-gold)" }} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
