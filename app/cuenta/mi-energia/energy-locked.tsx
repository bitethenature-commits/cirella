"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { NewsletterUnlockForm, type UnlockAccess } from "@/components/creator-page/portal-section";

/**
 * «Mi energía» sin acceso: lo explica y ofrece suscribirse con el mismo formulario del portal (ya ha
 * entrado: solo falta la casilla de la newsletter). Al suscribirse, la página se vuelve a pedir.
 */
export function EnergyLocked({ access, creatorName, privacyHref }: { access: UnlockAccess; creatorName: string; privacyHref: string }) {
  const router = useRouter();
  const unlocked = useCallback(() => router.refresh(), [router]);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="cp-display text-[1.6rem] leading-tight">Para las suscriptoras de la newsletter</h2>
        <p className="cp-muted mt-2 text-[0.92rem] leading-relaxed">
          «Mi energía» calcula tu carta natal, tu Diseño Humano, tus Gene Keys y tu luna con tus datos de nacimiento, y cada día te cuenta lo que el cielo despierta en ellos. También puedes guardar
          los datos de otras personas (con su permiso) y abrir el oráculo y las runas. Es gratis para quien está suscrita a la newsletter de {creatorName}.
        </p>
      </div>
      <NewsletterUnlockForm
        id="mi-energia-form"
        what="abrir «Mi energía»"
        label="Suscríbete para abrir «Mi energía»"
        access={access}
        creatorName={creatorName}
        privacyHref={privacyHref}
        next="/cuenta/mi-energia"
        via="carta"
        signedInHint="Solo falta que te apuntes a la newsletter para abrir «Mi energía»."
        sentHint="vuelves aquí con todo abierto"
        footerHint="vuelves aquí"
        onUnlocked={unlocked}
      />
    </div>
  );
}
