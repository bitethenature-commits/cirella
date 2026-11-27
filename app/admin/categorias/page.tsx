import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "../../panel/ui";
import { saveCategory } from "../actions";
import { platformOnly } from "../platform-only";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const t = await getT();
  platformOnly();
  await requireAdmin();
  const sp = await searchParams;
  const cats = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { creators: true } } } });
  const Row = ({ c }: { c?: (typeof cats)[number] }) => (
    <form action={saveCategory} className="grid items-center gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[60px_1fr_70px_90px_auto]">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="emoji" defaultValue={c?.emoji ?? ""} placeholder="✨" className="input h-9 text-center text-sm" />
      <input name="name" defaultValue={c?.name ?? ""} placeholder={t("Nueva categoría")} className="input h-9 text-sm" required />
      <input name="sortOrder" defaultValue={c?.sortOrder ?? cats.length} className="input h-9 text-sm" inputMode="numeric" />
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="accent-[#0E1024]" />{" "}<Tr s={"Activa"} /></label>
      <div className="flex items-center gap-2"><button className="btn btn-outline btn-sm">{c ? t("Guardar") : t("Añadir")}</button>{c && <span className="text-xs text-muted">{c._count.creators}</span>}</div>
    </form>
  );
  return (
    <div>
      <PageHeader title={t("Categorías")} subtitle={t("Se ofrecen en el onboarding.")} />
      <Flash ok={sp.ok} />
      <div className="card">
        {cats.map((c) => <Row key={c.id} c={c} />)}
        <Row />
      </div>
    </div>
  );
}
