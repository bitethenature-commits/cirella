"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { creatorLegalHref } from "@/lib/legal";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { Turnstile } from "@/components/ui/turnstile";
import { registerStudent, type StudentSignupState } from "@/app/(auth)/student-actions";
import { Tr, useT } from "@/lib/i18n/client";

/** «Crear mi cuenta» (web personal): nombre, email y la casilla de novedades, aparte y sin marcar. */
export function StudentSignupForm({ username, ownerName, turnstileSiteKey, demo }: { username: string; ownerName: string; turnstileSiteKey: string | null; demo: boolean }) {
  const t = useT();
  const [state, action] = useActionState<StudentSignupState, FormData>(registerStudent, undefined);
  const [token, setToken] = useState("");
  if (state?.sent)
    return (
      <div className="text-center" role="status">
        <MailCheck className="mx-auto h-8 w-8" />
        <p className="mt-3 font-semibold"><Tr s={"Revisa tu email"} /></p>
        <p className="cp-muted mt-2 text-sm"><Tr s={"Te hemos enviado un enlace a"} />{" "}<strong><Tr s={state.sent} /></strong><Tr s={". Ábrelo y pulsa «Confirmar y entrar»."} /></p>
        <p className="cp-muted mt-4 text-xs"><Tr s={"¿No te llega? Revisa la carpeta de spam o vuelve a pedirlo en unos minutos."} /></p>
        {demo && (
          <Link href="/dev/email" className="mt-4 block text-sm font-semibold underline-offset-2 hover:underline"><Tr s={"Abrir el buzón de demostración →"} /></Link>
        )}
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <Flash error={state?.error} />
      <div>
        <label className="mb-1.5 block text-xs font-medium" htmlFor="alta-name"><Tr s={"Tu nombre"} /></label>
        <input id="alta-name" name="name" autoComplete="name" required maxLength={80} className="cp-input" style={{ fontSize: "1rem" }} defaultValue={state?.name} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium" htmlFor="alta-email"><Tr s={"Tu email"} /></label>
        <input
          id="alta-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className="cp-input"
          style={{ fontSize: "1rem" }}
          placeholder={t("tu@email.com")}
          defaultValue={state?.email}
        />
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="newsletter" className="mt-0.5 h-4 w-4 shrink-0" />
        <span><Tr s={"Quiero recibir las novedades de"} />{" "}<Tr s={ownerName} />{" "}<Tr s={"por email (puedes darte de baja cuando quieras)."} /></span>
      </label>
      {turnstileSiteKey && (
        <>
          <input type="hidden" name="turnstile" value={token} />
          <Turnstile siteKey={turnstileSiteKey} onToken={setToken} />
        </>
      )}
      <SubmitButton className="cp-btn h-14 w-full text-base" pendingLabel={t("Enviando…")}><Tr s={"Crear mi cuenta"} /></SubmitButton>
      <p className="cp-muted text-xs"><Tr s={"Te enviaremos un enlace para confirmar tu email; sin contraseñas (si quieres, podrás crear una después). Al crear tu cuenta aceptas la"} />{" "}
        <Link href={creatorLegalHref(username, "privacidad")} className="underline underline-offset-2"><Tr s={"política de privacidad"} /></Link>.
      </p>
    </form>
  );
}
