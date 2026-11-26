"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { verifyLoginCode, type CodeState } from "./actions";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Campo del código: 6 cifras de la app (teclado numérico y autorrelleno de iOS) o un código de
 * recuperación. Se envía solo al pegar o autorrellenar las 6 cifras, nunca mientras se escribe.
 */
export function CodeForm({ rememberDefault }: { rememberDefault: boolean }) {
  const t = useT();
  const [state, action] = useActionState<CodeState, FormData>(verifyLoginCode, undefined);
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const formRef = useRef<HTMLFormElement>(null);
  const prevLen = useRef(0);
  // Tras un intento fallido el formulario se vacía: el siguiente autorrelleno vuelve a enviarse solo.
  useEffect(() => {
    prevLen.current = 0;
  }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      {mode === "totp" ? (
        <div>
          <label className="field-label" htmlFor="code"><Tr s={"Código de tu app"} /></label>
          <input
            key="totp"
            id="code"
            name="code"
            inputMode="numeric"
            pattern="[0-9 ]*"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            required
            aria-describedby="code-error"
            className="input min-h-12 text-center text-2xl tracking-[0.4em]"
            style={{ fontSize: "1.5rem" }}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              // Autorrelleno (iOS «Desde Contraseñas») o pegar: las 6 cifras llegan de golpe.
              if (digits.length === 6 && prevLen.current <= 4) formRef.current?.requestSubmit();
              prevLen.current = digits.length;
            }}
          />
        </div>
      ) : (
        <div>
          <label className="field-label" htmlFor="code"><Tr s={"Código de recuperación"} /></label>
          <input
            key="recovery"
            id="code"
            name="code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            autoFocus
            required
            placeholder="xxxxx-xxxxx"
            aria-describedby="code-error"
            className="input min-h-12 font-mono text-lg"
            style={{ fontSize: "1.125rem" }}
          />
        </div>
      )}
      <p id="code-error" aria-live="polite" className="min-h-5 text-sm text-[#8a3b31]"><Tr s={state?.error ?? ""} /></p>
      <label className="flex min-h-11 items-center gap-2.5 text-sm">
        <input type="checkbox" name="remember" defaultChecked={rememberDefault} className="h-4 w-4" /><Tr s={"Recordar este dispositivo 30 días"} /></label>
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel={t("Comprobando…")}><Tr s={"Entrar"} /></SubmitButton>
      <button type="button" onClick={() => setMode(mode === "totp" ? "recovery" : "totp")} className="block w-full text-center text-sm font-medium underline underline-offset-4">
        {mode === "totp" ? t("¿No tienes el móvil? Usa un código de recuperación") : t("Usar el código de mi app")}
      </button>
    </form>
  );
}
