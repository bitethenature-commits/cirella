import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { MessageCircle } from "lucide-react";
import { AstrologyIcon } from "@/components/creator-page/astrology-icon";
import { SectionHeading } from "@/components/creator-page/creator-page-view";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { EnergyIcon } from "@/components/creator-page/energy-icon";
import { HumanDesignIcon } from "@/components/creator-page/human-design-icon";
import { MoonIcon } from "@/components/creator-page/moon-icon";
import { Avatar } from "@/components/creator-page/product-art";
import { FlowerOfLife, SacredButton } from "@/components/creator-page/sacred-button";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { Reveal } from "@/components/reveal";
import { barePage, hiddenProductSlugs, SitePageView } from "@/components/creator-page/site-page-view";
import { appUrl } from "@/lib/env";
import { nextMoonCircles } from "@/lib/moon-circles";
import { oracleDecksForBlocks } from "@/lib/oracle-decks";
import { ONE_TO_ONE_SLUG } from "@/lib/site-pages";
import { getPublicSitePage } from "@/lib/site-pages.server";
import { sectionPageData } from "../section-data";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: "Página no encontrada" };
  // Publicada desde Páginas: su título y su descripción.
  const own = await getPublicSitePage(username, ONE_TO_ONE_SLUG);
  if (own) {
    const t = `${own.content.seoTitle || own.content.title} · ${data.config.displayName}`;
    const d = own.content.seoDescription || own.content.subtitle || undefined;
    return { title: t, description: d, alternates: { canonical: data.url("uno-a-uno") }, openGraph: { title: t, description: d, url: data.url("uno-a-uno"), siteName: data.siteName } };
  }
  const title = `1:1 · ${data.config.displayName}`;
  const description = `Un acompañamiento 1:1 con ${data.config.displayName}: un camino para descubrirte.`;
  return { title, description, alternates: { canonical: data.url("uno-a-uno") }, openGraph: { title, description, url: data.url("uno-a-uno"), siteName: data.siteName } };
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Las etapas del camino, de la primera conversación a decidir desde quien eres. */
const STEPS: { n: string; Icon: Icon; title: string; text: string }[] = [
  {
    n: "I",
    Icon: MessageCircle as Icon,
    title: "Nos conocemos",
    text: "Una primera conversación tranquila. Me cuentas en qué momento estás, qué te inquieta y qué te gustaría que cambiara. Sin prisa y sin juicio.",
  },
  {
    n: "II",
    Icon: AstrologyIcon,
    title: "Leemos tu mapa",
    text: "Con tu fecha, hora y lugar de nacimiento abrimos tu carta natal, tu Diseño Humano y tus Gene Keys. Es tu mapa: no te dice quién debes ser, te recuerda quién eres.",
  },
  {
    n: "III",
    Icon: HumanDesignIcon,
    title: "Te comprendes",
    text: "Poco a poco, lo que antes te pesaba empieza a tener sentido: tus ritmos, tu forma de decidir, lo que te da energía y lo que te la quita.",
  },
  {
    n: "IV",
    Icon: MoonIcon,
    title: "Lo llevas a tu vida",
    text: "Bajamos lo descubierto a tu día a día, luna a luna: pequeños gestos, rituales sencillos y decisiones concretas que puedes sostener.",
  },
  {
    n: "V",
    Icon: EnergyIcon,
    title: "Eliges desde ti",
    text: "Llega un momento en que ya no necesitas que nadie te lo explique. Te escuchas, confías en tu manera de hacer y caminas a tu ritmo.",
  },
];

const TAKEAWAYS = [
  { title: "Claridad", text: "Entiendes por qué sientes y actúas como lo haces." },
  { title: "Calma", text: "Dejas de luchar contra tu propia naturaleza." },
  { title: "Dirección", text: "Sabes hacia dónde ir y cómo dar el siguiente paso." },
];

const FOR_YOU = [
  "Sientes que vives con el piloto automático y quieres volver a escucharte.",
  "Estás ante una decisión importante y quieres tomarla desde ti.",
  "Te interesa la astrología, el Diseño Humano o las Gene Keys, pero no sabes por dónde empezar.",
  "Buscas un espacio solo para ti, con tiempo y con alguien que te acompañe.",
];

/** La raya dorada con la estrellita en medio. */
function GoldStar({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`mx-auto flex max-w-[13rem] items-center gap-3 ${className}`} style={{ color: "var(--c-gold)" }}>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
      <span className="text-xs">✦</span>
      <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
    </div>
  );
}

/**
 * «1:1»: el acompañamiento individual contado como un camino para descubrirse, sin precios, con el
 * estilo de lujo de la portada. Arriba la presentación; después las cinco etapas en un panel dorado
 * con números romanos, lo que se lleva, para quién es y una frase; al final, el contacto por email.
 */
