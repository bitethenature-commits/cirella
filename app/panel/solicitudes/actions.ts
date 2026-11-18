"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { deleteBookingHard, deleteOrderHard } from "@/lib/hard-delete";
import { clearRequestSlot, confirmRequest, declineRequest, reopenRequest, RequestError, rescheduleRequest } from "@/lib/requests";

const back = (q: Record<string, string>) => redirect(`/panel/solicitudes?${new URLSearchParams(q)}`);

async function run(fn: (creatorId: string, orderId: string) => Promise<string>, form: FormData) {
  const { creator } = await requireCreator();
  const orderId = String(form.get("orderId") ?? "");
  let ok: string;
  try {
    ok = await fn(creator.id, orderId);
  } catch (e) {
    if (e instanceof RequestError) back({ error: e.message });
    throw e;
  }
  revalidatePath("/panel/solicitudes");
  revalidatePath("/panel", "layout");
  back({ ok: ok! });
}

export async function confirmRequestAction(form: FormData) {
  await run(async (creatorId, orderId) => {
    const r = await confirmRequest(creatorId, orderId);
    if (r.productType === "SESSION")
      return r.bookingStatus === "CONFIRMED"
        ? "Confirmada: la reserva está hecha y le hemos enviado el email con los detalles."
        : "Confirmada. Esa hora ya no estaba libre: la reserva queda pendiente de fecha y ella la elige desde su área (o cámbiala tú en Solicitudes).";
    return "Confirmada: ya tiene el acceso y le hemos enviado el email para entrar.";
  }, form);
}

export async function rescheduleRequestAction(form: FormData) {
  await run(async (creatorId, orderId) => {
    await rescheduleRequest(creatorId, orderId, String(form.get("date") ?? ""), String(form.get("time") ?? ""));
    return "Día y hora cambiados. Cuéntaselo en tu email y confirma cuando esté todo.";
  }, form);
}

export async function clearRequestSlotAction(form: FormData) {
  await run(async (creatorId, orderId) => {
    await clearRequestSlot(creatorId, orderId);
    return "Hora quitada: al confirmar, ella elegirá la fecha desde su área.";
  }, form);
}

export async function declineRequestAction(form: FormData) {
  await run(async (creatorId, orderId) => {
    await declineRequest(creatorId, orderId);
    return "Solicitud descartada. Su hora vuelve a estar libre.";
  }, form);
}

export async function reopenRequestAction(form: FormData) {
  await run(async (creatorId, orderId) => {
    await reopenRequest(creatorId, orderId);
    return "Solicitud recuperada.";
  }, form);
}

/** «Borrar» una solicitud o una lectura: se va con su reserva y su acceso. No se puede deshacer. */
export async function deleteRequestAction(form: FormData) {
  const { creator } = await requireCreator();
  await deleteOrderHard(creator.id, String(form.get("id") ?? ""));
  for (const p of ["/panel/solicitudes", "/panel/ventas", "/panel/clientes"]) revalidatePath(p);
  revalidatePath("/panel", "layout");
  back({ ok: "Borrada." });
}

/** «Borrar» una reserva (con su venta, si la tiene): su hora vuelve a quedar libre. No se puede deshacer. */
export async function deleteBookingAction(form: FormData) {
  const { creator } = await requireCreator();
  await deleteBookingHard(creator.id, String(form.get("id") ?? ""));
  for (const p of ["/panel/solicitudes", "/panel/ventas", "/panel/clientes"]) revalidatePath(p);
  revalidatePath("/panel", "layout");
  back({ ok: "Reserva borrada." });
}
