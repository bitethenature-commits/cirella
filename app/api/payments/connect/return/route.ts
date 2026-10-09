import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { captureError } from "@/lib/monitoring";
import { payoutReturnPath, syncPayoutAccount } from "@/lib/payouts";

export const dynamic = "force-dynamic";

/** Vuelta del formulario de Stripe: se consulta el estado de la cuenta y se vuelve a donde estaba. */
export async function GET(req: Request) {
  const { creator } = await requireCreator({ allowIncompleteOnboarding: true });
  let status: string | null = creator.payoutStatus;
  if (creator.payoutAccountId) {
    try {
      status = await syncPayoutAccount(creator.payoutAccountId);
    } catch (e) {
      captureError(e, { area: "payments", tags: { op: "cuenta-vuelta" }, extra: { creatorId: creator.id } });
    }
  }
  redirect(payoutReturnPath(status, new URL(req.url).searchParams.get("desde"), !!creator.onboardedAt));
}
