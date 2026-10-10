import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { enqueueEmail } from "../email/outbox";
import { monthlyInvoiceEmail } from "../email/templates";
import { appUrl, isDemoMode } from "../env";
import { formatLegalAddress } from "../legal";
import { formatMoney } from "../money";
import { decidePlatformServiceTax, splitInclusive } from "../tax";
import { zonedParts, zonedTimeToUtc } from "../tz";
import { INVOICE_TIMEZONE, periodLabel, type InvoiceLine } from "./format";
import { createNumberedInvoiceTx } from "./issue";
import { getPlatformIssuer } from "./issuer";

/**
 * Factura mensual de Cirella a cada creadora (serie S): la cuota del plan y la comisión de las
 * ventas en las que vende ella (con la opción A, la comisión de las ventas que vende Cirella es su
 * margen y no se factura). Los importes llevan el IVA incluido, como los precios de los planes.
 *
 * La emite el cron (/api/cron) a partir del día 1 para el mes anterior. Es idempotente
 * (fees:{creatorId}:{yyyy-mm}): cada ejecución solo emite las que falten.
 */

type FeeTx = { type: string; description: string | null; amountCents: number; platformFeeCents: number; taxSeller: string | null };

const SALE_TYPES = ["CHARGE", "RENEWAL"];

/** Movimientos que entran en la factura mensual (también para la vista previa de /panel/plan). */
export const FEE_TX_WHERE = {
  OR: [{ type: "PLAN_FEE", amountCents: { gt: 0 } }, { type: { in: [...SALE_TYPES, "REFUND"] }, taxSeller: "CREATOR" }],
} satisfies Prisma.TransactionWhereInput;
export const FEE_TX_SELECT = { creatorId: true, type: true, description: true, amountCents: true, platformFeeCents: true, taxSeller: true } as const;

/** Líneas de la factura: una por cuota y una con la comisión de las ventas (las devoluciones restan). */
export function buildFeeInvoiceLines(txs: FeeTx[], planName?: string): { description: string; totalCents: number }[] {
  const lines: { description: string; totalCents: number }[] = [];
  for (const t of txs)
    if (t.type === "PLAN_FEE" && t.amountCents > 0) lines.push({ description: t.description ?? `Plan ${planName ?? ""}`.trim(), totalCents: t.amountCents });
  const creatorSales = txs.filter((t) => t.taxSeller === "CREATOR" && (SALE_TYPES.includes(t.type) || t.type === "REFUND"));
  const sales = creatorSales.filter((t) => SALE_TYPES.includes(t.type)).length;
  const fees = creatorSales.reduce((a, t) => a + t.platformFeeCents, 0);
  if (sales > 0 || fees !== 0) {
    const refunds = creatorSales.some((t) => t.type === "REFUND");
    lines.push({
      description: `Comisión del servicio sobre ${sales} venta${sales === 1 ? "" : "s"}${refunds ? " (descontadas las devoluciones)" : ""}`,
      totalCents: fees,
    });
  }
  return lines;
}

/** Mes natural en España: «2026-09» y sus límites [from, to). `offset` = -1 para el mes anterior. */
export function monthPeriod(now: Date, offset = 0) {
  const p = zonedParts(now, INVOICE_TIMEZONE);
  const key = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  const index = p.year * 12 + (p.month - 1) + offset;
  const period = key(index);
  return {
    period,
    from: zonedTimeToUtc(`${period}-01`, 0, INVOICE_TIMEZONE),
    to: zonedTimeToUtc(`${key(index + 1)}-01`, 0, INVOICE_TIMEZONE),
  };
}

