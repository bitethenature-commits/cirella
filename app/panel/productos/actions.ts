"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ACCESS_MODE_LABEL,
  ACCESS_MODES,
  accessModesFor,
  asAccessMode,
  defaultAccessMode,
  EXTERNAL_LABEL_MAX,
  parseExternalUrl,
  publishPriceError,
  resolveAccessMode,
  storedPriceCents,
} from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { uniqueProductSlug } from "@/lib/creator";
import { DELIVERY_MODES, deliveryIssueCopy, normalizeDeliveryMode, productDeliveryIssue } from "@/lib/delivery";
import { FreeAccessError, grantManualAccess, revokeManualAccess } from "@/lib/free-access";
import { accessEndFrom, asAccessEndChoice, lastDayText } from "@/lib/access-end";
import { LESSON_PARTS_JSON_MAX, parseLessonParts } from "@/lib/lesson-parts";
import { LessonSaveError, saveLessonWithParts } from "@/lib/lessons";
import { parseMoneyToCents } from "@/lib/money";
import { cleanRichInput, formatToStore, normalizeNewlines, parseTextFormat } from "@/lib/rich-text";
import { canSellType } from "@/lib/plans";
import { hasPaymentProvider } from "@/lib/payments";
import { siteMode } from "@/lib/site-mode";
import { RESERVED_PRODUCT_SLUGS } from "@/lib/slug";
import { privateKey, storage } from "@/lib/storage";
import { tenantDb, type TenantDb } from "@/lib/tenant";
import { wouldCreateCycle } from "@/lib/tiers";
import { asCourseCategory } from "@/lib/course-categories";
import { checkSaleInput, saleFormSchema, SALE_LABEL_MAX } from "@/lib/offers";
import { Prisma } from "@prisma/client";
import { applyProductMeetingUrl } from "@/lib/booking-changes";
import { parseIntakeConfigInput } from "@/lib/intake";
import { parseMeetingUrl } from "@/lib/meeting-url";
import { HORIZON_CHOICES } from "@/lib/slots";
import { addDaysToKey, labelToMinutes, zonedTimeToUtc } from "@/lib/tz";
import { moveWorkshop, notifyReplay, workshopClash } from "@/lib/workshops";
import { followsDay15Rule, PAID_SESSION_MAX_NOTICE_DAYS, PAID_SESSION_MIN_NOTICE_DAYS, paidSessionNoticeDays } from "@/lib/withdrawal";
import { DEFAULT_CTA, PRODUCT_TYPES, type ProductType } from "@/lib/types";

export type ActionState = { ok?: string; error?: string } | undefined;

async function ctx() {
  const { creator } = await requireCreator();
  return { creator, db: tenantDb(creator.id) };
}

function refresh(id?: string) {
  revalidatePath("/panel/productos");
  if (id) revalidatePath(`/panel/productos/${id}`);
  // La página pública está cacheada (ISR): reordenar, archivar o borrar debe verse ya.
  revalidatePath("/[username]", "page");
}

/** Borra del almacenamiento los archivos de unos ProductFile ya eliminados. Si falla, quedan huérfanos (no rompe nada). */
async function deleteStoredFiles(storageKeys: (string | null)[]) {
  const keys = storageKeys.filter((k): k is string => !!k).map(privateKey);
  if (keys.length) await storage().delete(keys).catch(() => {});
}

// ───────────── Productos ─────────────

