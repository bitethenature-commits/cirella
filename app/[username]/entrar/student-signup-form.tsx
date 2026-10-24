"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { creatorLegalHref } from "@/lib/legal";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { Turnstile } from "@/components/ui/turnstile";
import { registerStudent, type StudentSignupState } from "@/app/(auth)/student-actions";

/** «Crear mi cuenta» (web personal): nombre, email y la casilla de novedades, aparte y sin marcar. */
export function StudentSignupForm({ username, ownerName, turnstileSiteKey, demo }: { username: string; ownerName: string; turnstileSiteKey: string | null; demo: boolean }) {
  const [state, action] = useActionState<StudentSignupState, FormData>(registerStudent, undefined);
  const [token, setToken] = useState("");
  if (state?.sent)
    return (
      <div className="text-center" role="status">
        <MailCheck className="mx-auto h-8 w-8" />
        <p className="mt-3 font-semibold">Revisa tu email</p>
        <p className="cp-muted mt-2 text-sm">
          Te hemos enviado un enlace a <strong>{state.sent}</strong>. Ábrelo y pulsa «Confirmar y entrar».
        </p>
        <p className="cp-muted mt-4 text-xs">¿No te llega? Revisa la carpeta de spam o vuelve a pedirlo en unos minutos.</p>
        {demo && (
          <Link href="/dev/correo" className="mt-4 block text-sm font-semibold underline-offset-2 hover:underline">
            Abrir el buzón de demostración →
          </Link>
        )}
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <Flash error={state?.error} />
      <div>
        <label className="mb-1.5 block text-xs font-medium" htmlFor="alta-name">Tu nombre</label>
        <input id="alta-name" name="name" autoComplete="name" required maxLength={80} className="cp-input" style={{ fontSize: "1rem" }} defaultValue={state?.name} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium" htmlFor="alta-email">Tu email</label>
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
          placeholder="tu@email.com"
          defaultValue={state?.email}
        />
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="newsletter" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Quiero recibir las novedades de {ownerName} por email (puedes darte de baja cuando quieras).</span>
      </label>
      {turnstileSiteKey && (
        <>
          <input type="hidden" name="turnstile" value={token} />
          <Turnstile siteKey={turnstileSiteKey} onToken={setToken} />
        </>
      )}
      <SubmitButton className="cp-btn h-14 w-full text-base" pendingLabel="Enviando…">Crear mi cuenta</SubmitButton>
      <p className="cp-muted text-xs">
        Te enviaremos un enlace para confirmar tu email; sin contraseñas (si quieres, podrás crear una después). Al crear tu cuenta
        aceptas la{" "}
        <Link href={creatorLegalHref(username, "privacidad")} className="underline underline-offset-2">política de privacidad</Link>.
      </p>
    </form>
  );
}