export default async function UnoAUnoPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  // Publicada desde Páginas (lib/site-pages.ts → ONE_TO_ONE_SLUG): la que ha escrito ella.
  const own = await getPublicSitePage(username, ONE_TO_ONE_SLUG);
  if (own) {
    const { data: pub, content } = own;
    const oracleDecks = await oracleDecksForBlocks(pub.creator.id, content.blocks);
    return (
      <>
        <SitePageView
          page="uno-a-uno"
          username={pub.creator.username}
          config={pub.config}
          content={content}
          allowCustom={pub.allowCustom}
          personal={pub.personal}
          signupsOnly={pub.signupsOnly}
          hiddenSlugs={hiddenProductSlugs(pub.products, pub.signupsOnly)}
          siteOrigin={appUrl()}
          pages={pub.pages}
          currentPath={own.path}
          oracleDecks={oracleDecks}
          moonCircles={nextMoonCircles(pub.products)}
          bare={barePage(ONE_TO_ONE_SLUG)}
        />
        <TrackOnMount creatorId={pub.creator.id} type="PAGE_VIEW" />
      </>
    );
  }
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const first = config.displayName.trim().split(/\s+/)[0] || config.displayName;
  const email = config.contact.email;

  return (
    <CreatorShell page="uno-a-uno" username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="cp-luxe mx-auto max-w-3xl px-5 pb-20 pt-8 sm:pt-14">
        {/* Presentación */}
        <header className="relative text-center" data-reveal>
          <FlowerOfLife className="cp-uno-geo" strokeWidth={0.15} />
          <div className="cp-bubble-img mx-auto w-fit rounded-full">
            <Avatar src={config.avatarUrl} name={config.displayName} className="h-24 w-24" />
          </div>
          <p className="cp-eyebrow mt-6 !tracking-[0.42em]" style={{ color: "var(--c-gold)" }}>
            Acompañamiento 1:1
          </p>
          <GoldStar className="mt-4" />
          <h1 className="cp-display cp-thin mt-5 text-[2.8rem] leading-[1.05] sm:text-[3.7rem]">Un camino para descubrirte</h1>
          <p className="cp-display cp-thin mx-auto mt-4 max-w-xl text-[1.5rem] italic leading-snug sm:text-[1.8rem]" style={{ color: "var(--c-gold)" }}>
            No es una sesión suelta: es un viaje contigo.
          </p>
          <p className="cp-muted cp-thin-text mx-auto mt-5 max-w-lg text-[1.05rem] leading-relaxed">
            Durante un tiempo caminamos juntas, tú y yo. Partimos de dónde estás hoy y, paso a paso, vamos leyendo tu mapa hasta que vuelves a reconocerte en él.
          </p>
        </header>

        {/* El camino */}
        <section className="mt-24" aria-label="Cómo es el camino">
          <div data-reveal>
            <SectionHeading title="Cómo es el camino" />
          </div>
          <div className="cp-include-panel mt-10" data-reveal>
            <FlowerOfLife className="cp-include-geo" strokeWidth={0.2} />
            <ol className="cp-uno-steps">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4 sm:gap-6">
                  <span className="cp-roman">{s.n}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <s.Icon aria-hidden className="cp-gold h-7 w-7 shrink-0" strokeWidth={1.1} />
                      <h3 className="cp-display cp-thin text-[1.6rem] leading-tight sm:text-[1.85rem]">{s.title}</h3>
                    </div>
                    <p className="cp-muted cp-thin-text mt-2 text-[1rem] leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Lo que te llevas */}
        <section className="mt-24" aria-label="Lo que te llevas">
          <div data-reveal>
            <SectionHeading title="Lo que te llevas" />
          </div>
          <div className="mx-auto mt-10 grid max-w-sm gap-6 sm:max-w-none sm:grid-cols-3">
            {TAKEAWAYS.map((t, i) => (
              <div key={t.title} className="cp-card cp-uno-gift px-5 py-8 text-center" data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}>
                <span aria-hidden className="cp-gold text-sm">
                  ✦
                </span>
                <h3 className="cp-display cp-thin mt-3 text-[1.8rem] italic">{t.title}</h3>
                <GoldStar className="mt-3 !max-w-[6rem]" />
                <p className="cp-muted cp-thin-text mx-auto mt-3 max-w-[15rem] text-[0.98rem] leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Para quién es */}
        <section className="mx-auto mt-24 max-w-2xl" aria-label="Es para ti si…">
          <div data-reveal>
            <SectionHeading title="Es para ti si…" />
          </div>
          <div className="cp-include-panel mt-10" data-reveal>
            <ul className="cp-include-text">
              {FOR_YOU.map((t) => (
                <li key={t} className="flex gap-3.5">
                  <span aria-hidden className="cp-gold mt-[0.2em] shrink-0 text-[0.7rem]">
                    ✦
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Una frase */}
        <figure className="cp-uno-quote mx-auto mt-24 max-w-xl text-center" data-reveal>
          <span aria-hidden className="cp-uno-quote-mark">
            “
          </span>
          <blockquote className="cp-display cp-thin text-[1.8rem] italic leading-snug sm:text-[2.2rem]">No vengo a decirte quién eres. Vengo a acompañarte mientras lo recuerdas.</blockquote>
          <GoldStar className="mt-6" />
          <figcaption className="cp-gold mt-4 text-[0.78rem] tracking-[0.4em]">{first.toUpperCase()}</figcaption>
        </figure>

        {/* Contacto: solo el email */}
        {email && (
          <section className="cp-include-panel mx-auto mt-24 max-w-2xl text-center" aria-labelledby="empezamos" data-reveal>
            <FlowerOfLife className="cp-include-geo" strokeWidth={0.2} />
            <p className="cp-eyebrow !tracking-[0.4em]" style={{ color: "var(--c-gold)" }}>
              Tu primer paso
            </p>
            <h2 id="empezamos" className="cp-display cp-thin mt-3 text-[2.3rem] leading-tight sm:text-[2.8rem]">
              ¿Empezamos tu camino?
            </h2>
            <GoldStar className="mt-4" />
            <p className="cp-muted cp-thin-text mx-auto mt-5 max-w-md text-[1.02rem] leading-relaxed">
              Escríbeme y cuéntame en qué momento estás. Te respondo yo, personalmente, y vemos juntas si este camino es para ti.
            </p>
            <div className="mt-8 flex justify-center">
              <SacredButton href={`mailto:${email}?subject=${encodeURIComponent("Acompañamiento 1:1")}`} label="Escríbeme" ariaLabel="Escríbeme por email" />
            </div>
            <p className="cp-faint mt-4 text-sm tracking-wide">{email}</p>
          </section>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
      <Reveal />
    </CreatorShell>
  );
}