export async function createProduct(form: FormData) {
  const { creator, db } = await ctx();
  const type = z.enum(PRODUCT_TYPES).parse(form.get("type"));
  // «Taller en directo»: una sesión con fecha fija para varias personas.
  const group = type === "SESSION" && form.get("group") === "1";
  if (!canSellType(creator.plan, type)) redirect("/panel/plan");
  const count = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
  if (creator.plan.maxProducts != null && count >= creator.plan.maxProducts) redirect("/panel/productos?limite=1");
  const titles: Record<ProductType, string> = {
    DIGITAL: "Nuevo producto digital",
    SESSION: "Nueva sesión",
    COURSE: "Nuevo curso",
    MEMBERSHIP: "Nueva membresía",
  };
  // En la web personal con cobros, de pago en la web; sin cobros, gratis con email (o, una sesión,
  // pago en otra web).
  const accessMode = defaultAccessMode(siteMode(), type, hasPaymentProvider());
  const title = group ? "Nuevo taller en directo" : titles[type];
  const product = await db.product.create({
    data: {
      creatorId: creator.id,
      type,
      title,
      slug: await uniqueProductSlug(creator.id, title),
      groupSession: group,
      priceCents: 0,
      status: "DRAFT",
      accessMode,
      ctaLabel: accessMode === "FREE_EMAIL" ? FREE_CTA : DEFAULT_CTA[type],
      sortOrder: count + 1,
      billingInterval: type === "MEMBERSHIP" ? "month" : null,
      durationMin: type === "SESSION" ? 60 : null,
      bufferMin: type === "SESSION" ? 15 : null,
      // Sesión individual de pago en la web: 15 días desde la compra (lib/withdrawal.ts).
      minNoticeHours: type === "SESSION" ? (group ? 0 : accessMode === "PAID" ? PAID_SESSION_MIN_NOTICE_DAYS * 24 : 24) : null,
      emoji: group ? "🌙" : { DIGITAL: "✨", SESSION: "🔮", COURSE: "📖", MEMBERSHIP: "💫" }[type],
    },
  });
  if (type === "COURSE") await db.courseModule.create({ data: { creatorId: creator.id, productId: product.id, title: "Módulo 1", sortOrder: 0 } });
  redirect(`/panel/productos/${product.id}?nuevo=1`);
}

/** Botón por defecto de un producto gratis con email. */
const FREE_CTA = "Quiero el acceso gratis";

const productSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(2, "El título es demasiado corto").max(100),
  emoji: z.string().max(8).optional(),
  summary: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(),
  // Formato de la descripción (lib/rich-text.ts): tolerante; "" = texto de antes, ausente = el guardado.
  descriptionFormat: z.string().max(8).optional().transform(parseTextFormat),
  imageUrl: z.string().max(500).optional(),
  price: z.string(),
  ctaLabel: z.string().trim().max(30).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  featured: z.string().optional(),
  instructions: z.string().trim().max(1000).optional(),
  slug: z.string().trim().max(60).optional(),
  durationMin: z.coerce.number().int().min(10).max(480).optional(),
  bufferMin: z.coerce.number().int().min(0).max(240).optional(),
  minNoticeHours: z.coerce.number().int().min(0).max(24 * 30).optional(),
  // Sesión individual que se paga en la web: antelación en días desde la compra (mínimo 15).
  minNoticeDays: z.coerce.number({ message: "Escribe la antelación en días" }).int("Escribe la antelación en días enteros").optional(),
  meetingUrl: z.string().trim().max(600).optional(),
  // Calendario propio (lib/slots.ts, lib/intake.ts, talleres).
  horizonDays: z.string().max(4).optional(),
  groupSession: z.string().optional(),
  eventDate: z.string().max(10).optional(),
  eventTime: z.string().max(5).optional(),
  capacity: z.string().max(4).optional(),
  intake: z.string().max(4000, "Demasiadas preguntas o demasiado largas").optional(),
  billingInterval: z.enum(["month", "year"]).optional(),
  deliveryMode: z.enum(DELIVERY_MODES).optional(),
  // Cómo se consigue (lib/access-mode.ts). En la plataforma el formulario no lo envía: se conserva.
  accessMode: z.enum(ACCESS_MODES).optional(),
  externalUrl: z.string().trim().max(600).optional(),
  externalLabel: z.string().trim().max(EXTERNAL_LABEL_MAX, `El texto del botón admite ${EXTERNAL_LABEL_MAX} caracteres`).optional(),
  // Cursos: método para la página /cursos. Talleres: «Círculo de la luna».
  courseCategory: z.string().max(20).optional(),
  moonCircle: z.string().optional(),
}).merge(saleFormSchema);

