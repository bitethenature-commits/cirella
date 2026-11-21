import { redirect } from "next/navigation";

/** «Editar la web» ahora es Mi página (la web en su marco, con todo editable encima). Los enlaces de siempre llevan allí. */
export default async function CanvaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina } = await searchParams;
  redirect(pagina ? `/panel/pagina?pagina=${encodeURIComponent(pagina)}` : "/panel/pagina");
}
