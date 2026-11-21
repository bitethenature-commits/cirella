import "server-only";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { isPersonalMode } from "@/lib/site-mode";

/**
 * La newsletter es de la web personal (sale con el dominio de la dueña). En la plataforma no existe:
 * un envío masivo de muchas creadoras desde el mismo dominio pondría en riesgo la entrega de todas.
 */
export async function requireNewsletterOwner() {
  const r = await requireCreator();
  if (!isPersonalMode()) notFound();
  return r;
}
