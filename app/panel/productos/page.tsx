import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, Crown, ExternalLink, FileText, GraduationCap, LayoutGrid, Pencil, Plus, Star, Video, type LucideIcon } from "lucide-react";
import { ProductImage } from "@/components/creator-page/product-art";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { asAccessMode, externalHost } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { deliveryFacts, deliveryIssue } from "@/lib/delivery";
import { formatPrice } from "@/lib/money";
import { saleState } from "@/lib/offers";
import { signupsOnly } from "@/lib/commerce";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Badge, PageHeader } from "../ui";
import { moveProduct } from "./actions";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Los grupos plegables de la lista: uno por tipo, como salen en la página. */
const GROUPS: { type: ProductType; label: string; hint: string; Icon: LucideIcon }[] = [
  { type: "COURSE", label: "Cursos", hint: "Programas con lecciones", Icon: GraduationCap },
  { type: "SESSION", label: "Sesiones, talleres y círculos", hint: "En directo: 1:1, talleres con fecha y círculos de la luna", Icon: Video },
  { type: "DIGITAL", label: "Lecturas y productos digitales", hint: "Lecturas que preparas tú, PDF, audios y guías", Icon: FileText },
  { type: "MEMBERSHIP", label: "Membresías", hint: "Los niveles de tu comunidad", Icon: Crown },
];

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
  // Web personal: sin planes, y si no cobra, lo que se cobraba en la web no se ve (la ficha da 404).
  const personal = isPersonalMode();
  const count = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle={personal ? count : max != null ? `${products.length} de ${max} productos en tu plan ${creator.plan.name}` : `${count} · ilimitados en tu plan ${creator.plan.name}`}
        actions={
          <Link href="/panel/productos/nuevo" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Nuevo producto
          </Link>
        }
      />
      {sp.limite && <Flash error={`Has llegado al límite de ${max} productos del plan ${creator.plan.name}. Mejora tu plan para añadir más.`} />}

      <div className="space-y-4">
        {GROUPS.map(({ type, label, hint, Icon }) => {
          const items = products.filter((p) => p.type === type);
          if (!items.length) return null;
          const published = items.filter((p) => p.status === "PUBLISHED").length;
          return (
            <details key={type} open className="group rounded-2xl border border-line bg-paper/60">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 hover:bg-sand/50 [&::-webkit-details-marker]:hidden">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-cream">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {label}
                    <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-muted">{items.length}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {hint} · {plural(published, "publicado", "publicados")}
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2.5 px-3 pb-3">
                {items.map((p, i) => (
                  <div key={p.id} className="card flex items-center gap-3 p-3 sm:gap-4">
                <div className="flex flex-col">
                  <form action={moveProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="dir" value="up" />
                    <input type="hidden" name="sameType" value="1" />
                    <button disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Subir">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <form action={moveProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="dir" value="down" />
                    <input type="hidden" name="sameType" value="1" />
                    <button disabled={i === items.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Bajar">
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
                    {p.groupSession ? (p.moonCircle ? "Círculo de la luna" : "Taller") : PRODUCT_TYPE_LABEL[p.type as ProductType]} · {priceLine(p)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.status === "PUBLISHED" ? (
                      <Badge tone="success">Publicado</Badge>
                    ) : (
                      <Badge tone="warning">Borrador</Badge>
                    )}
                    {deliveryIssue(deliveryFacts(p))?.blocking && <Badge tone="danger">Sin entrega</Badge>}
                    {saleState(p).active ? (
                      <Badge tone="dark">En oferta · {formatPrice(saleState(p).priceCents, p.currency)}</Badge>
                    ) : saleState(p).upcoming ? (
                      <Badge tone="neutral">Oferta programada</Badge>
                    ) : null}
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
            </details>
          );
        })}
      </div>
      {products.length === 0 && (
        <EmptyState icon={<LayoutGrid className="h-5 w-5" />} title="Crea tu primer producto" action={<Link href="/panel/productos/nuevo" className="btn btn-primary">Nuevo producto</Link>}>
          Lecturas, sesiones, cursos o una comunidad privada.
        </EmptyState>
      )}
      <p className="mt-6 text-xs text-muted">
        Cada grupo sale en su sección de tu página, en este orden (las flechas lo mueven dentro de su grupo). {archived > 0 && `${archived} producto(s) archivado(s) con ventas: sus clientas conservan el acceso.`}
      </p>
    </div>
  );
}
