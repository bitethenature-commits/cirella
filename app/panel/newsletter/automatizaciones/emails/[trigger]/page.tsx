import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AUTOMATIONS, EDITABLE_EMAILS, type AutomationTrigger } from "@/lib/automation-catalog";
import { readDesign } from "@/lib/email-blocks";
import { brandPalette, brandSocials } from "@/lib/email-starters";
import { appUrl } from "@/lib/env";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../../../../ui";
import { requireNewsletterOwner } from "../../../guard";
import { AutomaticEmailEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function AutomaticEmailPage({ params }: { params: Promise<{ trigger: string }> }) {
  const { trigger } = await params;
  const { creator } = await requireNewsletterOwner();
  const meta = EDITABLE_EMAILS[trigger as AutomationTrigger];
  if (!meta) notFound();
  const t = trigger as AutomationTrigger;
  const row = await tenantDb(creator.id).automation.findFirst({ where: { trigger: t } });
  const design = readDesign(row?.design);
  // Sin su versión, el editor empieza con el email original escrito con bloques (o con su mensaje de antes).
  const start = design ?? (row?.message && (t === "WELCOME" || t === "ABANDONED_CHECKOUT")
    ? { v: 1 as const, blocks: [...meta.original().blocks.filter((b) => b.t === "title"), { id: "texto", t: "text" as const, body: row.message }] }
    : meta.original());
  return (
    <div>
      <Link href="/panel/newsletter/automatizaciones" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Automatizaciones
      </Link>
      <PageHeader title={AUTOMATIONS[t].label} subtitle={AUTOMATIONS[t].description} />
      <AutomaticEmailEditor
        trigger={t}
        custom={!!design || !!row?.subject}
        subject={row?.subject ?? ""}
        defaultSubject={meta.subject}
        design={start}
        vars={meta.vars}
        mode={meta.mode}
        fixed={meta.fixed}
        palette={brandPalette(creator.pageDraft, creator.displayName)}
        socials={brandSocials(creator.pageDraft, creator.displayName)}
        siteUrl={`${appUrl()}/`}
        brand={creator.displayName}
      />
    </div>
  );
}
