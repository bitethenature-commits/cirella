import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, LayoutGrid, Pencil, Plus, Star } from "lucide-react";
import { ProductImage } from "@/components/creator-page/product-art";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { asAccessMode, externalHost } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { deliveryFacts, deliveryIssue } from "@/lib/delivery";
import { formatPrice } from "@/lib/money";
import { tenantDb } from "@/lib/tenant";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Badge, PageHeader } from "../ui";
import { moveProduct } from "./actions";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «49 € · 3 ventas», «Gratis · 12 inscripciones» o «65 € · pago en calendly.com». */
function priceLine(p: { accessMode: string; priceCents: number; currency: string; billingInterval: string | null; externalUrl: string | null; _count: { orders: number } }) {
  const mode = asAccessMode(p.accessMode);
  const n = p._count.orders;
  if (mode === "FREE_EMAIL") return `Gratis · ${plural(n, "inscripción", "inscripciones")}`;
  if (mode === "EXTERNAL") {
    const host = externalHost(p.externalUrl);
    const price = p.priceCents > 0 ? `${formatPrice(p.priceCents, p.currency, p.billingInterval)} · ` : "";
    return `${price}${host ? `pago en ${host}` : "falta el enlace de pago"}${n ? ` · ${plural(n, "persona con acceso", "personas con acceso")}` : ""}`;
  }
  return `${formatPrice(p.priceCents, p.currency, p.billingInterval)} · ${plural(n, "venta", "ventas")}`;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ limite?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const products = await db.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { orders: { where: { status: "PAID" } }, files: true, lessons: true, posts: true } } },
  });
  const archived = await db.product.count({ where: { status: "ARCHIVED" } });
  const max = creator.plan.maxProducts;

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle={max != null ? `${products.length} de ${max} productos en tu plan ${creator.plan.name}` : `${products.length} productos · ilimitados en tu plan ${creator.plan.name}`}
        actions={
          <Link href="/panel/productos/nuevo" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Nuevo producto
          </Link>
        }
      />
      {sp.limite && <Flash error={`Has llegado al límite de ${max} productos del plan ${creator.plan.name}. Mejora tu plan para añadir más.`} />}

      <div className="space-y-2.5">
        {products.map((p, i) => (
          <div key={p.id} className="card flex items-center gap-3 p-3 sm:gap-4">
            <div className="flex flex-col">
              <form action={moveProduct}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="dir" value="up" />
                <button disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Subir">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              </form>
              <form action={moveProduct}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="dir" value="down" />
                <button disabled={i === products.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Bajar">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-24" style={{ ["--c-accent" as string]: "#C9BBF2", ["--c-gold" as string]: "#D9BF8C", ["--c-bg2" as string]: "#1A1D3D" }}>
              <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} />
            </div>
            <Link href={`/panel/productos/${p.id}`} className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-semibold">
                {p.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />}
                {p.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {PRODUCT_TYPE_LABEL[p.type as ProductType]} · {priceLine(p)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.status === "PUBLISHED" ? <Badge tone="success">Publicado</Badge> : <Badge tone="warning">Borrador</Badge>}
                {deliveryIssue(deliveryFacts(p))?.blocking && <Badge tone="danger">Sin entrega</Badge>}
              </div>
            </Link>
            <div className="flex shrink-0 gap-1">
              {p.status === "PUBLISHED" && (
                <Link href={`/${creator.username}/${p.slug}`} target="_blank" className="btn btn-ghost btn-sm hidden sm:inline-flex" aria-label="Ver">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              )}
              <Link href={`/panel/productos/${p.id}`} className="btn btn-outline btn-sm">
                <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
      {products.length === 0 && (
        <EmptyState icon={<LayoutGrid className="h-5 w-5" />} title="Crea tu primer producto" action={<Link href="/panel/productos/nuevo" className="btn btn-primary">Nuevo producto</Link>}>
          Lecturas, sesiones, cursos o una comunidad privada.
        </EmptyState>
      )}
      <p className="mt-6 text-xs text-muted">
        El orden de esta lista es el orden en tu página. {archived > 0 && `${archived} producto(s) archivado(s) con ventas: sus clientas conservan el acceso.`}
      </p>
    </div>
  );
}
