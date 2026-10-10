"use server";

import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { legalIdentityComplete } from "@/lib/legal";
import { captureError } from "@/lib/monitoring";
import { paymentProvider } from "@/lib/payments";
import { payoutOnboardingLink } from "@/lib/payouts";

const back = (k: "ok" | "error", msg: string) => redirect(`/panel/ajustes/cobros?${k}=${encodeURIComponent(msg)}`);

/** Conectar o completar la cuenta de cobro: al formulario de Stripe (o al simulador). */
export async function startPayoutOnboarding() {
  const { creator } = await requireCreator();
  // Sin datos legales no se puede vender (LSSI art. 10): primero /panel/ajustes/legal.
  if (!legalIdentityComplete(creator)) back("error", "Completa tus datos legales para activar los cobros");
  let url: string;
  try {
    url = await payoutOnboardingLink(creator.id, "panel");
  } catch (e) {
    captureError(e, { area: "payments", tags: { op: "cuenta-alta" }, extra: { creatorId: creator.id } });
    back("error", "No hemos podido conectar con Stripe. Inténtalo de nuevo en unos minutos.");
  }
  redirect(url!);
}

/** Panel Express de Stripe: ingresos, transferencias y datos bancarios de la creadora. */
export async function openPayoutDashboard() {
  const { creator } = await requireCreator();
  if (!creator.payoutAccountId) back("error", "Aún no tienes cuenta de cobro.");
  let url: string | null = null;
  try {
    url = await paymentProvider().payoutDashboardUrl(creator.payoutAccountId!);
  } catch (e) {
    captureError(e, { area: "payments", tags: { op: "panel-stripe" }, extra: { creatorId: creator.id } });
  }
  if (!url) back("error", paymentProvider().key === "simulated" ? "El panel de Stripe no está disponible en modo demostración" : "No hemos podido abrir el panel de Stripe. Inténtalo de nuevo.");
  redirect(url!);
}
