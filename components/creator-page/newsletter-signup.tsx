"use client";
import { useT, Tr } from "@/lib/i18n/client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import { siteText, type SiteTextKey, type SiteTexts, type TextVars } from "@/lib/site-texts";
import type { TextEdit } from "./home-edit";
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
  opensPortal = false,
  texts,
  editText,
  editButton,
}: {
  variant: "section" | "footer";
  /** En el Canva, el título escrito encima. */
  title?: ReactNode;
  text?: string;
  button: string;
  creatorName: string;
  privacyHref: string;
  /** Vista previa del editor: no se envía nada. */
  preview?: boolean;
  demo?: boolean;
  /** Web personal con Portal de noticias: avisa de que suscribirse lo abre. */
  opensPortal?: boolean;
  /** Sus textos fijos (lib/site-texts.ts) y, en el Canva, cómo se escriben encima. */
  texts?: SiteTexts;
  editText?: TextEdit;
  /** En el Canva: el texto del botón escrito encima (el botón no envía nada). */
  editButton?: ReactNode;
}) {
  const tt = useT();
  const t = (key: SiteTextKey, vars?: TextVars): ReactNode => {
    const v = siteText(texts, key, vars);
    return editText ? editText(key, v, vars) : v;
  };
  // En el Canva las etiquetas no son <label> (al pulsarlas saltaría al campo en vez de escribir encima).
  const Label = editText ? "p" : "label";
  const [state, action, pending] = useActionState<NewsletterSignupState, FormData>(subscribeFromPage, undefined);
  const id = `nl-${variant}`;
  // En el Canva no es un <button>: dentro de uno no se puede escribir.
  const submit = (className: string) =>
    editButton ? (
      <span role="button" className={className}>
        {editButton}
      </span>
    ) : (
      <button type="submit" disabled={pending} className={className}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} <Tr s={button} />
      </button>
    );
  if (state?.ok)
    return (
      <div className={`cp-card p-5 text-center ${variant === "footer" ? "w-full max-w-md" : ""}`} role="status">
        <CheckCircle2 className="cp-gold mx-auto h-8 w-8" />
        <p className="cp-display mt-2 text-[1.45rem] leading-tight">{t("nl.doneTitle")}</p>
        <p className="cp-muted mt-1.5 text-sm leading-relaxed">
          {tt("Te hemos enviado un email a {email}. Pulsa «Sí, quiero recibirla» y ya estarás dentro. Si no lo ves, mira en spam o en promociones.", { email: state.email ?? "" })}
        </p>
        {demo && (
          <Link href="/dev/email" className="mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline"><Tr s={"Abrir el buzón de demostración →"} /></Link>
        )}
      </div>
    );
  const small = (
    <p className="cp-faint mt-2 text-xs leading-relaxed">
      {t("nl.consent", { nombre: creatorName })}{" "}
      {/* El enlace a la privacidad siempre sale (RGPD): se cambia su nombre, no se quita. */}
      <Link href={privacyHref} className="underline underline-offset-2">{t("nl.privacy")}</Link>
    </p>
  );
  return (
    <form action={preview ? undefined : action} onSubmit={preview ? (e) => e.preventDefault() : undefined} className={`relative ${variant === "section" ? "cp-card p-6 sm:p-8" : "w-full max-w-md text-left"}`} data-testid={`newsletter-${variant}`}>
      <input type="hidden" name="where" value={variant} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label><Tr s={"Web"} />{" "}<input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {variant === "section" ? (
        <>
          {title && <h2 className="cp-display text-[1.9rem] leading-tight sm:text-[2.2rem]">{title}</h2>}
          {text && <p className="cp-muted mt-2 text-[0.95rem] leading-relaxed"><Tr s={text} /></p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs font-medium" htmlFor={editText ? undefined : `${id}-name`}>{t("nl.name")}</Label>
              <input id={`${id}-name`} name="name" maxLength={80} autoComplete="given-name" className="cp-input" placeholder={tt("Tu nombre")} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium" htmlFor={editText ? undefined : `${id}-email`}>{t("nl.email")}</Label>
              <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" inputMode="email" className="cp-input" placeholder={tt("tu@email.com")} />
            </div>
          </div>
          {submit("cp-btn mt-4 h-12 w-full justify-center sm:w-auto")}
        </>
      ) : (
        <>
          <Label className="mb-1.5 block text-sm font-semibold" htmlFor={editText ? undefined : `${id}-email`}>{title || t("nl.footerTitle")}</Label>
          <div className="flex gap-2">
            <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" inputMode="email" className="cp-input min-w-0 flex-1" placeholder={tt("tu@email.com")} />
            {submit("cp-btn h-12 shrink-0 justify-center")}
          </div>
        </>
      )}
      {opensPortal && (
        <p className="cp-gold mt-3 flex items-start gap-1.5 text-[0.85rem] leading-snug" data-opens-portal>
          <span aria-hidden>✦</span>
          <span>{t("nl.portal")}</span>
        </p>
      )}
      {state?.error && <p className="mt-2 text-sm text-[#b4443a]" role="alert"><Tr s={state.error} /></p>}
      {small}
    </form>
  );
}
