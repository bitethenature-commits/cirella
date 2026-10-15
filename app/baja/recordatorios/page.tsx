import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { maskEmail } from "@/lib/auth-utils";
import { hasOptedOut, optOutTarget } from "@/lib/recovery-optout";
import { confirmOptOut } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dejar de recibir recordatorios de compra", robots: { index: false }, referrer: "no-referrer" };

/**
 * Baja de los emails de compra abandonada (enlace del pie del email). Abrir el enlace no da de baja
 * (los antivirus del correo abren los enlaces): hay que pulsar el botón. La baja «en un clic» del
 * propio gestor de correo (cabecera List-Unsubscribe) va a ./un-clic.
 */
export default async function RecoveryOptOutPage({ searchParams }: { searchParams: Promise<{ t?: string; hecho?: string }> }) {
  const sp = await searchParams;
  const t = sp.t ?? "";
  const target = await optOutTarget(t);
  const done = target ? sp.hecho === "1" || (await hasOptedOut(target.creatorId, target.email)) : false;
  return (
    <AuthFrame username={target?.username}>
      {(branded) => {
        const muted = branded ? "cp-muted" : "text-sm text-muted";
        const h1 = branded ? "cp-display text-[2.2rem] leading-tight" : "display text-[2.4rem] leading-tight";
        if (!target)
          return (
            <div className="text-center">
              <h1 className={h1}>Este enlace no funciona</h1>
              <p className={`mt-3 ${muted}`}>Puede que esté incompleto o que haya caducado. Si no quieres recibir más recordatorios, responde al email y te daremos de baja.</p>
            </div>
          );
        if (done)
          return (
            <div className="text-center">
              <h1 className={h1}>Listo, te hemos dado de baja</h1>
              <p className={`mt-3 ${muted}`}>
                No recibirás más recordatorios de compras a medias de {target.creatorName} en <strong>{maskEmail(target.email)}</strong>. Los emails de tus
                compras (recibos y accesos) te seguirán llegando.
              </p>
            </div>
          );
        return (
          <div className="text-center">
            <h1 className={h1}>Dejar de recibir recordatorios de compra de {target.creatorName}</h1>
            <p className={`mt-3 ${muted}`}>
              Dejarás de recibir recordatorios de compras a medias de {target.creatorName} en <strong>{maskEmail(target.email)}</strong>. Los emails de tus
              compras (recibos y accesos) te seguirán llegando.
            </p>
            <form action={confirmOptOut} className="mt-8">
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
