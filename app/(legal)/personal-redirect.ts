import { redirect } from "next/navigation";
import { ownerUsername } from "@/lib/site-mode";

/**
 * Modo personal: no hay plataforma que presentar. Las páginas legales de la plataforma llevan a
 * la página legal de la dueña (aviso legal y privacidad), a la sección que corresponda.
 */
export function redirectToOwnerLegal(section: "aviso" | "privacidad") {
  const owner = ownerUsername();
  if (owner) redirect(`/${owner}/legal#${section}`);
}
