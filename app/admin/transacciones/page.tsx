import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, PageHeader } from "../../panel/ui";
import { AdminTable, td } from "../ui";
import { formatDate } from "@/lib/tz";
import { platformOnly } from "../platform-only";
import { Tr } from "@/lib/i18n/client";

const TYPE: Record<string, string> = { CHARGE: "Cobro", REFUND: "Reembolso", RENEWAL: "Renovación", PLAN_FEE: "Cuota de plan" };

export default async function AdminTransactions() {
  platformOnly();
  await requireAdmin();
  const txs = await prisma.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { creator: { select: { displayName: true } } } });
  return (
    <div>
      <PageHeader title="Transacciones" subtitle="Libro de movimientos: cobros, reembolsos, renovaciones y cuotas de plan." />
      <AdminTable head={["Fecha", "Tipo", "Creadora", "Concepto", "Importe", "Plataforma", "Creadora recibe", "Referencia"]} minWidth={1000}>
        {txs.map((t) => (
          <tr key={t.id}>
            <td className={`${td} text-muted`}>{formatDate(t.createdAt, { day: "numeric", month: "short", year: "2-digit" })}</td>
            <td className={td}><Badge tone={t.type === "PLAN_FEE" ? "dark" : t.type === "REFUND" ? "danger" : "neutral"}><Tr s={TYPE[t.type] ?? t.type} /></Badge></td>
            <td className={td}>{t.creator.displayName}</td>
            <td className={`${td} text-muted`}><Tr s={t.description} /></td>
            <td className={`${td} tabular-nums`}>{formatMoney(t.amountCents, t.currency, { decimals: true })}</td>
            <td className={`${td} tabular-nums font-semibold`}>{formatMoney(t.platformFeeCents, t.currency, { decimals: true })}</td>
            <td className={`${td} tabular-nums text-muted`}>{formatMoney(t.netCents, t.currency, { decimals: true })}</td>
            <td className={`${td} text-right font-mono text-xs text-faint`}>{t.providerRef?.slice(0, 18) ?? t.provider}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