export async function updateProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const { creator, db } = await ctx();
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const product = await db.product.findFirst({ where: { id: d.id } });
  if (!product) return { error: "Producto no encontrado" };
  if (product.status === "ARCHIVED" && creator.plan.maxProducts != null) {
    const active = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
    if (active >= creator.plan.maxProducts) return { error: `Has llegado al límite de ${creator.plan.maxProducts} productos de tu plan. Archiva otro o mejora tu plan.` };
  }
  const accessMode = resolveAccessMode(d.accessMode, product.accessMode, siteMode(), product.type, hasPaymentProvider());
  const priceCents = storedPriceCents(accessMode, parseMoneyToCents(d.price));
  const priceError = d.status === "PUBLISHED" ? publishPriceError(accessMode, priceCents) : null;
  if (priceError) return { error: priceError };
  // Pago en otra web: el enlace (https) es obligatorio también en borrador, para no guardar uno roto.
  let externalUrl: string | null = product.externalUrl;
  let externalLabel: string | null = product.externalLabel;
  if (accessMode === "EXTERNAL") {
    const url = parseExternalUrl(d.externalUrl ?? product.externalUrl);
    if (!url.ok) return { error: url.error };
    externalUrl = url.url;
    externalLabel = d.externalLabel !== undefined ? d.externalLabel || null : product.externalLabel;
  }
  if (d.status === "PUBLISHED" && !canSellType(creator.plan, product.type as ProductType))
    return { error: "Tu plan actual no permite publicar este tipo de producto" };
  const deliveryMode = normalizeDeliveryMode(product.type, d.deliveryMode ?? product.deliveryMode);
  // Publicar exige algo que entregar (lib/delivery.ts), con el modo y las instrucciones que llegan en el formulario.
  // Un borrador se guarda aunque esté incompleto. Lo que se paga fuera lo entrega la otra web.
  if (d.status === "PUBLISHED") {
    const r = await productDeliveryIssue(db, product.id, { deliveryMode, instructions: d.instructions || null, accessMode });
    if (r?.issue?.blocking) return { error: deliveryIssueCopy(r.issue, d.title).publishError };
  }
  const wantedSlug = d.slug ? d.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : product.slug;
  // Un slug que ha pasado a estar reservado (p. ej. «novedades») se recalcula aunque no cambie.
  const slug =
    wantedSlug !== product.slug || RESERVED_PRODUCT_SLUGS.has(wantedSlug)
      ? await uniqueProductSlug(creator.id, wantedSlug, product.id)
      : product.slug;
  // Sesiones: enlace de Zoom (solo https), horizonte, taller y datos que se piden.
  const meeting = parseMeetingUrl(d.meetingUrl);
  if (product.type === "SESSION" && !meeting.ok) return { error: meeting.error };
  const meetingUrl = meeting.ok ? meeting.url : null;
  const horizonDays = d.horizonDays && (HORIZON_CHOICES as readonly number[]).includes(Number(d.horizonDays)) ? Number(d.horizonDays) : null;
  const seatsSold = product.type === "SESSION" ? await db.booking.count({ where: { productId: product.id, status: { in: ["CONFIRMED", "COMPLETED", "PENDING_SCHEDULE"] } } }) : 0;
  const wantsGroup = product.type === "SESSION" && (d.groupSession === undefined ? product.groupSession : d.groupSession === "on");
  if (product.type === "SESSION" && wantsGroup !== product.groupSession && seatsSold > 0)
    return { error: wantsGroup ? "Esta sesión ya tiene reservas: crea un taller nuevo." : "Este taller ya tiene plazas vendidas: no se puede convertir en sesión individual." };
  let eventStartAt: Date | null = product.eventStartAt;
  let capacity: number | null = product.capacity;
  if (wantsGroup) {
    if (d.eventDate || d.eventTime) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.eventDate ?? "") || !/^\d{2}:\d{2}$/.test(d.eventTime ?? "")) return { error: "Escribe el día y la hora del taller" };
      eventStartAt = zonedTimeToUtc(d.eventDate!, labelToMinutes(d.eventTime!), creator.timezone);
    }
    capacity = d.capacity ? Number(d.capacity) : null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) return { error: "Las plazas van de 1 a 500 (vacío = sin límite)" };
    if (d.status === "PUBLISHED" && (!eventStartAt || eventStartAt <= new Date())) return { error: "Pon una fecha futura del taller para publicarlo" };
  }
  // Antelación: en una sesión individual que se paga en la web, días desde la compra y nunca menos
  // de 15 (lib/withdrawal.ts); en el resto, horas como siempre.
  let minNoticeHours = d.minNoticeHours ?? (wantsGroup ? 0 : 24);
  if (product.type === "SESSION" && followsDay15Rule({ type: product.type, groupSession: wantsGroup, accessMode })) {
    const days = d.minNoticeDays ?? paidSessionNoticeDays(product);
    if (days < PAID_SESSION_MIN_NOTICE_DAYS)
      return { error: `La antelación mínima de una sesión que se paga en la web es de ${PAID_SESSION_MIN_NOTICE_DAYS} días: así nunca cae dentro de los 14 días en los que tu clienta puede desistir.` };
    if (days > PAID_SESSION_MAX_NOTICE_DAYS) return { error: `La antelación mínima puede ser de ${PAID_SESSION_MAX_NOTICE_DAYS} días como mucho` };
    minNoticeHours = days * 24;
  }
  const dateChanged = wantsGroup && !!eventStartAt && eventStartAt.getTime() !== product.eventStartAt?.getTime();
  if (dateChanged) {
    const clash = await workshopClash(creator.id, eventStartAt!, new Date(eventStartAt!.getTime() + (d.durationMin ?? 60) * 60000), product.id);
    if (clash) return { error: `Esa hora choca con ${clash.label}` };
  }
  let intakeJson: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined;
  if (d.intake !== undefined) {
    const cfg = parseIntakeConfigInput(d.intake);
    if (!cfg.ok) return { error: cfg.error };
    intakeJson = cfg.value ? (cfg.value as unknown as Prisma.InputJsonObject) : Prisma.DbNull;
  }
  if (d.imageUrl && !d.imageUrl.startsWith("/media/") && !d.imageUrl.startsWith("/demo/")) return { error: "Imagen no válida" };
  // Oferta (lib/offers.ts): solo en lo que se paga en la web. Las fechas son días enteros en su zona:
  // empieza a las 00:00 del día de inicio y termina al acabar el día de fin.
  let saleData: { salePriceCents: number | null; saleStartsAt: Date | null; saleEndsAt: Date | null; saleLabel: string | null } | null = null;
  if (accessMode === "PAID" && form.get("saleForm") === "1") {
    const sale = checkSaleInput({
      on: d.saleOn,
      priceCents,
      salePriceCents: d.salePrice ? parseMoneyToCents(d.salePrice) : null,
      starts: d.saleStart ? zonedTimeToUtc(d.saleStart, 0, creator.timezone) : null,
      ends: d.saleEnd ? zonedTimeToUtc(addDaysToKey(d.saleEnd, 1), 0, creator.timezone) : null,
    });
    if (!sale.ok) return { error: sale.error };
    saleData = sale.value
      ? { ...sale.value, saleLabel: d.saleLabel?.slice(0, SALE_LABEL_MAX) || null }
      : { salePriceCents: null, saleStartsAt: null, saleEndsAt: null, saleLabel: null };
  }
  const description = d.description ? normalizeNewlines(d.description) : null;
  const descriptionFormat = formatToStore(description, d.descriptionFormat, product.descriptionFormat);
  const featured = d.featured === "on";
  if (featured && !product.featured) await db.product.updateMany({ where: { featured: true }, data: { featured: false } });
  await db.product.update({
    where: { id: product.id },
    data: {
      title: d.title,
      emoji: d.emoji || null,
      summary: d.summary || null,
      description: description && descriptionFormat ? cleanRichInput(description, { creatorId: creator.id, images: true }) : description,
      descriptionFormat,
      imageUrl: d.imageUrl || null,
      priceCents,
      ctaLabel: d.ctaLabel || (accessMode === "FREE_EMAIL" ? FREE_CTA : DEFAULT_CTA[product.type as ProductType]),
      accessMode,
      externalUrl,
      externalLabel,
      status: d.status,
      featured,
      instructions: d.instructions || null,
      deliveryMode,
      slug,
      ...(product.type === "SESSION"
        ? {
            durationMin: d.durationMin ?? 60,
            bufferMin: d.bufferMin ?? 15,
            minNoticeHours,
            meetingUrl,
            horizonDays,
            groupSession: wantsGroup,
            eventStartAt: wantsGroup ? (dateChanged && seatsSold > 0 ? product.eventStartAt : eventStartAt) : null,
            capacity: wantsGroup ? capacity : null,
          }
        : {}),
      ...(intakeJson !== undefined && (product.type === "SESSION" || product.type === "DIGITAL") ? { intake: intakeJson } : {}),
      ...(saleData ?? {}),
      ...(product.type === "COURSE" && d.courseCategory !== undefined ? { courseCategory: asCourseCategory(d.courseCategory) } : {}),
      ...(product.type === "SESSION" ? { moonCircle: wantsGroup && d.moonCircle === "on" } : {}),
      ...(product.type === "MEMBERSHIP" ? { billingInterval: d.billingInterval ?? "month" } : {}),
    },
  });
  // Con plazas vendidas, mover el taller avisa a cada asistente (lib/workshops.ts).
  const notes: string[] = [];
  if (dateChanged && seatsSold > 0) {
    const m = await moveWorkshop({ creatorId: creator.id, productId: product.id, startAt: eventStartAt! });
    if (!m.ok) return { error: m.error };
    notes.push(`Hemos avisado del cambio de fecha a ${m.moved} ${m.moved === 1 ? "asistente" : "asistentes"}.`);
  }
  if (product.type === "SESSION" && meetingUrl !== product.meetingUrl) {
    const n = await applyProductMeetingUrl({ creatorId: creator.id, productId: product.id, previous: product.meetingUrl, next: meetingUrl });
    if (n) notes.push(`Hemos enviado el enlace nuevo a ${n} ${n === 1 ? "clienta" : "clientas"}.`);
  }
  refresh(product.id);
  revalidatePath(`/${creator.username}`);
  if (notes.length) return { ok: `${d.status === "PUBLISHED" ? "Guardado y publicado." : "Guardado."} ${notes.join(" ")}` };
  // En la web personal sin cobros lo que se cobraba en la web se guarda tal cual, pero no se ve: se dice.
  if (accessMode === "PAID" && siteMode() === "personal" && !hasPaymentProvider()) {
    const choices = accessModesFor("personal", product.type).map((m) => `«${ACCESS_MODE_LABEL[m]}»`).join(" o ");
    return { ok: `Guardado. No se ve en tu página: en tu web no se cobra nada. Elige ${choices} para que aparezca.` };
  }
  return { ok: d.status === "PUBLISHED" ? "Guardado y publicado en tu página" : "Guardado como borrador" };
}

