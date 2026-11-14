"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ORACLE_CARDS } from "@/components/models/data/oracle";
import { requireCreator } from "@/lib/auth";
import { uniqueDeckSlug } from "@/lib/oracle-decks";
import { cardFormSchema, DECK_CARDS_MAX, DECK_CARDS_MIN, deckFormSchema, DECKS_MAX } from "@/lib/oracle-rules";
import { isOwnImageSrc } from "@/lib/page-blocks";
import { cleanRichInput } from "@/lib/rich-text";
import { cardFrameText, parseCardFrame } from "@/components/models/data/oracle";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb, type TenantDb } from "@/lib/tenant";

/**
 * Panel → Barajas: crear, editar, ordenar, publicar y borrar barajas de oráculo propias y sus cartas.
 * Todo con tenantDb (lib/tenant.ts): un id de otra creadora no encuentra nada. Las imágenes solo
 * pueden ser suyas (subidas con ImageUpload: /media/<su id>/…) o de la demo.
 */

export type DeckActionState = { ok?: string; error?: string } | undefined;

const idSchema = z.string().trim().regex(/^[a-z0-9]{8,40}$/);

/** Las páginas que pintan una baraja publicada (portada y páginas extra) y las pantallas del panel. */
function refresh(username: string, deckId?: string) {
  revalidatePath(`/${username}`, "layout");
  if (isPersonalMode()) revalidatePath("/", "layout");
  revalidatePath("/panel/barajas");
  if (deckId) revalidatePath(`/panel/barajas/${deckId}`, "layout");
  revalidatePath("/panel/pagina");
}

/** El ajuste de una imagen a la carta, limpio (null sin imagen). */
const frameOf = (raw: string, hasImage: boolean) => (hasImage && raw ? cardFrameText(parseCardFrame(raw)) : null);

/** Una imagen del formulario: vacía → null; suya (o de la demo) → la misma; de fuera → error. */
function ownImage(raw: string, creatorId: string): { ok: true; url: string | null } | { ok: false } {
  const url = raw.trim();
  if (!url) return { ok: true, url: null };
  return isOwnImageSrc(url, creatorId) ? { ok: true, url } : { ok: false };
}

// ── Barajas ──

export async function saveDeck(_: DeckActionState, form: FormData): Promise<DeckActionState> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const parsed = deckFormSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const back = ownImage(d.backImageUrl, creator.id);
  if (!back.ok) return { error: "La imagen del reverso no es tuya o ya no existe: vuelve a subirla" };
  const data = { name: d.name, description: d.description || null, backImageUrl: back.url, backFrame: frameOf(d.backFrame, !!back.url) };
  if (!d.id) {
    const count = await db.oracleDeck.count();
    if (count >= DECKS_MAX) return { error: `Puedes tener hasta ${DECKS_MAX} barajas` };
    const deck = await db.oracleDeck.create({ data: { creatorId: creator.id, slug: await uniqueDeckSlug(db, d.name), sortOrder: count, ...data } });
    refresh(creator.username);
    redirect(`/panel/barajas/${deck.id}?guardada=1`);
  }
  const current = await db.oracleDeck.findFirst({ where: { id: d.id }, select: { id: true } });
  if (!current) return { error: "Esta baraja ya no existe" };
  await db.oracleDeck.update({ where: { id: current.id }, data });
  refresh(creator.username, current.id);
  return { ok: "Baraja guardada." };
}

export async function deleteDeck(form: FormData) {
  const { creator } = await requireCreator();
  const id = idSchema.parse(form.get("id"));
  const db = tenantDb(creator.id);
  const deck = await db.oracleDeck.findFirst({ where: { id }, select: { id: true } });
  if (deck) {
    // Sus cartas se van con ella (ON DELETE CASCADE). Los bloques que la usaban vuelven a la de serie.
    await db.oracleDeck.delete({ where: { id: deck.id } });
    refresh(creator.username);
  }
  redirect("/panel/barajas?borrada=1");
}

/** Publicar o pasar a borrador. Publicar pide al menos DECK_CARDS_MIN cartas (la tirada de tres). */
export async function toggleDeck(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return;
  const deck = await db.oracleDeck.findFirst({ where: { id: id.data }, select: { id: true, status: true } });
  if (!deck) return;
  const publish = deck.status !== "PUBLISHED";
  if (publish && (await db.oracleCard.count({ where: { deckId: deck.id } })) < DECK_CARDS_MIN) redirect(`/panel/barajas/${deck.id}?faltan=1`);
  await db.oracleDeck.update({ where: { id: deck.id }, data: { status: publish ? "PUBLISHED" : "DRAFT" } });
  refresh(creator.username, deck.id);
}

