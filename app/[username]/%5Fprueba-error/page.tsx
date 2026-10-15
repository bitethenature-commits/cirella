import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * /{usuaria}/_prueba-error: lanza un error a propósito para comprobar (e2e) la página de error
 * con la plantilla de la creadora. Solo en modo demo. Los slugs de producto nunca empiezan por «_».
 */
export default function ErrorTestPage() {
  if (!isDemoMode()) notFound();
  throw new Error("Error de prueba (solo en modo demo)");
}
