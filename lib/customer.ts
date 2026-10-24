import "server-only";
import type { Creator } from "@prisma/client";
import { prisma } from "./db";
import { accessSource, includedProductsForUser } from "./membership-access";
import { readPageConfig } from "./page-config";

export function creatorBrief(c: Pick<Creator, "id" | "username" | "displayName" | "pagePublished" | "pageDraft" | "timezone" | "contactEmail">) {
  const cfg = readPageConfig(c.pagePublished ?? c.pageDraft, c.displayName);
  return {
    id: c.id,
    username: c.username,
    displayName: cfg.displayName,
    avatarUrl: cfg.avatarUrl,
    timezone: c.timezone,
    email: cfg.contact.email || c.contactEmail,
    whatsapp: cfg.contact.whatsapp,
  };
}

const activeAccess = (userId: string) => ({
  userId,
  status: "ACTIVE",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

/** Todo lo que una compradora tiene, de todas las creadoras a las que ha comprado. */
export async function getCustomerLibrary(userId: string) {
  const [accesses, progress, bookings, subscriptions, included] = await Promise.all([
    prisma.access.findMany({
      where: activeAccess(userId),
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          include: {
            creator: true,
            files: { orderBy: { sortOrder: "asc" } },
            _count: { select: { lessons: true } },
          },
        },
      },
    }),
    prisma.lessonProgress.groupBy({ by: ["productId"], where: { userId }, _count: { _all: true } }),
    prisma.booking.findMany({
      where: { userId, status: { in: ["CONFIRMED", "PENDING_SCHEDULE", "COMPLETED"] } },
      orderBy: [{ startAt: { sort: "asc", nulls: "first" } }], // pendientes de fecha primero
      include: { product: true, creator: true },
    }),
    prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { product: true, creator: true } }),
    includedProductsForUser(userId),
  ]);
  const done = new Map(progress.map((p) => [p.productId, p._count._all]));
  const courseRow = (product: { id: string; creator: Creator; _count: { lessons: number } }) => {
    const total = product._count.lessons;
    const completed = done.get(product.id) ?? 0;
    return { creator: creatorBrief(product.creator), total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
  };
  const direct = accesses.filter((a) => a.product.type === "COURSE").map((a) => ({ product: a.product, ...courseRow(a.product), via: null as { productId: string; title: string } | null, until: a.expiresAt }));
  // Cursos incluidos en sus membresías (si también lo compró, vale la compra).
  const own = new Set(direct.map((c) => c.product.id));
  const viaMembership = included
    .filter((i) => !own.has(i.product.id))
    .map((i) => ({ product: { ...i.product, files: [] }, ...courseRow(i.product), via: i.via, until: i.until }));
  const courses = [...direct, ...viaMembership];
  const digital = accesses.filter((a) => a.product.type === "DIGITAL").map((a) => ({ product: a.product, creator: creatorBrief(a.product.creator), files: a.product.files, since: a.createdAt }));
  const now = new Date();
  const upcoming = bookings.filter((b) => b.status === "PENDING_SCHEDULE" || (b.status === "CONFIRMED" && b.startAt && b.startAt >= new Date(now.getTime() - 2 * 3600_000)));
  const past = bookings.filter((b) => !upcoming.includes(b));
  return {
    courses,
    digital,
    files: digital.flatMap((d) => d.files.map((f) => ({ ...f, productTitle: d.product.title, creator: d.creator }))),
    upcoming: upcoming.map((b) => ({ ...b, creatorBrief: creatorBrief(b.creator) })),
    past: past.map((b) => ({ ...b, creatorBrief: creatorBrief(b.creator) })),
    memberships: subscriptions.map((s) => ({ ...s, creatorBrief: creatorBrief(s.creator) })),
  };
}

/**
 * Lecturas y grabaciones que la dueña le ha entregado (archivos de sus pedidos pagados ya enviados),
 * mientras su acceso al producto siga activo: para «Mis archivos».
 */
export async function deliveredReadings(userId: string) {
  const files = await prisma.orderFile.findMany({
    where: { sentAt: { not: null }, kind: { not: "LINK" }, order: { status: "PAID", customer: { userId } } },
    orderBy: { sentAt: "desc" },
    include: { order: { select: { productId: true, productTitle: true } }, creator: true },
  });
  const active = new Set((await prisma.access.findMany({ where: { ...activeAccess(userId), productId: { in: files.map((f) => f.order.productId) } }, select: { productId: true } })).map((a) => a.productId));
  return files.filter((f) => active.has(f.order.productId)).map((f) => ({ ...f, productTitle: f.order.productTitle, creator: creatorBrief(f.creator) }));
}

/**
 * Comprueba que la usuaria tiene acceso vigente a un producto: directo o por una membresía que lo
 * incluye (lib/membership-access.ts). La fecha de fin se comprueba en cada llamada.
 */
export async function hasAccess(userId: string, productId: string) {
  return !!(await accessSource(userId, productId));
}

/**
 * Materiales de los cursos para «Mis archivos»: PDF, audios, imágenes y otros archivos (los vídeos
 * se ven en la lección y los enlaces no se descargan), cada uno con la primera lección que lo usa
 * (por orden de módulo y de lección). `courses` viene de getCustomerLibrary (acceso ya comprobado).
 */
export async function courseMaterials(courses: { product: { id: string; title: string }; creator: ReturnType<typeof creatorBrief> }[]) {
  const ids = courses.map((c) => c.product.id);
  if (!ids.length) return [];
  const files = await prisma.productFile.findMany({
    where: { productId: { in: ids }, kind: { in: ["PDF", "AUDIO", "IMAGE", "OTHER"] } },
    orderBy: [{ productId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const uses = files.length
    ? await prisma.lessonPart.findMany({
        where: { productId: { in: ids }, kind: "FILE", fileId: { in: files.map((f) => f.id) } },
        select: { fileId: true, lesson: { select: { id: true, title: true, sortOrder: true, module: { select: { sortOrder: true } } } } },
      })
    : [];
  const first = new Map<string, (typeof uses)[number]["lesson"]>();
  for (const u of uses) {
    const had = first.get(u.fileId!);
    const before = !had || u.lesson.module.sortOrder < had.module.sortOrder || (u.lesson.module.sortOrder === had.module.sortOrder && u.lesson.sortOrder < had.sortOrder);
    if (before) first.set(u.fileId!, u.lesson);
  }
  const byId = new Map(courses.map((c) => [c.product.id, c]));
  return files.map((f) => {
    const c = byId.get(f.productId)!;
    const l = first.get(f.id);
    return { ...f, productTitle: c.product.title, creator: c.creator, lesson: l ? { id: l.id, title: l.title, href: `/cuenta/cursos/${f.productId}?leccion=${l.id}` } : null };
  });
}
