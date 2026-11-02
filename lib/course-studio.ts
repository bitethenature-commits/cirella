/**
 * Estudio de cursos del panel (/panel/cursos): lo que leen sus pestañas. Todo con tenantDb (solo lo
 * de esta creadora); lo que viene de otras tablas (clientas, accesos de las membresías) se filtra
 * también por creatorId.
 *
 *   courseList      → la lista de cursos con portada, lecciones, alumnas y estado;
 *   courseStudents  → quién tiene acceso (compra, gratis, dado a mano o por una membresía) y su progreso;
 *   courseStats     → «Datos»: visitas (LessonView) y completadas (LessonProgress) por lección.
 *
 * Las lecciones que cuentan para las alumnas son las publicadas (Lesson.published).
 */
import "server-only";
import { NO_CHARGE_LABEL, type NoChargeProvider } from "./access-mode";
import { prisma } from "./db";
import { activeAccessWhere, includingMemberships } from "./membership-access";
import { tenantDb } from "./tenant";

async function ownerUserId(creatorId: string) {
  return (await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true } }))?.userId ?? null;
}

/** Usuarias con acceso vigente a un curso (directo o por una membresía que lo incluye), sin la dueña. */
async function activeStudentAccess(creatorId: string, productId: string, now = new Date()) {
  const db = tenantDb(creatorId);
  const memberships = await includingMemberships(productId);
  const owner = await ownerUserId(creatorId);
  const rows = await db.access.findMany({
    where: { productId: { in: [productId, ...memberships.map((m) => m.productId)] }, ...activeAccessWhere(now), ...(owner ? { NOT: { userId: owner } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { userId: true, productId: true, orderId: true, createdAt: true, expiresAt: true },
  });
  return { rows, memberships };
}

export type CourseListItem = {
  id: string;
  title: string;
  emoji: string | null;
  imageUrl: string | null;
  status: string;
  modules: number;
  lessons: number;
  drafts: number;
  students: number;
  updatedAt: Date;
};

export async function courseList(creatorId: string): Promise<CourseListItem[]> {
  const db = tenantDb(creatorId);
  const courses = await db.product.findMany({
    where: { type: "COURSE", status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, emoji: true, imageUrl: true, status: true, updatedAt: true, _count: { select: { modules: true, lessons: true } } },
  });
  if (!courses.length) return [];
  const published = await db.lesson.groupBy({ by: ["productId"], where: { productId: { in: courses.map((c) => c.id) }, published: true }, _count: { _all: true } });
  const pub = new Map(published.map((p) => [p.productId, p._count._all]));
  const students = await Promise.all(courses.map(async (c) => new Set((await activeStudentAccess(creatorId, c.id)).rows.map((r) => r.userId)).size));
  return courses.map((c, i) => ({
    id: c.id,
    title: c.title,
    emoji: c.emoji,
    imageUrl: c.imageUrl,
    status: c.status,
    modules: c._count.modules,
    lessons: c._count.lessons,
    drafts: c._count.lessons - (pub.get(c.id) ?? 0),
    students: students[i],
    updatedAt: c.updatedAt,
  }));
}

export type CourseStudent = {
  userId: string;
  customerId: string | null;
  name: string;
  email: string;
  /** «Compra», «Formulario», «Dado por ti» o «Membresía «Círculo»». */
  origin: string;
  since: Date;
  until: Date | null;
  completed: number;
  total: number;
  lastActivity: Date | null;
};

/** Alumnas con acceso vigente y su progreso (lecciones publicadas completadas y última actividad). */
export async function courseStudents(creatorId: string, productId: string): Promise<{ students: CourseStudent[]; total: number }> {
  const db = tenantDb(creatorId);
  const { rows, memberships } = await activeStudentAccess(creatorId, productId);
  const total = await db.lesson.count({ where: { productId, published: true } });
  if (!rows.length) return { students: [], total };
  // Una fila por persona: el acceso directo si lo tiene; si no, el de la membresía más antigua.
  const byUser = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const prev = byUser.get(r.userId);
    if (!prev || (prev.productId !== productId && r.productId === productId)) byUser.set(r.userId, r);
  }
  const userIds = [...byUser.keys()];
  const orderIds = [...byUser.values()].flatMap((r) => (r.orderId ? [r.orderId] : []));
  const [customers, orders, progress, lastDone, lastSeen] = await Promise.all([
    db.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, name: true, email: true, user: { select: { name: true } } } }),
    db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, paymentProvider: true } }),
    db.lessonProgress.groupBy({ by: ["userId"], where: { productId, userId: { in: userIds }, lesson: { published: true } }, _count: { _all: true } }),
    db.lessonProgress.groupBy({ by: ["userId"], where: { productId, userId: { in: userIds } }, _max: { completedAt: true } }),
    db.lessonView.groupBy({ by: ["userId"], where: { productId, userId: { in: userIds } }, _max: { lastAt: true } }),
  ]);
  const customer = new Map(customers.map((c) => [c.userId, c]));
  const provider = new Map(orders.map((o) => [o.id, o.paymentProvider]));
  const done = new Map(progress.map((p) => [p.userId, p._count._all]));
  const doneAt = new Map(lastDone.map((p) => [p.userId, p._max.completedAt]));
  const seenAt = new Map(lastSeen.map((p) => [p.userId, p._max.lastAt]));
  const users = await prisma.user.findMany({ where: { id: { in: userIds.filter((u) => !customer.has(u)) } }, select: { id: true, email: true, name: true } });
  const userById = new Map(users.map((u) => [u.id, u]));
  const membershipTitle = new Map(memberships.map((m) => [m.productId, m.title]));

  const students = userIds.map((userId): CourseStudent => {
    const a = byUser.get(userId)!;
    const c = customer.get(userId);
    const u = userById.get(userId);
    const p = a.orderId ? provider.get(a.orderId) : null;
    const origin =
      a.productId !== productId
        ? `Membresía «${membershipTitle.get(a.productId) ?? "—"}»`
        : p && p in NO_CHARGE_LABEL
          ? NO_CHARGE_LABEL[p as NoChargeProvider]
          : p
            ? "Compra"
            : "Acceso";
    const last = [doneAt.get(userId), seenAt.get(userId)].filter((d): d is Date => !!d).sort((x, y) => y.getTime() - x.getTime())[0] ?? null;
    return {
      userId,
      customerId: c?.id ?? null,
      name: c?.name || c?.user.name || u?.name || (c?.email ?? u?.email ?? "").split("@")[0],
      email: c?.email ?? u?.email ?? "",
      origin,
      since: a.createdAt,
      until: a.expiresAt,
      completed: Math.min(done.get(userId) ?? 0, total),
      total,
      lastActivity: last,
    };
  });
  // Primero quien se movió hace menos; quien no ha empezado, al final por fecha de alta.
  students.sort((x, y) => (y.lastActivity?.getTime() ?? 0) - (x.lastActivity?.getTime() ?? 0) || y.since.getTime() - x.since.getTime());
  return { students, total };
}

