import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { formatMoney, formatPrice } from "@/lib/money";
import { tenantDb } from "@/lib/tenant";
import { orderStatusLabel } from "@/lib/refund-math";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatSessionDate } from "@/lib/tz";
import { Badge, Stat } from "../../ui";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const c = await db.customer.findFirst({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { startAt: { sort: "desc", nulls: "last" } }, include: { product: true } },
      subscriptions: { include: { product: true } },
    },
  });
  if (!c) notFound();
  const courseIds = (await db.access.findMany({ where: { userId: c.userId, product: { type: "COURSE" } }, select: { productId: true, product: { select: { title: true, _count: { select: { lessons: true } } } } } }));
  const progress = await db.lessonProgress.groupBy({ by: ["productId"], where: { userId: c.userId }, _count: { _all: true } });
  return (
    <div className="max-w-3xl">
      <Link href="/panel/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Clientes</Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-ink text-xl text-cream">{(c.name ?? c.email)[0].toUpperCase()}</div>
        <div className="flex-1">
          <h1 className="display text-[2.2rem] leading-tight">{c.name ?? c.email}</h1>
          <p className="text-sm text-muted">{c.email} · clienta desde {c.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="mt-0.5 text-xs text-muted">
            {c.marketingOptIn
              ? `Acepta novedades por email${c.marketingOptInAt ? ` desde el ${c.marketingOptInAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}` : ""}`
              : "No ha aceptado recibir novedades"}
          </p>
        </div>
        <a href={`mailto:${c.email}`} className="btn btn-outline btn-sm"><Mail className="h-4 w-4" /> Escribir</a>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Total gastado" value={formatMoney(c.totalSpentCents)} accent />
        <Stat label="Compras" value={c.ordersCount} />
        <Stat label="Última compra" value={c.lastPurchaseAt?.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) ?? "—"} />
      </div>
      {courseIds.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="font-semibold">Progreso en cursos</h2>
          {courseIds.map((a) => {
            const done = progress.find((p) => p.productId === a.productId)?._count._all ?? 0;
            const pct = a.product._count.lessons ? Math.round((done / a.product._count.lessons) * 100) : 0;
            return (
              <div key={a.productId} className="mt-3">
                <div className="flex justify-between text-sm"><span>{a.product.title}</span><span className="font-semibold">{pct}%</span></div>
                <div className="mt-1.5 h-1.5 rounded-full bg-sand"><div className="h-full rounded-full bg-lavender-deep" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </section>
      )}
      {c.subscriptions.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="font-semibold">Membresías</h2>
          {c.subscriptions.map((s) => (
            <p key={s.id} className="mt-2 flex items-center justify-between text-sm">
              <span>{s.product.title} · {formatPrice(s.priceCents, "EUR", s.interval)}</span>
              <Badge tone={s.status === "ACTIVE" ? (s.cancelAtPeriodEnd ? "warning" : "success") : "neutral"}>{s.status === "ACTIVE" ? (s.cancelAtPeriodEnd ? "Cancela al final del periodo" : "Activa") : "Finalizada"}</Badge>
            </p>
          ))}
        </section>
      )}
      {c.bookings.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="font-semibold">Sesiones</h2>
          {c.bookings.map((b) => (
            <p key={b.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span>{b.product.title} · {b.startAt ? capitalize(formatSessionDate(b.startAt, creator.timezone)) : "sin fecha"}</span>
              <Badge>{BOOKING_STATUS_LABEL[b.status]}</Badge>
            </p>
          ))}
        </section>
      )}
      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Pedidos</h2>
        {c.orders.map((o) => (
          <p key={o.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate"><Link href={`/panel/ventas/${o.id}`} className="hover:underline">{o.productTitle}</Link> <span className="text-muted">· {o.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></span>
            <span className="shrink-0 font-semibold tabular-nums">{formatMoney(o.amountCents, o.currency, { decimals: true })} <span className="font-normal text-muted">{orderStatusLabel(o)}</span></span>
          </p>
        ))}
      </section>
    </div>
  );
}
