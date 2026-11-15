import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Bookmark, BookOpenText, CalendarDays, Check, CloudSun, Flame, Flower2, GraduationCap, Heart, MessageCircle, Mic, Moon, MoonStar, PenLine, Radio, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackedLink, TrackOnMount } from "@/components/creator-page/tracking";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { orderTiers } from "@/lib/tiers";
import { tierFeatureItems, type TierIcon } from "@/lib/tier-features";

const ICONS: Record<TierIcon, LucideIcon> = {
  text: PenLine, page: BookOpenText, calendar: CalendarDays, save: Bookmark, moon: Moon, chat: MessageCircle, podcast: Mic, meditation: Flower2,
  weather: CloudSun, masterclass: GraduationCap, ceremony: Flame, circle: MoonStar, live: Radio, filter: SlidersHorizontal, heart: Heart, star: Sparkles,
};
import { sectionPageData } from "../section-data";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: "Página no encontrada" };
  const title = `Comunidad · ${data.config.displayName}`;
  const description = `Los niveles de la comunidad de ${data.config.displayName}: cada uno incluye todo lo del anterior.`;
  return { title, description, alternates: { canonical: data.url("comunidad") }, openGraph: { title, description, url: data.url("comunidad"), siteName: data.siteName } };
}

/**
 * «Comunidad»: los niveles (membresías) uno al lado del otro, de menos a más, con su precio, lo que
 * incluye cada uno («Todo lo de Esencia» en los de arriba, lib/tiers.ts) y el botón para unirse (el
 * checkout de siempre, con su casilla MEMBERSHIP_START).
 */
