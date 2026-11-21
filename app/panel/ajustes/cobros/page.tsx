import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CreditCard, ExternalLink } from "lucide-react";
import { PayoutStatusCard } from "@/components/panel/payout-status";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { legalIdentityComplete } from "@/lib/legal";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "../../ui";
import { openPayoutDashboard } from "./actions";
import { isPersonalMode } from "@/lib/site-mode";

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  // Modo personal: aquí no se cobra nada (lo de pago se cobra en otras webs).
  if (isPersonalMode()) redirect("/panel/ajustes");
  const { creator: session } = await requireCreator();
  const sp = await searchParams;
  // La sesión puede ser de antes del último aviso de Stripe: se lee la fila actual.
  const creator = await prisma.creator.findUniqueOrThrow({ where: { id: session.id } });
  const settings = await getSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/panel/ajustes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Ajustes
      </Link>
      <PageHeader title="Cobros" subtitle="Tu cuenta de cobro con Stripe." />
      <Flash ok={sp.ok} error={sp.error} />

      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4" /> Cuenta de cobro</h2>
        {!legalIdentityComplete(creator) && (
          <p className="mb-4 rounded-xl bg-[#f8efdc] px-4 py-3 text-sm text-[#8a6420]">
            Antes de activar los cobros, <Link href="/panel/ajustes/legal" className="font-semibold underline underline-offset-2">completa tus datos legales</Link>: la
            ley obliga a mostrar quién vende.
          </p>
        )}
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
    </div>
  );
}
