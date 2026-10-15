import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

/**
 * Siguiente número correlativo de una serie (emisor + código + año), sin huecos ni duplicados.
 *
 * Va en la misma transacción que la factura: si se deshace, no queda hueco. El INSERT … ON
 * CONFLICT DO UPDATE bloquea la fila de la serie hasta el commit, así que dos facturas a la vez de
 * la misma serie se ponen en fila (milisegundos) y nunca reciben el mismo número.
 */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, issuerKey: string, code: string, year: number): Promise<number> {
  const rows = await tx.$queryRaw<{ nextNumber: number }[]>`
    INSERT INTO "InvoiceSeries" ("id", "issuerKey", "code", "year", "nextNumber")
    VALUES (${randomUUID()}, ${issuerKey}, ${code}, ${year}, 2)
    ON CONFLICT ("issuerKey", "code", "year") DO UPDATE SET "nextNumber" = "InvoiceSeries"."nextNumber" + 1
    RETURNING "nextNumber"`;
  return Number(rows[0].nextNumber) - 1;
}
