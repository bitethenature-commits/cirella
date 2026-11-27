import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { SiteText } from "@/components/creator-page/site-text";
import { LegalText } from "@/components/legal-text";
import { getCurrentUser } from "@/lib/auth";
import { formatLegalAddress, legalIdentityComplete, taxIdLabel, creatorLegalHref } from "@/lib/legal";
import { getLegalSnapshot, legalIdentityOf } from "@/lib/legal-snapshot";
import { currentLegalKind, signupsOnly } from "@/lib/commerce";
import {
  acceptedLegalDocs,
  PERSONAL_SALES_THIRD_PARTY_TEXT,
  PERSONAL_THIRD_PARTY_TEXT,
  personalPaymentMethodsText,
  personalProcessorsText,
  privacyResponsibleLine,
  WITHDRAWAL_FORM_TEXT,
  type LegalKind,
} from "@/lib/legal-templates";
import { paymentProviderKeys } from "@/lib/payments";
import { getPublicCreator } from "@/lib/public";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { ownerUsername } from "@/lib/site-mode";
import { Tr } from "@/lib/i18n/client";
import { localTx } from "@/lib/i18n/content";
import { getLocale, getT } from "@/lib/i18n/server";
import { translateLegalDoc } from "@/lib/i18n/legal-docs";
import { SESSION_CHANGE_NOTICE_HOURS } from "@/lib/legal";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = isPublicUsernameAllowed(username, ownerUsername()) ? await getPublicCreator(username) : null;
  const heading = signupsOnly() ? "Aviso legal y privacidad" : "Aviso legal y condiciones";
  return {
    title: data ? `${heading} · ${data.config.displayName}` : "Aviso legal",
    robots: { index: false },
  };
}

/**
 * Aviso legal, condiciones de venta, cambios y reembolsos, privacidad y cookies de una creadora.
 * Con ?v={id}, la versión exacta que aceptó una compra (LegalSnapshot), aunque luego haya cambiado.
 *
 * Modo personal sin cobros (lo de pago se compra en otras webs): aviso legal, privacidad, cookies y
 * un aviso sobre los enlaces y códigos de otras marcas. Sin condiciones de venta ni reembolsos y sin
 * la línea de la plataforma. Modo personal que cobra (Stripe/PayPal de la dueña): además sus
 * condiciones de venta y reembolsos, también sin plataforma. Una versión aceptada (?v=) se muestra
 * como se aceptó (LegalSnapshotContent.personal / .sales).
 */
