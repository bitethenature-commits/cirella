import { Check, Gift } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { planBullets } from "@/lib/plans";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../ui";
import { changePlan } from "./actions";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ elegir?: string; ok?: string; error?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const [plans, products, fees] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    tenantDb(creator.id).product.count({ where: { status: { not: "ARCHIVED" } } }),
    tenantDb(creator.id).transaction.findMany({ where: { type: "PLAN_FEE" }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const discountActive = creator.commissionDiscountBps > 0 && (!creator.commissionDiscountUntil || creator.commissionDiscountUntil > new Date());
  return (
    <div>
      <PageHeader
        title="Tu plan"
        subtitle={<>Estás en <strong>{creator.plan.name}</strong> · {products}{creator.plan.maxProducts != null ? ` de ${creator.plan.maxProducts}` : ""} productos · comisión {(creator.plan.commissionBps / 100).toLocaleString("es-ES")} %{creator.planRenewsAt ? ` · se renueva el ${creator.planRenewsAt.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : ""}</>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      {(creator.creditCents > 0 || discountActive) && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft/40 p-4 text-sm">
          <Gift className="h-5 w-5 text-gold" />
          <span>
            {creator.creditCents > 0 && <>Tienes <strong>{formatMoney(creator.creditCents, "EUR", { decimals: true })}</strong> de crédito por referidos. </>}
            {discountActive && <>Comisión reducida en {(creator.commissionDiscountBps / 100).toLocaleString("es-ES")} puntos hasta el {creator.commissionDiscountUntil?.toLocaleDateString("es-ES")}.</>}
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
              <p className="mt-5 text-3xl font-semibold tracking-tight">{formatMoney(p.priceMonthlyCents)}<span className={`text-base font-normal ${current ? "text-cream/60" : "text-muted"}`}>/mes</span></p>
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
      <p className="mt-4 text-xs text-muted">Pago de la suscripción simulado en esta demo. Si cambias a un plan con menos funciones, tus productos se conservan: los que no estén incluidos se ocultan de tu página hasta que vuelvas a mejorar.</p>
      {fees.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow mb-3 !text-ink">Facturas del plan</h2>
          <div className="card divide-y divide-line">
            {fees.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{f.description}</span>
                <span className="text-muted">{f.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} · <strong className="text-ink">{formatMoney(f.amountCents, "EUR", { decimals: true })}</strong></span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
