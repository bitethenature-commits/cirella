"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setSetting } from "@/lib/settings";
import { requireNewsletterOwner } from "../guard";

const schema = z.object({ cap: z.coerce.number().int().min(0).max(100_000), reserve: z.coerce.number().int().min(0).max(10_000) });

/** Límite diario y reserva (ajustes de la web: solo quien la administra, que en la web personal es ella). */
export async function saveSendingLimits(form: FormData) {
  const { user } = await requireNewsletterOwner();
  if (!user.isAdmin) return;
  const p = schema.safeParse({ cap: form.get("cap"), reserve: form.get("reserve") });
  if (!p.success) return;
  await setSetting("emailDailyCap", p.data.cap);
  await setSetting("emailTransactionalReserve", Math.min(p.data.reserve, p.data.cap || p.data.reserve));
  revalidatePath("/panel/newsletter/ajustes");
}
