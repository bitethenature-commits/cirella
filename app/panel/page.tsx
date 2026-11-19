import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Newspaper, Palette, Plus, Sparkles, TrendingUp } from "lucide-react";
import { BarChart } from "@/components/charts";
import { PayoutBanner } from "@/components/panel/payout-status";
import { requireCreator } from "@/lib/auth";
import { legalIdentityComplete } from "@/lib/legal";
import { formatMoney, formatNumber, formatPercent } from "@/lib/money";
import { readPageConfig } from "@/lib/page-config";
import { orderHome, readPanelPrefs } from "@/lib/panel-prefs";
import { planFeatures } from "@/lib/plans";
import { isPersonalMode } from "@/lib/site-mode";
import { getDashboardStats, parseRange, RANGES } from "@/lib/stats";
import { tenantDb } from "@/lib/tenant";
import { capitalize, formatSessionDate } from "@/lib/tz";
import { panelNavFlags } from "./nav-flags";
import { PageHeader, RangeTabs, Stat } from "./ui";

export default async function PanelHome({ searchParams }: { searchParams: Promise<{ rango?: string }> }) {
  const { creator } = await requireCreator();
  const range = parseRange((await searchParams).rango);
  const s = await getDashboardStats(creator.id, range, creator.timezone);
  const features = planFeatures(creator.plan);
  const cfg = readPageConfig(creator.pageDraft, creator.displayName);
  const db = tenantDb(creator.id);
  // «Pon tu enlace en tu bio»: hecho en cuanto hubo una visita, sea del periodo que sea.
  const [productCount, firstView] = await Promise.all([
    db.product.count({ where: { status: { not: "ARCHIVED" } } }),
    db.analyticsEvent.findFirst({ where: { type: "PAGE_VIEW" }, select: { id: true } }),
  ]);
  const first = cfg.displayName.split(" ")[0];
  const rangeLabel = { month: "este mes", "30d": "en los últimos 30 días", all: "en total" }[range];
  // Modo personal: aquí no se cobra nada (sin cobros ni ingresos); se cuentan visitas e inscripciones.
  const personal = isPersonalMode();
  if (personal) {
    const [posts, codes, flags] = await Promise.all([db.post.count(), db.discountCode.count(), panelNavFlags(creator.id)]);
    const steps = [
      { done: !!cfg.avatarUrl, label: "Sube tu foto", href: "/panel/canva" },
      { done: legalIdentityComplete(creator), label: "Completa tu aviso legal", href: "/panel/ajustes/legal" },
      { done: cfg.links.length > 0 || Object.keys(cfg.socials).length > 0, label: "Añade tus redes y enlaces", href: "/panel/canva" },
      { done: creator.newsDays != null || posts > 0, label: "Elige cuántos días duran tus actualidades", href: "/panel/actualidades" },
      { done: codes > 0, label: "Añade un código de descuento", href: "/panel/codigos" },
      { done: !!firstView, label: "Pon tu enlace en tu bio", href: "/panel/ajustes#compartir" },
    ];
    return (
      <PersonalHome
        first={first}
        range={range}
        rangeLabel={rangeLabel}
        s={s}
        timezone={creator.timezone}
        showBookings={flags.showBookings}
        sales={!!flags.sales}
        checklist={steps}
        order={orderHome(readPanelPrefs(creator.panelPrefs).home)}
      />
    );
  }
  const top = s.topProducts[0];

  const checklist = [
    { done: !!cfg.avatarUrl, label: "Sube tu foto", href: "/panel/canva" },
    { done: productCount >= 2, label: "Añade un segundo producto", href: "/panel/sesiones" },
    { done: legalIdentityComplete(creator), label: "Completa tus datos legales", href: "/panel/ajustes/legal" },
    { done: creator.payoutStatus === "ACTIVE", label: "Activa tus cobros", href: "/panel/ajustes/cobros" },
    { done: cfg.links.length > 0 || Object.keys(cfg.socials).length > 0, label: "Añade tus redes y enlaces", href: "/panel/canva" },
    { done: !!firstView, label: "Comparte tu enlace en tu bio", href: "/panel/ajustes#compartir" },
  ];
  const pending = checklist.filter((c) => !c.done);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hola, ${first}`}
        subtitle={<>Así va tu negocio {rangeLabel}.</>}
        actions={<RangeTabs current={range} base="/panel" />}
      />

      <div className="space-y-2 empty:hidden">
        <PayoutBanner creator={creator} />
      </div>

      {/* Frases resumen */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-cream">
          <div className="starfield absolute inset-0 opacity-40" />
          <div className="relative">
            <p className="eyebrow !text-cream/50">{RANGES[range]}</p>
            <p className="display mt-2 text-[1.9rem] leading-tight">
              Tu página recibió <span className="text-gold">{formatNumber(s.pageViews)} visitas</span> {rangeLabel}.
            </p>
            <p className="mt-2 text-sm text-cream/65">
              {formatNumber(s.uniqueVisitors)} personas distintas · {formatPercent(s.conversion)} acabaron comprando.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-white p-6">
          <p className="eyebrow">Producto estrella</p>
          {top?.product ? (
            <>
              <p className="display mt-2 text-[1.9rem] leading-tight">
                Tu producto más vendido fue <span className="italic">{top.product.title}</span>.
              </p>
              <p className="mt-2 text-sm text-muted">
                {top.count} {top.count === 1 ? "venta" : "ventas"} · {formatMoney(top.revenue)} {rangeLabel}
              </p>
            </>
          ) : (
            <p className="display mt-2 text-[1.9rem] leading-tight text-muted">Tu primera venta está cerca. Comparte tu enlace ✨</p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ingresos" value={formatMoney(s.revenue)} hint={`Recibes ${formatMoney(s.net)} en tu cuenta`} accent />
        <Stat label="Ventas" value={formatNumber(s.sales)} hint="Productos vendidos" />
        <Stat label="Clientes" value={formatNumber(range === "all" ? s.totalCustomers : s.newCustomers)} hint={range === "all" ? "En total" : `${s.totalCustomers} en total`} />
        <Stat label="Conversión" value={formatPercent(s.conversion)} hint={`${formatNumber(s.uniqueVisitors)} visitantes únicos`} />
        <Stat label="Visitas" value={formatNumber(s.pageViews)} hint={`${formatNumber(s.productViews)} vistas de producto`} />
        <Stat label="Ingresos recurrentes" value={`${formatMoney(s.mrr)}`} hint="MRR de membresías" />
        <Stat label="Suscripciones activas" value={formatNumber(s.activeSubscriptions)} />
        <Stat label="Reservas" value={formatNumber(s.bookingsInRange)} hint={`${s.upcoming.length} próximas${s.pendingSchedule ? ` · ${s.pendingSchedule} sin fecha` : ""}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-semibold">Ingresos</h2>
            <span className="text-xs text-muted">{range === "all" ? "Por mes" : "Por día"}</span>
          </div>
          <BarChart
            title="Ingresos"
            data={s.series.map((p) => ({ key: p.key, label: p.label, value: p.revenue, display: `${formatMoney(p.revenue)} · ${p.sales} ${p.sales === 1 ? "venta" : "ventas"}` }))}
            axis="money"
          />
          <div className="mb-4 mt-8 flex items-baseline justify-between">
            <h2 className="font-semibold">Visitas</h2>
          </div>
          <BarChart
            title="Visitas"
            height={110}
            color="var(--color-gold)"
            data={s.series.map((p) => ({ key: p.key, label: p.label, value: p.visits, display: `${p.visits} visitas` }))}
          />
        </section>

        <div className="space-y-4">
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold">Productos más vendidos</h2>
            <ul className="mt-4 space-y-3">
              {s.topProducts.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span className="w-4 text-xs tabular-nums text-faint">{i + 1}</span>
                  <span className="text-lg">{t.product?.emoji ?? "✦"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.product?.title ?? "Producto eliminado"}</span>
                  <span className="text-right text-sm font-semibold tabular-nums">
                    {formatMoney(t.revenue)}
                    <span className="block text-xs font-normal text-muted">{t.count} {t.count === 1 ? "venta" : "ventas"}</span>
                  </span>
                </li>
              ))}
              {s.topProducts.length === 0 && <li className="text-sm text-muted">Aún no hay ventas en este periodo.</li>}
            </ul>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Próximas sesiones</h2>
              <Link href="/panel/solicitudes" className="text-xs font-semibold text-muted hover:text-ink">Ver todas</Link>
            </div>
            <ul className="mt-4 space-y-3">
              {s.upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand"><CalendarDays className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.customer.name ?? b.customer.email}</p>
                    <p className="truncate text-xs text-muted">{b.product.title} · {capitalize(formatSessionDate(b.startAt!, creator.timezone, false))}</p>
                  </div>
                </li>
              ))}
              {s.upcoming.length === 0 && <li className="text-sm text-muted">No hay sesiones próximas.</li>}
            </ul>
          </section>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <h2 className="font-semibold">Siguientes pasos</h2>
            <span className="text-xs text-muted">{checklist.length - pending.length}/{checklist.length}</span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition hover:border-ink/30 ${c.done ? "border-line bg-paper text-muted line-through" : "border-line bg-white"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full ${c.done ? "bg-ink text-cream" : "border border-line"}`}>{c.done && <Check className="h-3 w-3" />}</span>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/panel/sesiones" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <Plus className="h-5 w-5 text-lavender-deep" /> <span className="text-sm font-semibold">Sesiones y lecturas</span> <ArrowRight className="ml-auto h-4 w-4 text-faint" />
        </Link>
        <Link href="/panel/canva" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <Palette className="h-5 w-5 text-lavender-deep" /> <span className="text-sm font-semibold">Editar mi página</span> <ArrowRight className="ml-auto h-4 w-4 text-faint" />
        </Link>
        <Link href={features.analytics === "basic" ? "/panel/plan" : "/panel/estadisticas"} className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <TrendingUp className="h-5 w-5 text-lavender-deep" /> <span className="text-sm font-semibold">Estadísticas</span> <ArrowRight className="ml-auto h-4 w-4 text-faint" />
        </Link>
      </div>
    </div>
  );
}

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;
type ChecklistItem = { done: boolean; label: string; href: string };

/**
 * Inicio del panel en modo personal: visitas, inscripciones (lo gratuito con email y los accesos que
 * da la dueña) y clics, sin ingresos, cobros ni planes.
 */
function PersonalHome({
  first,
  range,
  rangeLabel,
  s,
  timezone,
  showBookings,
  sales,
  checklist,
  order,
}: {
  first: string;
  range: keyof typeof RANGES;
  rangeLabel: string;
  s: Stats;
  timezone: string;
  showBookings: boolean;
  /** La web cobra (Stripe/PayPal): ingresos y ventas además de visitas e inscripciones. */
  sales: boolean;
  checklist: ChecklistItem[];
  /** Orden de las tarjetas («Personalizar mi panel», lib/panel-prefs.ts HOME_CARDS). */
  order: string[];
}) {
  const pending = checklist.filter((c) => !c.done);
  const top = s.topSignups[0];
  const cards: Record<string, React.ReactNode> = {};
  cards.resumen = (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-cream">
          <div className="starfield absolute inset-0 opacity-40" />
          <div className="relative">
            <p className="eyebrow !text-cream/50">{RANGES[range]}</p>
            <p className="display mt-2 text-[1.9rem] leading-tight">
              Tu página recibió <span className="text-gold">{formatNumber(s.pageViews)} visitas</span> {rangeLabel}.
            </p>
            <p className="mt-2 text-sm text-cream/65">
              {formatNumber(s.uniqueVisitors)} personas distintas · {formatNumber(s.clicks)} clics en tus productos.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-white p-6">
          <p className="eyebrow">Lo más pedido</p>
          {top?.product ? (
            <>
              <p className="display mt-2 text-[1.9rem] leading-tight">
                <span className="italic">{top.product.title}</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                {top.count} {top.count === 1 ? "inscripción" : "inscripciones"} {rangeLabel}
              </p>
            </>
          ) : (
            <p className="display mt-2 text-[1.9rem] leading-tight text-muted">Tu primera inscripción está cerca. Comparte tu enlace ✨</p>
          )}
        </div>
      </div>
    </>
  );
  cards.cifras = (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {sales ? (
          <>
            <Stat label="Ingresos" value={formatMoney(s.revenue)} hint="Antes de las comisiones de Stripe y PayPal" accent />
            <Stat label="Ventas" value={formatNumber(s.sales)} hint="Productos vendidos" />
            <Stat label="Inscripciones" value={formatNumber(s.signups)} hint={`${formatPercent(s.signupConversion)} de las visitas`} />
            <Stat label="Visitas" value={formatNumber(s.pageViews)} hint={`${formatNumber(s.uniqueVisitors)} personas distintas`} />
          </>
        ) : (
          <>
            <Stat label="Visitas" value={formatNumber(s.pageViews)} hint={`${formatNumber(s.productViews)} vistas de producto`} accent />
            <Stat label="Personas distintas" value={formatNumber(s.uniqueVisitors)} hint="Medidas sin cookies" />
            <Stat label="Inscripciones" value={formatNumber(s.signups)} hint={`${formatPercent(s.signupConversion)} de las visitas`} />
            <Stat label="Clientes" value={formatNumber(range === "all" ? s.totalCustomers : s.newCustomers)} hint={range === "all" ? "En total" : `${s.totalCustomers} en total`} />
          </>
        )}
      </div>
    </>
  );
  cards.graficos = (
    <>
      <div className={`grid gap-4 ${showBookings ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-semibold">Visitas</h2>
            <span className="text-xs text-muted">{range === "all" ? "Por mes" : "Por día"}</span>
          </div>
          <BarChart
            title="Visitas"
            color="var(--color-gold)"
            data={s.series.map((p) => ({ key: p.key, label: p.label, value: p.visits, display: `${p.visits} visitas` }))}
          />
          <div className="mb-4 mt-8 flex items-baseline justify-between">
            <h2 className="font-semibold">Inscripciones</h2>
          </div>
          <BarChart
            title="Inscripciones"
            height={110}
            data={s.series.map((p) => ({ key: p.key, label: p.label, value: p.signups, display: `${p.signups} ${p.signups === 1 ? "inscripción" : "inscripciones"}` }))}
          />
        </section>

        {showBookings && (
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Próximas sesiones</h2>
              <Link href="/panel/solicitudes" className="text-xs font-semibold text-muted hover:text-ink">Ver todas</Link>
            </div>
            <ul className="mt-4 space-y-3">
              {s.upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand"><CalendarDays className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.customer.name ?? b.customer.email}</p>
                    <p className="truncate text-xs text-muted">{b.product.title} · {capitalize(formatSessionDate(b.startAt!, timezone, false))}</p>
                  </div>
                </li>
              ))}
              {s.upcoming.length === 0 && <li className="text-sm text-muted">No hay sesiones próximas.</li>}
            </ul>
          </section>
        )}
      </div>
    </>
  );
  cards.pasos = (
    <>
      {pending.length > 0 && (
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <h2 className="font-semibold">Siguientes pasos</h2>
            <span className="text-xs text-muted">{checklist.length - pending.length}/{checklist.length}</span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition hover:border-ink/30 ${c.done ? "border-line bg-paper text-muted line-through" : "border-line bg-white"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full ${c.done ? "bg-ink text-cream" : "border border-line"}`}>{c.done && <Check className="h-3 w-3" />}</span>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
  if (!pending.length) delete cards.pasos;
  cards.atajos = (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/panel/sesiones" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <Plus className="h-5 w-5 text-lavender-deep" /> <span className="text-sm font-semibold">Sesiones y lecturas</span> <ArrowRight className="ml-auto h-4 w-4 text-faint" />
        </Link>
        <Link href="/panel/circulos" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <Plus className="h-5 w-5 text-lavender-deep" /> <span className="text-sm font-semibold">Círculos de la Luna</span> <ArrowRight className="ml-auto h-4 w-4 text-faint" />
        </Link>
        <Link href="/panel/actualidades" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <Newspaper className="h-5 w-5 text-lavender-deep" /> <span className="text-sm font-semibold">Actualidades</span> <ArrowRight className="ml-auto h-4 w-4 text-faint" />
        </Link>
        <Link href="/panel/canva" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <Palette className="h-5 w-5 text-lavender-deep" /> <span className="text-sm font-semibold">Editar mi página</span> <ArrowRight className="ml-auto h-4 w-4 text-faint" />
        </Link>
      </div>
    </>
  );

  return (
    <div className="space-y-8">
      <PageHeader title={`Hola, ${first}`} subtitle={<>Así va tu página {rangeLabel}.</>} actions={<RangeTabs current={range} base="/panel" />} />


      {order
        .filter((k) => cards[k])
        .map((k) => (
          <div key={k} data-home-card={k}>
            {cards[k]}
          </div>
        ))}
    </div>
  );
}
