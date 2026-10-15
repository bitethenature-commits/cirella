"use client";

import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { claimAccess, type ClaimState } from "./actions";

/**
 * Formulario de un producto gratis con email: nombre, email, privacidad (obligatoria, sin marcar) y
 * novedades (opcional). Controlado: un error no borra lo escrito. Todo se valida otra vez en el
 * servidor (./actions.ts).
 */
export function ClaimForm({
  productId,
  productTitle,
  cta,
  responsible,
  privacyHref,
  processorName,
  creatorDisplayName,
}: {
  productId: string;
  productTitle: string;
  cta: string;
  /** Responsable del tratamiento: el nombre legal de la creadora o, si no lo hay, el de su página. */
  responsible: string;
  privacyHref: string;
  /** Plataforma que trata los datos por encargo (null en la web personal: allí no hay plataforma). */
  processorName: string | null;
  creatorDisplayName: string;
}) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimAccess, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  // El mismo mensaje si es la primera vez o si ya lo tenía (se le reenvía el enlace): así el
  // formulario no revela si un email ya está apuntado.
  if (state?.ok)
    return (
      <div className="cp-card p-5 text-center" role="status">
        <CheckCircle2 className="cp-gold mx-auto h-9 w-9" />
        <p className="cp-display mt-3 text-[1.6rem] leading-tight">¡Listo! Revisa tu email</p>
        <p className="cp-muted mt-2 text-sm leading-relaxed">
          Te hemos enviado el acceso a «{productTitle}» a {state.email}. Si no lo ves en unos minutos, mira en la carpeta de spam o de promociones.
        </p>
      </div>
    );

  return (
    <form action={action} className="cp-card relative space-y-3.5 p-5">
      <input type="hidden" name="productId" value={productId} />
      {/* Campo trampa: invisible para las personas, los robots lo rellenan. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Mail className="cp-gold h-4 w-4" /> Gratis: te lo enviamos por email
      </p>
      <div>
        <label className="mb-1.5 block text-xs font-medium" htmlFor="claim-name">Nombre</label>
        <input id="claim-name" name="name" required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="cp-input" placeholder="Tu nombre" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium" htmlFor="claim-email">Email</label>
        <input id="claim-email" name="email" type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="cp-input" placeholder="tu@email.com" />
        <p className="cp-faint mt-1.5 text-xs leading-relaxed">
          Responsable: {responsible}. Usamos tu nombre y email para darte acceso y enviarte el enlace
          {processorName ? `; ${processorName} los trata por encargo suyo` : ""}. Puedes acceder, rectificar o suprimir tus datos cuando quieras.
        </p>
      </div>
      <div className="space-y-1">
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 px-1 py-1 text-xs leading-relaxed" style={{ color: "var(--c-muted)" }}>
          <input type="checkbox" name="privacy" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
          <span>
            He leído y acepto la{" "}
            <a href={privacyHref} target="_blank" rel="noopener" className="underline underline-offset-2" style={{ color: "var(--c-text)" }}>
              política de privacidad
            </a>
            .
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 px-1 py-1 text-xs leading-relaxed" style={{ color: "var(--c-muted)" }}>
          <input type="checkbox" name="newsletter" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
          <span>Quiero recibir novedades de {creatorDisplayName} por email (opcional). Puedes darte de baja cuando quieras.</span>
        </label>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "color-mix(in oklab, #c0392b 12%, transparent)", color: "var(--c-text)" }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="cp-btn h-14 w-full text-base disabled:opacity-60">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
          </>
        ) : (
          cta
        )}
      </button>
      <p className="cp-faint text-center text-xs">Sin pagos ni contraseñas.</p>
    </form>
  );
}
