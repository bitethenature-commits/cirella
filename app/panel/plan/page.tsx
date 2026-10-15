import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, FileText, Gift } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { FEE_TX_SELECT, FEE_TX_WHERE, buildFeeInvoiceLines, monthPeriod } from "@/lib/invoices/fees";
import { periodLabel } from "@/lib/invoices/format";
import { planBullets } from "@/lib/plans";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../ui";
import { changePlan } from "./actions";
import { formatDate } from "@/lib/tz";
import { isPersonalMode } from "@/lib/site-mode";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ elegir?: string; ok?: string; error?: string }> }) {
  // Modo personal: sin planes (la dueña tiene el plan «Personal», sin comisión y con todo).
  if (isPersonalMode()) redirect("/panel");
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const month = monthPeriod(new Date());
  const [plans, products, invoices, monthTxs] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.product.count({ where: { status: { not: "ARCHIVED" } } }),
    db.invoice.findMany({ where: { kind: "FEES" }, orderBy: { issuedAt: "desc" }, take: 24 }),
    // Lo que lleva este mes: vista previa de la próxima factura (la emite el cron el día 1).
    db.transaction.findMany({ where: { createdAt: { gte: month.from, lt: month.to }, ...FEE_TX_WHERE }, orderBy: { createdAt: "asc" }, select: FEE_TX_SELECT }),
  ]);
  const monthTotal = buildFeeInvoiceLines(monthTxs, creator.plan.name).reduce((a, l) => a + l.totalCents, 0);
  const nextMonth = periodLabel(monthPeriod(new Date(), 1).period);
  const discountActive = creator.commissionDiscountBps > 0 && (!creator.commissionDiscountUntil || creator.commissionDiscountUntil > new Date());
  return (
    <div>
      <PageHeader
        title="Tu plan"
        subtitle={<>Estás en <strong>{creator.plan.name}</strong> · {products}{creator.plan.maxProducts != null ? ` de ${creator.plan.maxProducts}` : ""} productos · comisión {(creator.plan.commissionBps / 100).toLocaleString("es-ES")} %{creator.planRenewsAt ? ` · se renueva el ${formatDate(creator.planRenewsAt, { day: "numeric", month: "long" }, creator.timezone)}` : ""}</>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      {(creator.creditCents > 0 || discountActive) && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft/40 p-4 text-sm">
          <Gift className="h-5 w-5 text-gold" />
          <span>
            {creator.creditCents > 0 && <>Tienes <strong>{formatMoney(creator.creditCents, "EUR", { decimals: true })}</strong> de crédito por referidos. </>}
            {discountActive && <>Comisión reducida en {(creator.commissionDiscountBps / 100).toLocaleString("es-ES")} puntos hasta el {(creator.commissionDiscountUntil ? formatDate(creator.commissionDiscountUntil, { day: "numeric", month: "numeric", year: "numeric" }, creator.timezone) : undefined)}.</>}
          </span>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const current = p.id === creator.planId;
          const suggested = sp.elegir === p.key && !current;
          return (
            <div key={p.id} className={`relative flex flex-col rounded-3xl border p-6 ${current ? "border-ink bg-ink text-cream" : suggested ? "border-lavender-deep bg-white ring-2 ring-lavender-deep/30" : "border-line bg-white"}`}>
              {current && <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">Tu plan</span>}
              <p className="display text-3xl">{p.name}</p>
              <p className={`text-sm ${current ? "text-cream/60" : "text-muted"}`}>{p.tagline}</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight">{formatMoney(p.priceMonthlyCents)}<span className={`text-base font-normal ${current ? "text-cream/60" : "text-muted"}`}>/mes</span>{p.priceMonthlyCents > 0 && <span className={`ml-1 text-xs font-normal ${current ? "text-cream/60" : "text-muted"}`}>IVA incluido</span>}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {planBullets(p).map((b) => (
                  <li key={b} className="flex gap-2"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${current ? "text-gold" : "text-sage"}`} />{b}</li>
                ))}
              </ul>
              {!current && (
                <form action={changePlan} className="mt-6">
                  <input type="hidden" name="plan" value={p.key} />
                  <SubmitButton className={`btn w-full ${suggested ? "btn-primary" : "btn-outline"}`} pendingLabel="Procesando…">
                    {p.sortOrder > creator.plan.sortOrder ? `Mejorar a ${p.name}` : `Cambiar a ${p.name}`}
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Los precios incluyen IVA. Pago de la suscripción simulado en esta demo. Si cambias a un plan con menos funciones, tus productos se conservan: los que no estén incluidos se ocultan de tu página hasta que vuelvas a mejorar.</p>
      <section className="mt-10">
        <h2 className="eyebrow mb-3 !text-ink">Facturas de Cirella</h2>
        {invoices.length > 0 ? (
          <div className="card divide-y divide-line">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted" />
                  <span className="font-mono text-xs">{inv.fullNumber}</span>
                  <span className="text-muted">· {inv.period ? periodLabel(inv.period) : formatDate(inv.issuedAt, { day: "numeric", month: "numeric", year: "numeric" }, creator.timezone)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <strong className="tabular-nums">{formatMoney(inv.totalCents, inv.currency, { decimals: true })}</strong>
                  <Link href={`/facturas/${inv.id}`} className="btn btn-ghost btn-sm">Ver factura</Link>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Tu primera factura se emitirá el día 1 del mes que viene.</p>
        )}
        {monthTotal > 0 && (
          <p className="mt-3 text-xs text-muted">
            Este mes llevas {formatMoney(monthTotal, "EUR", { decimals: true })} en cuota y comisiones. La factura se emite el día 1 de {nextMonth}.
          </p>
        )}
      </section>
    </div>
  );
}
