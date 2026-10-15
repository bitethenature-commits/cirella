import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, PageHeader } from "../../panel/ui";
import { setUserStatus } from "../actions";
import { AdminTable, td } from "../ui";
import { formatDate } from "@/lib/tz";

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    where: { customerOf: { some: {} } },
    orderBy: { createdAt: "desc" },
    include: { customerOf: { include: { creator: { select: { displayName: true } } } } },
  });
  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${users.length} compradoras en toda la plataforma`} />
      <Flash ok={sp.ok} />
      <AdminTable head={["Cliente", "Compra a", "Pedidos", "Total", "Alta", "Estado", ""]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className={td}><span className="font-semibold">{u.name ?? "—"}</span><span className="block text-xs text-muted">{u.email}</span></td>
            <td className={`${td} text-muted`}>{u.customerOf.map((c) => c.creator.displayName).join(", ")}</td>
            <td className={td}>{u.customerOf.reduce((a, c) => a + c.ordersCount, 0)}</td>
            <td className={`${td} tabular-nums`}>{formatMoney(u.customerOf.reduce((a, c) => a + c.totalSpentCents, 0))}</td>
            <td className={`${td} text-muted`}>{formatDate(u.createdAt, { day: "numeric", month: "numeric", year: "numeric" })}</td>
            <td className={td}>{u.status === "BLOCKED" ? <Badge tone="danger">Bloqueado</Badge> : <Badge tone="success">Activo</Badge>}</td>
            <td className={`${td} text-right`}>
              <form action={setUserStatus}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="status" value={u.status === "BLOCKED" ? "ACTIVE" : "BLOCKED"} />
                <button className={`btn btn-sm ${u.status === "BLOCKED" ? "btn-outline" : "btn-danger"}`}>{u.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}</button>
              </form>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
