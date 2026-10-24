"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { confirmTwoFactorSetup, type SecurityState } from "@/app/panel/ajustes/seguridad/actions";

/**
 * Pantallas de la verificación en dos pasos (panel y administración): configurar la app, los
 * códigos de recuperación y los formularios que piden volver a confirmar. En el iPhone el botón
 * «Abrir en mi app de códigos» va primero: un QR en la misma pantalla no se puede escanear.
 */

type Scope = "panel" | "admin";

/** Campo del código: teclado numérico, autorrelleno de iOS y 16 px o más (Safari no hace zoom). */
function CodeInput({ id, label, allowRecovery = false }: { id: string; label: string; allowRecovery?: boolean }) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        name="code"
        required
        autoComplete="one-time-code"
        inputMode={allowRecovery ? "text" : "numeric"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={allowRecovery ? 20 : 7}
        className="input min-h-12 text-lg tracking-[0.2em]"
        style={{ fontSize: "1.125rem" }}
      />
    </div>
  );
}

function ErrorLine({ text }: { text?: string }) {
  return <p aria-live="polite" className="min-h-5 text-sm text-[#8a3b31]">{text ?? ""}</p>;
}

export function SetupWizard({ scope, uri, qrSvg, secretFormatted, doneHref }: { scope: Scope; uri: string; qrSvg: string; secretFormatted: string; doneHref: string }) {
  const [state, action] = useActionState<SecurityState, FormData>(confirmTwoFactorSetup, undefined);
  if (state?.codes) return <RecoveryCodesPanel codes={state.codes} doneHref={`${doneHref}?ok=activada`} first />;
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Paso 1</p>
        <h3 className="mt-1 font-semibold">Añade la cuenta a tu app de códigos</h3>
        <p className="mt-1 text-sm text-muted">Contraseñas del iPhone, Google Authenticator, Authy, 1Password…</p>
        <a href={uri} className="btn btn-primary mt-4 min-h-11 w-full sm:w-auto">
          <Smartphone className="h-4 w-4" /> Abrir en mi app de códigos
        </a>
        <details className="mt-4 rounded-2xl border border-line p-4 [&[open]>summary]:mb-3">
          <summary className="cursor-pointer text-sm font-medium">¿Configuras desde otro dispositivo? Escanea el código QR</summary>
          {/* SVG generado en el servidor a partir de nuestra propia dirección otpauth (lib/qr-svg.ts). */}
          <div className="mx-auto w-48 max-w-full" data-testid="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </details>
        <div className="mt-4">
          <p className="text-sm text-muted">O escribe esta clave en la app:</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code data-testid="totp-key" className="rounded-xl bg-sand px-3 py-2 font-mono text-base tracking-wider">{secretFormatted}</code>
            <CopyButton text={secretFormatted.replace(/\s/g, "")} label="Copiar" className="btn btn-outline btn-sm" />
          </div>
        </div>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="scope" value={scope} />
        <p className="eyebrow">Paso 2</p>
        <CodeInput id="setup-code" label="Escribe el código de 6 cifras" />
        <ErrorLine text={state?.error} />
        <SubmitButton className="btn btn-primary min-h-11" pendingLabel="Comprobando…">Activar</SubmitButton>
      </form>
    </div>
  );
}

export function RecoveryCodesPanel({ codes, doneHref, first = false }: { codes: string[]; doneHref: string; first?: boolean }) {
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="space-y-4" data-testid="recovery-codes">
      <div>
        <h3 className="font-semibold">{first ? "¡Activada! Guarda tus códigos de recuperación" : "Tus códigos de recuperación nuevos"}</h3>
        <p className="mt-1 text-sm text-muted">
          Guárdalos en un sitio seguro (por ejemplo, en Notas o impresos): cada uno sirve una vez si pierdes el móvil. No volveremos a enseñártelos.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-sand/60 p-4 font-mono text-base">
        {codes.map((c) => (
          <li key={c} className="tabular-nums">{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label="Copiar" className="btn btn-outline btn-sm min-h-11" />
        <button
          type="button"
          className="btn btn-outline btn-sm min-h-11"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([`Códigos de recuperación\n\n${text}\n`], { type: "text/plain" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "codigos-recuperacion.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download className="h-4 w-4" /> Descargar
        </button>
      </div>
      <label className="flex min-h-11 items-center gap-2.5 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4" />
        Los he guardado
      </label>
      {saved ? (
        <Link href={doneHref} className="btn btn-primary min-h-11">Terminar</Link>
      ) : (
        <button type="button" disabled className="btn btn-primary min-h-11">Terminar</button>
      )}
    </div>
  );
}

/**
 * Formulario que pide volver a confirmar (código de la app o de recuperación + contraseña si tiene).
 * Si la acción devuelve códigos nuevos, los enseña.
 */
export function ReauthForm({
  scope,
  action: serverAction,
  hasPassword,
  submitLabel,
  danger = false,
  then,
  doneHref,
}: {
  scope: Scope;
  action: (s: SecurityState, f: FormData) => Promise<SecurityState>;
  hasPassword: boolean;
  submitLabel: string;
  danger?: boolean;
  then?: string;
  doneHref: string;
}) {
  const [state, action] = useActionState<SecurityState, FormData>(serverAction, undefined);
  if (state?.codes) return <RecoveryCodesPanel codes={state.codes} doneHref={`${doneHref}?ok=codigos`} />;
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="scope" value={scope} />
      {then && <input type="hidden" name="then" value={then} />}
      <CodeInput id={`code-${submitLabel}`} label="Código de tu app (o de recuperación)" allowRecovery />
      {hasPassword && (
        <div>
          <label className="field-label" htmlFor={`pw-${submitLabel}`}>Contraseña</label>
          <input id={`pw-${submitLabel}`} name="password" type="password" required autoComplete="current-password" className="input" style={{ fontSize: "1rem" }} />
        </div>
      )}
      <ErrorLine text={state?.error} />
      <SubmitButton className={`btn ${danger ? "btn-outline text-[#9a3a2e]" : "btn-outline"} min-h-11`} pendingLabel="Un momento…">{submitLabel}</SubmitButton>
    </form>
  );
}
