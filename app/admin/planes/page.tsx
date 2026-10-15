import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_FEATURES, planFeatures, type PlanFeatures } from "@/lib/plans";
import { PRODUCT_TYPE_LABEL, PRODUCT_TYPES } from "@/lib/types";
import { PageHeader } from "../../panel/ui";
import { savePlan } from "../actions";
import { platformOnly } from "../platform-only";

type PlanRow = Awaited<ReturnType<typeof prisma.plan.findMany>>[number];

function PlanForm({ plan, count }: { plan?: PlanRow; count?: number }) {
  const f: PlanFeatures = plan ? planFeatures(plan) : DEFAULT_FEATURES;
  return (
    <form action={savePlan} className="card space-y-4 p-5">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="flex items-center justify-between">
        <p className="display text-2xl">{plan ? plan.name : "Nuevo plan"}</p>
        {plan && <span className="text-xs text-muted">clave: <code>{plan.key}</code> · {count} creadoras</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!plan && <label className="text-xs">Clave interna<input name="key" className="input mt-1 h-9 text-sm" placeholder="studio" required /></label>}
        <label className="text-xs">Nombre<input name="name" defaultValue={plan?.name} className="input mt-1 h-9 text-sm" required /></label>
        <label className="text-xs sm:col-span-2">Descripción<input name="tagline" defaultValue={plan?.tagline ?? ""} className="input mt-1 h-9 text-sm" /></label>
        <label className="text-xs">Precio mensual (€)<input name="price" defaultValue={plan ? plan.priceMonthlyCents / 100 : 0} inputMode="decimal" className="input mt-1 h-9 text-sm" /></label>
        <label className="text-xs">Comisión por venta (%)<input name="commission" defaultValue={plan ? plan.commissionBps / 100 : 10} inputMode="decimal" className="input mt-1 h-9 text-sm" /></label>
        <label className="text-xs">Máx. productos (vacío = ilimitados)<input name="maxProducts" defaultValue={plan?.maxProducts ?? ""} inputMode="numeric" className="input mt-1 h-9 text-sm" /></label>
        <label className="text-xs">Orden<input name="sortOrder" defaultValue={plan?.sortOrder ?? 9} inputMode="numeric" className="input mt-1 h-9 text-sm" /></label>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold">Tipos de producto</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {PRODUCT_TYPES.map((t) => <label key={t} className="flex items-center gap-1.5"><input type="checkbox" name={`type_${t}`} defaultChecked={f.productTypes.includes(t)} className="accent-[#0E1024]" /> {PRODUCT_TYPE_LABEL[t]}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold">Funcionalidades</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" name="customDesign" defaultChecked={f.customDesign} className="accent-[#0E1024]" /> Personalización visual</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" name="removeBranding" defaultChecked={f.removeBranding} className="accent-[#0E1024]" /> Quitar «Powered by»</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" name="customerArea" defaultChecked={f.customerArea} className="accent-[#0E1024]" /> Área de clientes</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" name="automations" defaultChecked={f.automations} className="accent-[#0E1024]" /> Automatizaciones</label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">Estadísticas
          <select name="analytics" defaultValue={f.analytics} className="input h-9 w-48 text-sm">
            <option value="basic">Básicas</option><option value="full">Estadísticas</option><option value="advanced">Avanzadas</option>
          </select>
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="checkbox" name="active" defaultChecked={plan?.active ?? true} className="accent-[#0E1024]" /> Activo (visible)</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" name="highlighted" defaultChecked={plan?.highlighted} className="accent-[#0E1024]" /> Destacado</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" name="isDefault" defaultChecked={plan?.isDefault} className="accent-[#0E1024]" /> Plan por defecto al registrarse</label>
      </div>
      <SubmitButton className="btn btn-primary btn-sm">Guardar plan</SubmitButton>
    </form>
  );
}

export default async function AdminPlans({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  platformOnly();
  await requireAdmin();
  const sp = await searchParams;
  const [plans, counts] = await Promise.all([
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.creator.groupBy({ by: ["planId"], _count: { _all: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Planes" subtitle="Precios, comisiones, límites y funcionalidades. Los cambios se aplican al instante a todas las creadoras del plan." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-4 xl:grid-cols-2">
        {plans.map((p) => <PlanForm key={p.id} plan={p} count={counts.find((c) => c.planId === p.id)?._count._all ?? 0} />)}
        <PlanForm />
      </div>
    </div>
  );
}