export async function moveProduct(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  const list = await db.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const i = list.findIndex((p) => p.id === id);
  let j = i + dir;
  // Desde el editor solo se ven los productos de la página: saltamos los ocultos (borradores y, en la
  // web personal, lo que se cobraba en la web).
  const signupsOnly = siteMode() === "personal" && !hasPaymentProvider();
  const hidden = (p: (typeof list)[number]) => p.status !== "PUBLISHED" || (signupsOnly && asAccessMode(p.accessMode) === "PAID");
  if (form.get("visible") === "1") while (j >= 0 && j < list.length && hidden(list[j])) j += dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((p, idx) => db.product.update({ where: { id: p.id }, data: { sortOrder: idx + 1 } })));
  refresh();
}

export async function setProductStatus(form: FormData) {
  const { creator, db } = await ctx();
  const id = String(form.get("id"));
  const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(form.get("status"));
  const product = await db.product.findFirst({ where: { id } });
  if (!product) return;
  if (product.status === "ARCHIVED" && status !== "ARCHIVED" && creator.plan.maxProducts != null) {
    const active = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
    if (active >= creator.plan.maxProducts) redirect("/panel/productos?limite=1");
  }
  const accessMode = asAccessMode(product.accessMode);
  if (
    status === "PUBLISHED" &&
    (publishPriceError(accessMode, product.priceCents) ||
      (accessMode === "EXTERNAL" && !product.externalUrl) ||
      !canSellType(creator.plan, product.type as ProductType))
  )
    redirect(`/panel/productos/${id}`);
  // Un taller sin fecha futura no se publica.
  if (status === "PUBLISHED" && product.groupSession && (!product.eventStartAt || product.eventStartAt <= new Date())) redirect(`/panel/productos/${id}?error=sin-fecha#sesion`);
  if (status === "PUBLISHED") {
    const issue = (await productDeliveryIssue(db, id))?.issue;
    if (issue?.blocking) redirect(`/panel/productos/${id}?error=sin-entrega#${issue.anchor}`);
  }
  await db.product.update({ where: { id }, data: { status } });
  refresh(id);
}

