import Link from "next/link";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Badge, PageHeader } from "../../panel/ui";
import { setProductStatusAdmin } from "../actions";
import { AdminTable, td } from "../ui";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" }, include: { creator: { select: { displayName: true, username: true } }, _count: { select: { orders: { where: { status: "PAID" } } } } } });
  return (
    <div>
      <PageHeader title="Productos" subtitle={`${products.length} productos en la plataforma · moderación`} />
      <Flash ok={sp.ok} error={sp.error} />
      <AdminTable head={["Producto", "Creadora", "Tipo", "Precio", "Ventas", "Estado", ""]} minWidth={900}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className={td}><Link href={`/${p.creator.username}/${p.slug}`} target="_blank" className="font-medium hover:underline">{p.emoji} {p.title}</Link></td>
            <td className={`${td} text-muted`}>{p.creator.displayName}</td>
            <td className={td}>{PRODUCT_TYPE_LABEL[p.type as ProductType]}</td>
            <td className={td}>{formatPrice(p.priceCents, p.currency, p.billingInterval)}</td>
            <td className={td}>{p._count.orders}</td>
            <td className={td}><Badge tone={p.status === "PUBLISHED" ? "success" : "neutral"}>{p.status === "PUBLISHED" ? "Publicado" : p.status === "DRAFT" ? "Borrador" : "Archivado"}</Badge></td>
            <td className={`${td} text-right`}>
              {p.status === "PUBLISHED" && (
                <form action={setProductStatusAdmin}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="DRAFT" /><button className="btn btn-danger btn-sm">Despublicar</button></form>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
