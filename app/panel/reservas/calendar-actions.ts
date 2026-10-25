"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { deleteNatalChart, saveDayNote, saveNatalChart } from "@/lib/calendar-diary";
import { searchCities, type City } from "@/lib/cities";

/** Guarda la nota del diario de un día (vacía = borrarla). Sin revalidar: el calendario ya tiene el texto. */
export async function saveCalendarNote(date: string, body: string): Promise<{ ok: true; savedAt: string | null } | { ok: false; error: string }> {
  const { creator } = await requireCreator();
  const r = await saveDayNote(creator.id, date, body);
  return r.ok ? { ok: true, savedAt: r.savedAt?.toISOString() ?? null } : r;
}

/** Lugar de nacimiento: ciudades que empiezan por lo escrito. */
export async function findBirthCities(query: string): Promise<City[]> {
  await requireCreator();
  return searchCities(String(query ?? "").slice(0, 80));
}

export async function saveMyNatalChart(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { creator } = await requireCreator();
  const r = await saveNatalChart(creator.id, input);
  if (!r.ok) return r;
  revalidatePath("/panel/reservas");
  revalidatePath("/panel/reservas/horario");
  return { ok: true };
}

export async function removeMyNatalChart(): Promise<{ ok: true }> {
  const { creator } = await requireCreator();
  await deleteNatalChart(creator.id);
  revalidatePath("/panel/reservas");
  revalidatePath("/panel/reservas/horario");
  return { ok: true };
}
