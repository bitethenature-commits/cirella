import "server-only";
import { SOURCE_LABEL, SOURCES, type Source } from "@/lib/analytics";
import { activeAccessWhere } from "@/lib/membership-access";
import { tenantDb } from "@/lib/tenant";
import { addDaysToKey, dateKeyInTz, formatInTz, zonedTimeToUtc } from "@/lib/tz";

/**
 * Las estadísticas de Inicio (app/panel/page.tsx) para un periodo: los números de arriba comparados con el periodo
 * de antes (igual de largo) y las series para las gráficas, en su zona horaria. Días en 7 y 30, semanas en 90 y
 * meses en 12 meses.
 */

export const PERIODS = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 365, label: "12 meses" },
] as const;
export type PeriodDays = (typeof PERIODS)[number]["days"];
export const asPeriod = (v: string | undefined): PeriodDays => PERIODS.find((p) => String(p.days) === v)?.days ?? 30;

/** Un punto de una gráfica: su etiqueta corta (eje), la larga (al pasar por encima) y su cifra. */
export type Point = { label: string; long: string; value: number };
type Bucket = { label: string; long: string; from: Date; to: Date };

const pad = (n: number) => String(n).padStart(2, "0");

function bucketsFor(days: PeriodDays, tz: string, now: Date): Bucket[] {
  const today = dateKeyInTz(now, tz);
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => formatInTz(d, tz, o).replace(/\./g, "");
  if (days === 365) {
    const [y, m] = today.split("-").map(Number);
    return Array.from({ length: 12 }, (_, i) => {
      const k = m - 11 + i;
      const yy = y + Math.floor((k - 1) / 12);
      const mm = ((((k - 1) % 12) + 12) % 12) + 1;
      const from = zonedTimeToUtc(`${yy}-${pad(mm)}-01`, 0, tz);
      const next = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${pad(mm + 1)}-01`;
      return { label: fmt(from, { month: "short" }), long: fmt(from, { month: "long", year: "numeric" }), from, to: zonedTimeToUtc(next, 0, tz) };
    });
  }
  if (days === 90) {
    return Array.from({ length: 13 }, (_, i) => {
      const startKey = addDaysToKey(today, -(12 - i) * 7 - 6);
      const from = zonedTimeToUtc(startKey, 0, tz);
      const to = zonedTimeToUtc(addDaysToKey(startKey, 7), 0, tz);
      const last = new Date(to.getTime() - 12 * 3600_000);
      return {
        label: fmt(from, { day: "numeric", month: "short" }),
        long: `Semana del ${fmt(from, { day: "numeric", month: "short" })} al ${fmt(last, { day: "numeric", month: "short" })}`,
        from,
        to,
      };
    });
  }
  return Array.from({ length: days }, (_, i) => {
    const key = addDaysToKey(today, -(days - 1 - i));
    const from = zonedTimeToUtc(key, 0, tz);
    return { label: fmt(from, { day: "numeric", month: "short" }), long: fmt(from, { weekday: "long", day: "numeric", month: "long" }), from, to: zonedTimeToUtc(addDaysToKey(key, 1), 0, tz) };
  });
}

const VIEWS = new Set(["PAGE_VIEW", "PRODUCT_VIEW"]);
const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Un número de arriba: el del periodo, el del periodo de antes y su serie (para la línea pequeña). */
export type Kpi = { value: number; prev: number; series: number[] };

export async function homeStats(o: { creatorId: string; tz: string; days: PeriodDays; onlySignups: boolean; now?: Date }) {
  const now = o.now ?? new Date();
  const db = tenantDb(o.creatorId);
  const buckets = bucketsFor(o.days, o.tz, now);
  const start = buckets[0].from;
  const prevStart = new Date(start.getTime() - (now.getTime() - start.getTime()));
  const signupTypes = o.onlySignups ? ["SIGNUP"] : ["SIGNUP", "PURCHASE"];

  const [events, subs, subscribersTotal, members, products] = await Promise.all([
    db.analyticsEvent.findMany({
      where: { createdAt: { gte: prevStart, lt: now }, type: { in: ["PAGE_VIEW", "PRODUCT_VIEW", "PRODUCT_CLICK", "SIGNUP", "PURCHASE", "REFUND"] } },
      select: { type: true, visitorId: true, source: true, productId: true, amountCents: true, createdAt: true },
    }),
    db.subscriber.findMany({ where: { confirmedAt: { gte: prevStart, lt: now } }, select: { confirmedAt: true } }),
    db.subscriber.count({ where: { status: "CONFIRMED" } }),
    db.access.count({ where: { product: { type: "MEMBERSHIP" }, ...activeAccessWhere(now) } }),
    db.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true, emoji: true } }),
  ]);

  const n = buckets.length;
  const idx = (d: Date) => {
    if (d < start) return -1;
    for (let i = n - 1; i >= 0; i--) if (d >= buckets[i].from) return i;
    return -1;
  };
  const zero = () => new Array<number>(n).fill(0);

  // Series del periodo.
  const visitorSets = buckets.map(() => new Set<string>());
  const signups = zero();
  const clicks = zero();
  const revenue = zero();
  const newsletter = zero();
  // Totales: el periodo y el de antes.
  const cur = { visitors: new Set<string>(), signups: 0, clicks: 0, revenue: 0 };
  const prev = { visitors: new Set<string>(), signups: 0, clicks: 0, revenue: 0 };
  // Desgloses (solo el periodo).
  const bySource = new Map<Source, Set<string>>();
  const byProduct = new Map<string, { views: number; clicks: number; signups: number }>();
  const productViewers = new Set<string>();
  const clickers = new Set<string>();
  // Visitantes por día de la semana: cada persona cuenta una vez por día.
  const weekday = WEEKDAYS.map(() => new Set<string>());

  for (const e of events) {
    const i = idx(e.createdAt);
    const t = i >= 0 ? cur : prev;
    const isSignup = signupTypes.includes(e.type);
    const view = VIEWS.has(e.type);
    const money = e.type === "PURCHASE" ? (e.amountCents ?? 0) : e.type === "REFUND" ? -(e.amountCents ?? 0) : 0;
    if (view) t.visitors.add(e.visitorId);
    if (isSignup) t.signups++;
    if (e.type === "PRODUCT_CLICK") t.clicks++;
    t.revenue += money;
    if (i < 0) continue;

    if (view) {
      visitorSets[i].add(e.visitorId);
      const src: Source = SOURCES.includes(e.source as Source) ? (e.source as Source) : "direct";
      if (!bySource.has(src)) bySource.set(src, new Set());
      bySource.get(src)!.add(e.visitorId);
      const key = dateKeyInTz(e.createdAt, o.tz);
      const wd = (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;
      weekday[wd].add(`${e.visitorId}|${key}`);
    }
    if (e.type === "PRODUCT_VIEW") productViewers.add(e.visitorId);
    if (e.type === "PRODUCT_CLICK") {
      clickers.add(e.visitorId);
      clicks[i]++;
    }
    if (isSignup) signups[i]++;
    revenue[i] += money;
    if (e.productId && (e.type === "PRODUCT_VIEW" || e.type === "PRODUCT_CLICK" || isSignup)) {
      const p = byProduct.get(e.productId) ?? { views: 0, clicks: 0, signups: 0 };
      if (e.type === "PRODUCT_VIEW") p.views++;
      else if (e.type === "PRODUCT_CLICK") p.clicks++;
      else p.signups++;
      byProduct.set(e.productId, p);
    }
  }

  let subsPrev = 0;
  for (const s of subs) {
    const i = idx(s.confirmedAt!);
    if (i >= 0) newsletter[i]++;
    else subsPrev++;
  }
  const subsCur = newsletter.reduce((a, b) => a + b, 0);
  const visitors = visitorSets.map((s) => s.size);
  const conv = (s: number, v: number) => (v ? (s / v) * 100 : 0);
  const point = (values: number[]): Point[] => buckets.map((b, i) => ({ label: b.label, long: b.long, value: values[i] }));
  const names = new Map(products.map((p) => [p.id, `${p.emoji ? `${p.emoji} ` : ""}${p.title}`]));

  return {
    kpis: {
      visitors: { value: cur.visitors.size, prev: prev.visitors.size, series: visitors } satisfies Kpi,
      signups: { value: cur.signups, prev: prev.signups, series: signups } satisfies Kpi,
      clicks: { value: cur.clicks, prev: prev.clicks, series: clicks } satisfies Kpi,
      revenue: { value: cur.revenue, prev: prev.revenue, series: revenue } satisfies Kpi,
      newsletter: { value: subsCur, prev: subsPrev, series: newsletter } satisfies Kpi,
      conversion: {
        value: conv(cur.signups, cur.visitors.size),
        prev: conv(prev.signups, prev.visitors.size),
        series: buckets.map((_, i) => conv(signups[i], visitors[i])),
      } satisfies Kpi,
    },
    subscribersTotal,
    members,
    visitors: point(visitors),
    signups: point(signups),
    revenue: point(revenue),
    newsletter: point(newsletter),
    sources: [...bySource].map(([s, set]) => ({ label: SOURCE_LABEL[s], value: set.size })).sort((a, b) => b.value - a.value),
    funnel: [
      { label: "Visitaron tu web", value: cur.visitors.size },
      { label: "Abrieron un producto", value: productViewers.size },
      { label: o.onlySignups ? "Pulsaron para apuntarse" : "Pulsaron para comprar o apuntarse", value: clickers.size },
      { label: o.onlySignups ? "Se inscribieron" : "Se inscribieron o compraron", value: cur.signups },
    ],
    topProducts: [...byProduct]
      .filter(([id]) => names.has(id))
      .map(([id, p]) => ({ id, title: names.get(id)!, ...p }))
      .sort((a, b) => b.views - a.views || b.signups - a.signups)
      .slice(0, 6),
    weekdays: WEEKDAYS.map((d, i) => ({ label: d.slice(0, 3), long: d, value: weekday[i].size })),
  };
}

export type HomeStats = Awaited<ReturnType<typeof homeStats>>;
