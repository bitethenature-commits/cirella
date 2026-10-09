import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Clock, FileWarning, ShieldCheck } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { simulateVerification } from "./actions";

/** Formulario de alta de Stripe Connect, simulado: la creadora elige qué responde Stripe. */
export default async function SimulatedConnectPage({ searchParams }: { searchParams: Promise<{ vuelta?: string }> }) {
  const { creator } = await requireCreator({ allowIncompleteOnboarding: true });
  if (creator.payoutProvider !== "simulated" || !creator.payoutAccountId) redirect("/panel/ajustes/cobros");
  const { vuelta = "" } = await searchParams;
  return (
    <div className="card p-6 sm:p-8">
      <p className="eyebrow">Stripe (simulado)</p>
      <h1 className="display mt-2 text-[2rem] leading-tight">Verifica tu identidad</h1>
      <p className="mt-2 text-sm text-muted">
        Así es el formulario de Stripe que rellenará {creator.displayName}. En la demostración los datos no se envían a ningún sitio.
      </p>
      <div className="mt-6 space-y-3">
        {[
          ["DNI o NIE", "12345678Z"],
          ["IBAN", "ES91 2100 0418 4502 0005 1332"],
          ["Dirección", "Calle Mayor 1, 28013 Madrid"],
        ].map(([label, value]) => (
          <div key={label}>
            <label className="field-label">{label}</label>
            <input className="input" value={value} readOnly disabled />
          </div>
        ))}
      </div>
      <form action={simulateVerification} className="mt-7 space-y-2.5">
        <input type="hidden" name="vuelta" value={vuelta} />
        <SubmitButton name="resultado" value="verificar" className="btn btn-primary btn-lg w-full" pendingLabel="Verificando…">
          <BadgeCheck className="h-4 w-4" /> Verificar al instante
        </SubmitButton>
        <SubmitButton name="resultado" value="revisar" className="btn btn-outline w-full">
          <Clock className="h-4 w-4" /> Dejar en verificación
        </SubmitButton>
        <SubmitButton name="resultado" value="documento" className="btn btn-outline w-full">
          <FileWarning className="h-4 w-4" /> Falta un documento
        </SubmitButton>
      </form>
      <p className="mt-6 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Con Stripe real, Cirella no ve tu documento ni tu IBAN: los guarda Stripe.
      </p>
      <Link href="/panel/ajustes/cobros" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:underline">Volver sin terminar</Link>
    </div>
  );
}
