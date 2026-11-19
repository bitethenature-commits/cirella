"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NEWSLETTER_FORM_DEFAULTS } from "@/lib/page-config";
import { isPersonalMode } from "@/lib/site-mode";
import { readSiteTexts, type SiteTexts } from "@/lib/site-texts";

type Result = { ok: true } | { ok: false; error: string };
type Raw = Record<string, unknown>;

/**
 * Cambia algo de la portada que vale para toda la web desde el Canva de una página extra: en la guardada y en
 * la publicada, y solo eso (lo demás de la portada sigue como estaba).
 */
async function patchHome(patch: (cfg: Raw) => Raw): Promise<Result> {
  const { creator } = await requireCreator();
  const apply = (raw: Prisma.JsonValue | null): Prisma.InputJsonValue | undefined =>
    raw && typeof raw === "object" && !Array.isArray(raw) ? (patch(raw as Raw) as Prisma.InputJsonValue) : undefined;
  const pageDraft = apply(creator.pageDraft);
  const pagePublished = apply(creator.pagePublished);
  if (!pageDraft && !pagePublished) return { ok: false, error: "guarda antes tu portada" };
  await prisma.creator.update({ where: { id: creator.id }, data: { ...(pageDraft ? { pageDraft } : {}), ...(pagePublished ? { pagePublished } : {}) } });
  revalidatePath(`/${creator.username}`, "layout");
  revalidatePath("/panel", "layout");
  if (isPersonalMode()) revalidatePath("/", "layout");
  return { ok: true };
}

/** Los textos fijos de la web (lib/site-texts.ts): valen para todas las páginas. */
export async function saveSiteTexts(texts: SiteTexts): Promise<Result> {
  const clean = readSiteTexts(texts);
  return patchHome((cfg) => ({ ...cfg, texts: clean }));
}

/** El texto del botón de la newsletter («Apuntarme»): el mismo en la portada y en el pie de todas las páginas. */
export async function saveNewsletterButton(button: string): Promise<Result> {
  const clean = String(button ?? "").trim().slice(0, 30) || NEWSLETTER_FORM_DEFAULTS.button;
  return patchHome((cfg) => {
    const nl = cfg.newsletter && typeof cfg.newsletter === "object" ? (cfg.newsletter as Raw) : {};
    return { ...cfg, newsletter: { ...NEWSLETTER_FORM_DEFAULTS, footer: false, ...nl, button: clean } };
  });
}
