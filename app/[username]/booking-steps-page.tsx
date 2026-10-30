import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { ProductCard, type PublicProduct } from "@/components/creator-page/creator-page-view";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { READINGS_DEFAULTS } from "@/lib/page-config";
import type { sectionPageData } from "./section-data";

/** Lo que es «lectura» y lo que es «sesión» (lib/channel-kind.ts): las lecturas que prepara ella y las sesiones en directo. */
export function isReadingProduct(p: PublicProduct): boolean {
  return p.type === "DIGITAL" && p.kindLabel === "Lectura";
}
export function isSessionProduct(p: PublicProduct): boolean {
  return p.type === "SESSION" && !p.groupSession;
}

/**
 * Página de «Lecturas» o de «Sesiones»: los pasos numerados para reservar (los de «Lecturas, sesiones
 * y círculos» de Mi página) y, debajo, los productos que encajan.
 */
export function BookingStepsPage({ data, kind }: { data: NonNullable<Awaited<ReturnType<typeof sectionPageData>>>; kind: "reading" | "session" }) {
  const { creator, config } = data;
  const card = config.readings?.[kind];
  const d = READINGS_DEFAULTS[kind];
  const steps = card?.steps.length ? card.steps : d.steps;
  const visible = data.products.filter((p) => !(data.signupsOnly && (p.accessMode ?? "PAID") === "PAID"));
  const products = visible.filter(kind === "reading" ? isReadingProduct : isSessionProduct);
  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:pt-12">
        <Link href={`${data.homeHref}#lecturas`} className="cp-muted inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <p className="cp-eyebrow mt-5">{card?.eyebrow || d.eyebrow}</p>
        <h1 className="cp-display mt-2 text-[2.6rem] leading-tight">{card?.title || d.title}</h1>
        <p className="cp-muted mt-3 text-[1.02rem] leading-relaxed">{card?.text || d.text}</p>

        <section aria-labelledby="pasos" className="cp-card mt-8 p-6 sm:p-7">
          <h2 id="pasos" className="cp-display text-[1.6rem]">
            Cómo reservar
          </h2>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="cp-display grid h-8 w-8 shrink-0 place-items-center rounded-full text-[1.1rem]" style={{ background: "var(--c-accent)", color: "var(--c-accent-text)" }}>
                  {i + 1}
                </span>
                <span className="pt-1 text-[0.95rem] leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="productos" className="mt-10">
          <h2 id="productos" className="cp-display text-[2rem]">
            {kind === "reading" ? "Lecturas" : "Sesiones"}
          </h2>
          {products.length === 0 ? (
            <p className="cp-muted mt-3">Ahora mismo no hay {kind === "reading" ? "lecturas" : "sesiones"} disponibles.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} username={creator.username} trackCreatorId={creator.id} />
              ))}
            </div>
          )}
        </section>
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
