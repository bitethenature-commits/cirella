import type { Invoice } from "@prisma/client";
import { INVOICE_TIMEZONE, INVOICE_TYPE_LABEL, invoiceLines } from "@/lib/invoices/format";
import { bpsToPercent, formatMoney } from "@/lib/money";
import { countryName } from "@/lib/tax/rates";

const date = (d: Date) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: INVOICE_TIMEZONE });

function Party({ title, name, taxId, address, country, fallback }: { title: string; name: string | null; taxId: string | null; address: string | null; country: string | null; fallback?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
      <p className="mt-1.5 font-semibold">{name || fallback}</p>
      {taxId && <p className="text-sm">NIF {taxId}</p>}
      {address && <p className="text-sm text-muted">{address}</p>}
      {country && !address?.includes(`(${countryName(country)})`) && <p className="text-sm text-muted">{countryName(country)}</p>}
    </div>
  );
}

/**
 * Factura en formato A4 para la pantalla y la impresora («Guardar como PDF» del navegador).
 * Todo sale de la propia factura (instantánea): no cambia aunque cambien los datos después.
 */
export function InvoiceDocument({
  invoice,
  relatedNumber,
  replacedBy,
  platformName,
}: {
  invoice: Invoice;
  /** F3: simplificada que sustituye · R1/R5: factura que rectifica. */
  relatedNumber?: string | null;
  /** F2: completa que la sustituye (si se pidió después). */
  replacedBy?: string | null;
  platformName: string;
}) {
  const money = (c: number) => formatMoney(c, invoice.currency, { decimals: true });
  const rate = bpsToPercent(invoice.taxRateBps);
  const lines = invoiceLines(invoice.lines);
  const subtitle =
    invoice.type === "F3" && relatedNumber
      ? `Sustituye a la factura simplificada ${relatedNumber}`
      : (invoice.type === "R1" || invoice.type === "R5") && relatedNumber
        ? `Rectifica la factura ${relatedNumber}`
        : null;
  const consumer = invoice.kind === "SALE" && !invoice.recipientTaxId;

  return (
    <article className="mx-auto w-full max-w-[800px] rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="display text-[2.2rem] leading-tight">{INVOICE_TYPE_LABEL[invoice.type] ?? "Factura"}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          {replacedBy && <p className="mt-1 text-sm text-muted">Sustituida por la factura {replacedBy}</p>}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Nº</dt>
          <dd className="text-right font-mono font-semibold">{invoice.fullNumber}</dd>
          <dt className="text-muted">Fecha de expedición</dt>
          <dd className="text-right tabular-nums">{date(invoice.issuedAt)}</dd>
          {invoice.operationDate && (
            <>
              <dt className="text-muted">Fecha de operación</dt>
              <dd className="text-right tabular-nums">{date(invoice.operationDate)}</dd>
            </>
          )}
        </dl>
      </header>

      <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
        <Party title="Emisor" name={invoice.issuerName} taxId={invoice.issuerTaxId} address={invoice.issuerAddress} country={invoice.issuerCountry} />
        <Party
          title="Destinataria/o"
          name={invoice.recipientName}
          taxId={invoice.recipientTaxId}
          address={invoice.recipientAddress}
          country={consumer ? null : invoice.recipientCountry}
          fallback="Consumidor final"
        />
      </section>

      <div className="-mx-2 overflow-x-auto py-6 sm:mx-0">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-2 py-2 font-medium">Concepto</th>
              <th className="px-2 py-2 text-right font-medium">Base imponible</th>
              <th className="px-2 py-2 text-right font-medium">IVA ({rate})</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="px-2 py-3">{l.description}</td>
                <td className="px-2 py-3 text-right tabular-nums">{money(l.baseCents)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{money(l.taxCents)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{money(l.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
        <dt className="text-muted">Base imponible</dt>
        <dd className="text-right tabular-nums">{money(invoice.baseCents)}</dd>
        <dt className="text-muted">Cuota de IVA ({rate})</dt>
        <dd className="text-right tabular-nums">{money(invoice.taxCents)}</dd>
        <dt className="border-t border-line pt-2 font-semibold">Total</dt>
        <dd className="border-t border-line pt-2 text-right text-lg font-semibold tabular-nums">{money(invoice.totalCents)}</dd>
      </dl>

      {invoice.taxNote && <p className="mt-6 text-sm italic text-muted">{invoice.taxNote}</p>}

      {invoice.registryQrUrl && (
        <div className="mt-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={invoice.registryQrUrl} alt="Código QR de verificación" className="h-24 w-24" />
          <p className="text-xs text-muted">Factura verificable en la sede electrónica de la AEAT (VERI*FACTU)</p>
        </div>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-faint">Factura emitida a través de {platformName}.</footer>
    </article>
  );
}
