"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { publishPage } from "@/lib/creator";
import { prisma } from "@/lib/db";
import { pageConfigSchema, type PageConfig } from "@/lib/page-config";
import { planFeatures } from "@/lib/plans";
import { cleanRichInput } from "@/lib/rich-text";
import { isPersonalMode } from "@/lib/site-mode";

const ownImage = (u: string | null | undefined) => (u && (u.startsWith("/media/") || u.startsWith("/demo/")) ? u : null);

async function save(input: PageConfig) {
  const { creator } = await requireCreator();
  const parsed = pageConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message, creator };
  const features = planFeatures(creator.plan);
  const cfg: PageConfig = {
    ...parsed.data,
    avatarUrl: ownImage(parsed.data.avatarUrl),
    coverUrl: ownImage(parsed.data.coverUrl),
    theme: { ...parsed.data.theme, backgroundImageUrl: ownImage(parsed.data.theme.backgroundImageUrl) },
    hidePoweredBy: features.removeBranding ? parsed.data.hidePoweredBy : false,
    // Bloques con formato: sin caracteres de control ni imágenes (los bloques no admiten imágenes).
    blocks: parsed.data.blocks?.map((b) => (b.format === "MD" ? { ...b, body: cleanRichInput(b.body, { creatorId: creator.id, images: false }) } : b)),
  };
  const tpl = await prisma.template.findFirst({ where: { key: cfg.template, active: true } });
  if (!tpl) return { ok: false as const, error: "Ese diseño no está disponible", creator };
  await prisma.creator.update({
    where: { id: creator.id },
    data: { pageDraft: cfg as unknown as Prisma.InputJsonValue, ...(creator.published ? {} : { displayName: cfg.displayName }) },
  });
  return { ok: true as const, creator };
}

export async function saveDraft(cfg: PageConfig) {
  const r = await save(cfg);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/panel/pagina");
  return { ok: true, message: "Borrador guardado" };
}

export async function publishDraft(cfg: PageConfig) {
  const r = await save(cfg);
  if (!r.ok) return { ok: false, error: r.error };
  await publishPage(r.creator.id);
  revalidatePath(`/${r.creator.username}`);
  revalidatePath("/panel", "layout");
  // En modo personal su nombre y su foto también salen en la página «no encontrada» compartida,
  // que se genera estática al desplegar (cuando su cuenta aún no existía): se regenera al publicar.
  if (isPersonalMode()) revalidatePath("/", "layout");
  return { ok: true, message: "¡Publicado! Tu página ya muestra los cambios." };
}
