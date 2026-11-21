import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { maskEmail } from "@/lib/auth-utils";
import { siteHomeUrl, unsubscribeTarget } from "@/lib/newsletter";
import { isPersonalMode } from "@/lib/site-mode";
import { confirmNewsletterOptOut } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Darme de baja de la newsletter", robots: { index: false }, referrer: "no-referrer" };

/**
 * Baja de la newsletter (enlace «Darme de baja» del pie de cada newsletter). Abrir el enlace no da de
 * baja (los antivirus del correo abren los enlaces): hay que pulsar el botón. La baja «en un clic» del
 * propio gestor de correo va a ./un-clic.
 */
export default async function NewsletterOptOutPage({ searchParams }: { searchParams: Promise<{ t?: string; hecho?: string }> }) {
  const sp = await searchParams;
  const t = sp.t ?? "";
  const target = await unsubscribeTarget(t);
  const done = target ? sp.hecho === "1" || (target.status !== "CONFIRMED" && target.status !== "PENDING") : false;
  return (
    <AuthFrame username={target?.username}>
      {(branded) => {
        const muted = branded ? "cp-muted" : "text-sm text-muted";
        const h1 = branded ? "cp-display text-[2.2rem] leading-tight" : "display text-[2.4rem] leading-tight";
        if (!target)
          return (
            <div className="text-center">
              <h1 className={h1}>Este enlace no funciona</h1>
              <p className={`mt-3 ${muted}`}>Puede que esté incompleto. Responde al email de la newsletter y te daremos de baja a mano.</p>
            </div>
          );
        if (done)
          return (
            <div className="text-center">
              <h1 className={h1}>Hecho</h1>
              <p className={`mt-3 ${muted}`}>
                No recibirás más newsletters de {target.creatorName} en <strong>{maskEmail(target.email)}</strong>. Los emails de tus compras y accesos te seguirán llegando.
              </p>
              <p className={`mt-6 ${muted}`}>
                ¿Ha sido un error?{" "}
                <Link href={`${siteHomeUrl(target.username, isPersonalMode())}#newsletter`} className="font-semibold underline underline-offset-2">
                  Vuelve a apuntarte
                </Link>
              </p>
            </div>
          );
        return (
          <div className="text-center">
            <h1 className={h1}>Darme de baja de la newsletter de {target.creatorName}</h1>
            <p className={`mt-3 ${muted}`}>
              Dejarás de recibirla en <strong>{maskEmail(target.email)}</strong>. Los emails de tus compras, accesos y reservas te seguirán llegando.
            </p>
            <form action={confirmNewsletterOptOut} className="mt-8">
              <input type="hidden" name="t" value={t} />
              <SubmitButton className={branded ? "cp-btn h-14 w-full text-base" : "btn btn-primary btn-lg w-full"} pendingLabel="Guardando…">
                Darme de baja
              </SubmitButton>
            </form>
          </div>
        );
      }}
    </AuthFrame>
  );
}