export async function issueMonthlyPlatformInvoices(now = new Date()): Promise<number> {
  const { period, from, to } = monthPeriod(now, -1);
  const txs = await prisma.transaction.findMany({ where: { createdAt: { gte: from, lt: to }, ...FEE_TX_WHERE }, orderBy: { createdAt: "asc" }, select: FEE_TX_SELECT });
  const byCreator = new Map<string, FeeTx[]>();
  for (const t of txs) byCreator.set(t.creatorId, [...(byCreator.get(t.creatorId) ?? []), t]);
  if (!byCreator.size) return 0;
  const done = new Set(
    (await prisma.invoice.findMany({ where: { dedupeKey: { in: [...byCreator.keys()].map((id) => `fees:${id}:${period}`) } }, select: { creatorId: true } })).map(
      (i) => i.creatorId,
    ),
  );
  const pending = [...byCreator.keys()].filter((id) => !done.has(id));
  if (!pending.length) return 0;

  const issuer = await getPlatformIssuer();
  if (!issuer.complete && !isDemoMode()) {
    console.warn(`[facturas] Faltan los datos fiscales de la empresa: no se emiten las facturas de ${period}.`);
    return 0;
  }
  // Fecha de la operación: el último día del mes facturado.
  const operationDate = new Date(to.getTime() - 1);
  let issued = 0;
  for (const creatorId of pending) {
    const creator = await prisma.creator.findUniqueOrThrow({ where: { id: creatorId }, include: { plan: true, user: { select: { email: true } } } });
    const lines = buildFeeInvoiceLines(byCreator.get(creatorId)!, creator.plan.name);
    const total = lines.reduce((a, l) => a + l.totalCents, 0);
    if (total <= 0) {
      console.log(`[facturas] ${creator.username} · ${period}: nada que facturar (${total} céntimos).`);
      continue;
    }
    const tax = decidePlatformServiceTax({ country: creator.legalCountry, vatStatus: creator.vatStatus, taxId: creator.legalTaxId });
    const withTax: InvoiceLine[] = lines.map((l) => ({ description: l.description, ...splitInclusive(l.totalCents, tax.rateBps), totalCents: l.totalCents }));
    const taxCents = withTax.reduce((a, l) => a + l.taxCents, 0);
    const invoice = await prisma.$transaction(async (tx) => {
      const dedupeKey = `fees:${creatorId}:${period}`;
      const existing = await tx.invoice.findUnique({ where: { dedupeKey } });
      if (existing) return null;
      return createNumberedInvoiceTx(tx, {
        creatorId,
        kind: "FEES",
        type: creator.legalTaxId ? "F1" : "F2",
        issuer: "PLATFORM",
        issuerKey: "platform",
        seriesCode: "S",
        period,
        operationDate,
        issuerName: issuer.name,
        issuerTaxId: issuer.taxId,
        issuerAddress: issuer.address,
        issuerCountry: issuer.country,
        recipientName: creator.legalName ?? creator.displayName,
        recipientTaxId: creator.legalTaxId,
        recipientAddress: creator.legalAddress ? formatLegalAddress(creator) : null,
        recipientCountry: creator.legalCountry,
        recipientEmail: creator.contactEmail ?? creator.user.email,
        lines: withTax,
        baseCents: total - taxCents,
        taxRateBps: tax.rateBps,
        taxCents,
        totalCents: total,
        taxCountry: tax.country,
        taxNote: tax.note,
        dedupeKey,
      });
    });
    if (!invoice) continue;
    issued++;
    await enqueueEmail({
      to: invoice.recipientEmail!,
      creatorId,
      userId: creator.userId,
      template: "MONTHLY_INVOICE",
      dedupeKey: `invoice-mail:${invoice.id}`,
      // Lo envía Cirella (no la creadora): remitente y respuesta por defecto de la plataforma.
      fromName: null,
      replyTo: null,
      ...monthlyInvoiceEmail({
        creatorName: creator.displayName,
        periodLabel: periodLabel(period),
        number: invoice.fullNumber,
        total: formatMoney(total, invoice.currency, { decimals: true }),
        url: `${appUrl()}/facturas/${invoice.id}`,
      }),
    });
  }
  return issued;
}
