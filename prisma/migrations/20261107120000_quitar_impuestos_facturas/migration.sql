-- Fuera el IVA, las facturas y el DAC7 de toda la web.

-- Facturas
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_creatorId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_orderId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_relatedInvoiceId_fkey";
DROP TABLE "Invoice";
DROP TABLE "InvoiceSeries";

-- Situación de IVA y datos de DAC7 de cada creadora (el NIF del aviso legal, legalTaxId, se queda)
ALTER TABLE "Creator" DROP COLUMN "birthDate",
DROP COLUMN "dac7ConfirmedAt",
DROP COLUMN "dac7LastReminderAt",
DROP COLUMN "dac7RemindersSent",
DROP COLUMN "dac7RequestedAt",
DROP COLUMN "iban",
DROP COLUMN "vatExemptionNote",
DROP COLUMN "vatStatus";

-- IVA, país y datos de factura de cada pedido
ALTER TABLE "Order" DROP COLUMN "billingAddress",
DROP COLUMN "billingName",
DROP COLUMN "billingTaxId",
DROP COLUMN "buyerCountry",
DROP COLUMN "ipCountry",
DROP COLUMN "taxCents",
DROP COLUMN "taxCountry",
DROP COLUMN "taxRateBps",
DROP COLUMN "taxSeller";

ALTER TABLE "Subscription" DROP COLUMN "buyerCountry";

ALTER TABLE "Transaction" DROP COLUMN "taxCents",
DROP COLUMN "taxCountry",
DROP COLUMN "taxRateBps",
DROP COLUMN "taxSeller";

-- Ajustes de la plataforma que ya no existen
DELETE FROM "PlatformSetting" WHERE "key" IN ('taxMode', 'dac7ReportableTypes');