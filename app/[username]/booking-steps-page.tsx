import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { CfgText, SiteText } from "@/components/creator-page/site-text";
import type { PublicProduct } from "@/components/creator-page/creator-page-view";
import { OracleCard } from "@/components/creator-page/oracle-card";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { READINGS_DEFAULTS } from "@/lib/page-config";
import type { sectionPageData } from "./section-data";
import { Tr } from "@/lib/i18n/client";

/** Lo que es «lectura» y lo que es «sesión» (lib/channel-kind.ts): las lecturas que prepara ella y las sesiones en directo. */
export function isReadingProduct(p: PublicProduct): boolean {
  return p.type === "DIGITAL" && p.kindLabel === "Lectura";
}
export function isSessionProduct(p: PublicProduct): boolean {
  return p.type === "SESSION" && !p.groupSession;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** La raya dorada con la estrellita en medio. */
function GoldRule({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`mx-auto flex max-w-[14rem] items-center gap-3 ${className}`} style={{ color: "var(--c-gold)" }}>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
      <span className="text-xs">✦</span>
      <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
    </div>
  );
}

/**
 * Página de «Lecturas» o de «Sesiones»: arriba, centrado y en dorado, qué es y cómo se reserva (pasos
 * en números romanos); debajo, las tarjetas en formato reel.
 */
export function BookingStepsPage({ data, kind }: { data: NonNullable<Awaited<ReturnType<typeof sectionPageData>>>; kind: "reading" | "session" }) {
  const { creator, config } = data;
  const card = config.readings?.[kind];
  const d = READINGS_DEFAULTS[kind];
  const steps = card?.steps.length ? card.steps : d.steps;
  const products = data.products.filter(kind === "reading" ? isReadingProduct : isSessionProduct);
  return (
    <CreatorShell page={kind === "reading" ? "lecturas" : "sesiones"} username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-14 pt-8 sm:pt-12">
        <Link href={`${data.homeHref}#lecturas`} className="cp-muted inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> <SiteText texts={config.texts} k="pg.booking.back" />
        </Link>

        <header className="mt-8 text-center">
          <p className="cp-eyebrow !tracking-[0.42em]" style={{ color: "var(--c-gold)" }}>
            <CfgText path={`readings.${kind}.eyebrow`}>{card?.eyebrow || d.eyebrow}</CfgText>
          </p>
          <GoldRule className="mt-4" />
          <h1 className="cp-display cp-thin mt-5 text-[2.8rem] leading-[1.05] sm:text-[3.4rem]">
            <CfgText path={`readings.${kind}.title`}>{card?.title || d.title}</CfgText>
          </h1>
          <p className="cp-muted cp-thin-text mx-auto mt-4 max-w-md text-[1.08rem] leading-relaxed">
            <CfgText path={`readings.${kind}.text`} multiline>
              {card?.text || d.text}
            </CfgText>
          </p>
        </header>

        <section aria-labelledby="pasos" className="mt-14">
          <h2 id="pasos" className="cp-display cp-thin text-[1.9rem] italic">
            <SiteText texts={config.texts} k="pg.booking.how" />
          </h2>
          <span aria-hidden className="mt-3 block h-px w-24" style={{ background: "linear-gradient(90deg, var(--c-gold), transparent)" }} />
          <ol className="cp-steps-line mt-5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-baseline gap-5 py-4">
                <span className="cp-roman">{ROMAN[i] ?? i + 1}</span>
                <span className="cp-thin-text text-[1.05rem] leading-relaxed">
                  <CfgText path={`readings.${kind}.steps.${i}`}>{s}</CfgText>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="productos" className="mt-16">
          <div className="text-center">
            <h2 id="productos" className="cp-display cp-thin text-[2.3rem]">
              <SiteText texts={config.texts} k={kind === "reading" ? "pg.readings.title" : "pg.sessions.title"} />
            </h2>
            <GoldRule className="mt-3 !max-w-[8rem]" />
          </div>
          {products.length === 0 ? (
            <p className="cp-muted mt-6 text-center">
              <SiteText texts={config.texts} k={kind === "reading" ? "pg.readings.empty" : "pg.sessions.empty"} />
            </p>
          ) : (
            <div className="mx-auto mt-8 grid max-w-[16rem] gap-5 sm:max-w-none sm:grid-cols-2 md:grid-cols-3">
              {products.map((p) => (
                <OracleCard key={p.id} p={p} username={creator.username} trackCreatorId={creator.id} />
              ))}
            </div>
          )}
        </section>
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
