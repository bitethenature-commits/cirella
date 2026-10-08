"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestMagicLink, signIn, type FormState } from "../actions";

export function LoginForms({ next, demo, initialError }: { next?: string; demo: boolean; initialError?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction] = useActionState<FormState, FormData>(signIn, undefined);
  const [mlState, mlAction] = useActionState<FormState, FormData>(requestMagicLink, undefined);
  return (
    <div>
      <div className="mb-6 grid grid-cols-2 rounded-full bg-sand p-1 text-sm">
        {(["password", "magic"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`h-9 rounded-full font-medium transition ${mode === m ? "bg-white shadow-soft" : "text-muted"}`}
          >
            {m === "password" ? "Contraseña" : "Enlace mágico"}
          </button>
        ))}
      </div>
      {mode === "password" ? (
        <form action={pwAction} className="space-y-4">
          <Flash error={pwState?.error ?? initialError} />
          <input type="hidden" name="next" value={next ?? ""} />
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" defaultValue={pwState?.email} />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Entrando…">Entrar</SubmitButton>
        </form>
      ) : (
        <form action={mlAction} className="space-y-4">
          <Flash ok={mlState?.ok} error={mlState?.error} />
          <input type="hidden" name="next" value={next ?? ""} />
          <p className="text-sm text-muted">¿Compraste sin contraseña? Te enviamos un enlace para entrar a tu cuenta.</p>
          <div>
            <label className="field-label" htmlFor="ml-email">Email</label>
            <input id="ml-email" name="email" type="email" autoComplete="email" required className="input" defaultValue={mlState?.email} />
          </div>
          <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Enviando…">Enviarme el enlace</SubmitButton>
          {mlState?.ok && demo && (
            <Link href="/dev/correo" className="block text-center text-sm font-semibold text-lavender-deep underline-offset-2 hover:underline">
              Abrir el buzón de demostración →
            </Link>
          )}
        </form>
      )}
    </div>
  );
}
