import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatPrice } from "@/lib/money";
import { Badge, PageHeader } from "../../panel/ui";
import { AdminTable, td } from "../ui";

export default async function AdminSubscriptions() {
  await requireAdmin();
  const [memberships, paying] = await Promise.all([
    prisma.subscription.findMany({ orderBy: { createdAt: "desc" }, include: { product: true, creator: { select: { displayName: true } }, customer: true } }),
    prisma.creator.findMany({ where: { plan: { priceMonthlyCents: { gt: 0 } } }, include: { plan: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="space-y-10">
      <section>
        <PageHeader title="Suscripciones" subtitle="Planes de las creadoras y membresías de sus clientas." />
        <h2 className="eyebrow mb-3 !text-ink">Planes de pago de creadoras · MRR {formatMoney(paying.filter((c) => c.status === "ACTIVE").reduce((a, c) => a + c.plan.priceMonthlyCents, 0))}</h2>
        <AdminTable head={["Creadora", "Plan", "Precio", "Comisión", "Renovación", "Crédito"]}>
          {paying.map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.displayName} <span className="text-muted">/{c.username}</span></td>
              <td className={td}><Badge tone="dark">{c.plan.name}</Badge></td>
              <td className={td}>{formatPrice(c.plan.priceMonthlyCents, "EUR", "month")}</td>
              <td className={td}>{c.plan.commissionBps / 100} %</td>
              <td className={`${td} text-muted`}>{c.planRenewsAt?.toLocaleDateString("es-ES") ?? "—"}</td>
              <td className={`${td} text-right`}>{c.creditCents ? formatMoney(c.creditCents, "EUR", { decimals: true }) : "—"}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
      <section>
        <h2 className="eyebrow mb-3 !text-ink">Membresías de clientas</h2>
        <AdminTable head={["Clienta", "Membresía", "Creadora", "Precio", "Periodo actual", "Estado"]}>
          {memberships.map((s) => (
            <tr key={s.id}>
              <td className={td}>{s.customer.name ?? s.customer.email}</td>
              <td className={td}>{s.product.title}</td>
              <td className={td}>{s.creator.displayName}</td>
              <td className={td}>{formatPrice(s.priceCents, "EUR", s.interval)}</td>
              <td className={`${td} text-muted`}>hasta {s.currentPeriodEnd.toLocaleDateString("es-ES")}</td>
              <td className={`${td} text-right`}><Badge tone={s.status === "ACTIVE" ? (s.cancelAtPeriodEnd ? "warning" : "success") : s.status === "PAST_DUE" ? "danger" : "neutral"}>{s.status === "ACTIVE" ? (s.cancelAtPeriodEnd ? "Cancela al final" : "Activa") : s.status === "PAST_DUE" ? "Pago pendiente" : "Finalizada"}</Badge></td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
