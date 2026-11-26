import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CreditCard,
  Download,
  Link2,
  Lock,
  Repeat,
  Send,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing";
import { Reveal } from "@/components/reveal";
import { prisma } from "@/lib/db";
import { appHost } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { planBullets } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { ownerUsername } from "@/lib/site-mode";
import { CreatorPublicPage, creatorPageMetadata } from "./[username]/public-page";
import { CanvaButton } from "@/components/creator-page/canva-button";
import { LiveDesign } from "@/components/creator-page/live-design";

export const dynamic = "force-dynamic";

/** Modo personal: la portada es la página de la dueña (con su título, su imagen para redes y su favicon). */
export async function generateMetadata(): Promise<Metadata> {
  const owner = ownerUsername();
  return owner ? creatorPageMetadata(owner, { root: true }) : {};
}

const FLOW = [
  { icon: Link2, title: "Instagram", text: "Un solo enlace en tu bio, TikTok o Telegram." },
  { icon: Sparkles, title: "Tu página", text: "Una mini web premium con tu estilo." },
  { icon: ShoppingBag, title: "Producto", text: "Lecturas, sesiones, cursos o comunidad." },
  { icon: CreditCard, title: "Pago", text: "Checkout en 30 segundos, sin crear cuenta." },
  { icon: Download, title: "Entrega", text: "Acceso automático a su contenido." },
  { icon: Repeat, title: "Clienta recurrente", text: "Área privada, membresías y avisos." },
];

const FEATURES = [
  { icon: Link2, title: "Link-in-bio premium", text: "Botones, redes y secciones en una página que parece hecha a medida." },
  { icon: Download, title: "Productos digitales", text: "PDF, audios, meditaciones o guías con entrega automática tras el pago." },
  { icon: CalendarDays, title: "Reservas", text: "Tu disponibilidad, márgenes entre sesiones y días bloqueados. Pagan y eligen hora." },
  { icon: BookOpen, title: "Cursos", text: "Módulos y lecciones en vídeo, audio o PDF, con progreso para tus alumnas." },
  { icon: UsersRound, title: "Membresías", text: "Tu círculo privado con suscripción mensual y contenido exclusivo." },
  { icon: Lock, title: "Área de clientes", text: "Cada compradora tiene su espacio con compras, cursos y sesiones." },
  { icon: BarChart3, title: "Estadísticas", text: "Visitas, conversión, ventas e ingresos recurrentes de un vistazo." },
  { icon: Send, title: "Automatizaciones", text: "Bienvenida, recordatorios de sesión y recuperación de compras." },
];

const AUDIENCE = ["Astrología", "Human Design", "Gene Keys", "Tarot", "Coaching", "Terapias holísticas", "Yoga y meditación", "Wellness", "Creadoras de contenido"];

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  // Modo personal: el mismo render que /<dueña> (que redirige aquí). Sin landing de la plataforma.
  const owner = ownerUsername();
  if (owner)
    return (
      <>
        <CreatorPublicPage username={owner} />
        <CanvaButton username={owner} personal />
        {/* Dentro de la vista en vivo de Diseño: el diseño sin guardar, encima (como en /<usuaria>). */}
        <LiveDesign />
      </>
    );
  return <Landing searchParams={searchParams} />;
}