export async function deleteProduct(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const orders = await db.order.count({ where: { productId: id } });
  // Con ventas no se borra (las clientas mantienen su acceso): se archiva.
  if (orders > 0) await db.product.update({ where: { id }, data: { status: "ARCHIVED", featured: false } });
  else {
    const files = await db.productFile.findMany({ where: { productId: id, storageKey: { not: null } }, select: { storageKey: true } });
    await db.product.deleteMany({ where: { id } });
    await deleteStoredFiles(files.map((f) => f.storageKey));
  }
  refresh();
  redirect("/panel/productos");
}

/**
 * Un producto publicado no puede quedarse sin nada que entregar: primero se sube el nuevo, luego se
 * borra el viejo. Si el borrado lo dejaría vacío, vuelve al editor con el aviso y no borra nada.
 */
async function guardLastDeliverable(db: TenantDb, productId: string, minus: { files?: number; lessons?: number }, anchor: string) {
  const r = await productDeliveryIssue(db, productId, { minus });
  if (r?.product.status === "PUBLISHED" && r.issue?.blocking) redirect(`/panel/productos/${productId}?error=ultimo-contenido#${anchor}`);
}

// ───────────── Acceso a mano (gratis o pagado fuera) ─────────────

const grantSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2, "Escribe su nombre").max(80),
  email: z.string().trim().toLowerCase().max(200).email("Revisa el email"),
  accessEnd: z.unknown().transform(asAccessEndChoice),
  accessEndDate: z.string().max(10).optional(),
});

