import type { Prisma, Product } from "@prisma/client";
import { isNoChargeOrder } from "./access-mode";
import { prisma } from "./db";
import { getBusyIntervals } from "./calendar";
import { isPersonalMode } from "./site-mode";
import { computeSlots, groupSlotsByDay, HORIZON_MAX_DAYS, horizonEnd, horizonOf, type DaySlots, type Interval } from "./slots";
import { followsDay15Rule, startAfterDays, PAID_SESSION_SHORT_NOTICE_HOURS, paidSessionHorizon, paidSessionNoticeDays } from "./withdrawal";
import { addDaysToKey, dateKeyInTz } from "./tz";

export type { DaySlots } from "./slots";

export type SessionProduct = Pick<Product, "id" | "creatorId" | "durationMin" | "bufferMin" | "minNoticeHours"> &
  Partial<Pick<Product, "horizonDays" | "groupSession" | "accessMode">>;

/**
 * Regla de los huecos de una sesión:
 *   · purchaseAt: fecha de la compra desde la que cuenta el día 15 (por defecto «ahora», quien está
 *     comprando). Al elegir o cambiar la fecha después de pagar, la del pago del pedido.
 *   · manual: la dueña da la sesión a mano («Dar una sesión o lectura») o la clienta elige la fecha
 *     de una que se le dio así: sin regla del día 15, con la antelación de siempre (24 h).
 */
export type SlotRule = { purchaseAt?: Date; manual?: boolean };

/**
 * Regla para elegir o cambiar la fecha de una reserva ya hecha (también tras «Proponer otra fecha»):
 * el día 15 cuenta desde el pago de SU pedido; una sesión dada a mano (pedido sin cobro) no la sigue.
 */
export function slotRuleForOrder(order: { paymentProvider: string; paidAt: Date | null; createdAt: Date } | null | undefined): SlotRule {
  if (!order) return {};
  return isNoChargeOrder(order) ? { manual: true } : { purchaseAt: order.paidAt ?? order.createdAt };
}

/** Antelación, días y horizonte de los huecos de una sesión según la regla del día 15 (lib/withdrawal.ts). */
export function slotNotice(product: SessionProduct, rule: SlotRule = {}): { minNoticeHours: number; minNoticeDays?: number; horizonDays: number } {
  const horizon = horizonOf(product);
  const paidWeb = followsDay15Rule({ type: "SESSION", groupSession: product.groupSession, accessMode: product.accessMode });
  if (paidWeb && !rule.manual) {
    const days = paidSessionNoticeDays(product);
    return { minNoticeHours: PAID_SESSION_SHORT_NOTICE_HOURS, minNoticeDays: days, horizonDays: Math.min(HORIZON_MAX_DAYS, paidSessionHorizon(horizon, days)) };
  }
  // A mano la dueña elige en su agenda: como mucho la antelación de siempre (24 h), aunque la de la
  // sesión de pago sea de días.
  const own = product.minNoticeHours ?? SESSION_DEFAULTS.minNoticeHours;
  const hours = rule.manual ? Math.min(own, SESSION_DEFAULTS.minNoticeHours) : own;
  return { minNoticeHours: hours, horizonDays: horizon };
}

/** Cliente con el que se leen los huecos: `prisma` o el de una transacción. */
export type SlotsClient = Pick<Prisma.TransactionClient, "creator" | "availabilityRule" | "blockedDate" | "availabilityOverride" | "booking" | "order" | "product">;

export const SESSION_DEFAULTS = { durationMin: 60, bufferMin: 15, minNoticeHours: 24, horizonDays: 28 };

/** ¿Es un taller en directo (sesión para varias personas con fecha fija)? */
export function isGroupSession(p: { type: string; groupSession?: boolean | null }) {
  return p.type === "SESSION" && !!p.groupSession;
}

/**
 * Pago en curso que guarda un hueco (solo en la web personal): mientras la compradora está en la página
 * de Stripe o PayPal, nadie más puede pagar esa hora. Se suelta solo si el pago falla (FAILED), si la
 * página de pago caduca (checkoutExpiresAt) o si el pedido se abandona. Un pedido recién creado que aún
 * no ha llegado a la pasarela guarda la hora unos minutos.
 */
export const HOLD_BEFORE_CHECKOUT_MIN = 15;
/** Un pago «pendiente de confirmar» (PROCESSING) guarda la hora como mucho un día. */
const HOLD_PROCESSING_MS = 24 * 3600_000;

export function holdWhere(now: Date): Prisma.OrderWhereInput {
  return {
    productType: "SESSION",
    OR: [
      { status: "PENDING", checkoutExpiresAt: { gt: now } },
      { status: "PENDING", checkoutExpiresAt: null, createdAt: { gt: new Date(now.getTime() - HOLD_BEFORE_CHECKOUT_MIN * 60000) } },
      { status: "PROCESSING", createdAt: { gt: new Date(now.getTime() - HOLD_PROCESSING_MS) } },
    ],
  };
}

