import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readStyle } from "@/lib/email-blocks";
import { brandPalette } from "@/lib/email-starters";
import { tenantDb } from "@/lib/tenant";
import { requireNewsletterOwner } from "../../guard";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

/** El creador de una plantilla: los controles a un lado y el email de muestra al otro, al momento. */
export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const t = await db.newsletterTemplate.findFirst({ where: { id } });
  if (!t) notFound();
  const others = await db.newsletterTemplate.findMany({ where: { id: { not: t.id } }, select: { id: true, name: true, design: true }, orderBy: { createdAt: "asc" } });
  return (
    <div>
      <Link href="/panel/newsletter#plantillas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Newsletter
      </Link>
      <TemplateEditor
        id={t.id}
        name={t.name}
        style={readStyle((t.design as { style?: unknown } | null)?.style)}
        brand={creator.displayName}
        palette={brandPalette(creator.pageDraft, creator.displayName)}
        others={others.map((o) => ({ id: o.id, name: o.name, style: readStyle((o.design as { style?: unknown } | null)?.style) }))}
      />
    </div>
  );
}