/**
 * «Dar acceso a una persona»: pedido de 0 € (paymentProvider «manual») y el mismo email de acceso
 * que recibe quien se apunta gratis. Si ya lo tenía, se le reenvía el enlace.
 */
export async function grantAccess(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, creator } = await requireCreator();
  const parsed = grantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  // «Duración del acceso»: el último día (incluido) cuenta en su zona horaria.
  const end = accessEndFrom({ choice: d.accessEnd, date: d.accessEndDate, now: new Date(), timeZone: creator.timezone });
  if (!end.ok) return { error: end.error };
  try {
    const r = await grantManualAccess({ creatorId: creator.id, productId: d.productId, name: d.name, email: d.email, grantedByUserId: user.id, until: end.until });
    refresh(d.productId);
    revalidatePath("/panel/ventas");
    revalidatePath("/panel/clientes");
    const until = end.until ? ` hasta el ${lastDayText(end.until, creator.timezone)}` : "";
    return {
      ok: r.status === "granted" ? `Listo: ${d.email} ya tiene acceso${until} y le hemos enviado el enlace.` : `${d.email} ya tenía acceso${until ? `: ahora lo tiene${until}` : ""}. Le hemos vuelto a enviar el enlace.`,
    };
  } catch (e) {
    if (e instanceof FreeAccessError) return { error: e.message };
    throw e;
  }
}

/**
 * «Cambiar fecha» de un acceso dado a mano (o devolverlo tras terminar): lo vuelve a dar con la
 * nueva fecha de fin (o sin fecha). Le llega otra vez el email con su enlace.
 */
export async function setAccessEnd(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const orderId = String(form.get("orderId") ?? "");
  const order = await db.order.findFirst({ where: { id: orderId, paymentProvider: { in: ["free", "manual"] }, status: "PAID" }, select: { productId: true, buyerEmail: true, buyerName: true } });
  if (!order) return { error: "No hemos encontrado ese acceso." };
  const end = accessEndFrom({ choice: asAccessEndChoice(form.get("accessEnd")), date: String(form.get("accessEndDate") ?? ""), now: new Date(), timeZone: creator.timezone });
  if (!end.ok) return { error: end.error };
  try {
    await grantManualAccess({ creatorId: creator.id, productId: order.productId, name: order.buyerName ?? order.buyerEmail, email: order.buyerEmail, grantedByUserId: user.id, until: end.until });
  } catch (e) {
    if (e instanceof FreeAccessError) return { error: e.message };
    throw e;
  }
  refresh(order.productId);
  revalidatePath("/panel/ventas");
  return { ok: end.until ? `Fecha cambiada: ${order.buyerEmail} tiene acceso hasta el ${lastDayText(end.until, creator.timezone)}.` : `${order.buyerEmail} tiene acceso sin fecha de fin.` };
}

/**
 * «Qué incluye esta membresía»: los cursos que tendrán sus miembros mientras la membresía siga
 * activa. Solo cursos suyos (tenantDb) y no archivados; el acceso se deduce al consultar
 * (lib/membership-access.ts), no se copia.
 */
