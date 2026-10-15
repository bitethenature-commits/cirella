"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBuyerFor } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { InvoiceError, issueFullInvoiceForOrder } from "@/lib/invoices/issue";
import { isKnownCountry } from "@/lib/tax/rates";
import { isPlausibleTaxId } from "@/lib/tax/tax-id";

export type FullInvoiceState = { error?: string } | undefined;

const schema = z
  .object({
    billingName: z.string().trim().min(2, "Escribe el nombre o la razón social").max(120),
    billingTaxId: z.string().max(30),
    billingAddress: z.string().trim().min(8, "Escribe la dirección fiscal").max(300),
    country: z.string().refine(isKnownCountry, "Elige tu país"),
  })
  .refine((d) => isPlausibleTaxId(d.billingTaxId, d.country), { message: "Revisa el NIF: no es válido" });

/**
 * «¿Necesitas factura con tu NIF?» después de comprar: sustituye la factura simplificada por una
 * completa. Lo puede pedir la compradora (también con la sesión limitada a este pedido).
 */
export async function requestFullInvoice(orderId: string, _: FullInvoiceState, form: FormData): Promise<FullInvoiceState> {
  const { user } = await requireBuyerFor({ orderId }, `/cuenta/pedidos/${orderId}`);
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customer: { select: { userId: true } } } });
  if (order?.customer?.userId !== user.id) return { error: "No encontramos esa compra en tu cuenta." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    await issueFullInvoiceForOrder(orderId, { name: d.billingName, taxId: d.billingTaxId, address: d.billingAddress, country: d.country });
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/cuenta/pedidos/${orderId}`);
  // La página muestra «Hemos emitido tu factura …» con el número de la factura nueva.
  redirect(`/cuenta/pedidos/${orderId}?factura=emitida#factura`);
}
