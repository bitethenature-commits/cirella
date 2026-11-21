import { notFound, redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";

/** Las páginas ya no tienen pantalla de ajustes aparte: se editan en Mi página. Los enlaces de siempre llevan allí. */
export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const page = await tenantDb(creator.id).sitePage.findFirst({ where: { id }, select: { slug: true } });
  if (!page) notFound();
  redirect(`/panel/pagina?pagina=${encodeURIComponent(page.slug)}`);
}
