import Link from "next/link";
import { ArrowLeft, CreditCard, ExternalLink, FileText, Landmark } from "lucide-react";
import { PayoutStatusCard } from "@/components/panel/payout-status";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { yearOf } from "@/lib/dac7";
import { dac7ForCreator } from "@/lib/dac7-data";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { PageHeader } from "../../ui";
import { openPayoutDashboard } from "./actions";
import { Dac7Form } from "./dac7-form";

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { creator: session } = await requireCreator();
  const sp = await searchParams;
  // La sesión puede ser de antes del último aviso de Stripe: se lee la fila actual.
  const creator = await prisma.creator.findUniqueOrThrow({ where: { id: session.id } });
  const year = yearOf(new Date());
  const [settings, dac7] = await Promise.all([getSettings(), dac7ForCreator(creator.id, year)]);
  const types = dac7.reportableTypes.map((t) => PRODUCT_TYPE_LABEL[t as ProductType]?.toLowerCase() ?? t).join(", ");

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/panel/ajustes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Ajustes
      </Link>
      <PageHeader title="Cobros" subtitle="Tu cuenta de cobro con Stripe y tus datos para Hacienda." />
      <Flash ok={sp.ok} error={sp.error} />

      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4" /> Cuenta de cobro</h2>
        <PayoutStatusCard creator={creator} supportEmail={settings.supportEmail} />
        {creator.payoutStatus === "ACTIVE" && (
          <form action={openPayoutDashboard} className="mt-4">
            <SubmitButton className="btn btn-outline btn-sm" pendingLabel="Abriendo…">
              <ExternalLink className="h-3.5 w-3.5" /> Ver mis cobros y transferencias en Stripe
            </SubmitButton>
          </form>
        )}
        <p className="mt-4 text-xs text-muted">
          Cada venta se cobra con Stripe: Cirella descuenta su comisión y Stripe transfiere el resto a tu banco. Tus datos bancarios y tu documento los guarda Stripe.
        </p>
      </section>

      <section id="datos-fiscales" className="card scroll-mt-20 p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4" /> Datos fiscales para Hacienda (DAC7)</h2>
        <Dac7Form creator={creator} />
      </section>

      {dac7.hasActivity && (
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> Lo que declararemos a Hacienda de {year}</h2>
          <p className="mt-1 text-sm text-muted">Ventas de {types}, en hora de España.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="py-2 font-semibold">Trimestre</th>
                  <th className="py-2 text-right font-semibold">Importe neto</th>
                  <th className="py-2 text-right font-semibold">Comisión de Cirella</th>
                  <th className="py-2 text-right font-semibold">Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {dac7.agg.quarters.map((q, i) => (
                  <tr key={i}>
                    <td className="py-2.5">T{i + 1}</td>
                    <td className="py-2.5 text-right">{formatMoney(q.considerationCents, "EUR", { decimals: true })}</td>
                    <td className="py-2.5 text-right">{formatMoney(q.feesCents, "EUR", { decimals: true })}</td>
                    <td className="py-2.5 text-right">{q.activities}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2.5">Total</td>
                  <td className="py-2.5 text-right">{formatMoney(dac7.agg.total.considerationCents, "EUR", { decimals: true })}</td>
                  <td className="py-2.5 text-right">{formatMoney(dac7.agg.total.feesCents, "EUR", { decimals: true })}</td>
                  <td className="py-2.5 text-right">{dac7.agg.total.activities}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted">
            Cirella informa cada año a la Agencia Tributaria (modelo 238) de lo que cobras por servicios personales como las sesiones. Te enviaremos este resumen antes del 31 de enero.
          </p>
        </section>
      )}
    </div>
  );
}
