import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Clock, FileWarning, ShieldCheck } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { simulateVerification } from "./actions";
import { simulatedIdentityFields } from "./identity";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

/** Formulario de alta de Stripe Connect, simulado: la creadora elige qué responde Stripe. */
export default async function SimulatedConnectPage({ searchParams }: { searchParams: Promise<{ vuelta?: string }> }) {
  const t = await getT();
  const { creator } = await requireCreator({ allowIncompleteOnboarding: true });
  if (creator.payoutProvider !== "simulated" || !creator.payoutAccountId) redirect("/panel/ajustes/cobros");
  const { vuelta = "" } = await searchParams;
  const fields = simulatedIdentityFields(creator);
  return (
    <div className="card p-6 sm:p-8">
      <p className="eyebrow"><Tr s={"Stripe (simulado)"} /></p>
      <h1 className="display mt-2 text-[2rem] leading-tight"><Tr s={"Verifica tu identidad"} /></h1>
      <p className="mt-2 text-sm text-muted"><Tr s={"Así es el formulario de Stripe que rellenará"} />{" "}{creator.displayName}<Tr s={". Es una simulación: mostramos los datos legales que ya tienes en Cirella (sin el documento ni el IBAN completos) y no se envían a ningún sitio."} /></p>
      <div className="mt-6 space-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <label className="field-label">{f.label}</label>
            <input className="input" value={f.value ?? ""} placeholder={f.placeholder} aria-label={f.label} readOnly disabled />
          </div>
        ))}
      </div>
      <form action={simulateVerification} className="mt-7 space-y-2.5">
        <input type="hidden" name="vuelta" value={vuelta} />
        <SubmitButton name="resultado" value="verificar" className="btn btn-primary btn-lg w-full" pendingLabel={t("Verificando…")}>
          <BadgeCheck className="h-4 w-4" />{" "}<Tr s={"Verificar al instante"} /></SubmitButton>
        <SubmitButton name="resultado" value="revisar" className="btn btn-outline w-full">
          <Clock className="h-4 w-4" />{" "}<Tr s={"Dejar en verificación"} /></SubmitButton>
        <SubmitButton name="resultado" value="documento" className="btn btn-outline w-full">
          <FileWarning className="h-4 w-4" />{" "}<Tr s={"Falta un documento"} /></SubmitButton>
      </form>
      <p className="mt-6 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{" "}<Tr s={"Con Stripe real, Cirella no ve tu documento ni tu IBAN: los guarda Stripe."} /></p>
      <Link href="/panel/ajustes/cobros" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:underline"><Tr s={"Volver sin terminar"} /></Link>
    </div>
  );
}
