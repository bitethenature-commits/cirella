import { redirect } from "next/navigation";

/** Las plantillas ahora están abajo de la pestaña Newsletter. Los enlaces de siempre llevan allí. */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  redirect(aviso ? `/panel/newsletter?${new URLSearchParams({ aviso })}#plantillas` : "/panel/newsletter#plantillas");
}
