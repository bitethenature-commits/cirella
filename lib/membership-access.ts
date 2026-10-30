import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { ancestorsOf, descendantsOf } from "./tiers";

/**
 * Acceso a un producto, directo o a través de una membresía que lo incluye (ProductInclusion).
 *
 * El acceso incluido NO se copia a Access: se deduce al consultar a partir del acceso vigente a la
 * membresía. Así termina exactamente cuando termina el de la membresía —fin del periodo pagado,
 * fecha de fin que puso la dueña, reembolso o acceso retirado— sin depender de ningún cron.
 *
 * «Vigente» es siempre: status ACTIVE y sin expiresAt o con expiresAt en el futuro. Se comprueba
 * con la hora de cada consulta.
 */

export const activeAccessWhere = (now = new Date()) => ({ status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

/** Todas las inclusiones de una creadora (son pocas: los niveles de su comunidad y sus cursos). */
const creatorEdges = cache(async (creatorId: string) => {
  const rows = await prisma.productInclusion.findMany({
    where: { creatorId },
    select: { productId: true, includedProductId: true, product: { select: { creatorId: true, type: true } }, includedProduct: { select: { creatorId: true } } },
  });
  // Por si acaso: nunca una inclusión entre creadoras distintas (saveInclusions ya lo impide), y solo
  // las membresías incluyen.
  return rows
    .filter((r) => r.product.creatorId === creatorId && r.includedProduct.creatorId === creatorId && r.product.type === "MEMBERSHIP")
    .map((r) => ({ productId: r.productId, includedProductId: r.includedProductId }));
});

const productCreator = cache(async (productId: string) => (await prisma.product.findUnique({ where: { id: productId }, select: { creatorId: true } }))?.creatorId ?? null);

/**
 * Membresías (de la misma creadora) que incluyen este producto, directa o indirectamente: un nivel
 * superior de la comunidad incluye los de abajo y lo que estos incluyen (lib/tiers.ts).
 */
export const includingMemberships = cache(async (productId: string) => {
  const creatorId = await productCreator(productId);
  if (!creatorId) return [];
  const ids = ancestorsOf(await creatorEdges(creatorId), productId);
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, creatorId, type: "MEMBERSHIP" }, select: { id: true, title: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.filter((id) => byId.has(id)).map((id) => ({ productId: id, title: byId.get(id)!.title }));
});

/** Lo que incluye una membresía, directa o indirectamente (cursos y membresías de los niveles de abajo). */
export const includedProductIds = cache(async (membershipId: string) => {
  const creatorId = await productCreator(membershipId);
  if (!creatorId) return [];
  return descendantsOf(await creatorEdges(creatorId), membershipId);
});

/** Membresías de los niveles de abajo que incluye una membresía (para su comunidad y «Mis membresías»). */
export const includedMembershipIds = cache(async (membershipId: string) => {
  const ids = await includedProductIds(membershipId);
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, type: "MEMBERSHIP", status: { not: "ARCHIVED" } }, select: { id: true } });
  const keep = new Set(rows.map((r) => r.id));
  return ids.filter((id) => keep.has(id));
});

export type AccessSource = {
  accessId: string;
  /** Producto del Access que da el acceso: el propio, o la membresía que lo incluye. */
  productId: string;
  orderId: string | null;
  subscriptionId: string | null;
  expiresAt: Date | null;
  /** La membresía por la que lo tiene (null = acceso directo). */
  via: { productId: string; title: string } | null;
};

/**
 * De dónde le viene el acceso a una usuaria: primero el directo; si no, el de una membresía que lo
 * incluye (el que dure más). null = sin acceso vigente.
 */
export async function accessSource(userId: string, productId: string, now = new Date()): Promise<AccessSource | null> {
  const direct = await prisma.access.findFirst({ where: { userId, productId, ...activeAccessWhere(now) } });
  if (direct) return { accessId: direct.id, productId, orderId: direct.orderId, subscriptionId: direct.subscriptionId, expiresAt: direct.expiresAt, via: null };
  const parents = await includingMemberships(productId);
  if (!parents.length) return null;
  const rows = await prisma.access.findMany({ where: { userId, productId: { in: parents.map((p) => p.productId) }, ...activeAccessWhere(now) } });
  if (!rows.length) return null;
  // Sin fecha de fin primero; si no, la que termina más tarde.
  rows.sort((a, b) => (a.expiresAt ? a.expiresAt.getTime() : Infinity) - (b.expiresAt ? b.expiresAt.getTime() : Infinity)).reverse();
  const a = rows[0];
  const via = parents.find((p) => p.productId === a.productId)!;
  return { accessId: a.id, productId: a.productId, orderId: a.orderId, subscriptionId: a.subscriptionId, expiresAt: a.expiresAt, via };
}

/**
 * ¿Cubre una sesión limitada a un pedido (enlace personal de un email) este producto? El suyo, y
 * los cursos que incluye su membresía (el enlace de una publicación abre también esos cursos).
 */
