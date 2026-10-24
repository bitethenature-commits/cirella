"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { isPersonalMode } from "@/lib/site-mode";
import { SITE_PAGE_TEMPLATES } from "@/lib/site-pages";
import {
  addSitePageButton,
  createSitePage,
  deleteSitePage,
  moveSitePage,
  saveSitePage,
  unpublishSitePage,
  type SaveSitePageResult,
  type SitePageInput,
} from "@/lib/site-pages.server";

/** Lo publicado tiene que verse ya: la portada (ISR), la página y el pie de todas las demás. */
function refreshPublic(username: string) {
  revalidatePath(`/${username}`, "layout");
  if (isPersonalMode()) revalidatePath("/", "layout");
  revalidatePath("/panel/paginas", "layout");
  revalidatePath("/panel/pagina");
}

const id = z.string().min(1).max(40);

export type CreatePageState = { error?: string } | undefined;

export async function createSitePageAction(_: CreatePageState, form: FormData): Promise<CreatePageState> {
  const { creator } = await requireCreator();
  const parsed = z.object({ template: z.enum(SITE_PAGE_TEMPLATES), title: z.string().trim().max(120).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Elige una plantilla" };
  const r = await createSitePage(creator.id, parsed.data);
  if ("error" in r) return { error: r.error };
  revalidatePath("/panel/paginas");
  redirect(`/panel/paginas/${r.id}`);
}

const inputSchema = z.object({ content: z.unknown(), slug: z.string().max(100), showInNav: z.boolean() });

async function save(pageId: string, input: SitePageInput, publish: boolean): Promise<SaveSitePageResult> {
  const { creator } = await requireCreator();
  const parsed = inputSchema.safeParse(input);
  if (!id.safeParse(pageId).success || !parsed.success) return { ok: false, error: "No se pudo guardar" };
  const r = await saveSitePage(creator.id, pageId, input, { publish });
  if (r.ok) refreshPublic(creator.username);
  return r;
}

export async function saveSitePageDraft(pageId: string, input: SitePageInput) {
  return save(pageId, input, false);
}

export async function publishSitePageAction(pageId: string, input: SitePageInput) {
  return save(pageId, input, true);
}

export async function unpublishSitePageAction(form: FormData) {
  const { creator } = await requireCreator();
  const pageId = id.parse(form.get("id"));
  if (await unpublishSitePage(creator.id, pageId)) refreshPublic(creator.username);
  redirect(`/panel/paginas/${pageId}?despublicada=1`);
}

export async function deleteSitePageAction(form: FormData) {
  const { creator } = await requireCreator();
  if (await deleteSitePage(creator.id, id.parse(form.get("id")))) refreshPublic(creator.username);
  redirect("/panel/paginas?borrada=1");
}

export async function moveSitePageAction(form: FormData) {
  const { creator } = await requireCreator();
  const dir = z.enum(["up", "down"]).parse(form.get("dir"));
  await moveSitePage(creator.id, id.parse(form.get("id")), dir);
  refreshPublic(creator.username);
}

export async function addSitePageButtonAction(pageId: string) {
  const { creator } = await requireCreator();
  const r = await addSitePageButton(creator.id, id.parse(pageId));
  revalidatePath("/panel/pagina");
  return r;
}
