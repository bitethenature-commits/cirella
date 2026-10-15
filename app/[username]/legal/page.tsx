import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { LegalText } from "@/components/legal-text";
import { getCurrentUser } from "@/lib/auth";
import { formatLegalAddress, legalIdentityComplete, taxIdLabel } from "@/lib/legal";
import { getLegalSnapshot, legalIdentityOf } from "@/lib/legal-snapshot";
import { currentLegalDocs, currentPersonalPrivacy, PERSONAL_THIRD_PARTY_TEXT, privacyResponsibleLine, WITHDRAWAL_FORM_TEXT } from "@/lib/legal-templates";
import { getPublicCreator } from "@/lib/public";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = isPublicUsernameAllowed(username, ownerUsername()) ? await getPublicCreator(username) : null;
  const heading = isPersonalMode() ? "Aviso legal y privacidad" : "Aviso legal y condiciones";
  return {
    title: data ? `${heading} · ${data.config.displayName}` : "Aviso legal",
    robots: { index: false },
  };
}

const COOKIES_TEXT =
  "Esta página no instala cookies de seguimiento. Medimos visitas de forma agregada y anónima, sin cookies. Solo usamos cookies técnicas para mantener tu sesión si entras en tu cuenta.";

/**
 * Aviso legal, condiciones de venta, cambios y reembolsos, privacidad y cookies de una creadora.
 * Con ?v={id}, la versión exacta que aceptó una compra (LegalSnapshot), aunque luego haya cambiado.
 *
 * Modo personal (aquí no se vende nada: lo de pago se compra en otras webs): aviso legal,
 * privacidad, cookies y un aviso sobre los enlaces y códigos de otras marcas. Sin condiciones de
 * venta ni reembolsos y sin la línea de la plataforma. Una versión aceptada (?v=) se muestra como se
 * aceptó: la de la web personal (LegalSnapshotContent.personal) así; una de la plataforma, entera.
 */
export default async function CreatorLegalPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ v?: string }> }) {
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
  const docs = snapshot ?? currentLegalDocs(creator, platformName);
  // Sin ventas en la web: solo lo que aplica a una página personal. Una versión aceptada se pinta
  // como se aceptó: la de la web personal (marca `personal`) igual, con su privacidad exacta.
  const personal = snapshot ? snapshot.personal === true : isPersonalMode();
  const privacy = snapshot ? snapshot.privacy : personal ? currentPersonalPrivacy(creator) : docs.privacy;
  const complete = legalIdentityComplete(identity);

  const rows: [string, string][] = [
    ["Titular", identity.legalName ?? ""],
    [taxIdLabel(identity.legalEntityType), identity.legalTaxId ?? ""],
    ["Domicilio", formatLegalAddress(identity)],
    ["Email", identity.legalEmail ?? ""],
    ...(identity.legalRegistry ? [["Datos registrales", identity.legalRegistry] as [string, string]] : []),
  ];

  return (
    <CreatorShell username={username} config={config} allowCustom={data.allowCustom} personal={data.personal} sellerName={identity.legalName}>
      <main className="mx-auto max-w-2xl px-4 pb-10 pt-8 sm:pt-12">
        <p className="cp-eyebrow">Información legal</p>
        <h1 className="cp-display mt-2 text-[2.4rem] leading-tight">{personal ? "Aviso legal y privacidad" : "Aviso legal y condiciones"}</h1>

        {snapshot && (
          <p className="cp-card mt-6 px-4 py-3 text-sm">
            <strong>{snapshot.personal ? "Versión aceptada al apuntarte" : "Versión aceptada en tu compra"}</strong> · en vigor desde el{" "}
            {snapshot.createdAt.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: creator.timezone })}. Es la copia exacta de lo que
            aceptaste; la versión actual puede ser distinta. <Link href={`/${username}/legal`} className="underline underline-offset-4">Ver la versión actual</Link>
          </p>
        )}

        {!complete && (
          <div className="cp-card mt-6 px-4 py-3 text-sm">
            <p>{personal ? "Los datos legales de esta página todavía no están completos." : "Esta creadora todavía no ha completado sus datos legales."}</p>
            {isOwner && (
              <Link href="/panel/ajustes/legal" className="mt-2 inline-block font-semibold underline underline-offset-4">
                Completar mis datos legales
              </Link>
            )}
          </div>
        )}

        {(complete || isOwner) && (
          <div className="mt-10 space-y-12">
            <section id="aviso" className="scroll-mt-20">
              <h2 className="cp-display text-[1.8rem]">Aviso legal</h2>
              <dl className="cp-card mt-4 divide-y text-sm" style={{ borderColor: "var(--c-line)" }}>
                {rows.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:justify-between sm:gap-4" style={{ borderColor: "var(--c-line)" }}>
                    <dt className="cp-muted">{label}</dt>
                    <dd className="sm:text-right">{value || "Pendiente de completar"}</dd>
                  </div>
                ))}
              </dl>
              {!personal && (
                <p className="cp-muted mt-3 text-sm">
                  Plataforma: <Link href="/aviso-legal" className="underline underline-offset-4">{platformName}</Link> presta el servicio tecnológico de esta página y
                  de los pagos; no es parte de las compras.
                </p>
              )}
            </section>

            {!personal && (
              <>
                <section id="condiciones" className="scroll-mt-20">
                  <h2 className="cp-display text-[1.8rem]">Condiciones de venta</h2>
                  <div className="mt-4">
                    <LegalText text={docs.terms} />
                  </div>
                </section>

                <section id="reembolsos" className="scroll-mt-20">
                  <h2 className="cp-display text-[1.8rem]">Cambios y reembolsos</h2>
                  <div className="mt-4">
                    <LegalText text={docs.refunds} />
                  </div>
                  <h3 className="mt-8 text-[0.95rem] font-semibold">Formulario de desistimiento</h3>
                  <p className="cp-muted mt-1 text-sm">Puedes copiarlo y enviarlo por email. No es obligatorio usarlo.</p>
                  <pre className="cp-card mt-3 whitespace-pre-wrap p-4 font-sans text-sm">{WITHDRAWAL_FORM_TEXT}</pre>
                </section>
              </>
            )}

            <section id="privacidad" className="scroll-mt-20">
              <h2 className="cp-display text-[1.8rem]">Privacidad</h2>
              <div className="mt-4">
                <LegalText text={`${privacyResponsibleLine(identity)}\n\n${privacy}`} />
              </div>
            </section>

            <section id="cookies" className="scroll-mt-20">
              <h2 className="cp-display text-[1.8rem]">Cookies</h2>
              <p className="mt-4 text-[0.92rem] leading-relaxed">{COOKIES_TEXT}</p>
            </section>

            {personal && (
              <section id="otras-webs" className="scroll-mt-20">
                <h2 className="cp-display text-[1.8rem]">Otras webs</h2>
                <div className="mt-4">
                  <LegalText text={PERSONAL_THIRD_PARTY_TEXT} />
                </div>
              </section>
            )}

            <p className="cp-faint text-xs">{personal ? "Estos textos los publica la titular de esta página y son responsabilidad suya." : "Estos textos los publica la vendedora y son responsabilidad suya."}</p>
          </div>
        )}
      </main>
    </CreatorShell>
  );
}
