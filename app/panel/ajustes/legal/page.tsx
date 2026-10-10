import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Scale } from "lucide-react";
import { LegalIdentityStatus } from "@/components/panel/legal-status";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { creatorLegalHref } from "@/lib/legal";
import { legalIdentityOf } from "@/lib/legal-snapshot";
import { currentLegalDocs } from "@/lib/legal-templates";
import { getSettings } from "@/lib/settings";
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
  const docs = currentLegalDocs(creator, platformName);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/panel/ajustes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Ajustes
      </Link>
      <PageHeader
        title="Datos legales"
        subtitle="La ley obliga a mostrar quién vende en tu página y en cada compra. Sin estos datos no se pueden activar los cobros."
        actions={
          <a href={creatorLegalHref(creator.username)} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
            Ver mi página legal <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />
      <Flash ok={sp.ok} error={sp.error} />

      <form action={saveLegalIdentityForm} className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><Scale className="h-4 w-4" /> Quién vende</h2>
          <LegalIdentityStatus creator={creator} />
        </div>
        <LegalIdentityFields defaults={legalIdentityOf(creator)} contactFallback={creator.contactEmail ?? user.email} />
        <SubmitButton pendingLabel="Guardando…">Guardar datos legales</SubmitButton>
      </form>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> Tus condiciones y políticas</h2>
          <p className="mt-1 text-sm text-muted">
            Partimos de plantillas pensadas para España. Puedes adaptarlas; te recomendamos revisarlas con tu asesoría. Lo que escribas aquí es responsabilidad tuya.
          </p>
        </div>
        <LegalDocsEditor
          docs={docs}
          custom={{ terms: creator.legalTerms !== null, refunds: creator.legalRefunds !== null, privacy: creator.legalPrivacy !== null }}
        />
      </section>
    </div>
  );
}
