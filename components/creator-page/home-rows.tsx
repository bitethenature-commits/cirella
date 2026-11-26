import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Lo de dentro de los desplegables de la portada («Actualidades», «Portal de noticias», «Ofertas»): filas
 * elegantes y fáciles de leer, cada una con su foto pequeña (la suya o, si no tiene, la de la web), una
 * línea de contexto arriba, el título, un texto corto y, a la derecha, lo importante (el precio) o la flecha.
 * Y los emblemas de cada sección: el megáfono, el portal con su nota y el % de las ofertas.
 */

/** El emblema redondo de la fila del desplegable. */
export function SectionEmblem({ children }: { children: ReactNode }) {
  return (
    <span className="cp-emblem grid h-12 w-12 shrink-0 place-items-center rounded-full sm:h-14 sm:w-14" aria-hidden>
      {children}
    </span>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Un megáfono de línea fina, con sus ondas. */
export function MegaphoneIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...stroke}>
      <path d="M5 13.5v5a1.5 1.5 0 0 0 1.5 1.5H9l9 5.5V6.5L9 12H6.5A1.5 1.5 0 0 0 5 13.5Z" />
      <path d="M10 20l1.6 5.4a1.4 1.4 0 0 0 2.7-.8L13 20.4" />
      <path d="M22 12.5a5 5 0 0 1 0 7" />
      <path d="M25 9.5a9.5 9.5 0 0 1 0 13" opacity=".6" />
    </svg>
  );
}

/** Un portal en arco con una nota que sale de él. */
export function PortalNoteIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...stroke}>
      <path d="M6 28V14a8 8 0 0 1 16 0v14" />
      <path d="M3.5 28h21" />
      <path d="M9.5 28V15a4.5 4.5 0 0 1 9 0v13" opacity=".55" />
      <path d="M19 9.5l7.5-2.5 2 6.2-7.5 2.5Z" />
      <path d="M21.4 10.6l3.9-1.3M22 12.6l3.9-1.3" opacity=".7" />
      <path d="M14 6.5v-2M10.5 7.5l-1-1.6M17.5 7.5l1-1.6" opacity=".5" />
    </svg>
  );
}

/** Un % elegante, con un aro fino alrededor. */
export function PercentIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...stroke}>
      <circle cx="16" cy="16" r="12.5" opacity=".45" />
      <path d="M21 10.5L11 21.5" />
      <circle cx="11.6" cy="11.8" r="2.3" />
      <circle cx="20.4" cy="20.2" r="2.3" />
    </svg>
  );
}

export type HomeRowData = {
  key: string;
  href: string;
  external?: boolean;
  image: string | null;
  /** Lo que sale si no hay foto (ni la propia ni la de la web). */
  icon: ReactNode;
  eyebrow: ReactNode;
  title: string;
  text?: ReactNode;
  /** A la derecha: el precio de una oferta… (sin él, la flecha). */
  aside?: ReactNode;
  /** Sobre la foto: el candado, el −30 %… */
  badge?: ReactNode;
  locked?: boolean;
};

export function HomeRows({ rows, fallbackImage }: { rows: HomeRowData[]; fallbackImage: string | null }) {
  return (
    <ul className="space-y-3" data-home-rows>
      {rows.map((r) => {
        const img = r.image ?? fallbackImage;
        const inner = (
          <>
            <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24" style={{ boxShadow: "0 0 0 1px color-mix(in oklab, var(--c-gold) 35%, transparent)" }}>
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" loading="lazy" decoding="async" className={`cp-img absolute inset-0 h-full w-full object-cover ${r.locked ? "blur-[2px] saturate-50" : ""}`} />
              ) : (
                <span className="absolute inset-0 grid place-items-center" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 40%, var(--c-bg)), color-mix(in oklab, var(--c-gold) 28%, var(--c-bg)))" }}>
                  {r.icon}
                </span>
              )}
              {r.locked && (
                <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
                  <Lock className="h-5 w-5" />
                </span>
              )}
              {r.badge}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="cp-gold flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em]">{r.eyebrow}</span>
              <span className="cp-display line-clamp-2 text-[1.28rem] leading-[1.15] sm:text-[1.4rem]">{r.title}</span>
              {r.text && <span className="cp-muted line-clamp-2 text-[0.86rem] leading-snug">{r.text}</span>}
            </span>
            {r.aside ?? <ChevronRight aria-hidden className="cp-faint h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />}
          </>
        );
        const cls = "cp-card cp-card-hover group flex items-center gap-4 p-3 sm:gap-5 sm:p-4";
        return (
          <li key={r.key}>
            {r.external ? (
              <a href={r.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {inner}
              </a>
            ) : (
              <Link href={r.href} className={cls}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
