import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Moon } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackedLink, TrackOnMount } from "@/components/creator-page/tracking";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { orderTiers } from "@/lib/tiers";
import { tierFeatures } from "@/lib/tier-features";
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
  const memberships = data.products.filter((p) => p.type === "MEMBERSHIP" && !(data.signupsOnly && (p.accessMode ?? "PAID") === "PAID"));
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
          <p className="cp-eyebrow">Comunidad</p>
          <h1 className="cp-display mt-3 text-[2.6rem] leading-[1.05] sm:text-[3.4rem]">Elige cómo quieres acompañarte</h1>
          {tiers.length > 1 && <p className="cp-muted mt-4 text-[1.02rem] leading-relaxed">Cada nivel incluye todo lo del anterior. Puedes subir de nivel cuando quieras.</p>}
        </div>

        {tiers.length === 0 ? (
          <p className="cp-muted mt-10 text-center">Pronto abriré la comunidad.</p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]" data-tiers>
            {tiers.map(({ tier: t, level, includesPrevious }) => {
              const d = descOf.get(t.id);
              const features = tierFeatures(d?.description ?? null, d?.summary ?? t.summary);
              const highlight = tiers.length === 3 && level === 2;
              const mode = t.accessMode ?? "PAID";
              const href = mode === "PAID" ? `/${creator.username}/${t.slug}/checkout` : mode === "EXTERNAL" && t.externalUrl ? t.externalUrl : `/${creator.username}/${t.slug}`;
              return (
                <section key={t.id} className="cp-card flex flex-col gap-4 p-7" aria-labelledby={`nivel-${t.id}`} data-tier={t.slug} style={highlight ? { borderColor: "var(--c-accent)" } : undefined}>
                  <p className="cp-eyebrow cp-gold">
                    Nivel {level}
                    {highlight ? " · la más elegida" : ""}
                  </p>
                  <h2 id={`nivel-${t.id}`} className="cp-display text-[2.2rem] leading-none">
                    {t.title}
                  </h2>
                  <p>
                    {t.sale && <s className="cp-muted mr-2">{formatPrice(t.sale.regularCents, t.currency)}</s>}
                    <span className="cp-display text-[2.6rem]">{formatPrice(t.sale ? t.sale.priceCents : t.priceCents, t.currency)}</span>
                    {t.billingInterval && <span className="cp-muted"> /{t.billingInterval === "year" ? "año" : "mes"}</span>}
                    {t.sale && <span className="cp-gold block text-xs font-semibold">{[t.sale.label, t.sale.endsLabel].filter(Boolean).join(" · ") || "Oferta"} · el primer pago</span>}
                  </p>
                  <ul className="space-y-2.5 text-[0.95rem]">
                    {includesPrevious && (
                      <li className="cp-muted flex items-start gap-2.5">
                        <Check className="cp-gold mt-0.5 h-4 w-4 shrink-0" /> Incluye todo lo de {includesPrevious.title}
                      </li>
                    )}
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className="cp-gold font-semibold" aria-hidden>
                          {includesPrevious ? "+" : "✓"}
                        </span>
                        {f}
                      </li>
                    ))}
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
                    className={`${highlight ? "cp-btn" : "cp-btn-ghost"} mt-auto w-full`}
                    ariaLabel={`Unirme a ${t.title}`}
                  >
                    Unirme a {t.title}
                  </TrackedLink>
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
