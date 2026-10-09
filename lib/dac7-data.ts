import type { Creator } from "@prisma/client";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { dac7RequestEmail } from "./email/templates";
import {
  aggregateDac7,
  dac7Deadline,
  dac7Missing,
  dac7ReminderDue,
  DAC7_TZ,
  isDac7Blocked,
  yearOf,
  type Dac7Aggregate,
  type Dac7CreatorFields,
  type Dac7Row,
} from "./dac7";
import { getSettings } from "./settings";
import { tenantDb } from "./tenant";

/**
 * DAC7 con datos: movimientos del libro por vendedora, recordatorios y la pausa de ventas.
 * La lógica (trimestres, IBAN, qué falta) está en lib/dac7.ts.
 */

const DAY_MS = 86_400_000;

/** Márgenes de un día a cada lado: el año se recorta luego en hora de España. */
function yearWindow(year: number) {
  return { gte: new Date(Date.UTC(year, 0, 1) - DAY_MS), lt: new Date(Date.UTC(year + 1, 0, 1) + DAY_MS) };
}

type LedgerRow = {
  creatorId: string;
  type: string;
  createdAt: Date;
  amountCents: number;
  platformFeeCents: number;
  netCents: number;
  order: { productType: string } | null;
};

const LEDGER_SELECT = {
  creatorId: true,
  type: true,
  createdAt: true,
  amountCents: true,
  platformFeeCents: true,
  netCents: true,
  order: { select: { productType: true } },
} as const;

/** Cobros, renovaciones (membresías) y reembolsos del libro → filas DAC7. */
function toRows(ledger: LedgerRow[]): Dac7Row[] {
  return ledger.map((t) => ({
    kind: t.type === "REFUND" ? "REFUND" : "CHARGE",
    at: t.createdAt,
    productType: t.type === "RENEWAL" ? "MEMBERSHIP" : (t.order?.productType ?? "OTHER"),
    amountCents: t.amountCents,
    platformFeeCents: t.platformFeeCents,
    netCents: t.netCents,
  }));
}

const ledgerWhere = (year: number) => ({ type: { in: ["CHARGE", "RENEWAL", "REFUND"] }, status: "SUCCEEDED", createdAt: yearWindow(year) });

export type Dac7ReportRow = { creator: Creator; missing: string[]; agg: Dac7Aggregate };

/** Informe de la plataforma (admin): cada vendedora con actividad declarable en el año. */
export async function dac7Report(year: number): Promise<Dac7ReportRow[]> {
  const { dac7ReportableTypes } = await getSettings();
  const ledger = await prisma.transaction.findMany({ where: ledgerWhere(year), select: LEDGER_SELECT });
  const byCreator = new Map<string, LedgerRow[]>();
  for (const t of ledger) byCreator.set(t.creatorId, [...(byCreator.get(t.creatorId) ?? []), t]);
  const out: Dac7ReportRow[] = [];
  const creators = await prisma.creator.findMany({ where: { id: { in: [...byCreator.keys()] } }, orderBy: { displayName: "asc" } });
  for (const creator of creators) {
    const agg = aggregateDac7(toRows(byCreator.get(creator.id)!), year, dac7ReportableTypes);
    if (!agg.total.activities && !agg.total.considerationCents) continue;
    out.push({ creator, missing: dac7Missing(creator), agg });
  }
  return out;
}

/** Lo que Cirella declarará de una creadora (su panel). Solo lee sus propios movimientos. */
export async function dac7ForCreator(creatorId: string, year: number) {
  const { dac7ReportableTypes } = await getSettings();
  const ledger = await tenantDb(creatorId).transaction.findMany({ where: ledgerWhere(year), select: LEDGER_SELECT });
  const agg = aggregateDac7(toRows(ledger), year, dac7ReportableTypes);
  return { agg, reportableTypes: dac7ReportableTypes, hasActivity: agg.total.activities > 0 || agg.total.considerationCents !== 0 };
}

type Dac7Creator = Dac7CreatorFields & { dac7RequestedAt: Date | null; dac7RemindersSent: number };

/** ¿Están pausadas las ventas de este tipo de producto por faltar los datos de DAC7? */
export async function dac7SalesPaused(creator: Dac7Creator, productType: string, now = new Date()) {
  const missing = dac7Missing(creator);
  if (!missing.length) return false;
  const { dac7ReportableTypes } = await getSettings();
  return dac7ReportableTypes.includes(productType) && isDac7Blocked(creator, missing, now);
}

/**
 * Cron diario (va en /api/cron): pide los datos fiscales a quien ha vendido algo declarable este
 * año y no los tiene completos, y le recuerda a los 20 y a los 40 días. Los cambios son UPDATE
 * condicionales y los emails llevan dedupeKey, así que dos ejecuciones a la vez envían uno.
 * Devuelve cuántos emails se han puesto en cola.
 */
export async function processDac7Reminders(now = new Date()): Promise<number> {
  const year = yearOf(now, DAC7_TZ);
  const { dac7ReportableTypes } = await getSettings();
  const sellers = await prisma.order.groupBy({
    by: ["creatorId"],
    where: { status: "PAID", productType: { in: dac7ReportableTypes }, paidAt: yearWindow(year) },
  });
  if (!sellers.length) return 0;
  const creators = await prisma.creator.findMany({
    where: { id: { in: sellers.map((s) => s.creatorId) }, status: "ACTIVE" },
    include: { user: { select: { email: true } } },
  });
  let sent = 0;
  for (const c of creators) {
    if (!dac7Missing(c).length) continue;
    let reminder: number | null = null;
    let requestedAt = c.dac7RequestedAt;
    if (!c.dac7RequestedAt) {
      const r = await prisma.creator.updateMany({ where: { id: c.id, dac7RequestedAt: null }, data: { dac7RequestedAt: now } });
      if (r.count) {
        reminder = 0;
        requestedAt = now;
      }
    } else if (dac7ReminderDue(c, now)) {
      const r = await prisma.creator.updateMany({
        where: { id: c.id, dac7RemindersSent: c.dac7RemindersSent },
        data: { dac7RemindersSent: c.dac7RemindersSent + 1, dac7LastReminderAt: now },
      });
      if (r.count) reminder = c.dac7RemindersSent + 1;
    }
    if (reminder === null || !requestedAt) continue;
    await enqueueEmail({
      to: c.user.email,
      creatorId: c.id,
      userId: c.userId,
      fromName: null,
      replyTo: null,
      template: "DAC7_REQUEST",
      dedupeKey: `dac7:${c.id}:${year}:${reminder}`,
      ...dac7RequestEmail({
        name: c.displayName,
        url: `${appUrl()}/panel/ajustes/cobros`,
        reminder,
        deadline: dac7Deadline(requestedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: DAC7_TZ }),
      }),
    });
    sent++;
  }
  return sent;
}

/** ?anio= de los informes: por defecto el año anterior (el que se declara en enero). */
export function parseDac7Year(raw: string | null | undefined, now = new Date()): number {
  const current = yearOf(now, DAC7_TZ);
  const y = Number(raw);
  return Number.isInteger(y) && y >= 2023 && y <= current ? y : current - 1;
}
