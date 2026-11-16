import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Pencil, Star } from "lucide-react";
import { ProductImage } from "@/components/creator-page/product-art";
import { MoonCircleArt } from "@/components/creator-page/moon-circle-art";
import type { MoonCircleSky } from "@/lib/moon-circle-sky";
import { asAccessMode, externalHost } from "@/lib/access-mode";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/tz";
import { Badge } from "../ui";
import { moveProduct } from "./actions";

/**
 * Ya no hay página «Productos»: cada cosa se lleva desde su sitio. Lecturas y sesiones 1:1 en
 * «Sesiones y lecturas», los círculos en «Círculos de la Luna», los cursos en Cursos y las membresías
 * en Comunidad. Aquí, adónde vuelve cada producto y las cartas de las dos páginas nuevas.
 */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «49 €», «Gratis · 12 inscripciones» o «65 € · pago en calendly.com». */
export function priceLine(p: { accessMode: string; priceCents: number; currency: string; billingInterval: string | null; externalUrl: string | null; _count: { orders: number } }) {
  const mode = asAccessMode(p.accessMode);
  const n = p._count.orders;
  if (mode === "FREE_EMAIL") return `Gratis · ${plural(n, "inscripción", "inscripciones")}`;
  if (mode === "EXTERNAL") {
    const host = externalHost(p.externalUrl);
    const price = p.priceCents > 0 ? `${formatPrice(p.priceCents, p.currency, p.billingInterval)} · ` : "";
    return `${price}${host ? `pago en ${host}` : "falta el enlace de pago"}`;
  }
  return p.priceCents > 0 ? formatPrice(p.priceCents, p.currency, p.billingInterval) : "Sin precio";
}

export type CardProduct = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  emoji: string | null;
  imageUrl: string | null;
  status: string;
  featured: boolean;
  accessMode: string;
  priceCents: number;
  currency: string;
  billingInterval: string | null;
  externalUrl: string | null;
  durationMin: number | null;
  eventStartAt: Date | null;
  capacity: number | null;
  _count: { orders: number };
};

/** Carta grande: la foto en burbuja dorada, el título, el precio y Editar. Con `date`, el día grande encima. */
export function ProductCard({
  p,
  username,
  first,
  last,
  meta,
  timeZone,
  showDate,
  sky,
}: {
  p: CardProduct;
  username: string;
  first: boolean;
  last: boolean;
  meta?: ReactNode;
  timeZone: string;
  showDate?: boolean;
  /** Círculo de la luna: su luna y su signo en lugar de la foto, como en la web. */
  sky?: MoonCircleSky | null;
}) {
  const past = showDate && p.eventStartAt ? p.eventStartAt.getTime() < Date.now() : false;
  return (
    <li className={`card flex flex-col overflow-hidden ${past ? "opacity-60" : ""}`}>
      <div className="p-3 pb-0">
        <Link href={`/panel/productos/${p.id}`} className="cp-photo-bubble block aspect-[4/3]" style={{ ["--c-accent" as string]: "#C9BBF2", ["--c-gold" as string]: "#D9BF8C", ["--c-bg2" as string]: "#1A1D3D" }}>
          {sky ? <MoonCircleArt sky={sky} compact /> : <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} />}
          {showDate && p.eventStartAt && (
            <span className="absolute left-3 top-3 grid min-w-[3.6rem] place-items-center rounded-xl border border-gold/60 bg-[#0E1024]/85 px-2 py-1.5 text-center leading-none text-gold backdrop-blur">
              <span className="font-serif text-[1.7rem]">{formatDate(p.eventStartAt, { day: "numeric" }, timeZone)}</span>
              <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em]">{formatDate(p.eventStartAt, { month: "short" }, timeZone).replace(".", "")}</span>
            </span>
          )}
        </Link>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-1.5 font-serif text-[1.3rem] leading-tight">
          {p.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" aria-label="Destacado" />}
          {p.title}
        </p>
        {meta && <p className="mt-1 text-xs text-muted">{meta}</p>}
        <p className="mt-1 text-sm text-gold">{priceLine(p)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.status === "PUBLISHED" ? <Badge tone="success">Visible en la web</Badge> : <Badge tone="warning">Borrador</Badge>}
          {past && <Badge tone="neutral">Ya pasó</Badge>}
        </div>
        <div className="mt-auto flex items-center gap-1 pt-4">
          {!showDate && (
          <>
          <form action={moveProduct}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="dir" value="up" />
            <input type="hidden" name="sameType" value="1" />
            <button disabled={first} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label={`Mover antes «${p.title}»`}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </form>
          <form action={moveProduct}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="dir" value="down" />
            <input type="hidden" name="sameType" value="1" />
            <button disabled={last} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label={`Mover después «${p.title}»`}>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
          </>
          )}
          <span className="flex-1" />
          {p.status === "PUBLISHED" && (
            <Link href={`/${username}/${p.slug}`} target="_blank" className="btn btn-ghost btn-sm" aria-label={`Ver «${p.title}» en la web`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}
          <Link href={`/panel/productos/${p.id}`} className="btn btn-outline btn-sm">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Link>
        </div>
      </div>
    </li>
  );
}

export const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  emoji: true,
  imageUrl: true,
  status: true,
  featured: true,
  accessMode: true,
  priceCents: true,
  currency: true,
  billingInterval: true,
  externalUrl: true,
  durationMin: true,
  eventStartAt: true,
  capacity: true,
  type: true,
  _count: { select: { orders: { where: { status: "PAID" } } } },
} as const;
