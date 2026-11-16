import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Check, Moon } from "lucide-react";
import { SpinningSolid } from "@/app/cuenta/spinning-solid";
import { TIER_ICONS } from "./tier-icons";
import type { TierFeature } from "@/lib/tier-features";

export const LEVEL_NUMERALS = ["I", "II", "III", "IV", "V"];

/**
 * El portal en arco de un nivel de la comunidad: el mismo en la web (/comunidad), en el área de alumno
 * («Mis membresías») y en el panel (Comunidad → Cartas). Foto de fondo velada, el sólido del nivel
 * girando, «Nivel I», el nombre y la frase; lo que va debajo (precio, lo que incluye, botón) lo pone
 * cada sitio. Sus colores son siempre los suyos (noche y oro), así se ve igual en todas partes.
 */
export function TierPortal({
  level,
  image,
  title,
  intro,
  children,
  bottom,
  href,
  open = true,
  badge,
  media,
  ariaLabel,
  className = "",
  style,
  as = "div",
}: {
  level: number;
  image: string | null;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  bottom?: ReactNode;
  href?: string;
  open?: boolean;
  badge?: string | null;
  /** Encima de la foto (en el panel: el botón para cambiarla). */
  media?: ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section";
}) {
  const cls = `portal tier-portal group relative isolate flex min-h-[26rem] flex-col items-center overflow-hidden rounded-b-[2rem] rounded-t-[999px] px-6 pb-7 pt-16 text-center md:min-h-[34rem] ${open ? "is-open" : "is-locked"} ${className}`;
  const inner = (
    <>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="portal-img absolute inset-0 -z-20 h-full w-full object-cover" />
      )}
      <span aria-hidden className="portal-veil absolute inset-0 -z-10" />
      <span aria-hidden className="portal-arch pointer-events-none absolute inset-3 rounded-b-[1.6rem] rounded-t-[999px]" />
      <span aria-hidden className="portal-rays pointer-events-none absolute inset-0 -z-10" />
      {media}
      <span className="portal-emblem relative grid h-16 w-16 place-items-center rounded-full text-[#d4b57a]" aria-hidden>
        <SpinningSolid level={level} offset={level * 1.3} className="plat-glow h-11 w-11" />
      </span>
      {badge && <span className="tier-portal-badge relative mt-4 rounded-full px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em]">{badge}</span>}
      <p className="relative mt-5 text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-[#d4b57a]/90">Nivel {LEVEL_NUMERALS[level] ?? level + 1}</p>
      <h2 className="tier-portal-title display relative mt-2 w-full text-[2.4rem] leading-none md:text-[2.7rem]">{title}</h2>
      <span aria-hidden className="relative mt-4 h-px w-16 bg-gradient-to-r from-transparent via-[#d4b57a]/70 to-transparent" />
      {intro && <div className="tier-portal-intro relative mt-4 w-full max-w-[17rem] font-serif text-[1.02rem] leading-relaxed">{intro}</div>}
      {children}
      {bottom && <div className="portal-bottom relative mt-auto flex w-full flex-col items-center pt-6">{bottom}</div>}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls} style={style} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  const Tag = as;
  return (
    <Tag className={cls} style={style} aria-label={ariaLabel}>
      {inner}
    </Tag>
  );
}

/** El precio dentro del portal. */
export function PortalPrice({ price, interval, regular, saleLine }: { price: ReactNode; interval?: string | null; regular?: string | null; saleLine?: string | null }) {
  return (
    <div className="relative mt-5">
      <p className="flex items-baseline justify-center gap-1">
        {regular && <s className="tier-portal-muted mr-1.5 text-sm">{regular}</s>}
        <span className="display text-[2.5rem] font-light leading-none">{price}</span>
        {interval && <span className="tier-portal-muted text-sm"> /{interval}</span>}
      </p>
      {saleLine && <p className="mt-1 text-xs font-semibold text-[#d4b57a]">{saleLine}</p>}
    </div>
  );
}

/** «Todo lo de Esencia · Y además:». */
export function PortalIncludes({ title }: { title: string }) {
  return (
    <li className="tier-portal-includes flex items-center gap-3 rounded-2xl px-3 py-2.5">
      <span className="portal-emblem grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#d4b57a]" aria-hidden>
        <Check className="h-4 w-4" />
      </span>
      <span>
        <strong className="font-semibold">Todo lo de {title}</strong>
        <span className="tier-portal-muted block text-[0.82rem]">Y además:</span>
      </span>
    </li>
  );
}

/** Una línea de lo que incluye, con su icono. */
export function PortalFeature({ f }: { f: TierFeature }) {
  const Icon = TIER_ICONS[f.icon];
  return (
    <li className="flex items-start gap-3">
      <span className="portal-emblem mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#d4b57a]" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <strong className="block font-semibold leading-snug">{f.title}</strong>
        {f.detail && <span className="tier-portal-muted block text-[0.84rem] leading-snug">{f.detail}</span>}
      </span>
    </li>
  );
}

/** La caja de los próximos círculos (en el nivel más alto). */
export function PortalCircles({ circles, note }: { circles: string[]; note?: string }) {
  return (
    <div className="tier-portal-box relative mt-5 w-full rounded-2xl p-3.5 text-left text-[0.82rem]">
      <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[#d4b57a]">
        <Moon className="h-3 w-3" /> Próximos círculos
      </p>
      <ul className="mt-2 space-y-1">
        {circles.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
      {note && <p className="tier-portal-muted mt-2 text-[0.72rem] italic">{note}</p>}
    </div>
  );
}

/** El botón de abajo: dorado en el nivel destacado, con borde dorado en los demás. */
export const portalButton = (strong: boolean) =>
  `${strong ? "portal-cta" : "tier-portal-ghost"} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold`;
