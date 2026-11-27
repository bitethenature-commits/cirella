"use server";

import { translateSoon } from "@/lib/i18n/content";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { checkSaleInput, saleFormSchema, SALE_LABEL_MAX } from "@/lib/offers";
import { tenantDb } from "@/lib/tenant";
import { addDaysToKey, zonedTimeToUtc } from "@/lib/tz";

export type OfferState = { ok?: string; error?: string } | undefined;

/** La portada, las páginas de los productos y el panel están cacheados: la oferta debe verse ya. */
function refresh(id: string) {
  revalidatePath("/panel/ofertas");
  revalidatePath("/panel/actualidades");
  revalidatePath(`/panel/productos/${id}`);
  revalidatePath("/[username]", "page");
  revalidatePath("/[username]/[slug]", "page");
  revalidatePath("/", "layout");
}

/**
 * Poner (o cambiar) una oferta: cualquier producto que se paga en la web (curso, sesión, círculo, lectura o
 * membresía). Las fechas son días enteros en su zona: empieza a las 00:00 del día de inicio y termina al acabar
 * el día de fin (como en la ficha del producto, lib/offers.ts).
 */
export async function saveOffer(_: OfferState, form: FormData): Promise<OfferState> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const id = String(form.get("productId") ?? "");
  const product = id ? await db.product.findFirst({ where: { id, status: { not: "ARCHIVED" } }, select: { id: true, accessMode: true, priceCents: true } }) : null;
  if (!product) return { error: "Elige lo que quieres poner en oferta" };
  if (product.accessMode !== "PAID") return { error: "Solo se puede poner en oferta lo que se paga en tu web" };
  if (product.priceCents <= 0) return { error: "Ponle antes un precio normal a este producto" };
  const parsed = saleFormSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const sale = checkSaleInput({
    on: true,
    priceCents: product.priceCents,
    salePriceCents: d.salePrice ? parseMoneyToCents(d.salePrice) : null,
    starts: d.saleStart ? zonedTimeToUtc(d.saleStart, 0, creator.timezone) : null,
    ends: d.saleEnd ? zonedTimeToUtc(addDaysToKey(d.saleEnd, 1), 0, creator.timezone) : null,
  });
  if (!sale.ok) return { error: sale.error };
  if (!sale.value) return { error: "Escribe el precio de la oferta" };
  await db.product.update({ where: { id: product.id }, data: { ...sale.value, saleLabel: d.saleLabel?.slice(0, SALE_LABEL_MAX) || null } });
  refresh(product.id);
  translateSoon(creator.id, true);
  return { ok: "Oferta guardada. Ya sale en tu portada, en «Ofertas»." };
}

/** Quitar una oferta: el producto vuelve a su precio normal (el producto no se toca). */
export async function endOffer(form: FormData) {
  const { creator } = await requireCreator();
  const id = String(form.get("id") ?? "");
  const db = tenantDb(creator.id);
  const product = id ? await db.product.findFirst({ where: { id }, select: { id: true } }) : null;
  if (product) {
    await db.product.update({ where: { id: product.id }, data: { salePriceCents: null, saleStartsAt: null, saleEndsAt: null, saleLabel: null } });
    refresh(product.id);
  }
  redirect("/panel/ofertas?quitada=1");
}