export async function scopeCoversProduct(scope: { orderId: string; productId: string }, productId: string): Promise<boolean> {
  if (scope.productId === productId) return true;
  return (await includedProductIds(scope.productId)).includes(productId);
}

/**
 * Cursos incluidos en las membresías vigentes de una usuaria (para «Mis cursos»), con la membresía
 * por la que los tiene y hasta cuándo.
 */
export async function includedProductsForUser(userId: string, now = new Date()) {
  const memberships = await prisma.access.findMany({
    where: { userId, product: { type: "MEMBERSHIP" }, ...activeAccessWhere(now) },
    select: { productId: true, expiresAt: true, product: { select: { title: true } } },
  });
  if (!memberships.length) return [];
  // Cada membresía con todo lo que incluye por debajo (los niveles de abajo y sus cursos).
  const reach = new Map<string, string[]>();
  for (const m of memberships) reach.set(m.productId, await includedProductIds(m.productId));
  const allIds = [...new Set([...reach.values()].flat())];
  if (!allIds.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: allIds }, type: "COURSE", status: { not: "ARCHIVED" } },
    include: { creator: true, _count: { select: { lessons: true } } },
    orderBy: { createdAt: "asc" },
  });
  const out = new Map<string, { product: (typeof products)[number]; via: { productId: string; title: string }; until: Date | null }>();
  for (const product of products) {
    for (const m of memberships) {
      if (!reach.get(m.productId)!.includes(product.id)) continue;
      const prev = out.get(product.id);
      const until = m.expiresAt;
      if (!prev || (prev.until && (!until || until > prev.until))) out.set(product.id, { product, via: { productId: m.productId, title: m.product.title }, until });
    }
  }
  return [...out.values()];
}

/**
 * Membresías de niveles de abajo que una usuaria tiene por estar en un nivel superior (para «Mis
 * membresías»), con el nivel por el que las tiene y hasta cuándo. Sin las que ya tiene directamente.
 */
export async function includedMembershipsForUser(userId: string, now = new Date()) {
  const memberships = await prisma.access.findMany({
    where: { userId, product: { type: "MEMBERSHIP" }, ...activeAccessWhere(now) },
    select: { productId: true, expiresAt: true, product: { select: { title: true } } },
  });
  const own = new Set(memberships.map((m) => m.productId));
  const out = new Map<string, { productId: string; via: { productId: string; title: string }; until: Date | null }>();
  for (const m of memberships)
    for (const id of await includedMembershipIds(m.productId)) {
      if (own.has(id)) continue;
      const prev = out.get(id);
      if (!prev || (prev.until && (!m.expiresAt || m.expiresAt > prev.until))) out.set(id, { productId: id, via: { productId: m.productId, title: m.product.title }, until: m.expiresAt });
    }
  if (!out.size) return [];
  const products = await prisma.product.findMany({ where: { id: { in: [...out.keys()] } }, include: { creator: true } });
  return products.map((product) => ({ product, ...out.get(product.id)! }));
}

/**
 * Miembros con acceso vigente a una membresía (página de `take`, por userId ascendente desde
 * `afterUserId`), con su clienta (email, nombre, baja de los avisos) y el pedido que les dio el
 * acceso (para el enlace personal). Sin la dueña.
 */
export async function activeMembersPage(creatorId: string, productId: string, o: { afterUserId?: string | null; take: number; now?: Date }) {
  const now = o.now ?? new Date();
  const owner = await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true } });
  const rows = await prisma.access.findMany({
    where: {
      creatorId,
      productId,
      ...activeAccessWhere(now),
      ...(o.afterUserId ? { userId: { gt: o.afterUserId } } : {}),
      ...(owner ? { NOT: { userId: owner.userId } } : {}),
    },
    orderBy: { userId: "asc" },
    take: o.take,
    select: { userId: true, orderId: true },
  });
  if (!rows.length) return [];
  const customers = await prisma.customer.findMany({ where: { creatorId, userId: { in: rows.map((r) => r.userId) } }, include: { user: { select: { email: true, name: true } } } });
  const byUser = new Map(customers.map((c) => [c.userId, c]));
  return rows.map((r) => {
    const c = byUser.get(r.userId);
    return {
      userId: r.userId,
      orderId: r.orderId,
      customerId: c?.id ?? null,
      email: c?.email ?? null,
      name: c?.name ?? c?.user.name ?? null,
      optedOut: !!c?.postEmailsOptOutAt,
    };
  });
}

/** Cuántas personas tienen ahora acceso a una membresía (sin la dueña). */
export async function countActiveMembers(creatorId: string, productId: string, now = new Date()) {
  const owner = await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true } });
  return prisma.access.count({ where: { creatorId, productId, ...activeAccessWhere(now), ...(owner ? { NOT: { userId: owner.userId } } : {}) } });
}
