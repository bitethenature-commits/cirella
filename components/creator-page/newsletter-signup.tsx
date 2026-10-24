"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { subscribeFromPage, type NewsletterSignupState } from "@/app/[username]/newsletter-actions";

/**
 * Formulario de la newsletter de la web personal: email (y nombre, opcional), sin casillas
 * premarcadas. Al pulsar «Apuntarme» le llega un email para confirmar (doble opt-in, RGPD art. 7):
 * la letra pequeña lo dice, junto con la baja y el enlace a la privacidad.
 *   · variant «section»: la sección de la portada, con su título y su texto.
 *   · variant «footer»: una fila compacta en el pie de todas las páginas.
 */
export function NewsletterSignup({
  variant,
  title,
  text,
  button,
  creatorName,
  privacyHref,
  preview = false,
  demo = false,
}: {
  variant: "section" | "footer";
  title?: string;
  text?: string;
  button: string;
  creatorName: string;
  privacyHref: string;
  /** Vista previa del editor: no se envía nada. */
  preview?: boolean;
  demo?: boolean;
}) {
  const [state, action, pending] = useActionState<NewsletterSignupState, FormData>(subscribeFromPage, undefined);
  const id = `nl-${variant}`;
  if (state?.ok)
    return (
      <div className={`cp-card p-5 text-center ${variant === "footer" ? "w-full max-w-md" : ""}`} role="status">
        <CheckCircle2 className="cp-gold mx-auto h-8 w-8" />
        <p className="cp-display mt-2 text-[1.45rem] leading-tight">Revisa tu email y confirma</p>
        <p className="cp-muted mt-1.5 text-sm leading-relaxed">
          Te hemos enviado un email a {state.email}. Pulsa «Sí, quiero recibirla» y ya estarás dentro. Si no lo ves, mira en spam o en promociones.
        </p>
        {demo && (
          <Link href="/dev/correo" className="mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline">
            Abrir el buzón de demostración →
          </Link>
        )}
      </div>
    );
  const small = (
    <p className="cp-faint mt-2 text-xs leading-relaxed">
      Te enviaré un email para confirmar. Solo lo usaré para la newsletter de {creatorName}; puedes darte de baja cuando quieras con el enlace de cada email.{" "}
      <Link href={privacyHref} className="underline underline-offset-2">Privacidad</Link>
    </p>
  );
  return (
    <form action={preview ? undefined : action} onSubmit={preview ? (e) => e.preventDefault() : undefined} className={`relative ${variant === "section" ? "cp-card p-6 sm:p-8" : "w-full max-w-md text-left"}`} data-testid={`newsletter-${variant}`}>
      <input type="hidden" name="where" value={variant} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {variant === "section" ? (
        <>
          {title && <h2 className="cp-display text-[1.9rem] leading-tight sm:text-[2.2rem]">{title}</h2>}
          {text && <p className="cp-muted mt-2 text-[0.95rem] leading-relaxed">{text}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium" htmlFor={`${id}-name`}>Nombre (opcional)</label>
              <input id={`${id}-name`} name="name" maxLength={80} autoComplete="given-name" className="cp-input" placeholder="Tu nombre" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" htmlFor={`${id}-email`}>Email</label>
              <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" inputMode="email" className="cp-input" placeholder="tu@email.com" />
            </div>
          </div>
          <button type="submit" disabled={pending} className="cp-btn mt-4 h-12 w-full justify-center sm:w-auto">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {button}
          </button>
        </>
      ) : (
        <>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor={`${id}-email`}>{title || "Recibe mi newsletter"}</label>
          <div className="flex gap-2">
            <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" inputMode="email" className="cp-input min-w-0 flex-1" placeholder="tu@email.com" />
            <button type="submit" disabled={pending} className="cp-btn h-12 shrink-0 justify-center">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {button}
            </button>
          </div>
        </>
      )}
      {state?.error && <p className="mt-2 text-sm text-[#b4443a]" role="alert">{state.error}</p>}
      {small}
    </form>
  );
}