export async function saveInclusions(_: ActionState, form: FormData): Promise<ActionState> {
  const { creator, db } = await ctx();
  const productId = String(form.get("productId") ?? "");
  const membership = await db.product.findFirst({ where: { id: productId, type: "MEMBERSHIP" }, select: { id: true } });
  if (!membership) return { error: "Membresía no encontrada" };
  const wanted = [...new Set(form.getAll("included").map(String))].filter((id) => id !== membership.id).slice(0, 50);
  // Cursos y otras membresías (niveles de abajo), suyos y no archivados.
  const picked = wanted.length ? await db.product.findMany({ where: { id: { in: wanted }, type: { in: ["COURSE", "MEMBERSHIP"] }, status: { not: "ARCHIVED" } }, select: { id: true, type: true, title: true } }) : [];
  // Sin ciclos: un nivel no puede incluir a otro que ya lo incluye (lib/tiers.ts).
  const others = await db.productInclusion.findMany({ where: { NOT: { productId: membership.id } }, select: { productId: true, includedProductId: true } });
  const loop = picked.find((p) => p.type === "MEMBERSHIP" && wouldCreateCycle(others, membership.id, p.id));
  if (loop) return { error: `«${loop.title}» ya incluye esta membresía: no puede incluirse a la vez (sería un círculo).` };
  await db.productInclusion.deleteMany({ where: { productId: membership.id } });
  if (picked.length) await db.productInclusion.createMany({ data: picked.map((c) => ({ creatorId: creator.id, productId: membership.id, includedProductId: c.id })) });
  refresh(membership.id);
  for (const c of picked) revalidatePath(`/panel/productos/${c.id}`);
  revalidatePath("/cuenta/cursos");
  revalidatePath("/cuenta/membresias");
  revalidatePath("/[username]/comunidad", "page");
  const courses = picked.filter((p) => p.type === "COURSE").length;
  const tiers = picked.length - courses;
  if (!picked.length) return { ok: "Guardado. Esta membresía no incluye ningún curso ni otro nivel." };
  return {
    ok: `Guardado. ${[courses ? `Tus miembros ya ven ${courses === 1 ? "este curso" : "estos cursos"} en «Mis cursos»` : "", tiers ? `leen también ${tiers === 1 ? "el otro nivel" : "los otros niveles"}` : ""].filter(Boolean).join(" y ")}.`,
  };
}

/** «Quitar acceso»: el acceso de esa persona pasa a retirado y sus enlaces dejan de funcionar. */
export async function revokeAccess(form: FormData) {
  const { creator } = await ctx();
  const orderId = String(form.get("orderId") ?? "");
  const productId = String(form.get("productId") ?? "");
  const done = await revokeManualAccess({ creatorId: creator.id, orderId });
  refresh(productId || undefined);
  revalidatePath("/panel/ventas");
  redirect(`/panel/productos/${encodeURIComponent(productId)}?${done ? "acceso=quitado" : "error=acceso"}#accesos`);
}

// ───────────── Archivos ─────────────

export async function deleteFile(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const file = await db.productFile.findFirst({ where: { id } });
  if (!file) return;
  await guardLastDeliverable(db, file.productId, { files: 1 }, "entrega");
  await db.productFile.deleteMany({ where: { id } });
  await deleteStoredFiles([file.storageKey]);
  refresh(file.productId);
}

