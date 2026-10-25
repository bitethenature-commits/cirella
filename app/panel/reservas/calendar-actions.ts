"use server";

import { requireCreator } from "@/lib/auth";
import { saveDayNote } from "@/lib/calendar-diary";

/** Guarda la nota del diario de un día (vacía = borrarla). Sin revalidar: el calendario ya tiene el texto. */
export async function saveCalendarNote(date: string, body: string): Promise<{ ok: true; savedAt: string | null } | { ok: false; error: string }> {
  const { creator } = await requireCreator();
  const r = await saveDayNote(creator.id, date, body);
  return r.ok ? { ok: true, savedAt: r.savedAt?.toISOString() ?? null } : r;
}
