"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { cancelBooking, requestReschedule, setBookingMeetingUrl } from "@/lib/booking-changes";
import { asksIntake, parseIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { createManualOrder } from "@/lib/manual-orders";
import { parseMeetingUrl } from "@/lib/meeting-url";
import { canonicalTimezone } from "@/lib/timezones";
import { addDaysToKey, labelToMinutes } from "@/lib/tz";
import { prisma } from "@/lib/db";
import { refundableCents } from "@/lib/refund-math";
import { refundOrder } from "@/lib/refunds";
import { tenantDb } from "@/lib/tenant";

const rulesSchema = z.array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1440), endMinute: z.number().int().min(0).max(1440) })).max(50);

export async function saveAvailability(rules: z.infer<typeof rulesSchema>, timezone: string) {
  const { creator } = await requireCreator();
  const parsed = rulesSchema.safeParse(rules);
  if (!parsed.success) return { ok: false, error: "Horario no válido" };
  if (parsed.data.some((r) => r.endMinute - r.startMinute < 15)) return { ok: false, error: "Cada franja debe durar al menos 15 minutos" };
  const tz = canonicalTimezone(timezone);
  if (!tz) return { ok: false, error: "Zona horaria no válida" };
  const db = tenantDb(creator.id);
  await db.availabilityRule.deleteMany({});
  if (parsed.data.length) await db.availabilityRule.createMany({ data: parsed.data.map((r) => ({ ...r, creatorId: creator.id })) });
  await prisma.creator.update({ where: { id: creator.id }, data: { timezone: tz } });
  revalidatePath("/panel/clientes");
  revalidatePath("/panel/solicitudes/horario");
  return { ok: true };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Días de `from` a `to` (incluidos), como mucho `max`. */
function dayRange(from: string, to: string | null, max: number): string[] | null {
  if (!DATE.test(from) || (to && !DATE.test(to))) return null;
  const end = to && to > from ? to : from;
  const out: string[] = [];
  for (let d = from; d <= end; d = addDaysToKey(d, 1)) {
    out.push(d);
    if (out.length > max) return null;
  }
  return out;
}

export type HorarioState = { ok?: string; error?: string } | undefined;
const MAX_OVERRIDES = 300;

/** «Fechas especiales»: de `from` a `to`, estas franjas (en su zona) sustituyen al horario semanal. */
export async function addSpecialHours(_: HorarioState, form: FormData): Promise<HorarioState> {
  const { creator } = await requireCreator();
  const days = dayRange(String(form.get("from") ?? ""), String(form.get("to") ?? "") || null, 92);
  if (!days) return { error: "Revisa las fechas (como mucho 3 meses seguidos)" };
  const tz = canonicalTimezone(form.get("timezone")) ?? creator.timezone;
  let ranges: { start: string; end: string }[];
  try {
    ranges = z.array(z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).min(1).max(8).parse(JSON.parse(String(form.get("ranges") ?? "[]")));
  } catch {
    return { error: "Añade al menos una franja de horas" };
  }
  const mins = ranges.map((r) => ({ startMinute: labelToMinutes(r.start), endMinute: r.end === "00:00" ? 1440 : labelToMinutes(r.end) }));
  if (mins.some((r) => r.endMinute - r.startMinute < 15)) return { error: "Cada franja debe durar al menos 15 minutos" };
  const note = String(form.get("note") ?? "").trim().slice(0, 80) || null;
  const db = tenantDb(creator.id);
  const today = new Date().toISOString().slice(0, 10);
  if ((await db.availabilityOverride.count({ where: { date: { gte: today } } })) + days.length * mins.length > MAX_OVERRIDES)
    return { error: "Tienes demasiadas fechas especiales: borra alguna antigua" };
  await db.availabilityOverride.deleteMany({ where: { kind: "HOURS", date: { in: days } } });
  await db.availabilityOverride.createMany({ data: days.flatMap((date) => mins.map((m) => ({ creatorId: creator.id, date, kind: "HOURS", timezone: tz, note, ...m }))) });
  revalidatePath("/panel/solicitudes/horario");
  return { ok: days.length === 1 ? "Fecha especial guardada" : `Fechas especiales guardadas (${days.length} días)` };
}

/** «Bloquear unas horas» de un día (médico, un recado…). */
export async function addTimeBlock(_: HorarioState, form: FormData): Promise<HorarioState> {
  const { creator } = await requireCreator();
  const date = String(form.get("date") ?? "");
  const start = String(form.get("start") ?? "");
  const end = String(form.get("end") ?? "");
  if (!DATE.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return { error: "Escribe el día y las horas" };
  const startMinute = labelToMinutes(start);
  const endMinute = end === "00:00" ? 1440 : labelToMinutes(end);
  if (endMinute - startMinute < 15) return { error: "Bloquea al menos 15 minutos" };
  await tenantDb(creator.id).availabilityOverride.create({
    data: { creatorId: creator.id, date, kind: "BLOCK", startMinute, endMinute, timezone: creator.timezone, note: String(form.get("note") ?? "").trim().slice(0, 80) || null },
  });
  revalidatePath("/panel/solicitudes/horario");
  return { ok: "Horas bloqueadas" };
}

export async function removeOverride(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const date = String(form.get("date") ?? "");
  if (form.get("id")) await db.availabilityOverride.deleteMany({ where: { id: String(form.get("id")) } });
  else if (DATE.test(date)) await db.availabilityOverride.deleteMany({ where: { date, kind: String(form.get("kind") ?? "HOURS") } });
  revalidatePath("/panel/solicitudes/horario");
}

export type MeetingState = { ok?: string; error?: string } | undefined;

/** Enlace de Zoom de UNA reserva (vacío = el de la sesión), con aviso opcional a la clienta. */
export async function setMeetingUrl(_: MeetingState, form: FormData): Promise<MeetingState> {
  const { creator } = await requireCreator();
  const parsed = parseMeetingUrl(String(form.get("meetingUrl") ?? ""));
  if (!parsed.ok) return { error: parsed.error };
  const r = await setBookingMeetingUrl({ creatorId: creator.id, bookingId: String(form.get("id") ?? ""), url: parsed.url, notify: form.get("notify") === "on" });
  if (!r.ok) return { error: r.error };
  revalidatePath(`/panel/solicitudes/reserva/${String(form.get("id"))}`);
  return { ok: r.notified ? "Enlace guardado. Le hemos enviado el enlace nuevo por email." : "Enlace guardado." };
}

export type IntakeState = { ok?: string; error?: string } | undefined;

/** La dueña escribe o corrige los datos para la lectura de una clienta (sin email). */
export async function setIntakeByOwner(_: IntakeState, form: FormData): Promise<IntakeState> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const order = await db.order.findFirst({ where: { id: String(form.get("orderId") ?? "") }, include: { product: { select: { intake: true, type: true, deliveryMode: true } } } });
  if (!order) return { error: "Pedido no encontrado" };
  const cfg = readIntakeConfig(order.product.intake);
  // La dueña puede apuntar lo que sepa: nada es obligatorio y los datos de nacimiento siempre se pueden escribir.
  const parsed = parseIntakeAnswers({ birth: "optional", questions: cfg.questions.map((q) => ({ ...q, required: false })) }, Object.fromEntries(form));
  if (!parsed.ok) return { error: parsed.error };
  await db.order.updateMany({
    where: { id: order.id },
    data: { intake: parsed.value ? (parsed.value as unknown as Prisma.InputJsonObject) : Prisma.DbNull, intakeUpdatedAt: new Date() },
  });
  revalidatePath("/panel/clientes");
  revalidatePath(`/panel/ventas/${order.id}`);
  for (const b of await db.booking.findMany({ where: { orderId: order.id }, select: { id: true } })) revalidatePath(`/panel/solicitudes/reserva/${b.id}`);
  return { ok: "Datos guardados" };
}

/** «Borrar datos»: la clienta pide que se borren (RGPD) o ya no hacen falta. */
export async function clearIntake(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const id = String(form.get("orderId") ?? "");
  await db.order.updateMany({ where: { id }, data: { intake: Prisma.DbNull, intakeUpdatedAt: null } });
  revalidatePath(`/panel/ventas/${id}`);
  const back = String(form.get("back") ?? "");
  if (back.startsWith("/panel/")) revalidatePath(back);
}

export type GiveState = { error?: string } | undefined;

const giveSchema = z.object({
  requestId: z.string().min(8).max(64),
  productId: z.string().min(1),
  name: z.string().trim().min(2, "Escribe su nombre").max(80),
  email: z.string().trim().toLowerCase().email("Revisa el email"),
  payment: z.enum(["gift", "paid_elsewhere"]),
  paidNote: z.string().trim().max(120).optional(),
  when: z.enum(["slot", "custom", "later"]).optional(),
  slotStart: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  clientTimezone: z.string().max(64).optional(),
  intakeMode: z.enum(["ask", "write"]).optional(),
  message: z.string().trim().max(1000, "El mensaje es demasiado largo").optional(),
});

/** «Dar una sesión o lectura» (lib/manual-orders.ts). */
export async function giveManually(_: GiveState, form: FormData): Promise<GiveState> {
  const { user, creator } = await requireCreator();
  const parsed = giveSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  const d = parsed.data;
  const product = await tenantDb(creator.id).product.findFirst({ where: { id: d.productId }, select: { intake: true, type: true, deliveryMode: true } });
  if (!product) return { error: "Elige qué le das" };
  let intake = null;
  if (d.intakeMode === "write") {
    const cfg = readIntakeConfig(product.intake);
    if (asksIntake(product.type, product.deliveryMode, cfg)) {
      // Lo que no sepa la dueña, se lo pedimos a la clienta: aquí nada es obligatorio.
      const loose = { birth: cfg.birth === "off" ? ("off" as const) : ("optional" as const), questions: cfg.questions.map((q) => ({ ...q, required: false })) };
      const r = parseIntakeAnswers(loose, Object.fromEntries(form));
      if (!r.ok) return { error: r.error };
      intake = r.value;
    }
  }
  const when =
    d.when === "slot" && d.slotStart
      ? { kind: "slot" as const, start: d.slotStart }
      : d.when === "custom"
        ? { kind: "custom" as const, date: d.date ?? "", time: d.time ?? "" }
        : d.when === "slot"
          ? null
          : { kind: "later" as const };
  if (!when) return { error: "Elige una hora de tu agenda" };
  const r = await createManualOrder({
    creatorId: creator.id,
    grantedByUserId: user.id,
    productId: d.productId,
    name: d.name,
    email: d.email,
    payment: d.payment,
    paidNote: d.paidNote,
    when,
    clientTimezone: d.clientTimezone,
    intake,
    message: d.message,
    requestId: d.requestId,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath("/panel/clientes");
  if (r.bookingId) redirect(`/panel/solicitudes/reserva/${r.bookingId}?ok=dada`);
  redirect(`/panel/ventas/${r.orderId}?ok=dada#entrega`);
}

export async function addBlockedDate(form: FormData) {
  const { creator } = await requireCreator();
  // Un día o un rango (vacaciones), como mucho 92 días.
  const days = dayRange(String(form.get("date") ?? ""), String(form.get("to") ?? "") || null, 92);
  if (!days) return;
  const reason = String(form.get("reason") ?? "").slice(0, 80) || null;
  await tenantDb(creator.id).blockedDate.createMany({ data: days.map((date) => ({ creatorId: creator.id, date, reason })), skipDuplicates: true });
  revalidatePath("/panel/clientes");
  revalidatePath("/panel/solicitudes/horario");
}

export async function removeBlockedDate(form: FormData) {
  const { creator } = await requireCreator();
  await tenantDb(creator.id).blockedDate.deleteMany({ where: { id: String(form.get("id")) } });
  revalidatePath("/panel/clientes");
  revalidatePath("/panel/solicitudes/horario");
}

export type ChangeState = { error?: string } | undefined;

const changeSchema = z.object({
  id: z.string().min(1),
  intent: z.enum(["reschedule", "cancel_refund", "cancel_only"]),
  note: z.string().trim().max(500, "El mensaje es demasiado largo (máx. 500 caracteres)").optional(),
  reason: z.string().trim().max(500, "El motivo es demasiado largo (máx. 500 caracteres)").optional(),
});

/**
 * «Cambiar o cancelar» una sesión (/panel/solicitudes/reserva/[id]):
 *   · reschedule: libera el hueco y la clienta elige otra fecha (el pago se mantiene);
 *   · cancel_refund: cancela y devuelve todo lo que queda del pago;
 *   · cancel_only: cancela sin devolver, con un motivo que verá la clienta.
 */
export async function changeBooking(_: ChangeState, form: FormData): Promise<ChangeState> {
  const { user, creator } = await requireCreator();
  const parsed = changeSchema.safeParse({
    id: form.get("id"),
    intent: form.get("intent"),
    note: form.get("note") ?? undefined,
    reason: form.get("reason") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  const { id, intent } = parsed.data;
  const note = parsed.data.note || null;
  const db = tenantDb(creator.id);
  const booking = await db.booking.findFirst({ where: { id }, include: { order: { include: { refunds: { select: { status: true, amountCents: true } } } } } });
  if (!booking) return { error: "Reserva no encontrada" };

  let ok: string;
  if (intent === "reschedule") {
    const r = await requestReschedule({ creatorId: creator.id, bookingId: id, note });
    if (!r.ok) return { error: r.error };
    ok = "propuesta";
  } else if (intent === "cancel_refund") {
    const o = booking.order;
    const reserved = o?.refunds.filter((r) => r.status !== "FAILED").reduce((a, r) => a + r.amountCents, 0) ?? 0;
    if (!o || o.status !== "PAID" || !o.paymentRef || refundableCents({ amountCents: o.amountCents, reservedCents: reserved }) <= 0)
      return { error: "Esta sesión no tiene un pago que reembolsar. Usa «Cancelar sin reembolso»." };
    if (booking.status !== "CONFIRMED" && booking.status !== "PENDING_SCHEDULE") return { error: "Esta sesión ya no se puede cancelar" };
    const r = await refundOrder({
      orderId: o.id,
      actor: { kind: "creator", creatorId: creator.id, userId: user.id },
      reason: "SESSION_CANCELLED",
      note,
      revokeAccess: true,
      cancelBooking: true,
    });
    if (!r.ok) return { error: r.error };
    ok = r.status === "SUCCEEDED" ? "reembolsada" : "reembolso_en_curso";
  } else {
    const reason = parsed.data.reason ?? "";
    if (reason.length < 5) return { error: "Explica el motivo: lo verá tu clienta" };
    const r = await cancelBooking({ creatorId: creator.id, bookingId: id, by: "CREATOR", reason, notify: true });
    if (!r.ok) return { error: r.error };
    ok = "cancelada";
  }
  revalidatePath("/panel/clientes");
  revalidatePath("/panel/ventas");
  redirect(`/panel/solicitudes/reserva/${id}?ok=${ok}`);
}

/** «Ya la envié»: la lectura «Lo preparo yo» se envía por email (la web no guarda el material). */
export async function markReadingSent(form: FormData) {
  const { creator } = await requireCreator();
  const orderId = String(form.get("orderId") ?? "");
  await tenantDb(creator.id).order.updateMany({ where: { id: orderId, status: "PAID", productType: "DIGITAL", deliveredAt: null }, data: { deliveredAt: new Date() } });
  revalidatePath("/panel/clientes", "layout");
}

/** Desmarcar una lectura ya hecha (Personas › Lecturas › Hechas): vuelve a la lista por enviar. */
export async function unmarkReadingSent(form: FormData) {
  const { creator } = await requireCreator();
  const orderId = String(form.get("orderId") ?? "");
  await tenantDb(creator.id).order.updateMany({ where: { id: orderId, productType: "DIGITAL", deliveredAt: { not: null } }, data: { deliveredAt: null } });
  revalidatePath("/panel/clientes", "layout");
}
