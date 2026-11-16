"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { AUTOMATIONS, type AutomationTrigger } from "@/lib/automations";
import { DELAY_FIELDS } from "@/lib/automation-catalog";
import { planFeatures } from "@/lib/plans";
import { cleanRichInput, formatToStore, normalizeNewlines, parseTextFormat } from "@/lib/rich-text";
import { tenantDb } from "@/lib/tenant";

export async function saveAutomation(form: FormData) {
  const { creator } = await requireCreator();
  const trigger = z.enum(Object.keys(AUTOMATIONS) as [AutomationTrigger, ...AutomationTrigger[]]).parse(form.get("trigger"));
  if (!planFeatures(creator.plan).automations) return;
  const meta = AUTOMATIONS[trigger];
  const db = tenantDb(creator.id);
  const row = await db.automation.findFirst({ where: { trigger } });
  const message = normalizeNewlines(String(form.get("message") ?? "")).trim().slice(0, 2000) || null;
  // Formato del mensaje (lib/rich-text.ts): sin tocar el texto llega el que tenía; sin campo, se conserva.
  const messageFormat = formatToStore(message, parseTextFormat(form.get("messageFormat") ?? undefined), row?.messageFormat ?? null);
  const data = {
    enabled: meta.essential ? true : form.get("enabled") === "on",
    delayMinutes: delayFrom(trigger, form.get("delay"), row?.delayMinutes ?? meta.defaultDelay),
    // El asunto y el mensaje se escriben en el editor del email (web personal): sin campo, se conservan.
    subject: form.has("subject") ? String(form.get("subject") ?? "").trim().slice(0, 150) || null : (row?.subject ?? null),
    message: form.has("message") ? (message && messageFormat ? cleanRichInput(message, { creatorId: creator.id, images: false }) : message) : (row?.message ?? null),
    messageFormat: form.has("message") ? messageFormat : (row?.messageFormat ?? null),
  };
  await db.automation.upsert({
    where: { creatorId_trigger: { creatorId: creator.id, trigger } },
    create: { creatorId: creator.id, trigger, ...data },
    update: data,
  });
  revalidatePath("/panel/automatizaciones");
}

/** El «cuándo» del formulario (en su unidad: minutos, horas o días) a minutos, dentro de sus límites. */
function delayFrom(trigger: AutomationTrigger, raw: FormDataEntryValue | null, current: number) {
  const f = DELAY_FIELDS[trigger];
  if (!f || raw === null || String(raw).trim() === "") return current;
  const n = Number(raw);
  if (!Number.isFinite(n)) return current;
  return Math.round(Math.max(f.min, Math.min(f.max, n)) * f.unit);
}
