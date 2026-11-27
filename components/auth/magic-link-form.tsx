"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestMagicLink, type FormState } from "@/app/(auth)/actions";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Pedir un enlace para entrar sin contraseña. `variant="creator"` usa las clases cp-* para heredar
 * el tema de la página de la creadora; `creatorUsername` pone su marca en el email y en «Entrar».
 */
export function MagicLinkForm({
  next,
  creatorUsername,
  defaultEmail,
  demo,
  variant = "cirella",
}: {
  next?: string;
  creatorUsername?: string;
  defaultEmail?: string;
  demo: boolean;
  variant?: "cirella" | "creator";
}) {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(requestMagicLink, undefined);
  const creator = variant === "creator";
  return (
    <form action={action} className="space-y-4">
      <Flash ok={state?.ok} error={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="c" value={creatorUsername ?? ""} />
      <div>
        <label className={creator ? "mb-1.5 block text-xs font-medium" : "field-label"} htmlFor="ml-email"><Tr s={"Tu email"} /></label>
        <input
          id="ml-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={creator ? "cp-input" : "input"}
          placeholder={t("tu@email.com")}
          defaultValue={state?.email ?? defaultEmail}
        />
      </div>
      <SubmitButton className={creator ? "cp-btn h-14 w-full text-base" : "btn btn-primary btn-lg w-full"} pendingLabel={t("Enviando…")}><Tr s={"Enviarme el enlace"} /></SubmitButton>
      {state?.ok && demo && (
        <Link
          href="/dev/email"
          className={`block text-center text-sm font-semibold underline-offset-2 hover:underline ${creator ? "" : "text-lavender-deep"}`}
        ><Tr s={"Abrir el buzón de demostración →"} /></Link>
      )}
    </form>
  );
}
