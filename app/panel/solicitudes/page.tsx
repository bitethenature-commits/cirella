import { redirect } from "next/navigation";

/**
 * Solicitudes ahora está dentro de Personas (/panel/clientes, arriba). Los enlaces de siempre (emails,
 * marcadores) siguen funcionando: llevan allí, con su aviso.
 */
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.ok) q.set("ok", sp.ok);
  if (sp.error) q.set("error", sp.error);
  redirect(q.size ? `/panel/clientes?${q}` : "/panel/clientes");
}