export default async function ComunidadPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const memberships = data.products.filter((p) => p.type === "MEMBERSHIP");
  const [edges, descriptions] = await Promise.all([
    prisma.productInclusion.findMany({ where: { creatorId: creator.id }, select: { productId: true, includedProductId: true } }),
    prisma.product.findMany({ where: { id: { in: memberships.map((m) => m.id) } }, select: { id: true, description: true, summary: true } }),
  ]);
  const tiers = orderTiers(memberships, edges);
  const top = tiers.at(-1)?.tier.id;
  const circles = data.products.filter((p) => p.moonCircle && p.eventStartAt).sort((a, b) => (a.eventStartAt! < b.eventStartAt! ? -1 : 1)).slice(0, 3);
  const descOf = new Map(descriptions.map((d) => [d.id, d]));

  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:pt-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="cp-eyebrow">✦ Comunidad ✦</p>
          <h1 className="cp-display mt-3 text-[2.6rem] leading-[1.05] sm:text-[3.4rem]">Elige cómo quieres acompañarte</h1>
          <p className="cp-muted mt-4 text-[1.05rem] leading-relaxed">
            Un espacio privado para vivir el cielo semana a semana: textos, voz, directos y lunas compartidas.
            {tiers.length > 1 ? " Cada nivel incluye todo lo del anterior y puedes subir o cancelar cuando quieras." : " Puedes cancelar cuando quieras."}
          </p>
          <div aria-hidden className="mx-auto mt-6 flex max-w-xs items-center gap-3" style={{ color: "var(--c-gold)" }}>
            <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
            <span className="text-xs">✦</span>
            <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
          </div>
        </div>

        {tiers.length === 0 ? (
          <p className="cp-muted mt-10 text-center">Pronto abriré la comunidad.</p>
        ) : (
          <div className="mt-12 grid items-start gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]" data-tiers>
            {tiers.map(({ tier: t, level, includesPrevious }) => {
              const d = descOf.get(t.id);
              const features = tierFeatureItems(d?.description ?? null, d?.summary ?? t.summary);
              const intro = (d?.description ?? "").split("\n").map((l) => l.trim()).find((l) => l && !/^[•\-*✦]\s/.test(l) && !/^incluye:?$/i.test(l)) ?? null;
              // La más elegida: el nivel más completo.
              const highlight = tiers.length > 1 && t.id === top;
              const mode = t.accessMode ?? "PAID";
              const href = mode === "PAID" ? `/${creator.username}/${t.slug}/solicitar` : mode === "EXTERNAL" && t.externalUrl ? t.externalUrl : `/${creator.username}/${t.slug}`;
              return (
                <section key={t.id} className={`cp-card tier-card relative flex flex-col overflow-hidden ${highlight ? "is-highlight md:-mt-4" : ""}`} aria-labelledby={`nivel-${t.id}`} data-tier={t.slug}>
                  {/* La foto del nivel, con su emblema. */}
                  <div className="cp-photo-bubble cp-photo-in relative aspect-[4/3]">
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.imageUrl} alt="" className="cp-img absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 45%, var(--c-bg)), color-mix(in oklab, var(--c-gold) 30%, var(--c-bg)))" }} />
                    )}
                    <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 35%, var(--c-surface))" }} />
                    {highlight && <span className="tier-badge absolute right-3 top-3 rounded-full px-3 py-1 text-[0.7rem] font-semibold">La más elegida</span>}
                  </div>
                  <div className="relative -mt-9 flex flex-col items-center gap-3 px-6 pb-7 text-center sm:px-7">
                    <span className="cp-emblem grid h-16 w-16 place-items-center rounded-full text-[1.8rem]" aria-hidden>
                      {t.emoji ?? "✦"}
                    </span>
                  <h2 id={`nivel-${t.id}`} className="cp-display text-[2.4rem] leading-none">
                    {t.title}
                  </h2>
                  {(intro || t.summary) && <p className="cp-muted max-w-xs text-[0.95rem] leading-relaxed">{intro ?? t.summary}</p>}
                  <p>
                    {t.sale && <s className="cp-muted mr-2">{formatPrice(t.sale.regularCents, t.currency)}</s>}
                    <span className="cp-display text-[2.6rem]">{formatPrice(t.sale ? t.sale.priceCents : t.priceCents, t.currency)}</span>
                    {t.billingInterval && <span className="cp-muted"> /{t.billingInterval === "year" ? "año" : "mes"}</span>}
                    {t.sale && <span className="cp-gold block text-xs font-semibold">{[t.sale.label, t.sale.endsLabel].filter(Boolean).join(" · ") || "Oferta"} · el primer pago</span>}
                  </p>
                  <span aria-hidden className="my-1 h-px w-20" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold), transparent)" }} />
                  <ul className="w-full space-y-3.5 text-left text-[0.93rem]">
                    {includesPrevious && (
                      <li className="tier-includes flex items-center gap-3 rounded-2xl px-3 py-2.5">
                        <span className="cp-emblem grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-hidden>
                          <Check className="h-4 w-4" />
                        </span>
                        <span>
                          <strong className="font-semibold">Todo lo de {includesPrevious.title}</strong>
                          <span className="cp-muted block text-[0.82rem]">Y además:</span>
                        </span>
                      </li>
                    )}
                    {features.map((f) => {
                      const Icon = ICONS[f.icon];
                      return (
                        <li key={f.title} className="flex items-start gap-3">
                          <span className="cp-emblem mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-hidden>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <strong className="block font-semibold leading-snug">{f.title}</strong>
                            {f.detail && <span className="cp-muted block text-[0.84rem] leading-snug">{f.detail}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {t.id === top && circles.length > 0 && tiers.length > 1 && (
                    <div className="rounded-2xl p-3.5 text-[0.82rem]" style={{ background: "color-mix(in oklab, var(--c-bg) 70%, transparent)" }}>
                      <p className="cp-eyebrow flex items-center gap-1.5">
                        <Moon className="h-3 w-3" /> Próximos círculos
                      </p>
                      <ul className="mt-2 space-y-1">
                        {circles.map((c) => (
                          <li key={c.id}>
                            {c.title} · {c.eventLabel}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <TrackedLink
                    href={href}
                    event={{ creatorId: creator.id, type: "PRODUCT_CLICK" as const, productId: t.id }}
                    className={`${highlight ? "cp-btn" : "cp-btn-ghost"} mt-3 w-full`}
                    ariaLabel={mode === "PAID" ? `Escríbeme para unirte a ${t.title}` : `Unirme a ${t.title}`}
                  >
                    {mode === "PAID" ? (
                      <>
                        <Mail className="h-4 w-4" /> Escríbeme para unirte
                      </>
                    ) : (
                      <>Unirme a {t.title}</>
                    )}
                  </TrackedLink>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {circles.length > 0 && (
          <p className="cp-muted mt-10 text-center text-sm">
            ¿Solo quieres venir a un círculo?{" "}
            <Link href={`${data.homeHref}#lecturas`} className="cp-gold underline underline-offset-4">
              Apúntate a un día suelto sin ser miembro
            </Link>
            .
          </p>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
