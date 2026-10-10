import type { Creator, Invoice, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { isDemoMode } from "../env";
import { getSettings } from "../settings";
import { NOTE_EXEMPT, decideTax } from "../tax";
import { isPlausibleTaxId, normalizeTaxId } from "../tax/tax-id";
import { zonedParts } from "../tz";
import { INVOICE_TIMEZONE, formatInvoiceNumber, invoiceYear, periodLabel, type InvoiceLine } from "./format";
import { creatorIssuer, getPlatformIssuer, type Issuer } from "./issuer";
import { nextInvoiceNumber } from "./numbering";

/**
 * Emisión de facturas de venta. Sin `server-only`: también lo usan el seed y las pruebas (tsx).
 *
 * Las facturas son inmutables: una simplificada (F2) se sustituye con una completa (F3) y una
 * devolución se corrige con una rectificativa (R1/R5). Cada factura tiene una clave única
 * (dedupeKey), así que emitir dos veces la misma devuelve la que ya existe.
 *
 *   · issueSaleInvoiceTx: la llaman fulfillOrder y applyRenewal dentro de la transacción del cobro.
 *     Si vende Cirella (opción A) siempre hay factura; si vende la creadora, solo si repercute IVA
 *     y tiene sus datos fiscales completos (si no, la compradora tiene un justificante de compra).
 *   · issueFullInvoiceForOrder: «Necesito factura con mi NIF» después de comprar.
 *   · issueCorrectiveInvoiceTx: la llama markRefundSucceeded al contabilizar un reembolso.
 */

export class InvoiceError extends Error {}

export { formatInvoiceNumber };

const SALE_SERIES: Record<string, string> = { PLATFORM: "V", CREATOR: "CIR" };
const REFUND_SERIES: Record<string, string> = { PLATFORM: "R", CREATOR: "CIRR" };

type CreatorFiscal = Pick<
  Creator,
  "id" | "vatStatus" | "vatExemptionNote" | "legalName" | "legalTaxId" | "legalAddress" | "legalPostalCode" | "legalCity" | "legalCountry"
>;

/** Emisora de una venta: Cirella o la creadora (con la mención de facturación por cuenta de ella). */
async function saleIssuer(seller: string, creator: CreatorFiscal): Promise<{ issuer: Issuer; issuerKey: string; mention: string | null } | null> {
  if (seller === "PLATFORM") {
    const p = await getPlatformIssuer();
    // createPendingOrder ya impide vender sin estos datos fuera del modo demo.
    if (!p.complete && !isDemoMode()) throw new InvoiceError("Faltan los datos fiscales de la empresa: no se puede emitir la factura.");
    return { issuer: p, issuerKey: "platform", mention: null };
  }
  const issuer = creatorIssuer(creator);
  if (!issuer) return null;
  const { platformName } = await getSettings();
  return {
    issuer,
    issuerKey: creator.id,
    mention: `Factura expedida por ${platformName} en nombre y por cuenta de ${issuer.name} (art. 5 del Real Decreto 1619/2012).`,
  };
}

/** ¿Se puede emitir factura de una venta? (si no, la compradora tiene un justificante de compra). */
export function canInvoiceSale(taxSeller: string, creator: Parameters<typeof creatorIssuer>[0]): boolean {
  return taxSeller === "PLATFORM" || creatorIssuer(creator) !== null;
}

/** Nota fiscal de una venta (OSS, no sujeta, exenta…), la misma que mostró el checkout. */
function saleTaxNote(seller: string, country: string | null, rateBps: number, creator: CreatorFiscal): string | null {
  if (seller === "PLATFORM") return decideTax({ mode: "PLATFORM_DIGITAL", productType: "DIGITAL", buyerCountry: country, creator: { country: null, vatStatus: "NONE" } }).note;
  return rateBps ? null : creator.vatExemptionNote?.trim() || NOTE_EXEMPT;
}

const joinNotes = (...notes: (string | null | undefined)[]) => notes.filter(Boolean).join(" ") || null;

type NewInvoice = Omit<Prisma.InvoiceUncheckedCreateInput, "year" | "number" | "fullNumber" | "issuedAt">;

/** Numera y guarda la factura (en la transacción de quien llama: sin huecos si se deshace). */
export async function createNumberedInvoiceTx(tx: Prisma.TransactionClient, data: NewInvoice, issuedAt = new Date()): Promise<Invoice> {
  const year = invoiceYear(issuedAt);
  const number = await nextInvoiceNumber(tx, data.issuerKey, data.seriesCode, year);
  return tx.invoice.create({ data: { ...data, year, number, fullNumber: formatInvoiceNumber(data.seriesCode, year, number), issuedAt } });
}

function issuerFields(i: Issuer) {
  return { issuerName: i.name, issuerTaxId: i.taxId, issuerAddress: i.address, issuerCountry: i.country };
}

function monthOf(d: Date) {
  const p = zonedParts(d, INVOICE_TIMEZONE);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/**
 * Factura de un cobro (CHARGE o RENEWAL). Completa (F1) si el pedido pidió factura con NIF y
 * simplificada (F2) si no. null si la venta no se puede facturar.
 */
export async function issueSaleInvoiceTx(tx: Prisma.TransactionClient, i: { transactionId: string }): Promise<Invoice | null> {
  const dedupeKey = `sale:${i.transactionId}`;
  const existing = await tx.invoice.findUnique({ where: { dedupeKey } });
  if (existing) return existing;
  const t = await tx.transaction.findUnique({
    where: { id: i.transactionId },
    include: { creator: true, order: { include: { customer: { select: { userId: true } } } } },
  });
  if (!t || !t.taxSeller || (t.type !== "CHARGE" && t.type !== "RENEWAL")) return null;
  const from = await saleIssuer(t.taxSeller, t.creator);
  if (!from) return null;

  // Las renovaciones no tienen pedido propio: los datos de facturación son los del pedido inicial.
  const sub = !t.order && t.subscriptionId
    ? await tx.subscription.findUnique({ where: { id: t.subscriptionId }, include: { customer: true, product: { select: { title: true } } } })
    : null;
  const order = t.order ?? (sub?.orderId ? await tx.order.findUnique({ where: { id: sub.orderId }, include: { customer: { select: { userId: true } } } }) : null);
  const full = !!order?.billingTaxId;
  const title = order?.productTitle ?? sub?.product.title ?? t.description ?? "Compra";
  const description = t.type === "RENEWAL" ? `Renovación de ${title} (${periodLabel(monthOf(t.createdAt))})` : title;
  const total = t.amountCents;
  const tax = t.taxCents;

  return createNumberedInvoiceTx(tx, {
    creatorId: t.creatorId,
    kind: "SALE",
    type: full ? "F1" : "F2",
    issuer: t.taxSeller,
    issuerKey: from.issuerKey,
    seriesCode: SALE_SERIES[t.taxSeller],
    orderId: order?.id ?? null,
    transactionId: t.id,
    buyerUserId: order?.customer?.userId ?? sub?.userId ?? null,
    ...issuerFields(from.issuer),
    recipientName: full ? order!.billingName : (order?.buyerName ?? sub?.customer.name ?? null),
    recipientTaxId: full ? order!.billingTaxId : null,
    recipientAddress: full ? order!.billingAddress : null,
    recipientCountry: order?.buyerCountry ?? sub?.buyerCountry ?? null,
    recipientEmail: order?.buyerEmail ?? sub?.customer.email ?? null,
    currency: t.currency,
    lines: [{ description, baseCents: total - tax, taxCents: tax, totalCents: total }] satisfies InvoiceLine[],
    baseCents: total - tax,
    taxRateBps: t.taxRateBps,
    taxCents: tax,
    totalCents: total,
    taxCountry: t.taxCountry,
    taxNote: joinNotes(saleTaxNote(t.taxSeller, t.taxCountry, t.taxRateBps, t.creator), from.mention),
    dedupeKey,
  });
}

export type BillingInput = { name: string; taxId: string; address: string; country: string };

/**
 * «Necesito factura con mi NIF» después de comprar: sustituye la simplificada con una completa
 * (F3) o, si no había factura, emite una completa (F1). Si ya hay una completa, la devuelve.
 */
export async function issueFullInvoiceForOrder(orderId: string, billing: BillingInput): Promise<Invoice> {
  const taxId = normalizeTaxId(billing.taxId);
  if (!isPlausibleTaxId(taxId, billing.country)) throw new InvoiceError("Revisa el NIF: no es válido");
  return prisma.$transaction(async (tx) => {
    // Bloquea el pedido: dos peticiones a la vez no emiten dos facturas completas.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { creator: true, customer: { select: { userId: true } } } });
    if (!order || order.status !== "PAID") throw new InvoiceError("Esta compra no admite factura.");
    if (order.refundedCents > 0) throw new InvoiceError("Esta compra tiene devoluciones: escribe a la creadora para pedir la factura.");
    const dedupeKey = `full:${orderId}`;
    const already = await tx.invoice.findUnique({ where: { dedupeKey } });
    if (already) return already;
    const charge = await tx.transaction.findFirst({ where: { orderId, type: "CHARGE" }, orderBy: { createdAt: "asc" } });
    if (!charge?.taxSeller) throw new InvoiceError("Esta compra no admite factura.");
    const sale = await tx.invoice.findUnique({ where: { dedupeKey: `sale:${charge.id}` } });
    // Ya pidió factura con NIF al comprar: la completa es la de la venta.
    if (sale && sale.type !== "F2") return sale;
    const from = await saleIssuer(charge.taxSeller, order.creator);
    if (!from) throw new InvoiceError(`${order.creator.legalName ?? order.creator.displayName} no emite facturas con IVA por esta venta.`);

    const recipient = { name: billing.name.trim(), taxId, address: billing.address.trim(), country: billing.country };
    await tx.order.update({ where: { id: orderId }, data: { billingName: recipient.name, billingTaxId: recipient.taxId, billingAddress: recipient.address } });
    const total = charge.amountCents;
    const tax = charge.taxCents;
    return createNumberedInvoiceTx(tx, {
      creatorId: order.creatorId,
      kind: "SALE",
      type: sale ? "F3" : "F1",
      issuer: charge.taxSeller,
      issuerKey: from.issuerKey,
      seriesCode: SALE_SERIES[charge.taxSeller],
      orderId,
      transactionId: null,
      buyerUserId: order.customer?.userId ?? null,
      relatedInvoiceId: sale?.id ?? null,
      ...issuerFields(from.issuer),
      recipientName: recipient.name,
      recipientTaxId: recipient.taxId,
      recipientAddress: recipient.address,
      recipientCountry: recipient.country,
      recipientEmail: order.buyerEmail,
      currency: order.currency,
      lines: [{ description: order.productTitle, baseCents: total - tax, taxCents: tax, totalCents: total }] satisfies InvoiceLine[],
      baseCents: total - tax,
      taxRateBps: charge.taxRateBps,
      taxCents: tax,
      totalCents: total,
      taxCountry: charge.taxCountry,
      // La fecha de la operación es la de la compra, no la de la factura.
      operationDate: order.paidAt,
      taxNote: joinNotes(
        sale ? `Sustituye a la factura simplificada ${sale.fullNumber}.` : null,
        saleTaxNote(charge.taxSeller, charge.taxCountry, charge.taxRateBps, order.creator),
        from.mention,
      ),
      dedupeKey,
    });
  });
}

/**
 * Rectificativa de una devolución (importes en negativo, como la fila REFUND). Rectifica la factura
 * completa si se pidió una; si no, la de la venta. null si la venta no tenía factura.
 */
export async function issueCorrectiveInvoiceTx(
  tx: Prisma.TransactionClient,
  i: { refundTransactionId: string; originalTransactionId: string },
): Promise<Invoice | null> {
  const dedupeKey = `refund:${i.refundTransactionId}`;
  const existing = await tx.invoice.findUnique({ where: { dedupeKey } });
  if (existing) return existing;
  const refund = await tx.transaction.findUnique({ where: { id: i.refundTransactionId } });
  if (!refund) return null;
  const full = refund.orderId ? await tx.invoice.findUnique({ where: { dedupeKey: `full:${refund.orderId}` } }) : null;
  const original = full ?? (await tx.invoice.findUnique({ where: { dedupeKey: `sale:${i.originalTransactionId}` } }));
  if (!original) return null;
  const total = refund.amountCents;
  const tax = refund.taxCents;
  const description = invoiceLinesDescription(original);
  return createNumberedInvoiceTx(tx, {
    creatorId: original.creatorId,
    kind: "SALE",
    type: original.type === "F2" ? "R5" : "R1",
    issuer: original.issuer,
    issuerKey: original.issuerKey,
    seriesCode: REFUND_SERIES[original.issuer],
    orderId: original.orderId,
    transactionId: refund.id,
    buyerUserId: original.buyerUserId,
    relatedInvoiceId: original.id,
    issuerName: original.issuerName,
    issuerTaxId: original.issuerTaxId,
    issuerAddress: original.issuerAddress,
    issuerCountry: original.issuerCountry,
    recipientName: original.recipientName,
    recipientTaxId: original.recipientTaxId,
    recipientAddress: original.recipientAddress,
    recipientCountry: original.recipientCountry,
    recipientEmail: original.recipientEmail,
    currency: original.currency,
    lines: [{ description: `Devolución · ${description}`, baseCents: total - tax, taxCents: tax, totalCents: total }] satisfies InvoiceLine[],
    baseCents: total - tax,
    taxRateBps: original.taxRateBps,
    taxCents: tax,
    totalCents: total,
    taxCountry: original.taxCountry,
    taxNote: joinNotes(`Rectifica la factura ${original.fullNumber} por devolución.`, original.taxNote?.replace(/^Sustituye a la factura simplificada [^ ]+\. ?/, "")),
    dedupeKey,
  });
}

function invoiceLinesDescription(inv: Invoice): string {
  const lines = Array.isArray(inv.lines) ? (inv.lines as InvoiceLine[]) : [];
  return lines[0]?.description ?? inv.fullNumber;
}