export default async function CreatorLegalPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ v?: string }> }) {
  const t = await getT();
  const { username } = await params;
  const sp = await searchParams;
  // Modo personal: solo la dueña (el layout también lo comprueba, pero la página se pinta a la vez).
  if (!isPublicUsernameAllowed(username, ownerUsername())) notFound();
  const data = await getPublicCreator(username);
  if (!data) notFound();
  const { creator, config, platformName } = data;
  const user = await getCurrentUser();
  const isOwner = user?.id === creator.userId;
  if (!creator.published && !isOwner) notFound();

  // Solo versiones de esta creadora: el id de otra devuelve null.
  const snapshot = sp.v ? await getLegalSnapshot(creator.id, sp.v) : null;
  if (sp.v && !snapshot) notFound();
  const identity = snapshot?.identity ?? legalIdentityOf(creator);
  // Una versión aceptada se pinta como se aceptó (con sus textos exactos); si no, los vigentes.
  const kind: LegalKind = snapshot ? (snapshot.personal ? (snapshot.sales ? "personal-sales" : "personal") : "platform") : currentLegalKind();
  const docs = snapshot ?? acceptedLegalDocs(creator, platformName, kind, paymentProviderKeys());
  const personal = kind !== "platform";
  // Sin ventas en la web (personal sin cobros): ni condiciones de venta ni reembolsos.
  const sells = kind !== "personal";
  const privacy = docs.privacy;
  const complete = legalIdentityComplete(identity);
  // Sus textos propios, con la IA (corregibles en Traducciones); los de partida, con el diccionario.
  const tx = await localTx(creator.id);
  const own = new Set([creator.legalTerms, creator.legalRefunds, creator.legalPrivacy].filter((x): x is string => !!x));
  // Las plantillas, línea a línea con el diccionario legal (con su nombre, las horas y cómo se paga en sus huecos).
  const locale = await getLocale();
  const keys = paymentProviderKeys();
  const docVars = {
    nombre: creator.displayName,
    plataforma: platformName,
    horas: `${SESSION_CHANGE_NOTICE_HOURS} h`,
    metodos: personalPaymentMethodsText(keys),
    procesadores: personalProcessorsText(keys),
  };
  const doc = (s: string) => translateLegalDoc(s, locale, docVars);
  const legal = (s: string) => (own.has(s) ? tx(s) : doc(s));

  const rows: [string, string][] = [
    ["Titular", identity.legalName ?? ""],
    [taxIdLabel(identity.legalEntityType), identity.legalTaxId ?? ""],
    ["Domicilio", formatLegalAddress(identity)],
    ["Email", identity.legalEmail ?? ""],
    ...(identity.legalRegistry ? [["Datos registrales", identity.legalRegistry] as [string, string]] : []),
  ];

  return (
    <CreatorShell page="legal" username={username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages} sellerName={identity.legalName}>
      <main className="mx-auto max-w-2xl px-4 pb-10 pt-8 sm:pt-12">
        <p className="cp-eyebrow">
          <SiteText texts={config.texts} k="pg.legal.eyebrow" />
        </p>
        <h1 className="cp-display mt-2 text-[2.4rem] leading-tight">
          <SiteText texts={config.texts} k={sells ? "pg.legal.titleSales" : "pg.legal.title"} />
        </h1>

        {snapshot && (
          <p className="cp-card mt-6 px-4 py-3 text-sm">
            <strong>{snapshot.personal && !snapshot.sales ? t("Versión aceptada al apuntarte") : t("Versión aceptada en tu compra")}</strong>{" "}<Tr s={"· en vigor desde el"} />{" "}
            {snapshot.createdAt.toLocaleString({ es: "es-ES", de: "de-DE", en: "en-GB" }[locale], { dateStyle: "long", timeStyle: "short", timeZone: creator.timezone })}<Tr s={". Es la copia exacta de lo que aceptaste; la versión actual puede ser distinta."} />{" "}<Link href={`${creatorLegalHref(username)}`} className="underline underline-offset-4"><Tr s={"Ver la versión actual"} /></Link>
          </p>
        )}

        {!complete && (
          <div className="cp-card mt-6 px-4 py-3 text-sm">
            <p>{personal ? t("Los datos legales de esta página todavía no están completos.") : t("Esta creadora todavía no ha completado sus datos legales.")}</p>
            {isOwner && (
              <Link href="/panel/ajustes/legal" className="mt-2 inline-block font-semibold underline underline-offset-4"><Tr s={"Completar mis datos legales"} /></Link>
            )}
          </div>
        )}

        {(complete || isOwner) && (
          <div className="mt-10 space-y-12">
            <section id="aviso" className="scroll-mt-20">
              <h2 className="cp-display text-[1.8rem]">
                <SiteText texts={config.texts} k="pg.legal.aviso" />
              </h2>
              <dl className="cp-card mt-4 divide-y text-sm" style={{ borderColor: "var(--c-line)" }}>
                {rows.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:justify-between sm:gap-4" style={{ borderColor: "var(--c-line)" }}>
                    <dt className="cp-muted"><Tr s={label} /></dt>
                    <dd className="sm:text-right"><Tr s={value || t("Pendiente de completar")} /></dd>
                  </div>
                ))}
              </dl>
              {!personal && (
                <p className="cp-muted mt-3 text-sm"><Tr s={"Plataforma:"} />{" "}<Link href="/legal-notice" className="underline underline-offset-4"><Tr s={platformName} /></Link>{" "}<Tr s={"presta el servicio tecnológico de esta página y de los pagos; no es parte de las compras."} /></p>
              )}
            </section>

            {sells && (
              <>
                <section id="condiciones" className="scroll-mt-20">
                  <h2 className="cp-display text-[1.8rem]">
                <SiteText texts={config.texts} k="pg.legal.condiciones" />
              </h2>
                  <div className="mt-4">
                    <LegalText text={legal(docs.terms)} />
                  </div>
                </section>

                <section id="reembolsos" className="scroll-mt-20">
                  <h2 className="cp-display text-[1.8rem]">
                <SiteText texts={config.texts} k="pg.legal.reembolsos" />
              </h2>
                  <div className="mt-4">
                    <LegalText text={legal(docs.refunds)} />
                  </div>
                  <h3 className="mt-8 text-[0.95rem] font-semibold"><Tr s={"Formulario de desistimiento"} /></h3>
                  <p className="cp-muted mt-1 text-sm"><Tr s={"Puedes copiarlo y enviarlo por email. No es obligatorio usarlo."} /></p>
                  <pre className="cp-card mt-3 whitespace-pre-wrap p-4 font-sans text-sm">{doc(WITHDRAWAL_FORM_TEXT)}</pre>
                </section>
              </>
            )}

            <section id="privacidad" className="scroll-mt-20">
              <h2 className="cp-display text-[1.8rem]">
                <SiteText texts={config.texts} k="pg.legal.privacidad" />
              </h2>
              <div className="mt-4">
                <LegalText text={`${doc(privacyResponsibleLine(identity))}\n\n${legal(privacy)}`} />
              </div>
            </section>

            <section id="cookies" className="scroll-mt-20">
              <h2 className="cp-display text-[1.8rem]">
                <SiteText texts={config.texts} k="pg.legal.cookies" />
              </h2>
              <p className="mt-4 text-[0.92rem] leading-relaxed">
                <SiteText texts={config.texts} k="pg.legal.cookiesText" multiline />
              </p>
            </section>

            {personal && (
              <section id="otras-webs" className="scroll-mt-20">
                <h2 className="cp-display text-[1.8rem]">
                <SiteText texts={config.texts} k="pg.legal.otras" />
              </h2>
                <div className="mt-4">
                  <LegalText text={doc(sells ? PERSONAL_SALES_THIRD_PARTY_TEXT : PERSONAL_THIRD_PARTY_TEXT)} />
                </div>
              </section>
            )}

            <p className="cp-faint text-xs">{personal ? t("Estos textos los publica la titular de esta página y son responsabilidad suya.") : t("Estos textos los publica la vendedora y son responsabilidad suya.")}</p>
          </div>
        )}
      </main>
    </CreatorShell>
  );
}
