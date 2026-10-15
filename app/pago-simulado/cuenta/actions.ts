"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import type { PayoutAccountSnapshot } from "@/lib/payments/provider";
import { emptySnapshot } from "@/lib/payments/simulated";
import { payoutReturnPath, syncPayoutAccount } from "@/lib/payouts";

/** De dónde venía la creadora, leído de la URL de vuelta que el simulador recibió (?vuelta=…). */
function origin(raw: unknown): "onboarding" | "panel" {
  try {
    return new URL(String(raw ?? ""), "http://x").searchParams.get("desde") === "onboarding" ? "onboarding" : "panel";
  } catch {
    return "panel";
  }
}

const DOCUMENT = "individual.verification.document";

/**
 * Lo que haría Stripe tras el formulario: verificar al momento, quedarse revisando o pedir un
 * documento. Después, lo mismo que la vuelta de Stripe (/api/payments/connect/return), pero aquí
 * mismo: una acción que redirige a una ruta de API no lleva a la creadora a su destino.
 */
export async function simulateVerification(form: FormData) {
  const { creator } = await requireCreator({ allowIncompleteOnboarding: true });
  const outcome = z.enum(["verificar", "revisar", "documento"]).parse(form.get("resultado"));
  const from = origin(form.get("vuelta"));
  if (creator.payoutProvider !== "simulated" || !creator.payoutAccountId) redirect(payoutReturnPath(creator.payoutStatus, from, !!creator.onboardedAt));
  const base = emptySnapshot(creator.payoutAccountId);
  const snapshot: PayoutAccountSnapshot =
    outcome === "verificar"
      ? { ...base, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true }
      : outcome === "revisar"
        ? { ...base, detailsSubmitted: true, pendingVerification: [DOCUMENT] }
        : { ...base, detailsSubmitted: true, currentlyDue: [DOCUMENT], disabledReason: "requirements.past_due" };
  const status = await syncPayoutAccount(creator.payoutAccountId, snapshot);
  redirect(payoutReturnPath(status, from, !!creator.onboardedAt));
}
