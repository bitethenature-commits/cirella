import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DeliveryAlert } from "@/components/ui/delivery-alert";
import { Flash } from "@/components/ui/flash";
import { hasPaymentProvider } from "@/lib/payments";
import { accessModesFor, asAccessMode, hostsContent, NO_CHARGE_LABEL, NO_CHARGE_PROVIDERS, type NoChargeProvider } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { deliveryFacts, deliveryIssue, deliveryIssueCopy } from "@/lib/delivery";
import { appHost } from "@/lib/env";
import { uploadPolicy } from "@/lib/file-types";
import { fileUsage, lessonPartViews } from "@/lib/lesson-parts";
import { canSellType } from "@/lib/plans";
import { siteMode } from "@/lib/site-mode";
import { asVatStatus } from "@/lib/tax";
import { getTaxMode } from "@/lib/tax/server";
import { tenantDb } from "@/lib/tenant";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { deleteProduct } from "../actions";
import { Badge } from "../../ui";
import { AccessManager } from "./access-manager";
import { CourseBuilder } from "./course-builder";
import { FilesManager } from "./files-manager";
import { PostsManager } from "./posts-manager";
import { ProductForm } from "./product-form";
import { formatDate } from "@/lib/tz";

/** Cuántas personas con acceso se listan en la ficha (el resto, en Inscripciones). */
const ACCESS_ROWS = 50;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; error?: string; acceso?: string; leccion?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const product = await db.product.findFirst({
    where: { id },
    include: {
      files: { orderBy: { sortOrder: "asc" } },
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: { parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, fileId: true, file: { select: { kind: true } } } } },
          },
        },
      },
      posts: { orderBy: { publishedAt: "desc" } },
      _count: { select: { orders: { where: { status: "PAID" } } } },
    },
  });
  if (!product) notFound();
  const type = product.type as ProductType;
  const members = type === "MEMBERSHIP" ? await db.subscription.count({ where: { productId: id, status: "ACTIVE" } }) : 0;
  const issue = deliveryIssue(
    deliveryFacts({
      ...product,
      _count: { files: product.files.length, lessons: product.modules.reduce((a, m) => a + m.lessons.length, 0), posts: product.posts.length },
    }),
  );
  const issueCopy = issue ? deliveryIssueCopy(issue, product.title) : null;
  const mode = siteMode();
  const accessMode = asAccessMode(product.accessMode);
  // Gratis o pagado fuera, con contenido aquí: se ve quién tiene acceso y se puede dar o quitar.
  const managesAccess = accessMode !== "PAID" && hostsContent(type);
  const noCharge = { productId: id, paymentProvider: { in: [...NO_CHARGE_PROVIDERS] }, status: "PAID" };
  const [accessOrders, accessTotal, paidSales] = managesAccess
    ? await Promise.all([
        db.order.findMany({
          where: noCharge,
          orderBy: { paidAt: "desc" },
          take: ACCESS_ROWS,
          select: { id: true, buyerName: true, buyerEmail: true, paidAt: true, paymentProvider: true, customer: { select: { userId: true } } },
        }),
        db.order.count({ where: noCharge }),
        db.order.count({ where: { productId: id, status: "PAID", paymentProvider: { notIn: [...NO_CHARGE_PROVIDERS] } } }),
      ])
    : [[], 0, product._count.orders];
  const activeAccess = managesAccess
    ? await db.access.findMany({
        where: { productId: id, status: "ACTIVE", orderId: { in: accessOrders.map((o) => o.id) } },
        select: { orderId: true },
      })
    : [];
  const activeOrders = new Set(activeAccess.map((a) => a.orderId));
  const accessRows = accessOrders.map((o) => ({
    orderId: o.id,
    name: o.buyerName,
    email: o.buyerEmail,
    date: o.paidAt ? formatDate(o.paidAt, { day: "numeric", month: "short", year: "numeric" }, creator.timezone) : "—",
    origin: NO_CHARGE_LABEL[o.paymentProvider as NoChargeProvider] ?? o.paymentProvider,
    active: activeOrders.has(o.id),
  }));

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
            <span className="text-xs text-muted">
              {managesAccess
                ? `${accessTotal} ${accessTotal === 1 ? "persona con acceso" : "personas con acceso"}${paidSales ? ` · ${paidSales} ${paidSales === 1 ? "venta" : "ventas"}` : ""}`
                : `${product._count.orders} ventas`}
            </span>
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
      {sp.error === "ultimo-contenido" && (
        <Flash error="Es lo último que entregas en un producto publicado. Sube otro antes de borrarlo o pasa el producto a borrador." />
      )}
      {sp.error === "sin-entrega" && issueCopy?.publishError && <Flash error={issueCopy.publishError} />}
      {sp.acceso === "quitado" && <Flash ok="Acceso retirado. Sus enlaces ya no funcionan." />}
      {sp.leccion === "eliminada" && <Flash ok="Lección eliminada." />}
      {sp.error === "acceso" && <Flash error="No hemos encontrado ese acceso." />}
      {issue && issueCopy && (
        <div className="mb-5">
          <DeliveryAlert title={issueCopy.title} text={issueCopy.text} cta={issueCopy.cta} href={`#${issue.anchor}`} tone={issue.blocking ? "block" : "warn"} />
        </div>
      )}

      <ProductForm
        product={{ ...product }}
        host={appHost()}
        username={creator.username}
        commissionBps={mode === "personal" ? 0 : creator.plan.commissionBps}
        taxPreview={{ mode: await getTaxMode(), country: creator.legalCountry, vatStatus: asVatStatus(creator.vatStatus) }}
        accessModes={accessModesFor(mode, type, hasPaymentProvider())}
      />

      <div className="mt-5 space-y-5 lg:max-w-[calc(100%-340px)]">
        {managesAccess && <AccessManager productId={product.id} rows={accessRows} total={accessTotal} external={accessMode === "EXTERNAL"} />}
        {type === "DIGITAL" && (
          <FilesManager productId={product.id} files={product.files} limitsLabel={uploadPolicy(mode === "personal").label} title="Archivos que se entregan" hint="PDF, audio, vídeo, ebook… Tus clientas los descargan desde su cuenta justo después de pagar." />
        )}
        {type === "COURSE" && (
          <>
            <FilesManager
              productId={product.id}
              files={product.files}
              limitsLabel={uploadPolicy(mode === "personal").label}
              title="Materiales del curso"
              hint="Vídeos (MP4 o MOV), audios (M4A o MP3), PDF e imágenes. También puedes subirlos desde cada lección."
              usage={fileUsage(product.modules.flatMap((m) => m.lessons.flatMap((l) => l.parts.map((p) => ({ fileId: p.fileId, lessonId: l.id })))))}
            />
            <div id="lecciones" className="scroll-mt-24">
              <CourseBuilder
                productId={product.id}
                modules={product.modules.map((m) => ({
                  id: m.id,
                  title: m.title,
                  lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, durationMin: l.durationMin, views: lessonPartViews(l.parts) })),
                }))}
              />
            </div>
          </>
        )}
        {type === "MEMBERSHIP" && (
          <div id="publicaciones" className="scroll-mt-24">
            <PostsManager
              productId={product.id}
              members={members}
              posts={product.posts.map((p) => ({ id: p.id, title: p.title, body: p.body, bodyFormat: p.bodyFormat, kind: p.kind, publishedAt: formatDate(p.publishedAt, { day: "numeric", month: "long" }, creator.timezone) }))}
            />
          </div>
        )}
        {type === "SESSION" && accessMode !== "EXTERNAL" && (
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
