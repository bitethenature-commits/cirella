"use client";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeOwnPassword, requestEmailChange, type CardState } from "./actions";

const FIELD = { fontSize: "1rem" } as const;

export function EmailCard({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState<CardState, FormData>(requestEmailChange, undefined);
  if (state?.ok) return <Flash ok={state.ok} />;
  return (
    <form action={action} className="space-y-3">
      <Flash error={state?.error} />
      <div>
        <label className="field-label" htmlFor="nuevo-email">Email nuevo</label>
        <input id="nuevo-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required className="input" style={FIELD} />
      </div>
      {hasPassword && (
        <div>
          <label className="field-label" htmlFor="email-password">Tu contraseña</label>
          <input id="email-password" name="password" type="password" autoComplete="current-password" required className="input" style={FIELD} />
        </div>
      )}
      <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Enviando…">Cambiar email</SubmitButton>
    </form>
  );
}

export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState<CardState, FormData>(changeOwnPassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <Flash ok={state?.ok} error={state?.error} />
      {hasPassword && (
        <div>
          <label className="field-label" htmlFor="pw-actual">Contraseña actual</label>
          <input id="pw-actual" name="current" type="password" autoComplete="current-password" required className="input" style={FIELD} />
        </div>
      )}
      <div>
        <label className="field-label" htmlFor="pw-nueva">{hasPassword ? "Contraseña nueva" : "Tu contraseña"}</label>
        <input id="pw-nueva" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" style={FIELD} placeholder="Mínimo 8 caracteres" />
      </div>
      <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Guardando…">{hasPassword ? "Cambiar contraseña" : "Crear contraseña"}</SubmitButton>
    </form>
  );
}
