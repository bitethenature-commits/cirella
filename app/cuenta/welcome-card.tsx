"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { setPassword, type FormState } from "@/app/(auth)/actions";

/** /cuenta?bienvenida=1 tras «Crear mi cuenta»: bienvenida y, si quiere, una contraseña. */
export function WelcomeCard({ name, email, hasPassword }: { name: string; email: string; hasPassword: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(setPassword, undefined);
  return (
    <section className="card p-6" aria-labelledby="bienvenida-t">
      <h2 id="bienvenida-t" className="display text-[1.9rem] leading-tight">Bienvenida{name ? `, ${name}` : ""}. Ya tienes tu área.</h2>
      <p className="mt-2 text-sm text-muted">Aquí estará todo lo que consigas: cursos, sesiones, archivos y novedades. Para volver, pulsa «Entrar» en la web.</p>
      {!hasPassword && (
        <form action={action} className="mt-5 max-w-sm space-y-3">
          <Flash error={state?.error} />
          <input type="hidden" name="next" value="/cuenta" />
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <label className="field-label" htmlFor="bienvenida-pw">Crea una contraseña <span className="font-normal text-muted">(opcional, si prefieres no usar enlaces)</span></label>
          <input id="bienvenida-pw" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" style={{ fontSize: "1rem" }} placeholder="Mínimo 8 caracteres" />
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="btn btn-primary" pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
            <Link href="/cuenta" className="text-sm text-muted underline-offset-2 hover:underline">Ahora no</Link>
          </div>
        </form>
      )}
    </section>
  );
}
