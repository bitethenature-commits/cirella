"use client";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfile, type ProfileState } from "../actions";

/** «Tus datos»: el nombre (el email y la contraseña tienen su tarjeta). */
export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <Flash ok={state?.ok} error={state?.error} />
      <div>
        <label className="field-label" htmlFor="perfil-name">Nombre</label>
        <input id="perfil-name" name="name" defaultValue={name} className="input" required maxLength={80} autoComplete="name" style={{ fontSize: "1rem" }} />
      </div>
      <div>
        <p className="field-label">Email</p>
        <p className="text-sm">
          {email} · <a href="#email" className="font-medium underline underline-offset-4">Cambiar</a>
        </p>
      </div>
      <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
    </form>
  );
}
