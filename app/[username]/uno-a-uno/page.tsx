import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType, CSSProperties, SVGProps } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { AstrologyIcon } from "@/components/creator-page/astrology-icon";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { EnergyIcon } from "@/components/creator-page/energy-icon";
import { HumanDesignIcon } from "@/components/creator-page/human-design-icon";
import { MoonIcon } from "@/components/creator-page/moon-icon";
import { Avatar } from "@/components/creator-page/product-art";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { Reveal } from "@/components/reveal";
import { sectionPageData } from "../section-data";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: "Página no encontrada" };
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

/** El cordel dorado del camino. */
const CORD: CSSProperties = {
  background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--c-gold) 70%, transparent) 8%, color-mix(in oklab, var(--c-gold) 45%, transparent) 85%, transparent)",
};

/**
 * «1:1»: el acompañamiento individual contado como un camino para descubrirse, sin precios. Arriba la
 * presentación; después las cinco etapas en un cordel dorado (aparecen al deslizar), lo que se lleva,
 * para quién es y una frase; al final, solo el contacto por email.
 */
export default async function UnoAUnoPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const first = config.displayName.trim().split(/\s+/)[0] || config.displayName;
  const email = config.contact.email;

  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-8 sm:pt-14">
        {/* Presentación */}
        <header className="text-center" data-reveal>
          <div className="mx-auto w-fit rounded-full p-[3px]" style={{ background: "linear-gradient(135deg, var(--c-gold), var(--c-accent))" }}>
            <div className="rounded-full p-[3px]" style={{ background: "var(--c-bg)" }}>
              <Avatar src={config.avatarUrl} name={config.displayName} className="h-20 w-20" />
            </div>
          </div>
          <p className="cp-eyebrow mt-5">Acompañamiento 1:1</p>
          <h1 className="cp-display mt-3 text-[2.7rem] leading-[1.05] sm:text-[3.6rem]">Un camino para descubrirte</h1>
          <p className="cp-display mx-auto mt-4 max-w-xl text-[1.45rem] italic leading-snug sm:text-[1.7rem]" style={{ color: "var(--c-gold)" }}>
            No es una sesión suelta: es un viaje contigo.
          </p>
          <p className="cp-muted mx-auto mt-5 max-w-lg text-[0.98rem] leading-relaxed">
            Durante un tiempo caminamos juntas, tú y yo. Partimos de dónde estás hoy y, paso a paso, vamos leyendo tu mapa hasta que vuelves a reconocerte en él.
          </p>
        </header>

        {/* El camino */}
        <section className="mt-20" aria-labelledby="camino">
          <h2 id="camino" className="cp-display text-center text-[2rem] sm:text-[2.4rem]" data-reveal>
            Cómo es el camino
          </h2>
          <ol className="relative mx-auto mt-10 max-w-xl">
            <span aria-hidden className="absolute bottom-0 left-[27px] top-0 w-[2px] rounded-full" style={CORD} />
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative flex gap-5 pb-12 last:pb-0" data-reveal style={{ ["--reveal-delay" as string]: `${i * 40}ms` }}>
                <span className="relative z-[1] grid h-14 w-14 shrink-0 place-items-center rounded-full border" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 60%, transparent)", background: "var(--c-bg)" }}>
                  <s.Icon aria-hidden className="cp-gold h-8 w-8" strokeWidth={1.2} />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="cp-gold cp-display text-[1.05rem] tracking-[0.2em]">{s.n}</p>
                  <h3 className="cp-display mt-0.5 text-[1.6rem] leading-tight sm:text-[1.85rem]">{s.title}</h3>
                  <p className="cp-muted mt-2 text-[0.95rem] leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Lo que te llevas */}
        <section className="mt-20" aria-labelledby="te-llevas">
          <h2 id="te-llevas" className="cp-display text-center text-[2rem] sm:text-[2.4rem]" data-reveal>
            Lo que te llevas
          </h2>
          <div className="mt-8 grid gap-8 text-center sm:grid-cols-3 sm:gap-6">
            {TAKEAWAYS.map((t, i) => (
              <div key={t.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}>
                <span aria-hidden className="mx-auto block h-px w-10" style={{ background: "var(--c-gold)" }} />
                <h3 className="cp-display mt-4 text-[1.6rem]">{t.title}</h3>
                <p className="cp-muted mx-auto mt-1.5 max-w-[16rem] text-[0.92rem] leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Para quién es */}
        <section className="mx-auto mt-20 max-w-xl" aria-labelledby="para-ti" data-reveal>
          <h2 id="para-ti" className="cp-display text-center text-[2rem] sm:text-[2.4rem]">
            Es para ti si…
          </h2>
          <ul className="mt-6 space-y-3.5">
            {FOR_YOU.map((t) => (
              <li key={t} className="flex gap-3 text-[0.98rem] leading-relaxed">
                <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--c-gold)" }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Una frase */}
        <figure className="mx-auto mt-20 max-w-xl text-center" data-reveal>
          <blockquote className="cp-display text-[1.7rem] italic leading-snug sm:text-[2.1rem]">“No vengo a decirte quién eres. Vengo a acompañarte mientras lo recuerdas.”</blockquote>
          <figcaption className="cp-gold mt-4 text-sm font-semibold tracking-[0.16em]">{first.toUpperCase()}</figcaption>
        </figure>

        {/* Contacto: solo el email */}
        {email && (
          <section className="mx-auto mt-20 max-w-xl text-center" aria-labelledby="empezamos" data-reveal>
            <span aria-hidden className="mx-auto block h-px w-16" style={{ background: "var(--c-gold)" }} />
            <h2 id="empezamos" className="cp-display mt-8 text-[2.2rem] leading-tight sm:text-[2.6rem]">
              ¿Empezamos tu camino?
            </h2>
            <p className="cp-muted mx-auto mt-3 max-w-md text-[0.98rem] leading-relaxed">Escríbeme y cuéntame en qué momento estás. Te respondo yo, personalmente, y vemos juntas si este camino es para ti.</p>
            <a href={`mailto:${email}?subject=${encodeURIComponent("Acompañamiento 1:1")}`} className="cp-btn mt-7 h-12 px-6">
              <Mail className="h-4 w-4" /> Escríbeme
            </a>
            <p className="cp-faint mt-3 text-sm">{email}</p>
          </section>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
      <Reveal />
    </CreatorShell>
  );
}
