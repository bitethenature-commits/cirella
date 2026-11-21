import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { maskEmail } from "@/lib/auth-utils";
import { confirmTarget, siteHomeUrl } from "@/lib/newsletter";
import { isPersonalMode } from "@/lib/site-mode";
import { confirmNewsletterSignup } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirma tu newsletter", robots: { index: false }, referrer: "no-referrer" };

/**
 * Confirmación del alta en la newsletter (doble opt-in): el enlace del email «Confirma que quieres
 * recibir la newsletter». Abrirlo no confirma nada (los antivirus del correo abren los enlaces): hay
 * que pulsar «Sí, quiero recibirla».
 */
export default async function ConfirmNewsletterPage({ searchParams }: { searchParams: Promise<{ t?: string; hecho?: string }> }) {
  const sp = await searchParams;
  const t = sp.t ?? "";
  const target = await confirmTarget(t);
  const home = target ? siteHomeUrl(target.username, isPersonalMode()) : "/";
  return (
    <AuthFrame username={target?.username}>
      {(branded) => {
        const muted = branded ? "cp-muted" : "text-sm text-muted";
        const h1 = branded ? "cp-display text-[2.2rem] leading-tight" : "display text-[2.4rem] leading-tight";
        const btn = branded ? "cp-btn h-14 w-full justify-center text-base" : "btn btn-primary btn-lg w-full";
        if (!target || target.status === "BOUNCED" || target.status === "COMPLAINED")
          return (
            <div className="text-center">
              <h1 className={h1}>Este enlace ha caducado</h1>
              <p className={`mt-3 ${muted}`}>Puede que esté incompleto o que tenga más de 7 días. Vuelve a apuntarte desde la página y te enviaremos uno nuevo.</p>
            </div>
          );
        if (target.status === "CONFIRMED")
          return (
            <div className="text-center">
              <h1 className={h1}>¡Listo! Ya estás dentro</h1>
              <p className={`mt-3 ${muted}`}>
                Recibirás la newsletter de {target.creatorName} en <strong>{maskEmail(target.email)}</strong>. Cada email lleva un enlace para darte de baja cuando quieras.
              </p>
              <Link href={home} className={`mt-8 inline-flex ${btn}`}>Ir a la página de {target.creatorName}</Link>
            </div>
          );
        if (target.status === "UNSUBSCRIBED")
          return (
            <div className="text-center">
              <h1 className={h1}>Te diste de baja</h1>
              <p className={`mt-3 ${muted}`}>Este enlace es de antes de darte de baja. Si quieres volver a recibirla, apúntate otra vez desde la página.</p>
              <Link href={home} className={`mt-8 inline-flex ${btn}`}>Ir a la página</Link>
            </div>
          );
        return (
          <div className="text-center">
            <h1 className={h1}>¿Quieres recibir la newsletter de {target.creatorName}?</h1>
            <p className={`mt-3 ${muted}`}>Confirma que <strong>{maskEmail(target.email)}</strong> es tu email. Podrás darte de baja cuando quieras con el enlace de cada email.</p>
            <form action={confirmNewsletterSignup} className="mt-8">
              <input type="hidden" name="t" value={t} />
              <SubmitButton className={btn} pendingLabel="Confirmando…">Sí, quiero recibirla</SubmitButton>
            </form>
          </div>
        );
      }}
    </AuthFrame>
  );
}
