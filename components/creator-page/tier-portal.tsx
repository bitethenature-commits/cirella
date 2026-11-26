import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Check, Moon } from "lucide-react";
import { SpinningSolid } from "@/app/area/spinning-solid";
import { DecorCanvas } from "@/components/decor-fx/decor-canvas";
import { TIER_ICONS } from "./tier-icons";
import { TierMotion } from "./tier-motion";
import { isDrawnScene, TierFrameArt, TierSceneArt } from "./tier-scenes";
import { figurePaths } from "@/lib/sacred-figures";
import { defaultEmblem, type TierEmblem } from "@/lib/tier-card";
import { resolveTierLook, tierFxVars, tierLookVars, type ResolvedTierLook, type TierLook } from "@/lib/tier-look";
import type { TierFeature } from "@/lib/tier-features";
import { Tr } from "@/lib/i18n/client";

export const LEVEL_NUMERALS = ["I", "II", "III", "IV", "V"];

/** Los atributos que leen sus estilos (globals.css → «Tarjetas de miembro»): paisaje, marco, si se dibuja y si se inclina. */
function lookAttrs(r: ResolvedTierLook, tilt: boolean) {
  return {
    "data-scene": r.scene,
    "data-frame": r.frame,
    ...(isDrawnScene(r.scene) ? { "data-drawn": "" } : {}),
    ...(tilt ? { "data-tilt": "" } : {}),
  };
}

/** Lo de detrás: su foto o su paisaje, el velo, lo que se mueve (solo en la tarjeta de verdad) y el marco. */
function Backdrop({ r, live }: { r: ResolvedTierLook; live: boolean }) {
  return (
    <>
      {r.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image} alt="" className="portal-img absolute inset-0 -z-20 h-full w-full object-cover" />
      )}
      <TierSceneArt scene={r.scene} />
      <span aria-hidden className="portal-veil absolute inset-0 -z-10" />
      {live && r.fx !== "none" && (
        <span aria-hidden className="tp-fx" style={tierFxVars(r) as CSSProperties}>
          <DecorCanvas decor={r.fx} contained />
        </span>
      )}
      <span aria-hidden className="portal-arch pointer-events-none absolute inset-3 rounded-b-[1.6rem] rounded-t-[999px]" />
      <TierFrameArt frame={r.frame} />
      <span aria-hidden className="portal-rays pointer-events-none absolute inset-0 -z-10" />
    </>
  );
}

/**
 * La tarjeta en arco de un nivel de la comunidad (su portal): la misma en la web (/membership), en el área de alumno
 * («Mis membresías») y en el panel (Comunidad → Cartas). Detrás, su diseño propio (lib/tier-look.ts): un paisaje de
 * ensueño dibujado o su foto, lo que se mueve encima, el marco del arco y sus colores; sin diseño, su foto velada o
 * la noche y el oro de siempre. Delante, el icono del nivel girando (un sólido, una figura sagrada o su imagen),
 * «Nivel I», el nombre y la frase; lo que va debajo (precio, lo que incluye, botón) lo pone cada sitio.
 * `tilt`: se inclina hacia el ratón (no mientras se escribe encima). `onEmblem`: el icono es un botón (Mi página).
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
  emblem,
  look,
  tilt = true,
  onEmblem,
}: {
  level: number;
  image: string | null;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  bottom?: ReactNode;
  href?: string;
  open?: boolean;
  badge?: ReactNode;
  /** Encima del fondo (en Mi página: las ventanitas del icono). */
  media?: ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section";
  emblem?: TierEmblem;
  look?: TierLook;
  tilt?: boolean;
  onEmblem?: () => void;
}) {
  const r = resolveTierLook(look, image);
  const cls = `portal tier-portal group relative isolate flex min-h-[26rem] flex-col items-center overflow-hidden rounded-b-[2rem] rounded-t-[999px] px-6 pb-7 pt-16 text-center md:min-h-[34rem] ${open ? "is-open" : "is-locked"} ${className}`;
  const css = { ...tierLookVars(r), ...style } as CSSProperties;
  const attrs = lookAttrs(r, tilt);
  const icon = <TierEmblemIcon emblem={emblem} level={level} />;
  const inner = (
    <>
      <Backdrop r={r} live />
      {media}
      {onEmblem ? (
        <button type="button" onClick={onEmblem} className="portal-emblem tp-gold relative grid h-16 w-16 place-items-center rounded-full transition hover:brightness-125" aria-label="Cambiar el icono del nivel" title="Cambiar el icono">
          {icon}
        </button>
      ) : (
        <span className="portal-emblem tp-gold relative grid h-16 w-16 place-items-center rounded-full" aria-hidden>
          {icon}
        </span>
      )}
      {badge && <span className="tier-portal-badge relative mt-4 rounded-full px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em]">{badge}</span>}
      <p className="tp-gold relative mt-5 text-[0.6rem] font-semibold uppercase tracking-[0.32em] opacity-90"><Tr s={"Nivel"} />{" "}<Tr s={LEVEL_NUMERALS[level] ?? level + 1} /></p>
      <h2 className="tier-portal-title display relative mt-2 w-full text-[2.4rem] leading-none md:text-[2.7rem]">{title}</h2>
      <span aria-hidden className="tp-rule relative mt-4 h-px w-16" />
      {intro && <div className="tier-portal-intro relative mt-4 w-full max-w-[17rem] font-serif text-[1.02rem] leading-relaxed">{intro}</div>}
      {children}
      {bottom && <div className="portal-bottom relative mt-auto flex w-full flex-col items-center pt-6">{bottom}</div>}
      <span aria-hidden className="tp-glare" />
      <TierMotion />
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls} style={css} aria-label={ariaLabel} {...attrs}>
        {inner}
      </Link>
    );
  const Tag = as;
  return (
    <Tag className={cls} style={css} aria-label={ariaLabel} {...attrs}>
      {inner}
    </Tag>
  );
}

