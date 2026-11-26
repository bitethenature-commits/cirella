"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerification, type FormState } from "@/app/(auth)/actions";
import { Tr, useT } from "@/lib/i18n/client";

export function ResendVerificationForm() {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(resendVerification, undefined);
  if (state?.ok) return <p className="font-medium"><Tr s={state.ok} /></p>;
  return (
    <form action={action} className="space-y-2">
      <SubmitButton className="btn btn-outline btn-sm" pendingLabel={t("Enviando…")}><Tr s={"Reenviarme el enlace"} /></SubmitButton>
      {state?.error && <p role="alert" className="text-sm"><Tr s={state.error} /></p>}
    </form>
  );
}
