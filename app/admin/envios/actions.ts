"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { discardEmail, retryEmail } from "@/lib/email/outbox";
import { retryEvent } from "@/lib/events";

const Form = z.object({
  id: z.string().min(1).max(40),
  ver: z.enum(["fallidos", "reintentando", "eventos"]).catch("fallidos"),
});

function parse(form: FormData) {
  return Form.parse({ id: form.get("id"), ver: form.get("ver") });
}

function done(ver: string, changed: boolean, msg: string) {
  revalidatePath("/admin", "layout");
  redirect(`/admin/envios?ver=${ver}&ok=${encodeURIComponent(changed ? msg : "Este envío ya no estaba pendiente")}`);
}

export async function retryEmailAction(form: FormData) {
  await requireAdmin();
  const { id, ver } = parse(form);
  done(ver, await retryEmail(id), "Reintento lanzado");
}

export async function discardEmailAction(form: FormData) {
  await requireAdmin();
  const { id, ver } = parse(form);
  done(ver, await discardEmail(id), "Envío descartado");
}

export async function retryEventAction(form: FormData) {
  await requireAdmin();
  const { id, ver } = parse(form);
  done(ver, await retryEvent(id), "Evento reprocesado");
}
