import Link from "next/link";
import type { ReactNode } from "react";
import { ELEMENT_HUE, SIGNS, signOf } from "@/components/models/data/astrology";
import { KEY_BY_N } from "@/components/models/data/gene-keys";
import { GATE_BY_N } from "@/components/models/data/human-design";
import { EIGHT_PHASES, PHASE_GUIDANCE } from "@/components/models/data/moon";
import { PayoutBanner } from "@/components/panel/payout-status";
import { requireCreator } from "@/lib/auth";
import { listBirthProfiles } from "@/lib/birth-profiles";
import { signupsOnly } from "@/lib/commerce";
import { activationsAt } from "@/lib/human-design-calc";
import { moonState } from "@/lib/lunar-sky";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { dateKeyInTz, formatInTz, zonedTimeToUtc } from "@/lib/tz";
import { BarChart, HBars, Sparkline, TrendChart } from "./inicio/charts";
import { fmtValue, type ValueFormat } from "./inicio/format";
import { NextMoon } from "./inicio/next-moon";
import { Pending } from "./inicio/pending";
import { asPeriod, homeStats, PERIODS, type Kpi, type PeriodDays } from "./inicio/stats";
import { TodayEnergy, type GeneralEnergy } from "./inicio/today-energy";
import { StatsWheel, type WheelSector } from "./stats-wheel";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Cuándo empieza la temporada de cada signo (mes, día), de Aries a Piscis. */
const SIGN_START: [number, number][] = [
  [3, 21], [4, 20], [5, 21], [6, 21], [7, 23], [8, 23], [9, 23], [10, 23], [11, 22], [12, 22], [1, 20], [2, 19],
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Las 12 últimas temporadas del zodiaco, en su zona horaria: la de ahora (a medias) y las 11 de antes. Cada signo
 * sale una vez: es su trozo del último año.
 */
function lastSeasons(tz: string, now: Date) {
  const today = dateKeyInTz(now, tz);
  const year = Number(today.slice(0, 4));
  const starts: { sign: number; key: string }[] = [];
  for (const y of [year - 1, year, year + 1]) SIGN_START.forEach(([m, d], sign) => starts.push({ sign, key: `${y}-${pad(m)}-${pad(d)}` }));
  starts.sort((a, b) => a.key.localeCompare(b.key));
  const cur = starts.findLastIndex((s) => s.key <= today);
  return starts.slice(cur - 11, cur + 1).map((s, i) => {
    const from = zonedTimeToUtc(s.key, 0, tz);
    const end = zonedTimeToUtc(starts[cur - 11 + i + 1].key, 0, tz);
    return { sign: s.sign, from, end, to: end > now ? now : end, current: i === 11 };
  });
}

/** La energía del día para todos: la Luna, el Sol, la puerta del Sol en Human Design y la Llave de Gene Keys. */
function generalEnergy(now: Date, tz: string): GeneralEnergy {
  const s = moonState(now);
  const phase = EIGHT_PHASES[Math.floor(s.elong / 45) % 8];
  const guide = PHASE_GUIDANCE[phase];
  const sun = activationsAt(now).sun;
  const gate = GATE_BY_N.get(sun.gate)!;
  const key = KEY_BY_N.get(sun.gate)!;
  return {
    date: formatInTz(now, tz, { weekday: "long", day: "numeric", month: "long" }),
    phase,
    moonSign: SIGNS[signOf(s.moonLon).n].name,
    intent: guide.intent,
    practice: guide.practice,
    illum: s.illum,
    sunSign: SIGNS[signOf(s.sunLon).n].name,
    gate: sun.gate,
    line: sun.line,
    gateName: gate.name,
    gateTheme: gate.theme,
    key: key.n,
    shadow: key.shadow,
    gift: key.gift,
    siddhi: key.siddhi,
  };
}

/** La subida o bajada respecto al periodo de antes, con su flecha (no solo el color). En la conversión, en puntos. */
function Delta({ k, points }: { k: Kpi; points?: boolean }) {
  if (points) {
    const d = k.value - k.prev;
    if (Math.abs(d) < 0.05) return <span className="text-xs text-muted"><Tr s={"= que antes"} /></span>;
    return (
      <span className="text-xs font-semibold" style={{ color: d > 0 ? "var(--color-success, #2f8f5b)" : "var(--color-rose, #c4554a)" }}>
        <Tr s={d > 0 ? "↑" : "↓"} /> {Math.abs(d).toLocaleString("es-ES", { maximumFractionDigits: 1 })}{" "}<Tr s={"pts"} /></span>
    );
  }
  if (!k.prev) return <span className="text-xs text-muted"><Tr s={k.value ? "nuevo" : "—"} /></span>;
  const pct = Math.round(((k.value - k.prev) / k.prev) * 100);
  if (pct === 0) return <span className="text-xs text-muted"><Tr s={"= que antes"} /></span>;
  return (
    <span className="text-xs font-semibold" style={{ color: pct > 0 ? "var(--color-success, #2f8f5b)" : "var(--color-rose, #c4554a)" }}>
      <Tr s={pct > 0 ? "↑" : "↓"} /> {Math.abs(pct)} %
    </span>
  );
}

function KpiTile({ label, k, format = "num", points, spark = true }: { label: string; k: Kpi; format?: ValueFormat; points?: boolean; spark?: boolean }) {
  return (
    <div className="card flex flex-col p-4">
      <p className="text-xs text-muted"><Tr s={label} /></p>
      <p className="mt-1 font-serif text-[1.9rem] leading-none tabular-nums">{fmtValue(k.value, format)}</p>
      <div className="mt-1.5">
        <Delta k={k} points={points} />
      </div>
      {spark && (
        <div className="mt-auto pt-2">
          <Sparkline values={k.series} />
        </div>
      )}
    </div>
  );
}

/** Un número sin comparación (los totales de ahora: suscriptoras, miembros). */
function TotalTile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="card flex flex-col p-4">
      <p className="text-xs text-muted"><Tr s={label} /></p>
      <p className="mt-1 font-serif text-[1.9rem] leading-none tabular-nums">{fmtValue(value)}</p>
      <p className="mt-1.5 text-xs text-muted"><Tr s={note} /></p>
    </div>
  );
}

