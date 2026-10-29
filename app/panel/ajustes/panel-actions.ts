"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePanelPrefs } from "@/lib/panel-prefs";

export type PanelPrefsResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * «Personalizar mi panel»: guarda sus colores y el orden del menú y de Inicio. Solo los suyos (la
 * cuenta con la que ha entrado): nunca toca a otra creadora ni a su web pública.
 */
export async function savePanelPrefs(raw: unknown): Promise<PanelPrefsResult> {
  const { creator } = await requireCreator();
  const p = parsePanelPrefs(raw);
  if (!p.ok) return p;
  const empty = !p.value.theme && !p.value.nav && !p.value.home.length;
  await prisma.creator.update({
    where: { id: creator.id },
    data: { panelPrefs: empty ? Prisma.DbNull : (p.value as unknown as Prisma.InputJsonValue) },
  });
  revalidatePath("/panel", "layout");
  return { ok: true, message: empty ? "Listo: tu panel vuelve a ser como venía." : "Guardado: así se verá tu panel en todos tus dispositivos." };
}
