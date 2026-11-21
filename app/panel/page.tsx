import type { Prisma } from "@prisma/client";
import { ELEMENT_HUE, SIGNS } from "@/components/models/data/astrology";
import { PayoutBanner } from "@/components/panel/payout-status";
import { requireCreator } from "@/lib/auth";
import { SOURCE_LABEL, SOURCES, type Source } from "@/lib/analytics";
import { signupsOnly } from "@/lib/commerce";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { dateKeyInTz, formatInTz, zonedTimeToUtc } from "@/lib/tz";
import { StatsWheel, type WheelMetric, type WheelSector } from "./stats-wheel";

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

const METRICS: WheelMetric[] = ["visitas", "inscripciones", "clics", "newsletter"];

/**
 * Inicio: la rueda del zodiaco con sus estadísticas. Cada signo es su temporada del último año (Aries, del 21 de
 * marzo al 19 de abril…) con una barra de lo que pasó en ella. Debajo, los filtros: qué se cuenta (visitantes
 * únicos, inscripciones, clics en productos o altas en la newsletter), de dónde llegan y de qué producto.
 */
export default async function PanelHome({ searchParams }: { searchParams: Promise<{ m?: string; origen?: string; producto?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const tz = creator.timezone;
  const now = new Date();
  const products = await db.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true, emoji: true }, orderBy: { title: "asc" } });

  const metric: WheelMetric = METRICS.includes(sp.m as WheelMetric) ? (sp.m as WheelMetric) : "visitas";
  // La newsletter no sabe de dónde llegan (Instagram, TikTok…): ahí no hay filtro de origen.
  const source = metric !== "newsletter" && SOURCES.includes(sp.origen as Source) ? (sp.origen as Source) : null;
  const product = products.some((p) => p.id === sp.producto) ? sp.producto! : null;
  // Sin cobros, una inscripción es SIGNUP; si cobra, también cuentan las compras.
  const onlySignups = signupsOnly();
  const type: Prisma.AnalyticsEventWhereInput["type"] =
    metric === "visitas" ? (product ? "PRODUCT_VIEW" : "PAGE_VIEW") : metric === "clics" ? "PRODUCT_CLICK" : onlySignups ? "SIGNUP" : { in: ["SIGNUP", "PURCHASE"] };
  const base: Prisma.AnalyticsEventWhereInput = { type, ...(source ? { source } : {}), ...(product ? { productId: product } : {}) };

  // Newsletter de un producto: quien se apuntó al pedirlo gratis (guarda el producto) o al comprarlo (guarda el pedido).
  const refs =
    metric === "newsletter" && product ? [product, ...(await db.order.findMany({ where: { productId: product }, select: { id: true } })).map((o) => o.id)] : null;

  const seasons = lastSeasons(tz, now);
  const values = await Promise.all(
    seasons.map(async (s) => {
      // Altas en la newsletter: las que confirmaron en esa temporada (aunque luego se dieran de baja).
      if (metric === "newsletter") return db.subscriber.count({ where: { confirmedAt: { gte: s.from, lt: s.to }, ...(refs ? { sourceRef: { in: refs } } : {}) } });
      const where: Prisma.AnalyticsEventWhereInput = { ...base, createdAt: { gte: s.from, lt: s.to } };
      // Visitantes únicos: personas distintas (se miden sin cookies, cada día).
      if (metric === "visitas") return (await db.analyticsEvent.groupBy({ by: ["visitorId"], where })).length;
      return db.analyticsEvent.count({ where });
    }),
  );

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
        value: values[i],
        current: s.current,
        // Por dónde va la temporada de ahora (para la marca de «hoy»).
        progress: s.current ? Math.min(1, (now.getTime() - s.from.getTime()) / (s.end.getTime() - s.from.getTime())) : 1,
      };
    })
    .sort((a, b) => a.sign - b.sign);

  return (
    <div>
      <h1 className="sr-only">Inicio</h1>
      {!isPersonalMode() && (
        <div className="mb-4 space-y-2 empty:hidden">
          <PayoutBanner creator={creator} />
        </div>
      )}
      <StatsWheel
        sectors={sectors}
        metric={metric}
        labels={{ visitas: "Visitantes únicos", inscripciones: onlySignups ? "Inscripciones" : "Inscripciones y compras", clics: "Clics en productos", newsletter: "Altas en la newsletter" }}
        source={source ?? ""}
        product={product ?? ""}
        sources={SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
        products={products.map((p) => ({ value: p.id, label: `${p.emoji ? `${p.emoji} ` : ""}${p.title}` }))}
      />
    </div>
  );
}