function ChartCard({ title, value, children, className = "" }: { title: string; value?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`} aria-label={title}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {value && <p className="font-serif text-lg tabular-nums"><Tr s={value} /></p>}
      </div>
      {children}
    </section>
  );
}

const EmptyChart = ({ text }: { text: string }) => <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted"><Tr s={text} /></p>;

/**
 * Inicio del panel. Arriba, en grande: su energía de hoy y la próxima luna. Debajo, lo que la espera (Pendientes) y
 * sus estadísticas con el periodo que elija (7, 30, 90 días o 12 meses), comparadas con el periodo de antes: los
 * números, la evolución de las visitas, inscripciones, ingresos, newsletter, de dónde llegan, el embudo, lo más visto
 * y qué días la visitan. Al final, la rueda del zodiaco con los visitantes del último año.
 */
export default async function PanelHome({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const t = await getT();
  const { user, creator } = await requireCreator();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const tz = creator.timezone;
  const now = new Date();
  const personal = isPersonalMode();
  const onlySignups = signupsOnly();
  const days: PeriodDays = asPeriod(sp.p);

  const seasons = lastSeasons(tz, now);
  const [stats, profiles, seasonValues] = await Promise.all([
    homeStats({ creatorId: creator.id, tz, days, onlySignups, now }),
    personal ? listBirthProfiles(creator.id, user.id) : Promise.resolve([]),
    Promise.all(seasons.map(async (s) => (await db.analyticsEvent.groupBy({ by: ["visitorId"], where: { type: "PAGE_VIEW", createdAt: { gte: s.from, lt: s.to } } })).length)),
  ]);
  const own = profiles.find((p) => p.isOwn) ?? null;

  const day = (d: Date, withYear: boolean) => formatInTz(d, tz, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) }).replace(/\./g, "");
  const sectors: WheelSector[] = seasons
    .map((s, i) => {
      const sign = SIGNS[s.sign];
      const last = new Date(s.end.getTime() - 12 * 3600_000);
      return {
        sign: s.sign,
        name: sign.name,
        glyph: sign.glyph,
        hue: ELEMENT_HUE[sign.element],
        dates: `${day(s.from, false)} – ${day(last, true)}`,
        value: seasonValues[i],
        current: s.current,
        progress: s.current ? Math.min(1, (now.getTime() - s.from.getTime()) / (s.end.getTime() - s.from.getTime())) : 1,
      };
    })
    .sort((a, b) => a.sign - b.sign);

  const k = stats.kpis;
  const sum = (pts: { value: number }[]) => pts.reduce((a, p) => a + p.value, 0);
  const signupLabel = onlySignups ? "Inscripciones" : "Inscripciones y compras";
  const period = PERIODS.find((p) => p.days === days)!;
  const funnelTop = stats.funnel[0].value || 1;
  const sourcesTotal = sum(stats.sources) || 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="sr-only"><Tr s={"Inicio"} /></h1>
      {!personal && (
        <div className="space-y-2 empty:hidden">
          <PayoutBanner creator={creator} />
        </div>
      )}

      {/* En grande: su energía de hoy y la próxima luna */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <TodayEnergy general={generalEnergy(now, tz)} profile={own} setupHref={personal ? "/area/energy" : null} />
        <NextMoon tz={tz} now={now} />
      </div>

      <Pending creatorId={creator.id} />

      {/* Estadísticas: el periodo y los números */}
      <section aria-labelledby="stats-t" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="stats-t" className="font-serif text-[1.6rem] leading-tight"><Tr s={"Tus estadísticas"} /></h2>
          <nav aria-label={t("Periodo")} className="inline-flex gap-1 rounded-full border border-line p-1 text-sm">
            {PERIODS.map((p) => (
              <Link
                key={p.days}
                href={p.days === 30 ? "/panel" : `/panel?p=${p.days}`}
                scroll={false}
                aria-current={p.days === days ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition ${p.days === days ? "bg-gold text-[#1a1408]" : "text-muted hover:text-ink"}`}
              >
                <Tr s={p.label} />
              </Link>
            ))}
          </nav>
        </div>
        <p className="-mt-2 text-xs text-muted"><Tr s={"Últimos"} />{" "}<Tr s={period.label} /><Tr s={", comparados con los"} />{" "}<Tr s={period.label} />{" "}<Tr s={"de antes."} /></p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <KpiTile label={t("Visitantes únicos")} k={k.visitors} />
          <KpiTile label={t(signupLabel)} k={k.signups} />
          {!onlySignups && <KpiTile label={t("Ingresos")} k={k.revenue} format="money" />}
          <KpiTile label={t("Altas en la newsletter")} k={k.newsletter} />
          <KpiTile label={t("Clics en productos")} k={k.clicks} />
          <KpiTile label={t("Conversión (inscripciones / visitantes)")} k={k.conversion} format="pct" points />
          <TotalTile label={t("Suscriptoras de la newsletter")} value={stats.subscribersTotal} note={t("Confirmadas, ahora mismo")} />
          <TotalTile label={t("Miembros activos")} value={stats.members} note={t("En tus membresías, ahora mismo")} />
        </div>
      </section>

      <ChartCard title={t("Visitantes únicos")} value={fmtValue(k.visitors.value)}>
        <TrendChart points={stats.visitors} label={t("Visitantes únicos")} />
      </ChartCard>

      <div className={`grid gap-4 ${onlySignups ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        <ChartCard title={t(signupLabel)} value={fmtValue(sum(stats.signups))}>
          <BarChart points={stats.signups} label={t(signupLabel)} />
        </ChartCard>
        {!onlySignups && (
          <ChartCard title={t("Ingresos")} value={fmtValue(sum(stats.revenue), "money")}>
            <BarChart points={stats.revenue} label={t("Ingresos")} format="money" />
          </ChartCard>
        )}
        <ChartCard title={t("Altas en la newsletter")} value={fmtValue(sum(stats.newsletter))}>
          <BarChart points={stats.newsletter} label={t("Altas en la newsletter")} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("De dónde llegan")}>
          {stats.sources.length ? (
            <HBars items={stats.sources.map((s) => ({ ...s, hint: `${Math.round((s.value / sourcesTotal) * 100)} %` }))} />
          ) : (
            <EmptyChart text={t("Aún no hay visitas en este periodo.")} />
          )}
        </ChartCard>
        <ChartCard title={t("Del primer vistazo a la inscripción")}>
          {stats.funnel[0].value ? (
            <HBars items={stats.funnel.map((f, i) => ({ ...f, hint: i ? `${Math.round((f.value / funnelTop) * 100)} %` : undefined }))} />
          ) : (
            <EmptyChart text={t("Aún no hay visitas en este periodo.")} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("Lo más visto")}>
          {stats.topProducts.length ? (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-1 pb-2 font-medium"><Tr s={"Producto"} /></th>
                    <th className="px-1 pb-2 text-right font-medium"><Tr s={"Visitas"} /></th>
                    <th className="px-1 pb-2 text-right font-medium"><Tr s={"Clics"} /></th>
                    <th className="px-1 pb-2 text-right font-medium">{onlySignups ? t("Inscritas") : t("Inscritas o compras")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.topProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="max-w-[14rem] truncate px-1 py-2">{p.title}</td>
                      <td className="px-1 py-2 text-right tabular-nums">{fmtValue(p.views)}</td>
                      <td className="px-1 py-2 text-right tabular-nums">{fmtValue(p.clicks)}</td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums">{fmtValue(p.signups)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyChart text={t("Aún nadie ha abierto tus productos en este periodo.")} />
          )}
        </ChartCard>
        <ChartCard title={t("Qué días te visitan más")}>
          <BarChart points={stats.weekdays} label={t("Visitantes por día de la semana")} height={170} />
        </ChartCard>
      </div>

      {/* Al final, la rueda del zodiaco: los visitantes del último año, por temporadas */}
      <section className="card p-4 sm:p-6" aria-labelledby="rueda-t">
        <h3 id="rueda-t" className="mb-3 text-center font-semibold"><Tr s={"Tu año en el zodiaco"} /></h3>
        <StatsWheel sectors={sectors} />
      </section>
    </div>
  );
}
