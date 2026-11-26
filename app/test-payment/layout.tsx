import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { paymentProviderKey } from "@/lib/payments";
import { Tr } from "@/lib/i18n/client";

export const metadata: Metadata = { title: "Simulador de pagos", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Páginas que hacen de Stripe y del banco en demo y desarrollo. Con Stripe real no existen. */
export default function SimulatorLayout({ children }: { children: React.ReactNode }) {
  if (paymentProviderKey() !== "simulated") notFound();
  return (
    <div className="min-h-dvh bg-paper">
      <p className="flex items-center justify-center gap-2 bg-sand px-4 py-2 text-center text-xs font-medium text-muted">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" />{" "}<Tr s={"Simulador de pagos · modo demostración. No se mueve dinero real."} /></p>
      <main className="mx-auto max-w-md px-4 pb-16 pt-8 sm:pt-12">{children}</main>
    </div>
  );
}
