import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Scale } from "lucide-react";
import { LegalIdentityStatus } from "@/components/panel/legal-status";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { creatorLegalHref, LEGAL_TEMPLATE_VERSION } from "@/lib/legal";
import { legalIdentityOf } from "@/lib/legal-snapshot";
import { currentLegalKind } from "@/lib/commerce";
import { acceptedLegalDocs } from "@/lib/legal-templates";
import { paymentProviderKeys } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { isPersonalMode } from "@/lib/site-mode";
import { PageHeader } from "../../ui";
import { saveLegalIdentityForm } from "./actions";
import { LegalDocsEditor } from "./legal-docs-editor";
import { LegalIdentityFields } from "./legal-identity-fields";

export const metadata: Metadata = { title: "Datos legales" };

export default async function LegalSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { creator: session, user } = await requireCreator();
  const sp = await searchParams;
  // Se lee la fila actual: la de la sesión puede ser anterior al último guardado.
  const [creator, { platformName }] = await Promise.all([prisma.creator.findUniqueOrThrow({ where: { id: session.id } }), getSettings()]);
  // Modo personal sin cobros: aquí no se vende nada; solo aviso legal y privacidad (con su propia
  // plantilla). Si cobra, sus condiciones de venta (sin plataforma) además.
  const kind = currentLegalKind();
  const personal = isPersonalMode();
  const docs = acceptedLegalDocs(creator, platformName, kind, paymentProviderKeys());

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/panel/ajustes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Ajustes
      </Link>
      <PageHeader
        title="Datos legales"
        subtitle={
          personal
            ? "La ley obliga a identificar a la titular de una web con actividad profesional: tu nombre, NIF, dirección y email salen en tu aviso legal."
            : "La ley obliga a mostrar quién vende en tu página y en cada compra. Sin estos datos no se pueden activar los cobros."
        }
        actions={
          <a href={creatorLegalHref(creator.username)} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
            Ver mi página legal <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />
      <Flash ok={sp.ok} error={sp.error} />

      <form action={saveLegalIdentityForm} className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><Scale className="h-4 w-4" /> {personal ? "Titular de la web" : "Quién vende"}</h2>
          <LegalIdentityStatus creator={creator} />
        </div>
        <LegalIdentityFields defaults={legalIdentityOf(creator)} contactFallback={creator.contactEmail ?? user.email} />
        <SubmitButton pendingLabel="Guardando…">Guardar datos legales</SubmitButton>
      </form>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> {kind === "personal" ? "Tu política de privacidad" : "Tus condiciones y políticas"}</h2>
          <p className="mt-1 text-sm text-muted">
            Partimos de plantillas pensadas para España. Puedes adaptarlas. Lo que escribas aquí es responsabilidad tuya.
          </p>
          <p role="note" className="mt-3 rounded-xl border border-gold bg-gold-soft px-3 py-2 text-sm text-ink">
            <strong>Borrador: revísalo con tu asesoría</strong> antes de vender. Plantillas versión {LEGAL_TEMPLATE_VERSION}
            {kind !== "personal" ? " (incluyen la renuncia obligatoria al desistimiento en lo digital, las sesiones a partir del día 15, los talleres sin desistimiento y el reembolso proporcional de las membresías)" : ""}.
          </p>
        </div>
        <LegalDocsEditor
          docs={docs}
          custom={{ terms: creator.legalTerms !== null, refunds: creator.legalRefunds !== null, privacy: creator.legalPrivacy !== null }}
          only={kind === "personal" ? ["privacy"] : undefined}
        />
      </section>
    </div>
  );
}
