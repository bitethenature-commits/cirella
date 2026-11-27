import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { maskEmail } from "@/lib/auth-utils";
import { siteHomeUrl, unsubscribeTarget } from "@/lib/newsletter";
import { isPersonalMode } from "@/lib/site-mode";
import { confirmNewsletterOptOut } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Darme de baja de la newsletter"), robots: { index: false }, referrer: "no-referrer" };
}

/**
 * Baja de la newsletter (enlace «Darme de baja» del pie de cada newsletter). Abrir el enlace no da de
 * baja (los antivirus del correo abren los enlaces): hay que pulsar el botón. La baja «en un clic» del
 * propio gestor de correo va a ./un-clic.
 */
export default async function NewsletterOptOutPage({ searchParams }: { searchParams: Promise<{ t?: string; hecho?: string }> }) {
  const tt = await getT();
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
              <h1 className={h1}><Tr s={"Este enlace no funciona"} /></h1>
              <p className={`mt-3 ${muted}`}><Tr s={"Puede que esté incompleto. Responde al email de la newsletter y te daremos de baja a mano."} /></p>
            </div>
          );
        if (done)
          return (
            <div className="text-center">
              <h1 className={h1}><Tr s={"Hecho"} /></h1>
              <p className={`mt-3 ${muted}`}><Tr s={"No recibirás más newsletters de"} />{" "}<Tr s={target.creatorName} />{" "}<Tr s={"en"} />{" "}<strong>{maskEmail(target.email)}</strong><Tr s={". Los emails de tus compras y accesos te seguirán llegando."} /></p>
              <p className={`mt-6 ${muted}`}><Tr s={"¿Ha sido un error?"} />{" "}
                <Link href={`${siteHomeUrl(target.username, isPersonalMode())}#newsletter`} className="font-semibold underline underline-offset-2"><Tr s={"Vuelve a apuntarte"} /></Link>
              </p>
            </div>
          );
        return (
          <div className="text-center">
            <h1 className={h1}><Tr s={"Darme de baja de la newsletter de"} />{" "}<Tr s={target.creatorName} /></h1>
            <p className={`mt-3 ${muted}`}><Tr s={"Dejarás de recibirla en"} />{" "}<strong>{maskEmail(target.email)}</strong><Tr s={". Los emails de tus compras, accesos y reservas te seguirán llegando."} /></p>
            <form action={confirmNewsletterOptOut} className="mt-8">
              <input type="hidden" name="t" value={t} />
              <SubmitButton className={branded ? "cp-btn h-14 w-full text-base" : "btn btn-primary btn-lg w-full"} pendingLabel={tt("Guardando…")}><Tr s={"Darme de baja"} /></SubmitButton>
            </form>
          </div>
        );
      }}
    </AuthFrame>
  );
}
