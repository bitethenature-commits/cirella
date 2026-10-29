/**
 * Emails de la newsletter: la confirmación del alta (doble opt-in), cada newsletter y la prueba que
 * se manda la dueña. Puros: scripts/unit/newsletter.test.ts.
 */
import type { EmailDesign, EmailVars } from "../email-blocks";
import { renderSubject } from "./blocks-html";
import { designEmailHtml } from "./design-layout";
import { esc, p } from "./html";
import { layout } from "./templates";

export function newsletterConfirmEmail(o: { creatorName: string; url: string; name?: string | null }) {
  return {
    subject: `Confirma que quieres recibir la newsletter de ${o.creatorName}`,
    html: layout({
      brand: o.creatorName,
      title: `Hola${o.name ? `, ${o.name}` : ""}`,
      body:
        p(`Para empezar a recibir la newsletter de ${esc(o.creatorName)}, confirma que este email es tuyo.`) +
        p(`<span style="color:#8A8698;font-size:13px">Si no lo has pedido tú, ignora este email: no te escribiremos.</span>`),
      cta: { label: "Sí, quiero recibirla", url: o.url },
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
};

export function newsletterFooterHtml(f: NewsletterFooter): string {
  const who = [f.legalName && f.legalName !== f.senderName ? `${f.senderName} (${f.legalName})` : f.senderName, f.legalAddress, f.legalEmail]
    .filter(Boolean)
    .map((s) => esc(s!))
    .join(" · ");
  const unsub = f.unsubscribeUrl
    ? `<a href="${esc(f.unsubscribeUrl)}" style="color:#8A8698">Darme de baja</a>`
    : `<span style="text-decoration:underline">Darme de baja</span> (en la prueba no hace nada)`;
  return (
    `Recibes este email porque te apuntaste a la newsletter de ${esc(f.senderName)}. ¿Ya no quieres recibirla? ${unsub}.` +
    `<br>${who} · <a href="${esc(f.legalUrl)}" style="color:#8A8698">Aviso legal y privacidad</a>`
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
  const subject = renderSubject(o.subject, o.vars) || "Newsletter";
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
