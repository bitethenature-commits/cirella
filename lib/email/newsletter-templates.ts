/**
 * Emails de la newsletter: la confirmación del alta (doble opt-in), cada newsletter y la prueba que
 * se manda la dueña. Puros: scripts/unit/newsletter.test.ts.
 */
import type { EmailDesign, EmailVars } from "../email-blocks";
import { renderSubject } from "./blocks-html";
import { designEmailHtml } from "./design-layout";
import { esc, p } from "./html";
import { layout } from "./templates";
import { et } from "@/lib/i18n/email";

export function newsletterConfirmEmail(o: { creatorName: string; url: string; name?: string | null }) {
  return {
    subject: et("Confirma que quieres recibir la newsletter de {creatorName}", { creatorName: o.creatorName }),
    html: layout({
      brand: o.creatorName,
      title: et("Hola{name}", { name: o.name ? `, ${o.name}` : "" }),
      body:
        p(et("Para empezar a recibir la newsletter de {creatorName}, confirma que este email es tuyo.", { creatorName: esc(o.creatorName) })) +
        p(et("<span style=\"color:#A99FC2;font-size:13px\">Si no lo has pedido tú, ignora este email: no te escribiremos.</span>")),
      cta: { label: et("Sí, quiero recibirla"), url: o.url },
      areaLink: false,
    }),
  };
}

/** Pie legal de cada newsletter: quién la envía (LSSI art. 10 y 20), por qué le llega y la baja. */
export type NewsletterFooter = {
  senderName: string;
  legalName?: string | null;
  legalAddress?: string | null;
  legalEmail?: string | null;
  legalUrl: string;
  /** null en la prueba: el enlace de baja no hace nada. */
  unsubscribeUrl: string | null;
  /** Por qué le llega (automatizaciones de compra): «compraste «Curso X»». Sin él: la newsletter. */
  reason?: string | null;
  /** El mensaje que ella escribe en Ajustes › Envío (vacío = defaultFooterMessage). */
  message?: string | null;
};

/** El mensaje del pie de siempre (si no ha escrito el suyo en Ajustes › Envío). */
export function defaultFooterMessage(senderName: string) {
  return et("Recibes este email porque te apuntaste a la newsletter de {senderName}. ¿Ya no quieres recibirla?", { senderName: senderName });
}

/** El mensaje que sale de verdad: el suyo o, si está vacío, el de siempre. */
export function footerMessage(custom: string | null | undefined, senderName: string) {
  return custom?.trim() || defaultFooterMessage(senderName);
}

export function newsletterFooterHtml(f: NewsletterFooter): string {
  const who = [f.legalName && f.legalName !== f.senderName ? `${f.senderName} (${f.legalName})` : f.senderName, f.legalAddress, f.legalEmail]
    .filter(Boolean)
    .map((s) => esc(s!))
    .join(" · ");
  const unsub = f.unsubscribeUrl
    ? et("<a href=\"{unsubscribeUrl}\" style=\"color:#8A8698\">Darme de baja</a>", { unsubscribeUrl: esc(f.unsubscribeUrl) })
    : et("<span style=\"text-decoration:underline\">Darme de baja</span> (en la prueba no hace nada)");
  return (
    (f.reason
      ? et("Recibes este email porque {reason}. ¿No quieres recibir más emails como este? {unsub}.", { reason: esc(f.reason), unsub: unsub })
      : `${esc(footerMessage(f.message, f.senderName)).replace(/\n/g, "<br>")} ${unsub}.`) +
    et("<br>{who} · <a href=\"{legalUrl}\" style=\"color:#8A8698\">Aviso legal y privacidad</a>", { who: who, legalUrl: esc(f.legalUrl) })
  );
}

/** Una newsletter, lista para una persona (sus variables y su enlace de baja). */
export function campaignEmail(o: {
  brand: string;
  subject: string;
  preheader?: string | null;
  design: EmailDesign;
  baseUrl: string;
  vars: EmailVars;
  footer: NewsletterFooter;
  test?: boolean;
}) {
  const subject = renderSubject(o.subject, o.vars) || et("Newsletter");
  return {
    subject: o.test ? `[Prueba] ${subject}` : subject,
    // Con el estilo del editor visual (lib/email/design-layout.ts); el pie legal, el de siempre.
    html: designEmailHtml({
      brand: o.brand,
      subject,
      design: o.design,
      baseUrl: o.baseUrl,
      vars: o.vars,
      footer: newsletterFooterHtml(o.footer),
      preheader: o.preheader ? renderSubject(o.preheader, o.vars) : null,
    }),
  };
}
