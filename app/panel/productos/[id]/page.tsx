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
import { IncludesManager } from "./includes-manager";
import { accessEndText } from "@/lib/access-end";
import { memberPostState, scheduleLabel } from "@/lib/community-rules";
import { countActiveMembers } from "@/lib/membership-access";
import { isPersonalMode } from "@/lib/site-mode";
import { ProductForm } from "./product-form";
import { dateKeyInTz, formatDate, minutesToLabel, zonedParts } from "@/lib/tz";
import { readIntakeConfig } from "@/lib/intake";
import { notifyWorkshopReplay } from "../actions";
import { WorkshopAttendees } from "./workshop-attendees";

/** Cuántas personas con acceso se listan en la ficha (el resto, en Inscripciones). */
const ACCESS_ROWS = 50;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; error?: string; acceso?: string; leccion?: string; avisadas?: string; publicacion?: string }>;
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
      posts: {
        orderBy: { publishedAt: "desc" },
        take: 50,
        include: { _count: { select: { likes: true, files: true, comments: { where: { status: "VISIBLE" } } } } },
      },
      includes: { select: { includedProductId: true } },
      includedIn: { select: { product: { select: { id: true, title: true } } } },
      _count: { select: { orders: { where: { status: "PAID" } } } },
    },
  });
  if (!product) notFound();
  const type = product.type as ProductType;
  // Personas con acceso vigente (de pago, gratis o dado a mano), sin la dueña.
  const members = type === "MEMBERSHIP" ? await countActiveMembers(creator.id, id) : 0;
  const courseOptions =
    type === "MEMBERSHIP"
      ? await db.product.findMany({
          where: { type: "COURSE", status: { not: "ARCHIVED" } },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, emoji: true, status: true, _count: { select: { lessons: true } } },
        })
      : [];
  const issue = deliveryIssue(
    deliveryFacts({
      ...product,
      _count: { files: product.files.length, lessons: product.modules.reduce((a, m) => a + m.lessons.length, 0), posts: product.posts.length },
    }),
  );
  const issueCopy = issue ? deliveryIssueCopy(issue, product.title) : null;
  const mode = siteMode();
  const accessMode = asAccessMode(product.accessMode);
  // Gratis o pagado fuera, con contenido aquí: se ve quién tiene acceso y se puede dar o quitar. En la
  // web personal, también lo de pago (para quien paga por Bizum o transferencia, o para regalarlo).
  const managesAccess = hostsContent(type) && (accessMode !== "PAID" || isPersonalMode());
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
        where: { productId: id, orderId: { in: accessOrders.map((o) => o.id) } },
        select: { orderId: true, status: true, expiresAt: true },
      })
    : [];
  const now = new Date();
  const accessByOrder = new Map(activeAccess.map((a) => [a.orderId, a]));
  const accessRows = accessOrders.map((o) => ({
    orderId: o.id,
    name: o.buyerName,
    email: o.buyerEmail,
    date: o.paidAt ? formatDate(o.paidAt, { day: "numeric", month: "short", year: "numeric" }, creator.timezone) : "—",
    origin: NO_CHARGE_LABEL[o.paymentProvider as NoChargeProvider] ?? o.paymentProvider,
    ...(() => {
      const a = accessByOrder.get(o.id);
      const live = !!a && a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now);
      const ended = !!a && !!a.expiresAt && a.expiresAt <= now && (a.status === "ACTIVE" || a.status === "EXPIRED");
      return { active: live, ended, until: a?.expiresAt && (live || ended) ? accessEndText(a.expiresAt, creator.timezone, now) : null };
    })(),
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

      {sp.error === "sin-fecha" && <Flash error="Pon una fecha futura del taller para publicarlo." />}
      {sp.avisadas !== undefined && <Flash ok={`Aviso de la grabación enviado a ${sp.avisadas} ${sp.avisadas === "1" ? "asistente" : "asistentes"}.`} />}
      <ProductForm
        product={{
          ...product,
          eventDate: product.eventStartAt ? dateKeyInTz(product.eventStartAt, creator.timezone) : "",
          eventTime: product.eventStartAt ? (() => { const z = zonedParts(product.eventStartAt!, creator.timezone); return minutesToLabel(z.hour * 60 + z.minute); })() : "",
          intake: readIntakeConfig(product.intake),
          hasBookings: type === "SESSION" && (await db.booking.count({ where: { productId: id } })) > 0,
          customPrivacy: !!creator.legalPrivacy,
          ownerTimezone: creator.timezone,
        }}
        host={appHost()}
        username={creator.username}
        commissionBps={mode === "personal" ? 0 : creator.plan.commissionBps}
        taxPreview={{ mode: await getTaxMode(), country: creator.legalCountry, vatStatus: asVatStatus(creator.vatStatus) }}
        accessModes={accessModesFor(mode, type, hasPaymentProvider())}
      />

      <div className="mt-5 space-y-5 lg:max-w-[calc(100%-340px)]">
        {managesAccess && (
          <AccessManager productId={product.id} rows={accessRows} total={accessTotal} external={accessMode === "EXTERNAL"} paid={accessMode === "PAID"} timeZone={creator.timezone} />
        )}
        {product.includedIn.length > 0 && (
          <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-muted">
            Incluido en: {product.includedIn.map((i, n) => (
              <span key={i.product.id}>
                {n > 0 && ", "}
                <Link href={`/panel/productos/${i.product.id}#incluye`} className="font-semibold text-ink underline-offset-2 hover:underline">«{i.product.title}»</Link>
              </span>
            ))}
            . Sus miembros lo ven mientras su membresía esté activa.
          </p>
        )}
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
          <>
            <div id="publicaciones" className="scroll-mt-24">
              <PostsManager
                productId={product.id}
                members={members}
                flash={sp.publicacion === "borrada" ? "Publicación eliminada." : null}
                posts={product.posts.map((p) => {
                  const state = memberPostState(p, now);
                  return {
                    id: p.id,
                    title: p.title,
                    kind: p.kind,
                    state,
                    chip:
                      state === "DRAFT"
                        ? "Borrador"
                        : state === "SCHEDULED"
                          ? `Programada · ${scheduleLabel(p.publishedAt, creator.timezone)}`
                          : `Publicada · ${formatDate(p.publishedAt, { day: "numeric", month: "short" }, creator.timezone)}`,
                    likes: p._count.likes,
                    comments: p._count.comments,
                    files: p._count.files,
                    notified: p.notify && p.notifiedAt ? p.notifiedCount : null,
                  };
                })}
              />
            </div>
            <IncludesManager
              productId={product.id}
              selected={product.includes.map((i) => i.includedProductId)}
              options={courseOptions.map((c) => ({ id: c.id, title: c.title, emoji: c.emoji, draft: c.status !== "PUBLISHED", lessons: c._count.lessons }))}
            />
          </>
        )}
        {type === "SESSION" && product.groupSession && (
          <>
            <WorkshopAttendees creatorId={creator.id} productId={product.id} capacity={product.capacity} />
            <FilesManager productId={product.id} files={product.files} limitsLabel={uploadPolicy(mode === "personal").label} title="Grabación y materiales" hint="Lo verán solo las asistentes de este taller en su área." />
            {product.files.length > 0 && product.eventStartAt && product.eventStartAt < new Date() && (
              <ConfirmForm action={notifyWorkshopReplay} message="¿Enviar a cada asistente un email con la grabación? Solo se envía una vez a cada una.">
                <input type="hidden" name="id" value={product.id} />
                <button className="btn btn-outline h-11">Avisar de la grabación</button>
              </ConfirmForm>
            )}
          </>
        )}
        {type === "SESSION" && accessMode !== "EXTERNAL" && !product.groupSession && (
          <section className="card flex flex-wrap items-center gap-4 p-5">
            <CalendarDays className="h-6 w-6 text-lavender-deep" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Disponibilidad</p>
              <p className="text-sm text-muted">Tus días, horarios y días bloqueados se aplican a todas tus sesiones.</p>
            </div>
            <Link href="/panel/reservas/horario" className="btn btn-outline btn-sm">Configurar horario</Link>
          </section>
        )}
      </div>
    </div>
  );
}