/** Horas guardadas por pagos en curso de esta creadora (de sesiones 1:1). */
async function heldIntervals(db: Pick<SlotsClient, "order">, creatorId: string, now: Date, ignoreOrderId?: string): Promise<Interval[]> {
  const orders = await db.order.findMany({
    where: { creatorId, ...holdWhere(now), ...(ignoreOrderId ? { NOT: { id: ignoreOrderId } } : {}) },
    select: { metadata: true, product: { select: { durationMin: true, groupSession: true } } },
  });
  const out: Interval[] = [];
  for (const o of orders) {
    const slot = (o.metadata as { slotStart?: string } | null)?.slotStart;
    if (!slot || o.product.groupSession) continue;
    const start = Date.parse(slot);
    if (Number.isNaN(start)) continue;
    out.push({ start, end: start + (o.product.durationMin ?? SESSION_DEFAULTS.durationMin) * 60000 });
  }
  return out;
}

/** Talleres de la creadora (con fecha y sin archivar) que tocan [from, to): ocupan su agenda 1:1. */
export async function workshopIntervals(db: Pick<SlotsClient, "product">, creatorId: string, from: Date, to: Date, excludeProductId?: string): Promise<Interval[]> {
  const rows = await db.product.findMany({
    where: {
      creatorId,
      type: "SESSION",
      groupSession: true,
      status: { not: "ARCHIVED" },
      eventStartAt: { gte: new Date(from.getTime() - 86400_000), lt: to },
      ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
    },
    select: { eventStartAt: true, durationMin: true },
  });
  return rows.map((r) => ({ start: r.eventStartAt!.getTime(), end: r.eventStartAt!.getTime() + (r.durationMin ?? SESSION_DEFAULTS.durationMin) * 60000 }));
}

/**
 * Datos y cálculo de los huecos de una sesión. `holds` (por defecto, en la web personal) descuenta las
 * horas de los pagos en curso de otras compradoras; `ignoreOrderId` es el pedido de quien mira (su
 * propio pago en curso no le quita su hora).
 */
async function slotStarts(
  product: SessionProduct,
  opts: { now?: Date; client?: SlotsClient; ignoreOrderId?: string; holds?: boolean; noticeFrom?: Date } & SlotRule,
) {
  const now = opts.now ?? new Date();
  const db = opts.client ?? prisma;
  const creator = await db.creator.findUniqueOrThrow({
    where: { id: product.creatorId },
    select: { timezone: true, calendarProvider: true, calendarAccountId: true },
  });
  const tz = creator.timezone;
  const notice = slotNotice(product, opts);
  const horizonDays = notice.horizonDays;
  const durationMin = product.durationMin ?? SESSION_DEFAULTS.durationMin;
  // Primera hora posible por la regla del día 15 (null si no se aplica).
  const notBefore = notice.minNoticeDays ? startAfterDays(opts.purchaseAt ?? now, notice.minNoticeDays, tz) : null;
  if (product.groupSession) return { tz, durationMin, horizonDays, notBefore: null, starts: [] as string[] };
  const end = new Date(horizonEnd(now, tz, horizonDays));
  const from = new Date(now.getTime() - 86400_000);
  const todayKey = dateKeyInTz(now, tz);
  const holds = opts.holds ?? isPersonalMode();
  const [rules, blocked, overrides, bookings, workshops, held, external] = await Promise.all([
    db.availabilityRule.findMany({ where: { creatorId: product.creatorId } }),
    db.blockedDate.findMany({ where: { creatorId: product.creatorId } }),
    db.availabilityOverride.findMany({
      where: { creatorId: product.creatorId, date: { gte: addDaysToKey(todayKey, -1), lte: addDaysToKey(todayKey, horizonDays + 1) } },
    }),
    db.booking.findMany({
      where: { creatorId: product.creatorId, status: "CONFIRMED", groupSeat: false, startAt: { gte: from, lte: end } },
      select: { startAt: true, endAt: true },
    }),
    workshopIntervals(db, product.creatorId, from, end),
    holds ? heldIntervals(db, product.creatorId, now, opts.ignoreOrderId) : Promise.resolve([]),
    getBusyIntervals(creator, now, end),
  ]);
  const busy: Interval[] = [
    ...bookings.filter((b) => b.startAt && b.endAt).map((b) => ({ start: b.startAt!.getTime(), end: b.endAt!.getTime() })),
    ...workshops,
    ...held,
    ...external.map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })),
  ];
  const starts = computeSlots({
    now,
    timezone: tz,
    durationMin,
    bufferMin: product.bufferMin ?? SESSION_DEFAULTS.bufferMin,
    minNoticeHours: notice.minNoticeHours,
    minNoticeDays: notice.minNoticeDays,
    firstDayFrom: opts.purchaseAt ?? now,
    horizonDays,
    rules,
    blockedDates: blocked.map((b) => b.date),
    overrides,
    busy,
    noticeFrom: opts.noticeFrom,
  });
  return { tz, durationMin, horizonDays, notBefore, starts };
}

/**
 * Huecos disponibles de una sesión, agrupados por día en la zona de quien mira (`viewerTz`, por
 * defecto la de la dueña). Un taller tiene fecha fija: no tiene huecos.
 */
