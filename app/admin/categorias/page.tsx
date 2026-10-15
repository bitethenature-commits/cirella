import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TEMPLATES, TEMPLATE_KEYS } from "@/lib/templates";
import { PageHeader } from "../../panel/ui";
import { saveCategory } from "../actions";

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const cats = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { creators: true } } } });
  const Row = ({ c }: { c?: (typeof cats)[number] }) => (
    <form action={saveCategory} className="grid items-center gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[60px_1fr_160px_70px_90px_auto]">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="emoji" defaultValue={c?.emoji ?? ""} placeholder="✨" className="input h-9 text-center text-sm" />
      <input name="name" defaultValue={c?.name ?? ""} placeholder="Nueva categoría" className="input h-9 text-sm" required />
      <select name="defaultTemplate" defaultValue={c?.defaultTemplate ?? "mystical"} className="input h-9 text-sm">
        {TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{TEMPLATES[k].name}</option>)}
      </select>
      <input name="sortOrder" defaultValue={c?.sortOrder ?? cats.length} className="input h-9 text-sm" inputMode="numeric" />
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="accent-[#0E1024]" /> Activa</label>
      <div className="flex items-center gap-2"><button className="btn btn-outline btn-sm">{c ? "Guardar" : "Añadir"}</button>{c && <span className="text-xs text-muted">{c._count.creators}</span>}</div>
    </form>
  );
  return (
    <div>
      <PageHeader title="Categorías" subtitle="Se ofrecen en el onboarding y sugieren un diseño por defecto." />
      <Flash ok={sp.ok} />
      <div className="card">
        {cats.map((c) => <Row key={c.id} c={c} />)}
        <Row />
      </div>
    </div>
  );
}
