"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerification, type FormState } from "@/app/(auth)/actions";

export function ResendVerificationForm() {
  const [state, action] = useActionState<FormState, FormData>(resendVerification, undefined);
  if (state?.ok) return <p className="font-medium">{state.ok}</p>;
  return (
    <form action={action} className="space-y-2">
      <SubmitButton className="btn btn-outline btn-sm" pendingLabel="Enviando…">Reenviarme el enlace</SubmitButton>
      {state?.error && <p role="alert" className="text-sm">{state.error}</p>}
    </form>
  );
}