export async function addLinkFile(form: FormData) {
  const { creator, db } = await ctx();
  const productId = String(form.get("productId"));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const url = String(form.get("url") ?? "").trim();
  if (!name || !/^https?:\/\//.test(url)) return;
  if (!(await db.product.findFirst({ where: { id: productId } }))) return;
  const count = await db.productFile.count({ where: { productId } });
  await db.productFile.create({ data: { creatorId: creator.id, productId, name, kind: "LINK", url, sortOrder: count } });
  refresh(productId);
}

// ───────────── Curso ─────────────

export async function addModule(form: FormData) {
  const { creator, db } = await ctx();
  const productId = String(form.get("productId"));
  if (!(await db.product.findFirst({ where: { id: productId, type: "COURSE" } }))) return;
  const count = await db.courseModule.count({ where: { productId } });
  await db.courseModule.create({ data: { creatorId: creator.id, productId, title: String(form.get("title") || `Módulo ${count + 1}`).slice(0, 120), sortOrder: count } });
  refresh(productId);
}

export async function renameModule(form: FormData) {
  const { db } = await ctx();
  const id = String(form.get("id"));
  const m = await db.courseModule.findFirst({ where: { id } });
  if (!m) return;
  await db.courseModule.update({ where: { id }, data: { title: String(form.get("title") || m.title).slice(0, 120) } });
  refresh(m.productId);
}

export async function deleteModule(form: FormData) {
  const { db } = await ctx();
  const m = await db.courseModule.findFirst({ where: { id: String(form.get("id")) } });
  if (!m) return;
  await guardLastDeliverable(db, m.productId, { lessons: await db.lesson.count({ where: { moduleId: m.id } }) }, "lecciones");
  await db.courseModule.deleteMany({ where: { id: m.id } });
  refresh(m.productId);
}

const lessonSchema = z.object({
  id: z.string().max(40).optional(),
  moduleId: z.string().min(1, "Módulo no encontrado").max(40),
  title: z.string().trim().min(1, "Ponle un título a la lección").max(140, "El título admite 140 caracteres"),
  // "" = automática (la suma de los vídeos y audios).
  durationMin: z.union([z.literal(""), z.coerce.number().int().min(0, "Revisa la duración").max(600, "La duración admite hasta 600 minutos")]).optional(),
  version: z.coerce.number().int().min(0).optional(),
  parts: z.string().max(LESSON_PARTS_JSON_MAX + 1),
});

export type LessonActionState = { ok?: string; error?: string; warning?: string; lessonId?: string; version?: number } | undefined;

/** Lo que enviaba el editor de antes (una pestaña abierta desde antes de actualizar). */
const OLD_LESSON_FORM = "Hemos actualizado el editor de lecciones. Recarga la página para seguir.";

/**
 * Guarda una lección con sus partes (vídeo, audio, texto, PDF, imágenes…) desde el editor de
 * /panel/productos/<id>/lecciones/…. Toda la validación está en lib/lessons.ts.
 */
export async function saveLesson(_: LessonActionState, form: FormData): Promise<LessonActionState> {
  const { creator } = await ctx();
  if (!form.has("parts")) return { error: OLD_LESSON_FORM };
  const parsed = lessonSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const parts = parseLessonParts(d.parts);
  if (!parts.ok) return { error: parts.error };
  try {
    const r = await saveLessonWithParts(creator.id, {
      id: d.id || undefined,
      moduleId: d.moduleId,
      title: d.title,
      durationMin: typeof d.durationMin === "number" && d.durationMin > 0 ? d.durationMin : null,
      version: d.version ?? null,
      parts: parts.parts,
    });
    refresh(r.productId);
    revalidatePath(`/panel/productos/${r.productId}/lecciones/${r.lessonId}`);
    revalidatePath(`/cuenta/cursos/${r.productId}`);
    return { ok: "Lección guardada", lessonId: r.lessonId, version: r.version, warning: r.warning ?? undefined };
  } catch (e) {
    if (e instanceof LessonSaveError) return { error: e.message };
    throw e;
  }
}

/** Elimina una lección (y su progreso). Con back=curso, vuelve al programa del curso. */
export async function deleteLesson(form: FormData) {
  const { db } = await ctx();
  const l = await db.lesson.findFirst({ where: { id: String(form.get("id")) } });
  if (!l) return;
  await guardLastDeliverable(db, l.productId, { lessons: 1 }, "lecciones");
  await db.lesson.deleteMany({ where: { id: l.id } });
  refresh(l.productId);
  if (form.get("back") === "curso") redirect(`/panel/productos/${l.productId}?leccion=eliminada#lecciones`);
}

export async function moveLesson(form: FormData) {
  const { db } = await ctx();
  const l = await db.lesson.findFirst({ where: { id: String(form.get("id")) } });
  if (!l) return;
  const list = await db.lesson.findMany({ where: { moduleId: l.moduleId }, orderBy: { sortOrder: "asc" } });
  const i = list.findIndex((x) => x.id === l.id);
  const j = i + (form.get("dir") === "up" ? -1 : 1);
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, idx) => db.lesson.update({ where: { id: x.id }, data: { sortOrder: idx } })));
  refresh(l.productId);
}

// ───────────── Membresía ─────────────

/** «Avisar de la grabación» de un taller: un email a cada asistente. */
export async function notifyWorkshopReplay(form: FormData) {
  const { creator } = await ctx();
  const id = String(form.get("id") ?? "");
  const r = await notifyReplay({ creatorId: creator.id, productId: id });
  refresh(id);
  redirect(`/panel/productos/${id}?avisadas=${r.sent}#asistentes`);
}
