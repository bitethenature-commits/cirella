import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { maskEmail } from "@/lib/auth-utils";
import { postOptOutTarget } from "@/lib/community-optout";
import { confirmCommunityOptOut } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Dejar de recibir avisos de la comunidad"), robots: { index: false }, referrer: "no-referrer" };
}

/**
 * Baja de los avisos por email de la comunidad (enlace del pie de cada aviso). Abrir el enlace no da
 * de baja (los antivirus del correo abren los enlaces): hay que pulsar el botón. La baja «en un
 * clic» del propio gestor de correo va a ./un-clic.
 */
export default async function CommunityOptOutPage({ searchParams }: { searchParams: Promise<{ t?: string; hecho?: string }> }) {
  const tt = await getT();
  const sp = await searchParams;
  const t = sp.t ?? "";
  const target = await postOptOutTarget(t);
  const done = target ? sp.hecho === "1" || target.optedOut : false;
  return (
    <AuthFrame username={target?.username}>
      {(branded) => {
        const muted = branded ? "cp-muted" : "text-sm text-muted";
        const h1 = branded ? "cp-display text-[2.2rem] leading-tight" : "display text-[2.4rem] leading-tight";
        if (!target)
          return (
            <div className="text-center">
              <h1 className={h1}><Tr s={"Este enlace no funciona"} /></h1>
              <p className={`mt-3 ${muted}`}><Tr s={"Puede que esté incompleto o que haya caducado. Puedes desactivar los avisos desde tu comunidad, o responder al email y te daremos de baja."} /></p>
            </div>
          );
        if (done)
          return (
            <div className="text-center">
              <h1 className={h1}><Tr s={"Listo"} /></h1>
              <p className={`mt-3 ${muted}`}><Tr s={"No te avisaremos por email de publicaciones nuevas de"} />{" "}<Tr s={target.creatorName} />{" "}<Tr s={"en"} />{" "}<strong>{maskEmail(target.email)}</strong><Tr s={". Puedes volver a activarlo desde tu comunidad."} /></p>
            </div>
          );
        return (
          <div className="text-center">
            <h1 className={h1}><Tr s={"Dejar de recibir avisos de"} />{" "}<Tr s={target.creatorName} /></h1>
            <p className={`mt-3 ${muted}`}><Tr s={"No te avisaremos por email de publicaciones nuevas ni de respuestas a tus comentarios en"} />{" "}<strong>{maskEmail(target.email)}</strong><Tr s={". Seguirás teniendo acceso a la comunidad como siempre."} /></p>
            <form action={confirmCommunityOptOut} className="mt-8">
              <input type="hidden" name="t" value={t} />
              <SubmitButton className={branded ? "cp-btn h-14 w-full text-base" : "btn btn-primary btn-lg w-full"} pendingLabel={tt("Guardando…")}><Tr s={"Darme de baja"} /></SubmitButton>
            </form>
          </div>
        );
      }}
    </AuthFrame>
  );
}
