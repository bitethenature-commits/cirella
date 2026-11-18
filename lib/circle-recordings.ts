import "server-only";
import { visibleMemberPostWhere } from "./community-rules";
import { prisma } from "./db";
import { activeAccessWhere, includedMembershipIds, includingMemberships } from "./membership-access";

/**
 * Grabación y workbook de un círculo de la luna. Después del círculo (por Zoom), la dueña sube a su
 * estudio el vídeo grabado y el PDF: son archivos del propio círculo (ProductFile sin publicación).
 *
 * Los ve, en su área («Círculos y lecturas»), quien tenía ese círculo:
 *   · quien se apuntó a él suelto (su plaza, confirmada o ya celebrada), o
 *   · quien tiene la membresía que da los círculos (la de su publicación o un nivel que la incluye),
 *     solo si ya era miembro cuando se celebró («solo los de su tiempo») y mientras siga siéndolo.
 */

const SEAT_OK = ["CONFIRMED", "COMPLETED"];
/** Margen para quien entra en la membresía con el círculo ya empezado: cuenta si entró antes de que acabara. */
const endOf = (start: Date, durationMin: number | null) => new Date(start.getTime() + (durationMin ?? 90) * 60_000);

/** Prefijo de la clave de los avisos de la grabación de un círculo (para marcar «Avisada»). */
export const circleNoticeKey = (productId: string) => `circlerec:${productId}:`;

type Circle = { id: string; creatorId: string; eventStartAt: Date | null; durationMin: number | null };

/** La publicación del círculo en la membresía (la que da derecho a ir), si está publicada. */
async function circlePost(circleId: string, now: Date) {
  return prisma.membershipPost.findFirst({ where: { circleProductId: circleId, ...visibleMemberPostWhere(now) }, select: { productId: true, eventAt: true } });
}

/** ¿Tiene esta usuaria la grabación de este círculo? Devuelve el producto que le da el derecho (o null). */
export async function circleRecordingAccess(userId: string, circle: Circle, now = new Date()): Promise<string | null> {
  const seat = await prisma.booking.findFirst({ where: { productId: circle.id, status: { in: SEAT_OK }, customer: { userId } }, select: { id: true } });
  if (seat) return circle.id;
  const direct = await prisma.access.findFirst({ where: { userId, productId: circle.id, ...activeAccessWhere(now) }, select: { id: true } });
  if (direct) return circle.id;
  const post = await circlePost(circle.id, now);
  const start = circle.eventStartAt ?? post?.eventAt ?? null;
  if (!post || !start) return null;
  const memberships = [post.productId, ...(await includingMemberships(post.productId)).map((m) => m.productId)];
  const a = await prisma.access.findFirst({
    where: { userId, productId: { in: memberships }, createdAt: { lte: endOf(start, circle.durationMin) }, ...activeAccessWhere(now) },
    select: { productId: true },
  });
  return a?.productId ?? null;
}

export type CircleRecipient = { userId: string; name: string | null; email: string; via: string };

