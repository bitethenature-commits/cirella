import "server-only";
import type { Creator } from "@prisma/client";
import { prisma } from "./db";
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
  const [accesses, progress, bookings, subscriptions] = await Promise.all([
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
      orderBy: [{ startAt: "asc" }],
      include: { product: true, creator: true },
    }),
    prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { product: true, creator: true } }),
  ]);
  const done = new Map(progress.map((p) => [p.productId, p._count._all]));
  const courses = accesses
    .filter((a) => a.product.type === "COURSE")
    .map((a) => {
      const total = a.product._count.lessons;
      const completed = done.get(a.productId) ?? 0;
      return { product: a.product, creator: creatorBrief(a.product.creator), total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
    });
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

/** Comprueba que la usuaria tiene acceso vigente a un producto. */
export async function hasAccess(userId: string, productId: string) {
  const a = await prisma.access.findFirst({ where: { ...activeAccess(userId), productId } });
  return !!a;
}
