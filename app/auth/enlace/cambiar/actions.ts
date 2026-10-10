"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";
import { openOrderLink } from "../open-link";

/**
 * «Salir y abrir el enlace»: cierra la sesión de la otra cuenta y abre aquí mismo el enlace
 * personal (redirigir a /auth/enlace desde una acción perdería la cookie de la nueva sesión).
 */
export async function switchToLink(form: FormData) {
  const t = String(form.get("t") ?? "");
  await destroySession();
  redirect(await openOrderLink(t, { afterSignOut: true }));
}