/**
 * La tarjeta en pequeño, sin texto (las muestras del Diseño de cada nivel en Mi página): su paisaje, su marco, sus
 * colores y el círculo del icono, en el tamaño de una tarjeta de verdad (la muestra la encoge con CSS).
 */
export function TierBackdrop({ look, image }: { look: TierLook; image: string | null }) {
  const r = resolveTierLook(look, image);
  return (
    <span className="portal tier-portal is-open tp-thumb-card relative isolate block overflow-hidden rounded-b-[2rem] rounded-t-[999px]" style={tierLookVars(r) as CSSProperties} {...lookAttrs(r, false)}>
      <Backdrop r={r} live={false} />
      <span className="portal-emblem absolute left-1/2 top-16 h-16 w-16 -translate-x-1/2 rounded-full" />
    </span>
  );
}

/**
 * El icono de un nivel: su sólido girando en tres dimensiones, su figura sagrada girando despacio o su imagen en el
 * círculo. Sin elegir, el de su nivel (I tetraedro, II icosaedro, III dodecaedro).
 */
export function TierEmblemIcon({ emblem, level, className = "h-11 w-11" }: { emblem?: TierEmblem; level: number; className?: string }) {
  const e = emblem ?? defaultEmblem(level);
  if (e.kind === "image")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={e.src} alt="" className="absolute inset-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-full object-cover" />;
  if (e.kind === "figure")
    return (
      <svg viewBox="-6 -6 212 212" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" className={`tp-figure plat-glow ${className}`} aria-hidden>
        <path d={figurePaths(e.key).join(" ")} />
      </svg>
    );
  return <SpinningSolid level={level} solid={e.key} offset={level * 1.3} className={`plat-glow ${className}`} />;
}

/** El precio dentro del portal. */
export function PortalPrice({ price, interval, regular, saleLine }: { price: ReactNode; interval?: string | null; regular?: string | null; saleLine?: string | null }) {
  return (
    <div className="relative mt-5">
      <p className="flex items-baseline justify-center gap-1">
        {regular && <s className="tier-portal-muted mr-1.5 text-sm"><Tr s={regular} /></s>}
        <span className="display text-[2.5rem] font-light leading-none">{price}</span>
        {interval && <span className="tier-portal-muted text-sm"> /<Tr s={interval} /></span>}
      </p>
      {saleLine && <p className="tp-gold mt-1 text-xs font-semibold"><Tr s={saleLine} /></p>}
    </div>
  );
}

/** «Todo lo de Esencia · Y además:». */
export function PortalIncludes({ title }: { title: string }) {
  return (
    <li className="tier-portal-includes flex items-center gap-3 rounded-2xl px-3 py-2.5">
      <span className="portal-emblem tp-gold grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-hidden>
        <Check className="h-4 w-4" />
      </span>
      <span>
        <strong className="font-semibold"><Tr s={"Todo lo de"} />{" "}{title}</strong>
        <span className="tier-portal-muted block text-[0.82rem]"><Tr s={"Y además:"} /></span>
      </span>
    </li>
  );
}

/** Una línea de lo que incluye, con su icono. */
export function PortalFeature({ f }: { f: TierFeature }) {
  const Icon = TIER_ICONS[f.icon];
  return (
    <li className="flex items-start gap-3">
      <span className="portal-emblem tp-gold mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <strong className="block font-semibold leading-snug">{f.title}</strong>
        {f.detail && <span className="tier-portal-muted block text-[0.84rem] leading-snug"><Tr s={f.detail} /></span>}
      </span>
    </li>
  );
}

/** La caja de los próximos círculos (en el nivel más alto). */
export function PortalCircles({ circles, note }: { circles: string[]; note?: string }) {
  return (
    <div className="tier-portal-box relative mt-5 w-full rounded-2xl p-3.5 text-left text-[0.82rem]">
      <p className="tp-gold flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.24em]">
        <Moon className="h-3 w-3" />{" "}<Tr s={"Próximos círculos"} /></p>
      <ul className="mt-2 space-y-1">
        {circles.map((c, i) => (
          <li key={i}><Tr s={c} /></li>
        ))}
      </ul>
      {note && <p className="tier-portal-muted mt-2 text-[0.72rem] italic"><Tr s={note} /></p>}
    </div>
  );
}

/** El botón de abajo: dorado en el nivel destacado, con borde dorado en los demás. */
export const portalButton = (strong: boolean) =>
  `${strong ? "portal-cta" : "tier-portal-ghost"} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold`;
