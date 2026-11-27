import Link from "next/link";
import { ArrowRight, CreditCard } from "lucide-react";
import type { Creator } from "@prisma/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { describeRequirements, payoutView, storedRequirements } from "@/lib/payouts";
import { Badge } from "@/app/panel/ui";
import { startPayoutOnboarding } from "@/app/panel/ajustes/cobros/actions";
import { getT } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

type PayoutCreator = Pick<Creator, "status" | "payoutProvider" | "payoutStatus" | "payoutChargesEnabled" | "payoutPayoutsEnabled" | "payoutRequirements">;

/** Estado de la cuenta de cobro con lo que falta y el botón para seguir en Stripe. */
export async function PayoutStatusCard({ creator, supportEmail }: { creator: PayoutCreator; supportEmail: string }) {
  const t = await getT();
  const v = payoutView(creator, { supportEmail });
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={v.tone}><Tr s={v.label} /></Badge>
        <p className="font-semibold">{v.title}</p>
      </div>
      <p className="mt-2 text-sm text-muted"><Tr s={v.body} /></p>
      {v.missing.length > 0 && v.status !== "ACTION_REQUIRED" && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {v.missing.map((m) => <li key={m}><Tr s={m} /></li>)}
        </ul>
      )}
      {v.cta && (
        <form action={startPayoutOnboarding} className="mt-4">
          <SubmitButton className="btn btn-primary btn-sm" pendingLabel={t("Abriendo Stripe…")}><Tr s={v.cta} /></SubmitButton>
        </form>
      )}
    </div>
  );
}

/** Aviso compacto en el inicio del panel mientras no se puede vender (o Stripe pide algo con plazo). */
export function PayoutBanner({ creator }: { creator: PayoutCreator }) {
  const v = payoutView(creator);
  const req = storedRequirements(creator);
  if (v.status === "ACTIVE" && !req.currentlyDue.length && creator.payoutPayoutsEnabled) return null;
  const first = describeRequirements([...req.pastDue, ...req.currentlyDue])[0];
  const text =
    v.status === "VERIFYING"
      ? "Verificación en curso: te avisaremos cuando puedas vender."
      : v.status === "ACTION_REQUIRED" || (v.status === "ACTIVE" && first)
        ? `Te falta subir ${first ?? "un dato más que pide Stripe"}.`
        : v.status === "ACTIVE"
          ? "Stripe retiene tus transferencias hasta que completes tus datos."
          : v.status === "REJECTED"
            ? "Stripe no ha podido verificar tu cuenta de cobro."
            : "Conecta tu cuenta de cobro para poder vender.";
  return (
    <Link
      href="/panel/ajustes/cobros"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:shadow-soft ${v.tone === "danger" ? "border-[#ecd2cd] bg-[#fdf3f1] text-[#8a3b31]" : "border-[#ecdcb8] bg-[#fbf5e8] text-[#7a5a1c]"}`}
    >
      <CreditCard className="h-4 w-4 shrink-0" />
      <span className="flex-1"><Tr s={text} /></span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}