/** Intercambia un elemento con el de al lado y renumera la lista (0, 1, 2…). */
async function swapOrder(list: { id: string }[], id: string, dir: -1 | 1, save: (id: string, sortOrder: number) => Promise<unknown>) {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, n) => save(x.id, n)));
  return true;
}

export async function moveDeck(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const list = await db.oracleDeck.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const moved = await swapOrder(list, String(form.get("id")), form.get("dir") === "up" ? -1 : 1, (id, sortOrder) => db.oracleDeck.update({ where: { id }, data: { sortOrder } }));
  if (moved) refresh(creator.username);
}

// ── Cartas ──

async function deckOf(db: TenantDb, deckId: string) {
  return db.oracleDeck.findFirst({ where: { id: deckId }, select: { id: true } });
}

export async function saveCard(_: DeckActionState, form: FormData): Promise<DeckActionState> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const parsed = cardFormSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const deck = await deckOf(db, d.deckId);
  if (!deck) return { error: "Esta baraja ya no existe" };
  const image = ownImage(d.imageUrl, creator.id);
  if (!image.ok) return { error: "La imagen de la carta no es tuya o ya no existe: vuelve a subirla" };
  const back = ownImage(d.backImageUrl, creator.id);
  if (!back.ok) return { error: "La imagen del reverso no es tuya o ya no existe: vuelve a subirla" };
  const reversedMessage = d.reversible ? cleanRichInput(d.reversedMessage, { creatorId: creator.id, images: false }).trim() : "";
  const data = {
    name: d.name,
    keyword: d.keyword,
    message: cleanRichInput(d.message, { creatorId: creator.id, images: false }).trim(),
    question: d.question,
    imageUrl: image.url,
    imageFrame: frameOf(d.imageFrame, !!image.url),
    backImageUrl: back.url,
    backFrame: frameOf(d.backFrame, !!back.url),
    motif: ORACLE_CARDS.some((c) => c.id === d.motif) ? d.motif : null,
    reversible: d.reversible,
    reversedMessage: reversedMessage || null,
  };
  if (!d.id) {
    const count = await db.oracleCard.count({ where: { deckId: deck.id } });
    if (count >= DECK_CARDS_MAX) return { error: `Una baraja puede tener hasta ${DECK_CARDS_MAX} cartas` };
    await db.oracleCard.create({ data: { creatorId: creator.id, deckId: deck.id, sortOrder: count, ...data } });
    refresh(creator.username, deck.id);
    redirect(`/panel/barajas/${deck.id}?carta=nueva`);
  }
  const current = await db.oracleCard.findFirst({ where: { id: d.id, deckId: deck.id }, select: { id: true } });
  if (!current) return { error: "Esta carta ya no existe" };
  await db.oracleCard.update({ where: { id: current.id }, data });
  refresh(creator.username, deck.id);
  redirect(`/panel/barajas/${deck.id}?carta=guardada`);
}

export async function deleteCard(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const id = idSchema.parse(form.get("id"));
  const card = await db.oracleCard.findFirst({ where: { id }, select: { id: true, deckId: true } });
  if (!card) redirect("/panel/barajas");
  await db.oracleCard.delete({ where: { id: card.id } });
  // Una baraja publicada que se queda sin cartas suficientes para la tirada de tres vuelve a borrador.
  const left = await db.oracleCard.count({ where: { deckId: card.deckId } });
  if (left < DECK_CARDS_MIN) await db.oracleDeck.updateMany({ where: { id: card.deckId, status: "PUBLISHED" }, data: { status: "DRAFT" } });
  refresh(creator.username, card.deckId);
  redirect(`/panel/barajas/${card.deckId}?carta=borrada${left < DECK_CARDS_MIN ? "&borrador=1" : ""}`);
}

export async function moveCard(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const deckId = idSchema.safeParse(form.get("deckId"));
  if (!deckId.success || !(await deckOf(db, deckId.data))) return;
  const list = await db.oracleCard.findMany({ where: { deckId: deckId.data }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const moved = await swapOrder(list, String(form.get("id")), form.get("dir") === "up" ? -1 : 1, (id, sortOrder) => db.oracleCard.update({ where: { id }, data: { sortOrder } }));
  if (moved) refresh(creator.username, deckId.data);
}
