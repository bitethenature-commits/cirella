import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { captureError } from "@/lib/monitoring";
import { payoutOnboardingLink } from "@/lib/payouts";

export const dynamic = "force-dynamic";

/** Los enlaces al formulario de Stripe caducan en minutos: Stripe manda aquí para pedir otro. */
export async function GET(req: Request) {
  const { creator } = await requireCreator({ allowIncompleteOnboarding: true });
  const from = new URL(req.url).searchParams.get("desde") === "onboarding" ? "onboarding" : "panel";
  let url: string;
  try {
    url = await payoutOnboardingLink(creator.id, from);
  } catch (e) {
    captureError(e, { area: "payments", tags: { op: "cuenta-enlace" }, extra: { creatorId: creator.id } });
    redirect(from === "onboarding" ? "/onboarding" : `/panel/ajustes/cobros?error=${encodeURIComponent("No hemos podido conectar con Stripe. Inténtalo de nuevo en unos minutos.")}`);
  }
  redirect(url);
}
