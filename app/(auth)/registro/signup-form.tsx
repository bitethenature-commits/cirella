"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUp, type FormState } from "../actions";

export function SignupForm({ refCode, username, plan }: { refCode?: string; username?: string; plan?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      <Flash ok={state?.ok} error={state?.error} />
      <input type="hidden" name="ref" value={refCode ?? ""} />
      <input type="hidden" name="username" value={username ?? ""} />
      <input type="hidden" name="plan" value={plan ?? ""} />
      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="tu@email.com" defaultValue={state?.email} />
      </div>
      <div>
        <label className="field-label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" placeholder="Mínimo 8 caracteres" />
      </div>
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Creando tu cuenta…">
        Crear mi cuenta
      </SubmitButton>
      <p className="text-center text-xs text-muted">
        Al crear tu cuenta aceptas los{" "}
        <Link href="/terminos" className="underline underline-offset-2">Términos del servicio</Link> y has leído la{" "}
        <Link href="/privacidad" className="underline underline-offset-2">Política de privacidad</Link>. ¿Ya tienes cuenta?{" "}
        <Link href="/entrar" className="font-semibold text-ink underline-offset-2 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