async function Landing({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const [plans, settings] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  const reg = (extra = "") => {
    const q = new URLSearchParams();
    if (ref) q.set("ref", ref);
    if (extra) q.set("plan", extra);
    const s = q.toString();
    return `/signup${s ? `?${s}` : ""}`;
  };
  const host = appHost();

  return (
    <div className="bg-paper">
      <MarketingHeader refCode={ref} />

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden bg-ink text-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/demo/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="starfield absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-32 sm:pt-40 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-cream/80 backdrop-blur">
              <span className="text-gold">✦</span> Para astrólogas, terapeutas, coaches y creadoras
            </p>
            <h1 className="display mt-6 text-[2.9rem] leading-[1.02] sm:text-[4.2rem] lg:text-[4.8rem]">
              Convierte tu perfil social en tu <em className="text-lavender">negocio completo</em>, desde un solo enlace.
            </h1>
            <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-cream/75">
              Tu página, tu tienda, tus reservas, tus cursos y tu comunidad. Tus clientas compran desde Instagram en segundos y reciben su contenido al instante.
            </p>
            <form action="/signup" className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
              {ref && <input type="hidden" name="ref" value={ref} />}
              <label className="flex h-12 flex-1 items-center rounded-full border border-white/15 bg-white/10 pl-4 text-sm backdrop-blur focus-within:border-lavender">
                <span className="text-cream/55">{host}/</span>
                <input
                  name="username"
                  placeholder="tunombre"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="h-full min-w-0 flex-1 bg-transparent pr-4 text-cream outline-none placeholder:text-cream/35"
                />
              </label>
              <button className="btn btn-light btn-lg !h-12">
                Crear mi página <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-4 text-xs text-cream/50">Gratis para empezar · Sin tarjeta · Lista en 5 minutos</p>
          </div>

          <div className="phone-frame relative mx-auto w-full max-w-[300px] animate-fade-up [animation-delay:150ms] lg:max-w-[320px]">
            <div className="absolute -inset-10 rounded-full bg-lavender/20 blur-3xl" />
            <div className="relative rounded-[2.6rem] border border-white/15 bg-black/60 p-2.5 shadow-2xl backdrop-blur">
              <div className="relative overflow-hidden rounded-[2.1rem]" style={{ aspectRatio: "390 / 780" }}>
                <iframe
                  src="/ana?embed=1"
                  title="Demo: página de Cirella"
                  className="absolute left-0 top-0 origin-top-left border-0"
                  style={{ width: 390, height: 780, transform: "scale(var(--phone-scale))" }}
                  loading="eager"
                />
              </div>
              <div className="absolute left-1/2 top-4 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
            </div>
            <Link href="/ana" className="mt-5 flex items-center justify-center gap-2 text-sm text-cream/80 hover:text-cream">
              Ver la demo de Cirella <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Para quién ───────── */}
      <section className="border-b border-line bg-cream/60">
        <div className="mx-auto flex max-w-6xl gap-3 overflow-x-auto px-5 py-5 scrollbar-none">
          {AUDIENCE.map((a) => (
            <span key={a} className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
              {a}
            </span>
          ))}
        </div>
      </section>

      {/* ───────── Flujo ───────── */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <div className="max-w-2xl" data-reveal>
          <p className="eyebrow">Cómo funciona</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">De un seguidor a una clienta, sin salir del móvil.</h2>
          <p className="mt-4 text-muted">Diseñado para el recorrido real de quien te descubre en Instagram: ver, confiar, comprar y volver.</p>
        </div>
        <ol className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {FLOW.map((s, i) => (
            <li key={s.title} className="card relative p-4 sm:p-5" data-reveal style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}>
              <span className="absolute right-4 top-4 text-xs tabular-nums text-faint">0{i + 1}</span>
              <s.icon className="h-5 w-5 text-lavender-deep" />
              <p className="mt-4 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── Funcionalidades ───────── */}
      <section className="bg-ink py-20 text-cream sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div data-reveal>
              <p className="eyebrow !text-cream/50">Todo en un enlace</p>
              <h2 className="display mt-3 text-4xl sm:text-5xl">Link-in-bio, tienda, agenda y academia. Juntos.</h2>
              <p className="mt-4 text-cream/65">Deja de coser cinco herramientas. Tu negocio entero vive en tu página y tú lo gestionas desde el móvil.</p>
              <Link href={reg()} className="btn btn-light mt-8">
                Empezar gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <div key={f.title} className="glass-dark rounded-2xl p-5" data-reveal style={{ ["--reveal-delay" as string]: `${(i % 2) * 80}ms` }}>
                  <f.icon className="h-5 w-5 text-gold" />
                  <p className="mt-3 font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm text-cream/60">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Plantillas ───────── */}
      <section id="plantillas" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" data-reveal>
          <div className="max-w-xl">
            <p className="eyebrow">Diseños</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">Tu web, diseñada al detalle.</h2>
            <p className="mt-4 text-muted">Sin plantillas de serie: tú eliges cada color, el fondo (también con movimiento), las letras, la forma de las tarjetas y de los botones, y cada página puede tener su propio estilo. Guarda tus diseños como plantillas y cámbialos cuando quieras sin perder productos ni textos.</p>
          </div>
        </div>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Colores y fondos con degradado o foto", "22 fondos, muchos con movimiento", "Más de 50 letras para títulos y textos", "Tarjetas, botones y fotos a medida"].map((t, i) => (
            <li key={t} className="card p-5 text-sm font-semibold" data-reveal style={{ ["--reveal-delay" as string]: `${i * 60}ms` }}>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ───────── Precios ───────── */}
      <section id="precios" className="border-y border-line bg-cream/50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center" data-reveal>
            <p className="eyebrow">Precios</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">Empieza gratis. Crece cuando vendas.</h2>
            <p className="mt-4 text-muted">Sin permanencia. Cambia de plan cuando quieras.</p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-3xl border p-7 ${p.highlighted ? "border-ink bg-ink text-cream shadow-lift" : "border-line bg-white"}`}
                data-reveal
              >
                {p.highlighted && <span className="absolute -top-3 left-7 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">Más elegido</span>}
                <p className="display text-3xl">{p.name}</p>
                <p className={`mt-1 text-sm ${p.highlighted ? "text-cream/60" : "text-muted"}`}>{p.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{formatMoney(p.priceMonthlyCents, p.currency)}</span>
                  <span className={p.highlighted ? "text-cream/60" : "text-muted"}>/mes</span>
                </p>
                <p className={`mt-1 text-sm ${p.highlighted ? "text-gold" : "text-lavender-deep"}`}>
                  + {(p.commissionBps / 100).toLocaleString("es-ES")} % por venta
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {planBullets(p).map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlighted ? "text-gold" : "text-sage"}`} />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link href={reg(p.priceMonthlyCents ? p.key : "")} className={`btn mt-8 ${p.highlighted ? "btn-light" : "btn-primary"}`}>
                  {p.priceMonthlyCents ? `Elegir ${p.name}` : "Empezar gratis"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Cierre ───────── */}
      <section className="relative overflow-hidden bg-ink py-24 text-center text-cream">
        <div className="starfield absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-2xl px-5" data-reveal>
          <h2 className="display text-4xl sm:text-6xl">Tu bio merece algo más que una lista de enlaces.</h2>
          <p className="mt-5 text-cream/65">Crea tu espacio en {settings.platformName} y comparte tu enlace hoy mismo.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={reg()} className="btn btn-light btn-lg">
              Crear mi página gratis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/ana" className="btn btn-lg text-cream hover:bg-white/10">
              Ver ejemplo
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter platformName={settings.platformName} />
      <Reveal />
    </div>
  );
}
