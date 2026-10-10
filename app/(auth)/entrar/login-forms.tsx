"use client";
import { useActionState, useState } from "react";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn, type FormState } from "../actions";

export function LoginForms({
  next,
  demo,
  initialError,
  notice,
  defaultMode = "password",
  defaultEmail,
}: {
  next?: string;
  demo: boolean;
  initialError?: string;
  /** Aviso informativo (p. ej. «Confirma tu email para continuar»). */
  notice?: string;
  defaultMode?: "password" | "magic";
  defaultEmail?: string;
}) {
  const [mode, setMode] = useState<"password" | "magic">(defaultMode);
  const [pwState, pwAction] = useActionState<FormState, FormData>(signIn, undefined);
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
            {m === "password" ? "Contraseña" : "Enlace por email"}
          </button>
        ))}
      </div>
      {mode === "password" ? (
        <form action={pwAction} className="space-y-4">
          <Flash error={pwState?.error ?? initialError} ok={pwState?.error || initialError ? null : notice} />
          <input type="hidden" name="next" value={next ?? ""} />
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" defaultValue={pwState?.email ?? defaultEmail} />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Entrando…">Entrar</SubmitButton>
        </form>
      ) : (
        <div className="space-y-4">
          <Flash error={initialError} ok={initialError ? null : notice} />
          <p className="text-sm text-muted">¿Compraste sin contraseña? Te enviamos un enlace para entrar.</p>
          <MagicLinkForm next={next} demo={demo} defaultEmail={defaultEmail} />
        </div>
      )}
    </div>
  );
}
