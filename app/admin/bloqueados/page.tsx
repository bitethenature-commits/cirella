import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "../../panel/ui";
import { setCreatorStatus, setUserStatus } from "../actions";
import { AdminTable, td } from "../ui";
import { formatDate } from "@/lib/tz";
import { platformOnly } from "../platform-only";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export default async function AdminBlocked() {
  const t = await getT();
  platformOnly();
  await requireAdmin();
  const [users, creators] = await Promise.all([
    prisma.user.findMany({ where: { status: "BLOCKED" }, orderBy: { createdAt: "desc" } }),
    prisma.creator.findMany({ where: { status: "BLOCKED" }, include: { user: { select: { email: true } } } }),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title={t("Bloqueados")} subtitle={t("Usuarios sin acceso y páginas de creadoras ocultas.")} />
      <section>
        <h2 className="eyebrow mb-3 !text-ink"><Tr s={"Páginas de creadoras bloqueadas"} /></h2>
        <AdminTable head={["Creadora", "Email", ""]} minWidth={500}>
          {creators.map((c) => (
            <tr key={c.id}><td className={td}>{c.displayName} /{c.username}</td><td className={`${td} text-muted`}>{c.user.email}</td>
              <td className={`${td} text-right`}><form action={setCreatorStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="ACTIVE" /><input type="hidden" name="back" value="/admin/bloqueados" /><button className="btn btn-outline btn-sm"><Tr s={"Reactivar"} /></button></form></td></tr>
          ))}
          {creators.length === 0 && <tr><td className={`${td} text-muted`} colSpan={3}><Tr s={"Ninguna."} /></td></tr>}
        </AdminTable>
      </section>
      <section>
        <h2 className="eyebrow mb-3 !text-ink"><Tr s={"Usuarios bloqueados"} /></h2>
        <AdminTable head={["Usuario", "Alta", ""]} minWidth={500}>
          {users.map((u) => (
            <tr key={u.id}><td className={td}><Tr s={u.name ?? "—"} /> <span className="text-muted">{u.email}</span></td><td className={`${td} text-muted`}>{formatDate(u.createdAt, { day: "numeric", month: "numeric", year: "numeric" })}</td>
              <td className={`${td} text-right`}><form action={setUserStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="ACTIVE" /><input type="hidden" name="back" value="/admin/bloqueados" /><button className="btn btn-outline btn-sm"><Tr s={"Desbloquear"} /></button></form></td></tr>
          ))}
          {users.length === 0 && <tr><td className={`${td} text-muted`} colSpan={3}><Tr s={"Ninguno."} /></td></tr>}
        </AdminTable>
      </section>
    </div>
  );
}
