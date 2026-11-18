import Link from "next/link";
import { Copy, PenLine, Plus, Send } from "lucide-react";
import { LookPreview } from "@/components/email-editor/look-preview";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { readStyle } from "@/lib/email-blocks";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { createTemplate, deleteTemplate, duplicateTemplate, startFromTemplate } from "./actions";
import { ensureStarterTemplates } from "./seed";

export const dynamic = "force-dynamic";

/**
 * Plantillas: el aspecto de tus newsletters, hecho a tu gusto como en un lienzo (fondo con geometría,
 * colores de títulos y texto, burbujas con o sin geometría, un adorno en una esquina, letras y
 * esquinas). Todas son tuyas, también las que venían de Cirella: se cambian y se borran. No llevan
 * textos: cada newsletter hecha con una empieza vacía.
 */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { creator } = await requireNewsletterOwner();
  const sp = await searchParams;
  await ensureStarterTemplates(creator.id);
  const mine = await tenantDb(creator.id).newsletterTemplate.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { campaigns: true } } } });

  return (
    <div>
      <PageHeader
        title="Plantillas"
        subtitle="El aspecto de tus newsletters: fondo con geometría, colores, burbujas y letras."
        actions={
          <form action={createTemplate}>
            <SubmitButton className="btn btn-primary btn-sm"><Plus className="h-4 w-4" /> Nueva plantilla</SubmitButton>
          </form>
        }
      />
      <NewsletterTabs current="/panel/newsletter/plantillas" />
      {sp.aviso && (
        <p role="status" className="mb-4 rounded-xl bg-[#e7f3ec] px-4 py-3 text-sm text-[#2f6b4a]">
          {sp.aviso.slice(0, 200)}
        </p>
      )}

      <p className="mb-4 text-sm text-muted">Todas son tuyas: cámbialas o bórralas cuando quieras. Las newsletters ya hechas con ellas no cambian.</p>
      {mine.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No tienes plantillas. Crea una con «Nueva plantilla».</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((t) => (
            <div key={t.id} className="card flex flex-col overflow-hidden">
              <Link href={`/panel/newsletter/plantillas/${t.id}`} aria-label={`Editar ${t.name}`}>
                <LookPreview style={readStyle((t.design as { style?: unknown } | null)?.style)} />
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <p className="truncate font-serif text-lg">{t.name}</p>
                {t._count.campaigns > 0 && <p className="text-xs text-muted">Usada en {t._count.campaigns} newsletter{t._count.campaigns === 1 ? "" : "s"}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={startFromTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <SubmitButton className="btn btn-primary btn-sm"><Send className="h-4 w-4" /> Usar</SubmitButton>
                  </form>
                  <Link href={`/panel/newsletter/plantillas/${t.id}`} className="btn btn-outline btn-sm"><PenLine className="h-4 w-4" /> Editar</Link>
                  <form action={duplicateTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <SubmitButton className="btn btn-ghost btn-sm"><Copy className="h-4 w-4" /> Duplicar</SubmitButton>
                  </form>
                  <ConfirmForm action={deleteTemplate} message={`¿Borrar la plantilla «${t.name}»? No se puede deshacer. Las newsletters hechas con ella no cambian.`}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn btn-ghost btn-sm text-rose">Borrar</button>
                  </ConfirmForm>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
