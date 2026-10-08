import Link from "next/link";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Thumb } from "../ui";

export default async function MyPurchases() {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { buyerEmail: user.email, status: { in: ["PAID", "REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    include: { product: true, creator: { select: { displayName: true, username: true } }, bookings: { select: { id: true } } },
  });
  const link = (o: (typeof orders)[number]) =>
    o.productType === "COURSE" ? `/cuenta/cursos/${o.productId}` : o.productType === "MEMBERSHIP" ? `/cuenta/membresias/${o.productId}` : o.productType === "SESSION" && o.bookings[0] ? `/cuenta/sesiones/${o.bookings[0].id}` : "/cuenta/archivos";
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mis compras</h1>
      <div className="card mt-6 divide-y divide-line">
        {orders.map((o) => (
          <Link key={o.id} href={link(o)} className="flex items-center gap-4 p-4 transition hover:bg-paper">
            <Thumb src={o.product.imageUrl} emoji={o.product.emoji} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{o.productTitle}</p>
              <p className="text-xs text-muted">
                {PRODUCT_TYPE_LABEL[o.productType as ProductType]} · {o.creator.displayName} · {o.paidAt?.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{formatMoney(o.amountCents, o.currency, { decimals: true })}</p>
              <p className="text-xs text-muted">{ORDER_STATUS_LABEL[o.status]}</p>
            </div>
          </Link>
        ))}
      </div>
      {orders.length === 0 && <EmptyState icon={<Receipt className="h-5 w-5" />} title="Sin compras todavía" />}
    </div>
  );
}
