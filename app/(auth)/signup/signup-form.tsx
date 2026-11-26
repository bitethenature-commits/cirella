"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUp, type FormState } from "../actions";
import { Tr, useT } from "@/lib/i18n/client";

export function SignupForm({ refCode, username, plan }: { refCode?: string; username?: string; plan?: string }) {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      <Flash ok={state?.ok} error={state?.error} />
      <input type="hidden" name="ref" value={refCode ?? ""} />
      <input type="hidden" name="username" value={username ?? ""} />
      <input type="hidden" name="plan" value={plan ?? ""} />
      <div>
        <label className="field-label" htmlFor="email"><Tr s={"Email"} /></label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder={t("tu@email.com")} defaultValue={state?.email} />
      </div>
      <div>
        <label className="field-label" htmlFor="password"><Tr s={"Contraseña"} /></label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" placeholder={t("Mínimo 8 caracteres")} />
      </div>
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel={t("Creando tu cuenta…")}><Tr s={"Crear mi cuenta"} /></SubmitButton>
      <p className="text-center text-xs text-muted"><Tr s={"Al crear tu cuenta aceptas los"} />{" "}
        <Link href="/terms" className="underline underline-offset-2"><Tr s={"Términos del servicio"} /></Link>{" "}<Tr s={"y has leído la"} />{" "}
        <Link href="/privacy" className="underline underline-offset-2"><Tr s={"Política de privacidad"} /></Link><Tr s={". ¿Ya tienes cuenta?"} />{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-2 hover:underline"><Tr s={"Entrar"} /></Link>
      </p>
    </form>
  );
}
