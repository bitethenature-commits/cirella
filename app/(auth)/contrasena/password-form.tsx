"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { setPassword, type FormState } from "../actions";

export function PasswordForm({ next, email }: { next: string; email: string }) {
  const [state, action] = useActionState<FormState, FormData>(setPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Flash error={state?.error} />
      <input type="hidden" name="next" value={next} />
      {/* Para que el gestor de contraseñas la guarde con el email correcto. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div>
        <label className="field-label" htmlFor="password">Nueva contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" placeholder="Mínimo 8 caracteres" />
      </div>
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
      <Link href={next || "/auth/continuar"} className="block text-center text-sm text-muted underline-offset-2 hover:underline">
        Ahora no
      </Link>
    </form>
  );
}
