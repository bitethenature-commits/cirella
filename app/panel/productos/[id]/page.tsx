import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { appHost } from "@/lib/env";
import { canSellType } from "@/lib/plans";
import { asVatStatus } from "@/lib/tax";
import { getTaxMode } from "@/lib/tax/server";
import { tenantDb } from "@/lib/tenant";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { deleteProduct } from "../actions";
import { Badge } from "../../ui";
import { CourseBuilder } from "./course-builder";
import { FilesManager } from "./files-manager";
import { PostsManager } from "./posts-manager";
import { ProductForm } from "./product-form";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const product = await db.product.findFirst({
    where: { id },
    include: {
      files: { orderBy: { sortOrder: "asc" } },
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" } } } },
      posts: { orderBy: { publishedAt: "desc" } },
      _count: { select: { orders: { where: { status: "PAID" } } } },
    },
  });
  if (!product) notFound();
  const type = product.type as ProductType;
  const members = type === "MEMBERSHIP" ? await db.subscription.count({ where: { productId: id, status: "ACTIVE" } }) : 0;

  return (
    <div>
      <Link href="/panel/productos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Productos
      </Link>
      <div className="mb-6 mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{PRODUCT_TYPE_LABEL[type]}</p>
          <h1 className="display mt-1 text-[2.3rem] leading-tight">{product.emoji} {product.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            {product.status === "PUBLISHED" ? <Badge tone="success">Publicado</Badge> : product.status === "ARCHIVED" ? <Badge>Archivado</Badge> : <Badge tone="warning">Borrador</Badge>}
            <span className="text-xs text-muted">{product._count.orders} ventas</span>
          </div>
        </div>
        <div className="flex gap-2">
          {product.status === "PUBLISHED" && (
            <Link href={`/${creator.username}/${product.slug}`} target="_blank" className="btn btn-outline btn-sm"><ExternalLink className="h-4 w-4" /> Ver</Link>
          )}
          <ConfirmForm action={deleteProduct} message={product._count.orders > 0 ? null : "¿Eliminar este producto y todo su contenido? No se puede deshacer."}>
            <input type="hidden" name="id" value={product.id} />
            <button className="btn btn-danger btn-sm"><Trash2 className="h-4 w-4" /> {product._count.orders > 0 ? "Archivar" : "Eliminar"}</button>
          </ConfirmForm>
        </div>
      </div>
      {sp.nuevo && <Flash ok="Producto creado como borrador. Completa los datos, pon precio y publícalo." />}
      {!canSellType(creator.plan, type) && <Flash error={`Tu plan ${creator.plan.name} no incluye ${PRODUCT_TYPE_LABEL[type].toLowerCase()}s. Mejora tu plan para publicarlo.`} />}

      <ProductForm
        product={{ ...product }}
        host={appHost()}
        username={creator.username}
        commissionBps={creator.plan.commissionBps}
        taxPreview={{ mode: await getTaxMode(), country: creator.legalCountry, vatStatus: asVatStatus(creator.vatStatus) }}
      />

      <div className="mt-5 space-y-5 lg:max-w-[calc(100%-340px)]">
        {type === "DIGITAL" && (
          <FilesManager productId={product.id} files={product.files} title="Archivos que se entregan" hint="PDF, audio, vídeo, ebook… Tus clientas los descargan desde su cuenta justo después de pagar." />
        )}
        {type === "COURSE" && (
          <>
            <FilesManager productId={product.id} files={product.files} title="Materiales del curso" hint="Sube vídeos, audios y PDF y asígnalos a cada lección." />
            <CourseBuilder
              productId={product.id}
              modules={product.modules.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons }))}
              files={product.files.map((f) => ({ id: f.id, name: f.name, kind: f.kind }))}
            />
          </>
        )}
        {type === "MEMBERSHIP" && (
          <PostsManager
            productId={product.id}
            members={members}
            posts={product.posts.map((p) => ({ id: p.id, title: p.title, body: p.body, kind: p.kind, publishedAt: p.publishedAt.toLocaleDateString("es-ES", { day: "numeric", month: "long" }) }))}
          />
        )}
        {type === "SESSION" && (
          <section className="card flex flex-wrap items-center gap-4 p-5">
            <CalendarDays className="h-6 w-6 text-lavender-deep" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Disponibilidad</p>
              <p className="text-sm text-muted">Tus días, horarios y días bloqueados se aplican a todas tus sesiones.</p>
            </div>
            <Link href="/panel/reservas#disponibilidad" className="btn btn-outline btn-sm">Configurar horario</Link>
          </section>
        )}
      </div>
    </div>
  );
}
