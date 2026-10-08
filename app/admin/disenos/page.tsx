import { TemplatePreview } from "@/components/template-preview";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readPageConfig } from "@/lib/page-config";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";
import { PageHeader } from "../../panel/ui";
import { saveTemplateAdmin } from "../actions";

export default async function AdminTemplates({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [templates, creators] = await Promise.all([prisma.template.findMany({ orderBy: { sortOrder: "asc" } }), prisma.creator.findMany({ select: { pagePublished: true, pageDraft: true, displayName: true } })]);
  const usage = new Map<string, number>();
  for (const c of creators) {
    const t = readPageConfig(c.pagePublished ?? c.pageDraft, c.displayName).template;
    usage.set(t, (usage.get(t) ?? 0) + 1);
  }
  return (
    <div>
      <PageHeader title="Diseños disponibles" subtitle="Activa o desactiva plantillas. Las creadoras que ya usan una plantilla desactivada la conservan." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.filter((t) => (TEMPLATE_KEYS as readonly string[]).includes(t.key)).map((t) => (
          <form key={t.id} action={saveTemplateAdmin} className={`card overflow-hidden ${t.active ? "" : "opacity-60"}`}>
            <input type="hidden" name="id" value={t.id} />
            <TemplatePreview template={t.key as TemplateKey} />
            <div className="space-y-2 p-4">
              <input name="name" defaultValue={t.name} className="input h-9 text-sm font-semibold" />
              <input name="description" defaultValue={t.description ?? ""} className="input h-9 text-xs" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={t.active} className="accent-[#0E1024]" /> Disponible</label>
                <span className="text-xs text-muted">{usage.get(t.key) ?? 0} en uso</span>
                <input type="hidden" name="sortOrder" value={t.sortOrder} />
                <button className="btn btn-outline btn-sm">Guardar</button>
              </div>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
