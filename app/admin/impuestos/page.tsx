import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INVOICE_TYPE_LABEL } from "@/lib/invoices/format";
import { getPlatformIssuer } from "@/lib/invoices/issuer";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { asTaxMode, type TaxMode } from "@/lib/tax";
import { countryName } from "@/lib/tax/rates";
import { Badge, PageHeader } from "../../panel/ui";
import { AdminTable, td } from "../ui";
import { saveTaxSettings } from "./actions";
import { formatDate } from "@/lib/tz";
import { platformOnly } from "../platform-only";

const MODES: [TaxMode, string, string][] = [
  [
    "PLATFORM_DIGITAL",
    "Cirella vende los productos digitales, cursos y membresías",
    "Art. 9 bis del Reglamento 282/2011: cobra el IVA del país de la compradora y lo declara en la ventanilla única (OSS). Las sesiones en directo las vende cada creadora.",
  ],
  ["CREATOR", "Cada creadora vende sus productos", "Cirella solo factura la cuota y la comisión. El IVA de cada venta depende de la situación de IVA de la creadora."],
];

/**
 * Impuestos y facturas: política de IVA, aviso si faltan los datos fiscales de la empresa y las
 * últimas facturas emitidas. Las exportaciones para la asesoría (libro registro, OSS/369, 303)
 * se añadirán cuando la asesoría diga qué formato necesita.
 */
export default async function AdminTaxes({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  platformOnly();
  await requireAdmin();
  const sp = await searchParams;
  const [settings, issuer, invoices] = await Promise.all([
    getSettings(),
    getPlatformIssuer(),
    prisma.invoice.findMany({ orderBy: { issuedAt: "desc" }, take: 50, include: { creator: { select: { displayName: true } } } }),
  ]);
  const mode = asTaxMode(settings.taxMode);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Impuestos y facturas" subtitle="Quién vende a efectos de IVA y las facturas que emite la plataforma." />
      <Flash ok={sp.ok} error={sp.error} />
      {!issuer.complete && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-[#ecd2cd] bg-[#fdf3f1] p-4 text-sm text-[#8a3b31]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Faltan los datos fiscales de la empresa: no se pueden emitir facturas ni vender en modo real.{" "}
            <Link href="/admin/ajustes" className="font-semibold underline underline-offset-2">Completar en Ajustes</Link>
          </p>
        </div>
      )}

      <form action={saveTaxSettings} className="card space-y-4 p-6">
        <h2 className="font-semibold">Política de IVA</h2>
        <div className="space-y-2">
          {MODES.map(([key, label, hint]) => (
            <label key={key} className="flex cursor-pointer gap-3 rounded-2xl border border-line p-4 has-[:checked]:border-ink">
              <input type="radio" name="taxMode" value={key} defaultChecked={mode === key} className="mt-1 h-4 w-4 accent-ink" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-0.5 block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Cambiarla afecta a las ventas y renovaciones desde ahora (también al neto de las creadoras). Decídelo por escrito con tu asesoría.
        </p>
        <p className="text-xs text-muted">
          Emisor de las facturas: {issuer.name}
          {issuer.taxId ? ` · NIF ${issuer.taxId}` : ""} {issuer.address ? `· ${issuer.address}` : ""} ·{" "}
          <Link href="/admin/ajustes" className="underline underline-offset-2">editar datos de la empresa</Link>
        </p>
        <SubmitButton>Guardar política</SubmitButton>
      </form>

      <h2 className="eyebrow mb-3 mt-10 !text-ink">Últimas facturas emitidas</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted">Todavía no se ha emitido ninguna factura.</p>
      ) : (
        <AdminTable head={["Número", "Fecha", "Tipo", "Emisor", "Destinataria/o", "País", "IVA", "Total", ""]} minWidth={900}>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td className={`${td} font-mono text-xs`}>{i.fullNumber}</td>
              <td className={`${td} text-muted`}>{formatDate(i.issuedAt, { day: "numeric", month: "short", year: "2-digit" })}</td>
              <td className={td}><Badge tone={i.kind === "FEES" ? "dark" : i.type.startsWith("R") ? "danger" : "neutral"}>{i.kind === "FEES" ? "Cuotas" : INVOICE_TYPE_LABEL[i.type]}</Badge></td>
              <td className={td}>{i.issuer === "PLATFORM" ? "Cirella" : i.creator.displayName}</td>
              <td className={`${td} text-muted`}>{i.recipientName ?? i.recipientEmail ?? "Consumidor final"}</td>
              <td className={`${td} text-muted`}>{i.taxCountry ? countryName(i.taxCountry) : "—"}</td>
              <td className={`${td} tabular-nums`}>{formatMoney(i.taxCents, i.currency, { decimals: true })}</td>
              <td className={`${td} tabular-nums font-semibold`}>{formatMoney(i.totalCents, i.currency, { decimals: true })}</td>
              <td className={`${td} text-right`}><Link href={`/facturas/${i.id}`} className="text-xs font-semibold underline underline-offset-2">Ver</Link></td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
