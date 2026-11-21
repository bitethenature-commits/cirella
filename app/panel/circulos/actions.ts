"use server";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { saveCirclePackPrice } from "@/lib/circle-pack";
import { parseMoneyToCents } from "@/lib/money";

/** Precio del «Círculo completo» (vacío = la suma de los dos círculos). */
export async function saveCirclePack(form: FormData) {
  const { creator } = await requireCreator();
  const raw = String(form.get("price") ?? "").trim();
  await saveCirclePackPrice(creator.id, raw ? parseMoneyToCents(raw) : null);
  revalidatePath("/panel/circulos");
  revalidatePath("/cuenta/sesiones");
}
