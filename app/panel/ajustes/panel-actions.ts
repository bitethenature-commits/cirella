"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readPageConfig, type PageConfig } from "@/lib/page-config";
import { parsePanelPrefs } from "@/lib/panel-prefs";
import type { Design } from "@/lib/templates";

export type PanelPrefsResult = { ok: true; message: string } | { ok: false; error: string };

const ownImage = (u: string | null | undefined) => (u && (u.startsWith("/media/") || u.startsWith("/demo/")) ? u : null);
/** Las fotos de fondo, solo suyas. */
const cleanDesign = (d: Design): Design => (d.backgroundImageUrl ? { ...d, backgroundImageUrl: ownImage(d.backgroundImageUrl) } : d);

/**
 * «Diseño de mi panel»: guarda su diseño, la barra del menú y el orden del menú y de Inicio. Solo los suyos (la
 * cuenta con la que ha entrado): nunca toca a otra creadora ni a su web pública. `designs`: sus plantillas (las
 * mismas que en el Diseño de la web), si las ha cambiado desde aquí; se guardan en su borrador de la web.
 */
export async function savePanelPrefs(raw: unknown, designs?: PageConfig["designs"]): Promise<PanelPrefsResult> {
  const { creator } = await requireCreator();
  const p = parsePanelPrefs(raw);
  if (!p.ok) return p;
  const value = { ...p.value, design: p.value.design ? cleanDesign(p.value.design) : null };
  const empty = !value.design && !value.sidebar && !value.nav && !value.home.length;
  const data: Prisma.CreatorUpdateInput = { panelPrefs: empty ? Prisma.DbNull : (value as unknown as Prisma.InputJsonValue) };
  if (designs) {
    const draft = creator.pageDraft && typeof creator.pageDraft === "object" && !Array.isArray(creator.pageDraft) ? (creator.pageDraft as Record<string, unknown>) : {};
    const list = readPageConfig({ ...draft, designs }, creator.displayName).designs.map((x) => ({ ...x, theme: cleanDesign(x.theme) }));
    data.pageDraft = { ...draft, designs: list } as unknown as Prisma.InputJsonValue;
  }
  await prisma.creator.update({ where: { id: creator.id }, data });
  revalidatePath("/panel", "layout");
  return { ok: true, message: empty ? "Listo: tu panel vuelve a ser como venía." : "Guardado: así se verá tu panel en todos tus dispositivos." };
}
