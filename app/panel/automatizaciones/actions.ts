"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { AUTOMATIONS, type AutomationTrigger } from "@/lib/automations";
import { planFeatures } from "@/lib/plans";
import { tenantDb } from "@/lib/tenant";

export async function saveAutomation(form: FormData) {
  const { creator } = await requireCreator();
  const trigger = z.enum(Object.keys(AUTOMATIONS) as [AutomationTrigger, ...AutomationTrigger[]]).parse(form.get("trigger"));
  if (!planFeatures(creator.plan).automations) return;
  const meta = AUTOMATIONS[trigger];
  const data = {
    enabled: meta.essential ? true : form.get("enabled") === "on",
    delayMinutes: Math.max(0, Math.min(60 * 24 * 14, Number(form.get("delayMinutes") ?? meta.defaultDelay) || 0)),
    subject: String(form.get("subject") ?? "").trim().slice(0, 150) || null,
    message: String(form.get("message") ?? "").trim().slice(0, 2000) || null,
  };
  await tenantDb(creator.id).automation.upsert({
    where: { creatorId_trigger: { creatorId: creator.id, trigger } },
    create: { creatorId: creator.id, trigger, ...data },
    update: data,
  });
  revalidatePath("/panel/automatizaciones");
}
