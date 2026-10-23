"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { addOrderLink, deleteOrderFile, sendOrderDelivery } from "@/lib/order-files";
import { parseTextFormat } from "@/lib/rich-text";

export type DeliveryState = { ok?: string; error?: string } | undefined;

export async function addDeliveryLink(_: DeliveryState, form: FormData): Promise<DeliveryState> {
  const { creator } = await requireCreator();
  const orderId = String(form.get("orderId") ?? "");
  const r = await addOrderLink({ creatorId: creator.id, orderId, name: String(form.get("name") ?? ""), url: String(form.get("url") ?? "") });
  if (!r.ok) return { error: r.error };
  revalidatePath(`/panel/ventas/${orderId}`);
  return { ok: "Enlace añadido (todavía no se lo hemos enviado)" };
}

export async function removeDeliveryFile(form: FormData) {
  const { creator } = await requireCreator();
  await deleteOrderFile({ creatorId: creator.id, fileId: String(form.get("fileId") ?? "") });
  revalidatePath(`/panel/ventas/${String(form.get("orderId") ?? "")}`);
}

export async function sendDelivery(_: DeliveryState, form: FormData): Promise<DeliveryState> {
  const { creator } = await requireCreator();
  const orderId = String(form.get("orderId") ?? "");
  const r = await sendOrderDelivery({
    creatorId: creator.id,
    orderId,
    message: String(form.get("message") ?? ""),
    messageFormat: parseTextFormat(form.get("messageFormat") ?? undefined) ?? null,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(`/panel/ventas/${orderId}`);
  revalidatePath("/panel/reservas");
  return { ok: r.sent ? "Enviado. Le hemos mandado un email con el enlace." : "No había nada nuevo que enviar." };
}
