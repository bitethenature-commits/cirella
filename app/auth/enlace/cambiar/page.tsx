import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { maskEmail } from "@/lib/auth-utils";
import { homeFor } from "@/lib/home";
import { resolveOrderLink } from "@/lib/order-links";
import { switchToLink } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Este enlace es de otra cuenta", robots: { index: false }, referrer: "no-referrer" };

/** Un enlace personal abierto con otra cuenta en el navegador: se pregunta antes de cambiar de sesión. */
export default async function SwitchAccountPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const t = (await searchParams).t ?? "";
  const res = await resolveOrderLink(t, { touch: false });
  if (res?.status !== "ok") redirect(`/auth/enlace?t=${encodeURIComponent(t)}`);
  const user = await getCurrentUser();
  if (!user || user.id === res.order.customer?.userId) redirect(`/auth/enlace?t=${encodeURIComponent(t)}`);
  const home = await homeFor(user.id);
  const who = user.name?.split(" ")[0] || user.email;

  return (
    <AuthFrame username={res.order.creator.username}>
      {(branded) => (
        <div className="text-center">
          <h1 className={branded ? "cp-display text-[2.2rem] leading-tight" : "display text-[2.4rem] leading-tight"}>Este enlace es de otra cuenta</h1>
          <p className={`mt-3 ${branded ? "cp-muted" : "text-sm text-muted"}`}>
            Ahora mismo has entrado como <strong>{user.email}</strong>. El enlace es de la compra de <strong>{maskEmail(res.order.buyerEmail)}</strong>.
          </p>
          <form action={switchToLink} className="mt-8">
            <input type="hidden" name="t" value={t} />
            <SubmitButton className={branded ? "cp-btn h-14 w-full text-base" : "btn btn-primary btn-lg w-full"} pendingLabel="Abriendo…">
              Salir y abrir el enlace
            </SubmitButton>
          </form>
          <Link href={home} className={branded ? "cp-btn-ghost mt-3 h-12 w-full" : "btn btn-outline mt-3 w-full"}>
            Seguir como {who}
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}
