"use client";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfile, type ProfileState } from "../actions";

export function ProfileForm({ name, email, hasPassword }: { name: string; email: string; hasPassword: boolean }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, undefined);
  return (
    <form action={action} className="card mt-6 max-w-lg space-y-4 p-6">
      <Flash ok={state?.ok} error={state?.error} />
      <div>
        <label className="field-label">Nombre</label>
        <input name="name" defaultValue={name} className="input" required maxLength={80} />
      </div>
      <div>
        <label className="field-label">Email</label>
        <input value={email} disabled className="input bg-sand/50 text-muted" />
        <p className="field-hint">Es el email con el que compraste. Para cambiarlo, escríbenos.</p>
      </div>
      <div>
        <label className="field-label">{hasPassword ? "Cambiar contraseña" : "Crear contraseña"} <span className="font-normal text-muted">(opcional)</span></label>
        <input name="password" type="password" minLength={8} autoComplete="new-password" className="input" placeholder={hasPassword ? "Nueva contraseña" : "Para entrar sin enlace mágico"} />
      </div>
      <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
    </form>
  );
}
