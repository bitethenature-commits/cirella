import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintButton } from "@/components/invoice/print-button";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewInvoice } from "@/lib/invoices/access";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Factura", robots: { index: false } };

/**
 * Factura imprimible. La ven la administración, la creadora de la venta (o la destinataria de una
 * factura de cuotas) y la compradora: con su cuenta verificada o con la sesión limitada al pedido
 * (tras pagar o desde el enlace del recibo). A cualquier otra persona, 404: no se revela que existe.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s) redirect(`/entrar?next=${encodeURIComponent(`/facturas/${id}`)}`);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { related: { select: { fullNumber: true } }, relatedFrom: { where: { type: "F3" }, select: { fullNumber: true } } },
  });
  if (!invoice) notFound();
  const allowed = s.order
    ? invoice.kind === "SALE" && invoice.orderId === s.order.id && invoice.buyerUserId === s.user.id
    : canViewInvoice(
        {
          // Como compradora o como administración solo con el email demostrado (igual que /cuenta y /admin).
          userId: s.verified ? s.user.id : "",
          email: s.verified ? s.user.email : "",
          isAdmin: s.user.isAdmin && s.verified,
          creatorId: s.user.creator?.id ?? null,
        },
        invoice,
      );
  if (!allowed) notFound();
  const { platformName } = await getSettings();

  return (
    <main className="min-h-dvh bg-paper px-4 py-8 sm:py-12 print:bg-white print:p-0">
      <div className="mx-auto mb-5 max-w-[800px]">
        <PrintButton />
      </div>
      <InvoiceDocument invoice={invoice} relatedNumber={invoice.related?.fullNumber} replacedBy={invoice.relatedFrom[0]?.fullNumber} platformName={platformName} />
    </main>
  );
}