export type LessonStat = { id: string; title: string; module: string; published: boolean; viewers: number; views: number; completions: number };

/** «Datos»: por lección, cuántas alumnas la han abierto, cuántas veces y cuántas la han completado. */
export async function courseStats(creatorId: string, productId: string) {
  const db = tenantDb(creatorId);
  const owner = await ownerUserId(creatorId);
  const notOwner = owner ? { NOT: { userId: owner } } : {};
  const [modules, views, completions, students] = await Promise.all([
    db.courseModule.findMany({
      where: { productId },
      orderBy: { sortOrder: "asc" },
      select: { title: true, lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, published: true } } },
    }),
    db.lessonView.groupBy({ by: ["lessonId"], where: { productId, ...notOwner }, _count: { _all: true }, _sum: { count: true } }),
    db.lessonProgress.groupBy({ by: ["lessonId"], where: { productId, ...notOwner }, _count: { _all: true } }),
    activeStudentAccess(creatorId, productId),
  ]);
  const v = new Map(views.map((x) => [x.lessonId, x]));
  const c = new Map(completions.map((x) => [x.lessonId, x._count._all]));
  const lessons: LessonStat[] = modules.flatMap((m) =>
    m.lessons.map((l) => ({ id: l.id, title: l.title, module: m.title, published: l.published, viewers: v.get(l.id)?._count._all ?? 0, views: v.get(l.id)?._sum.count ?? 0, completions: c.get(l.id) ?? 0 })),
  );
  const studentIds = [...new Set(students.rows.map((r) => r.userId))];
  const published = lessons.filter((l) => l.published).map((l) => l.id);
  // Quién ha empezado (abierto o completado algo) y quién lo ha terminado entero.
  const [started, perUser] = await Promise.all([
    studentIds.length ? db.lessonView.groupBy({ by: ["userId"], where: { productId, userId: { in: studentIds } } }) : Promise.resolve([]),
    studentIds.length && published.length
      ? db.lessonProgress.groupBy({ by: ["userId"], where: { productId, userId: { in: studentIds }, lessonId: { in: published } }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const startedSet = new Set([...started.map((s) => s.userId), ...perUser.map((p) => p.userId)]);
  const finished = perUser.filter((p) => p._count._all >= published.length).length;
  const avg = studentIds.length && published.length ? Math.round((perUser.reduce((a, p) => a + p._count._all, 0) / (studentIds.length * published.length)) * 100) : 0;
  return {
    lessons,
    totals: { students: studentIds.length, started: startedSet.size, finished, avgPercent: avg, views: lessons.reduce((a, l) => a + l.views, 0) },
  };
}
