import { productPath } from "@/lib/public-paths";
import Link from "next/link";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Badge, PageHeader } from "../../panel/ui";
import { setProductStatusAdmin } from "../actions";
import { AdminTable, td } from "../ui";
import { platformOnly } from "../platform-only";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const t = await getT();
  platformOnly();
  await requireAdmin();
  const sp = await searchParams;
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" }, include: { creator: { select: { displayName: true, username: true } }, _count: { select: { orders: { where: { status: "PAID" } } } } } });
  return (
    <div>
      <PageHeader title={t("Productos")} subtitle={`${products.length} productos en la plataforma · moderación`} />
      <Flash ok={sp.ok} error={sp.error} />
      <AdminTable head={["Producto", "Creadora", "Tipo", "Precio", "Ventas", "Estado", ""]} minWidth={900}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className={td}><Link href={`${productPath(p.creator.username, p)}`} target="_blank" className="font-medium hover:underline"><Tr s={p.emoji} /> {p.title}</Link></td>
            <td className={`${td} text-muted`}>{p.creator.displayName}</td>
            <td className={td}><Tr s={PRODUCT_TYPE_LABEL[p.type as ProductType]} /></td>
            <td className={td}>{formatPrice(p.priceCents, p.currency, p.billingInterval)}</td>
            <td className={td}>{p._count.orders}</td>
            <td className={td}><Badge tone={p.status === "PUBLISHED" ? "success" : "neutral"}>{p.status === "PUBLISHED" ? t("Publicado") : p.status === "DRAFT" ? t("Borrador") : t("Archivado")}</Badge></td>
            <td className={`${td} text-right`}>
              {p.status === "PUBLISHED" && (
                <form action={setProductStatusAdmin}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="DRAFT" /><button className="btn btn-danger btn-sm"><Tr s={"Despublicar"} /></button></form>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