/** Quién tiene la grabación de un círculo (para «Avisar a las alumnas»), sin la dueña. */
export async function circleRecipients(circle: Circle & { title: string }, now = new Date()): Promise<CircleRecipient[]> {
  const owner = await prisma.creator.findUnique({ where: { id: circle.creatorId }, select: { userId: true } });
  const out = new Map<string, CircleRecipient>();
  const seats = await prisma.booking.findMany({
    where: { productId: circle.id, status: { in: SEAT_OK } },
    orderBy: { createdAt: "asc" },
    select: { customer: { select: { userId: true, name: true, email: true } } },
  });
  for (const s of seats) out.set(s.customer.userId, { userId: s.customer.userId, name: s.customer.name, email: s.customer.email, via: "Se apuntó al círculo" });
  const post = await circlePost(circle.id, now);
  const start = circle.eventStartAt ?? post?.eventAt ?? null;
  if (post && start) {
    const tiers = [{ productId: post.productId, title: "" }, ...(await includingMemberships(post.productId))];
    const titles = new Map((await prisma.product.findMany({ where: { id: { in: tiers.map((t) => t.productId) } }, select: { id: true, title: true } })).map((p) => [p.id, p.title]));
    const members = await prisma.access.findMany({
      where: { creatorId: circle.creatorId, productId: { in: tiers.map((t) => t.productId) }, createdAt: { lte: endOf(start, circle.durationMin) }, ...activeAccessWhere(now) },
      orderBy: { createdAt: "asc" },
      select: { userId: true, productId: true },
    });
    const customers = await prisma.customer.findMany({ where: { creatorId: circle.creatorId, userId: { in: members.map((m) => m.userId) } }, select: { userId: true, name: true, email: true } });
    const byUser = new Map(customers.map((c) => [c.userId, c]));
    for (const m of members) {
      const c = byUser.get(m.userId);
      if (!c || out.has(m.userId)) continue;
      out.set(m.userId, { userId: m.userId, name: c.name, email: c.email, via: `Membresía «${titles.get(m.productId) ?? ""}»` });
    }
  }
  if (owner) out.delete(owner.userId);
  return [...out.values()];
}

export type RecordingFile = { id: string; name: string; kind: string; mimeType: string | null; sizeBytes: number | null; durationSec: number | null; videoCodec: string | null; width: number | null; height: number | null };
export type MyCircleRecording = { id: string; title: string; at: Date; files: RecordingFile[] };

/** Los círculos ya celebrados que tiene una alumna, del más reciente al más antiguo, con su vídeo y su PDF. */
export async function myCircleRecordings(userId: string, now = new Date()): Promise<MyCircleRecording[]> {
  const ids = new Set<string>();
  // Los que compró sueltos.
  const seats = await prisma.booking.findMany({ where: { status: { in: SEAT_OK }, customer: { userId }, product: { moonCircle: true } }, select: { productId: true } });
  for (const s of seats) ids.add(s.productId);
  // Los de su membresía, de su tiempo.
  const own = await prisma.access.findMany({ where: { userId, product: { type: "MEMBERSHIP" }, ...activeAccessWhere(now) }, select: { productId: true, createdAt: true } });
  if (own.length) {
    const since = new Map<string, Date>();
    for (const a of own)
      for (const id of [a.productId, ...(await includedMembershipIds(a.productId))]) {
        const prev = since.get(id);
        if (!prev || a.createdAt < prev) since.set(id, a.createdAt);
      }
    const posts = await prisma.membershipPost.findMany({
      where: { productId: { in: [...since.keys()] }, kind: "CIRCULO_LUNAR", circleProductId: { not: null }, eventAt: { lte: now }, ...visibleMemberPostWhere(now) },
      select: { productId: true, eventAt: true, circleProductId: true },
    });
    const durations = new Map(
      (await prisma.product.findMany({ where: { id: { in: posts.map((p) => p.circleProductId!) } }, select: { id: true, durationMin: true } })).map((c) => [c.id, c.durationMin]),
    );
    for (const p of posts) if (p.eventAt && p.circleProductId && since.get(p.productId)! <= endOf(p.eventAt, durations.get(p.circleProductId) ?? null)) ids.add(p.circleProductId);
  }
  if (!ids.size) return [];
  const circles = await prisma.product.findMany({
    where: { id: { in: [...ids] }, moonCircle: true, eventStartAt: { lte: now } },
    select: {
      id: true,
      title: true,
      eventStartAt: true,
      files: {
        where: { postId: null, storageKey: { not: null } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, kind: true, mimeType: true, sizeBytes: true, durationSec: true, videoCodec: true, width: true, height: true },
      },
    },
  });
  return circles
    .map((c) => ({ id: c.id, title: c.title, at: c.eventStartAt!, files: c.files }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}