export async function getAvailableSlots(
  product: SessionProduct,
  opts: { now?: Date; client?: SlotsClient; viewerTz?: string | null; ignoreOrderId?: string; holds?: boolean } & SlotRule = {},
) {
  const now = opts.now ?? new Date();
  const r = await slotStarts(product, { ...opts, now });
  const viewer = opts.viewerTz || r.tz;
  return {
    timezone: viewer,
    ownerTimezone: r.tz,
    durationMin: r.durationMin,
    horizonDays: r.horizonDays,
    range: { from: dateKeyInTz(now, viewer), to: dateKeyInTz(new Date(horizonEnd(now, r.tz, r.horizonDays) - 1), viewer) },
    /** Sesión pagada en la web: nada antes de esta hora (día 15 desde la compra). */
    notBefore: r.notBefore ? r.notBefore.toISOString() : null,
    days: groupSlotsByDay(r.starts, viewer),
  };
}

/**
 * ¿Sigue ofreciéndose ese hueco? Con `client` = la transacción, se lee bajo su cerrojo. Mismo cálculo
 * (y mismo horizonte) que la lista de huecos. `noticeFrom`: ver SlotInput.
 */
export async function isSlotAvailable(
  product: SessionProduct,
  startIso: string,
  opts: { now?: Date; client?: SlotsClient; ignoreOrderId?: string; holds?: boolean; noticeFrom?: Date } & SlotRule = {},
) {
  const t = Date.parse(startIso);
  if (Number.isNaN(t)) return false;
  const { starts } = await slotStarts(product, opts);
  return starts.some((s) => Date.parse(s) === t);
}

type BookingClient = Pick<Prisma.TransactionClient, "booking" | "product" | "$executeRaw">;

/**
 * Cerrojo de reservas de una creadora: dura hasta el final de la transacción en curso,
 * así que dos compras o reprogramaciones simultáneas de la misma creadora se comprueban
 * y se escriben una detrás de otra. Las de creadoras distintas no se esperan entre sí.
 * Tomarlo dos veces en la misma transacción no bloquea (es reentrante).
 */
export async function lockCreatorBookings(client: Pick<Prisma.TransactionClient, "$executeRaw">, creatorId: string) {
  // $executeRaw y no $queryRaw: pg_advisory_xact_lock devuelve void, que $queryRaw no sabe leer.
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking:${creatorId}`}, 0))`;
}

/** Cerrojo de las plazas de un taller (hasta el final de la transacción): las compras se cuentan de una en una. */
export async function lockProductSeats(client: Pick<Prisma.TransactionClient, "$executeRaw">, productId: string) {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`seats:${productId}`}, 0))`;
}

/**
 * ¿Choca [start, end) (± margen) con otra reserva confirmada de la creadora o con uno de sus talleres?
 *
 * Toma el cerrojo de reservas de la creadora (lockCreatorBookings), que dura hasta el final
 * de la transacción: dos compras o reprogramaciones simultáneas se comprueban una detrás de
 * otra. Llamar siempre dentro de prisma.$transaction y antes de escribir la reserva.
 */
export async function hasBookingClash(
  client: BookingClient,
  creatorId: string,
  start: Date,
  end: Date,
  bufferMin: number,
  excludeBookingId?: string,
) {
  await lockCreatorBookings(client, creatorId);
  const buf = bufferMin * 60000;
  const clash = await client.booking.findFirst({
    where: {
      creatorId,
      status: "CONFIRMED",
      groupSeat: false,
      startAt: { lt: new Date(end.getTime() + buf) },
      endAt: { gt: new Date(start.getTime() - buf) },
      ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
    },
    select: { id: true },
  });
  if (clash) return true;
  const workshops = await workshopIntervals(client, creatorId, new Date(start.getTime() - buf), new Date(end.getTime() + buf));
  return workshops.some((w) => start.getTime() < w.end + buf && end.getTime() + buf > w.start);
}

/**
 * Plazas ocupadas de un taller: las confirmadas (y las de un taller ya celebrado) y, con `holds` (por
 * defecto en la web personal), los pagos en curso de otras compradoras.
 */
export async function seatsTaken(client: Pick<Prisma.TransactionClient, "booking" | "order">, productId: string, opts: { ignoreOrderId?: string; holds?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const [seats, held] = await Promise.all([
    client.booking.count({ where: { productId, groupSeat: true, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    (opts.holds ?? isPersonalMode())
      ? client.order.count({ where: { productId, ...holdWhere(now), ...(opts.ignoreOrderId ? { NOT: { id: opts.ignoreOrderId } } : {}) } })
      : Promise.resolve(0),
  ]);
  return seats + held;
}

/**
 * ¿El error viene de la regla Booking_no_overlap de la base de datos? Es la última red de
 * seguridad (dos reservas CONFIRMED solapadas de la misma creadora): si salta, la transacción
 * ya está anulada y quien llama decide qué hacer (p. ej. dejar la reserva pendiente de fecha).
 */
export function isBookingOverlapError(e: unknown) {
  return e instanceof Error && /23P01|Booking_no_overlap/.test(e.message);
}
