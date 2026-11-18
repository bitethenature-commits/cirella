import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DeliveryAlert } from "@/components/ui/delivery-alert";
import { Flash } from "@/components/ui/flash";
import { hasPaymentProvider } from "@/lib/payments";
import { accessModesFor, asAccessMode, hostsContent, NO_CHARGE_LABEL, NO_CHARGE_PROVIDERS, type NoChargeProvider } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { deliveryFacts, deliveryIssue, deliveryIssueCopy } from "@/lib/delivery";
import { appHost } from "@/lib/env";
import { uploadPolicy } from "@/lib/file-types";
import { fileUsage } from "@/lib/lesson-parts";
import { canSellType } from "@/lib/plans";
import { siteMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { deleteMessage } from "@/lib/delete-copy";
import { deleteProduct } from "../actions";
import { Badge } from "../../ui";
import { AccessManager } from "./access-manager";
import { CourseSummary } from "./course-summary";
import { FilesManager } from "./files-manager";
import { CommunityLink } from "./community-link";
import { IncludesManager } from "./includes-manager";
import { accessEndText } from "@/lib/access-end";
import { memberPostState } from "@/lib/community-rules";
import { countActiveMembers } from "@/lib/membership-access";
import { isPersonalMode } from "@/lib/site-mode";
import { ProductForm } from "./product-form";
import { productPreviewContext } from "./preview-context";
import { dateKeyInTz, formatDate, minutesToLabel, zonedParts } from "@/lib/tz";
import { readIntakeConfig } from "@/lib/intake";
import { WorkshopAttendees } from "./workshop-attendees";
import { productListHref, productListLabel } from "../list-href";
import { ReadingStudio } from "./reading-studio";
import { productTopics } from "@/lib/course-categories";
import { readProductTestimonials } from "@/lib/product-testimonials";
import { defaultPageTexts, readMoonChoice, readPageTexts, studioKindOf } from "@/lib/product-texts";
import { CIRCLE_JOIN_DEFAULT, topTier } from "@/lib/circle-post";
import { prisma } from "@/lib/db";
import { meetingProvider } from "@/lib/meeting-url";
import { requestCta } from "@/lib/types";
import { HORIZON_DEFAULT_DAYS } from "@/lib/slots";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { paidSessionNoticeDays } from "@/lib/withdrawal";

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
      // Solo para contarlas («Abrir en Comunidad»): se escriben y moderan en /panel/comunidad.
      posts: { select: { status: true, publishedAt: true } },
      includes: {
        orderBy: { createdAt: "asc" },
        select: { includedProductId: true, includedProduct: { select: { id: true, title: true, slug: true, status: true, creatorId: true, _count: { select: { lessons: { where: { published: true } } } } } } },
      },
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
          // Cursos y los otros niveles de la comunidad (membresías): un nivel incluye los de abajo.
          where: { type: { in: ["COURSE", "MEMBERSHIP"] }, status: { not: "ARCHIVED" }, NOT: { id } },
          orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, type: true, title: true, emoji: true, status: true, _count: { select: { lessons: { where: { published: true } } } } },
        })
      : [];
  const issue = deliveryIssue(
    deliveryFacts({
      ...product,
      _count: { files: product.files.length, lessons: product.modules.reduce((a, m) => a + m.lessons.filter((l) => l.published).length, 0), posts: product.posts.length },
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

  // Lecturas, sesiones 1:1 y círculos: se editan sobre la propia web (reading-studio.tsx).
  const studioKind = studioKindOf(product);
  if (studioKind) {
    const ctx = await productPreviewContext(creator, product, type);
    const theme = resolveTheme(ctx.config.template, ctx.config.theme, ctx.allowCustom);
    const topics = productTopics(product).filter((c) => c !== "ESPECIAL");
    // Un círculo de la luna: su publicación en la membresía más completa (lib/circle-post.ts).
    const circlePost =
      studioKind === "circle" && product.moonCircle
        ? await (async () => {
            const post = await prisma.membershipPost.findFirst({
              where: { creatorId: creator.id, circleProductId: product.id },
              select: { body: true, joinLabel: true, publishedAt: true, product: { select: { title: true } }, _count: { select: { likes: true, comments: true } } },
            });
            return {
              tier: post ? post.product.title : ((await topTier(creator.id))?.title ?? null),
              body: post?.body ?? product.summary ?? "",
              joinLabel: post?.joinLabel || CIRCLE_JOIN_DEFAULT,
              publishedAt: post ? post.publishedAt.toISOString() : null,
              likes: post?._count.likes ?? 0,
              comments: post?._count.comments ?? 0,
              timeZone: creator.timezone,
            };
          })()
        : undefined;
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href={productListHref(product)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> {productListLabel(product)}
          </Link>
          <span className="flex-1" />
          {product.status === "PUBLISHED" && (
            <Link href={`/${creator.username}/${product.slug}`} target="_blank" className="btn btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" /> Ver en la web
            </Link>
          )}
          <ConfirmForm action={deleteProduct} message={deleteMessage("esta lectura o sesión", product._count.orders)}>
            <input type="hidden" name="id" value={product.id} />
            <button className="btn btn-danger btn-sm">
              <Trash2 className="h-4 w-4" /> Borrar
            </button>
          </ConfirmForm>
        </div>
        {sp.nuevo && <Flash ok="Creado como borrador. Rellénalo paso a paso y ponlo visible al guardar." />}
        <ReadingStudio
          circlePost={circlePost}
          themeStyle={themeStyle(theme)}
          themeCard={String(theme.card)}
          template={ctx.config.template}
          product={{
            id: product.id,
            kind: studioKind,
            title: product.title,
            summary: product.summary ?? "",
            description: product.description ?? "",
            descriptionFormat: product.descriptionFormat,
            imageUrl: product.imageUrl,
            emoji: product.emoji ?? "",
            price: product.priceCents ? String(product.priceCents / 100).replace(".", ",") : "",
            ctaLabel: product.ctaLabel ?? "",
            cta: requestCta(type, product.ctaLabel),
            status: product.status,
            featured: product.featured,
            instructions: product.instructions ?? "",
            deliveryMode: product.deliveryMode,
            slug: product.slug,
            topics,
            testimonials: readProductTestimonials(product.testimonials),
            texts: (() => {
              const own = readPageTexts(product.pageTexts, studioKind);
              const d = defaultPageTexts(studioKind, meetingProvider(product.meetingUrl) === "zoom" || !product.meetingUrl ? "Por Zoom" : "Por videollamada");
              return { perks: own.perks ?? d.perks, icons: own.icons ?? d.icons, steps: own.steps ?? d.steps, cardCta: own.cardCta ?? d.cardCta, moon: readMoonChoice(product.pageTexts) };
            })(),
            moonCircle: product.moonCircle,
            eventDate: product.eventStartAt ? dateKeyInTz(product.eventStartAt, creator.timezone) : "",
            eventTime: product.eventStartAt ? (() => { const z = zonedParts(product.eventStartAt!, creator.timezone); return minutesToLabel(z.hour * 60 + z.minute); })() : "",
            capacity: product.capacity != null ? String(product.capacity) : "",
            durationMin: product.durationMin ?? 60,
            bufferMin: product.bufferMin ?? 15,
            notice: accessMode === "PAID" ? { name: "minNoticeDays", value: paidSessionNoticeDays(product) } : { name: "minNoticeHours", value: Math.min(product.minNoticeHours ?? 24, 720) },
            horizonDays: String(product.horizonDays ?? HORIZON_DEFAULT_DAYS),
            meetingUrl: product.meetingUrl ?? "",
          }}
        />
        {studioKind === "circle" && (
          <div className="mt-6">
            <WorkshopAttendees creatorId={creator.id} productId={product.id} capacity={product.capacity} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Link href={productListHref(product)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {productListLabel(product)}
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
          <ConfirmForm action={deleteProduct} message={deleteMessage(`«${product.title}» y todo su contenido`, product._count.orders)}>
            <input type="hidden" name="id" value={product.id} />
            <button className="btn btn-danger btn-sm"><Trash2 className="h-4 w-4" /> Borrar</button>
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
      {issue && issueCopy && !(type === "SESSION" && !product.groupSession) && (
        <div className="mb-5">
          <DeliveryAlert title={issueCopy.title} text={issueCopy.text} cta={issueCopy.cta} href={`#${issue.anchor}`} tone={issue.blocking ? "block" : "warn"} />
        </div>
      )}

      {sp.error === "sin-fecha" && <Flash error="Pon una fecha futura del taller para publicarlo." />}
      <ProductForm
        product={{
          ...product,
          eventDate: product.eventStartAt ? dateKeyInTz(product.eventStartAt, creator.timezone) : "",
          eventTime: product.eventStartAt ? (() => { const z = zonedParts(product.eventStartAt!, creator.timezone); return minutesToLabel(z.hour * 60 + z.minute); })() : "",
          intake: readIntakeConfig(product.intake),
          // Oferta (lib/offers.ts): fechas como días en su zona (el fin es el último día incluido).
          salePrice: product.salePriceCents ? String(product.salePriceCents / 100).replace(".", ",") : "",
          saleStart: product.saleStartsAt ? dateKeyInTz(product.saleStartsAt, creator.timezone) : "",
          saleEnd: product.saleEndsAt ? dateKeyInTz(new Date(product.saleEndsAt.getTime() - 1), creator.timezone) : "",
          hasBookings: type === "SESSION" && (await db.booking.count({ where: { productId: id } })) > 0,
          customPrivacy: !!creator.legalPrivacy,
          ownerTimezone: creator.timezone,
        }}
        host={appHost()}
        username={creator.username}
        commissionBps={mode === "personal" ? 0 : creator.plan.commissionBps}
        accessModes={accessModesFor(mode, type, hasPaymentProvider())}
        preview={await productPreviewContext(creator, product, type)}
      >
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
              {/* Las lecciones se preparan en el estudio de cursos (/panel/cursos/<id>). */}
              <CourseSummary productId={product.id} modules={product.modules} />
            </div>
          </>
        )}
        {type === "MEMBERSHIP" && (
          <>
            <div id="publicaciones" className="scroll-mt-24">
              {/* Las publicaciones se escriben, programan y moderan en el estudio Comunidad. */}
              <CommunityLink
                productId={product.id}
                members={members}
                counts={product.posts.reduce(
                  (n, p) => {
                    n[memberPostState(p, now)]++;
                    return n;
                  },
                  { PUBLISHED: 0, SCHEDULED: 0, DRAFT: 0 },
                )}
              />
            </div>
            <IncludesManager
              productId={product.id}
              selected={product.includes.map((i) => i.includedProductId)}
              options={courseOptions.map((c) => ({ id: c.id, type: c.type, title: c.title, emoji: c.emoji, draft: c.status !== "PUBLISHED", lessons: c._count.lessons }))}
            />
          </>
        )}
        {type === "SESSION" && product.groupSession && (
          <>
            <WorkshopAttendees creatorId={creator.id} productId={product.id} capacity={product.capacity} />
          </>
        )}
      </ProductForm>
    </div>
  );
}
