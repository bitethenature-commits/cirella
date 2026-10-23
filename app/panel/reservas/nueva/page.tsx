import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { readIntakeConfig } from "@/lib/intake";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../../ui";
import { GiveForm } from "./give-form";

/** «Dar una sesión o lectura»: un regalo o algo que le pagaron fuera (Bizum, transferencia). */
export default async function GivePage({ searchParams }: { searchParams: Promise<{ producto?: string; email?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const [products, customers] = await Promise.all([
    db.product.findMany({
      where: { status: { not: "ARCHIVED" }, OR: [{ type: "SESSION" }, { type: "DIGITAL", deliveryMode: "PERSONAL" }] },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, type: true, groupSession: true, eventStartAt: true, intake: true, accessMode: true },
    }),
    db.customer.findMany({ orderBy: { lastPurchaseAt: { sort: "desc", nulls: "last" } }, take: 200, select: { name: true, email: true } }),
  ]);
  return (
    <div className="max-w-2xl pb-28">
      <Link href="/panel/reservas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Reservas</Link>
      <PageHeader title="Dar una sesión o lectura" subtitle="Para regalarla o apuntar una que te han pagado por otro lado. Le llega el email con su enlace, como si la hubiera comprado." />
      {products.length === 0 ? (
        <p className="card p-5 text-sm text-muted">
          Primero crea una sesión o una lectura «Lo preparo yo» en <Link href="/panel/productos/nuevo" className="underline">Productos</Link>.
        </p>
      ) : (
        <GiveForm
          ownerTz={creator.timezone}
          products={products.map((p) => ({
            id: p.id,
            title: p.title,
            kind: p.type === "SESSION" ? (p.groupSession ? "workshop" : "session") : "reading",
            intake: readIntakeConfig(p.intake),
          }))}
          customers={customers.map((c) => ({ name: c.name ?? "", email: c.email }))}
          initialProductId={sp.producto}
          initialEmail={sp.email}
        />
      )}
    </div>
  );
}
