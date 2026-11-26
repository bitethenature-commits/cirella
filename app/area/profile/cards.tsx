"use client";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeOwnPassword, requestEmailChange, type CardState } from "./actions";
import { Tr, useT } from "@/lib/i18n/client";

const FIELD = { fontSize: "1rem" } as const;

export function EmailCard({ hasPassword }: { hasPassword: boolean }) {
  const t = useT();
  const [state, action] = useActionState<CardState, FormData>(requestEmailChange, undefined);
  if (state?.ok) return <Flash ok={state.ok} />;
  return (
    <form action={action} className="space-y-3">
      <Flash error={state?.error} />
      <div>
        <label className="field-label" htmlFor="nuevo-email"><Tr s={"Email nuevo"} /></label>
        <input id="nuevo-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required className="input" style={FIELD} />
      </div>
      {hasPassword && (
        <div>
          <label className="field-label" htmlFor="email-password"><Tr s={"Tu contraseña"} /></label>
          <input id="email-password" name="password" type="password" autoComplete="current-password" required className="input" style={FIELD} />
        </div>
      )}
      <SubmitButton className="btn btn-primary btn-sm" pendingLabel={t("Enviando…")}><Tr s={"Cambiar email"} /></SubmitButton>
    </form>
  );
}

export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const t = useT();
  const [state, action] = useActionState<CardState, FormData>(changeOwnPassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <Flash ok={state?.ok} error={state?.error} />
      {hasPassword && (
        <div>
          <label className="field-label" htmlFor="pw-actual"><Tr s={"Contraseña actual"} /></label>
          <input id="pw-actual" name="current" type="password" autoComplete="current-password" required className="input" style={FIELD} />
        </div>
      )}
      <div>
        <label className="field-label" htmlFor="pw-nueva">{hasPassword ? t("Contraseña nueva") : t("Tu contraseña")}</label>
        <input id="pw-nueva" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" style={FIELD} placeholder={t("Mínimo 8 caracteres")} />
      </div>
      <SubmitButton className="btn btn-primary btn-sm" pendingLabel={t("Guardando…")}>{hasPassword ? t("Cambiar contraseña") : t("Crear contraseña")}</SubmitButton>
    </form>
  );
}
