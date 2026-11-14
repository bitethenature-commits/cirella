/**
 * Laura Martín (laura@example.com, contraseña demo1234) con acceso a TODO lo de Cirella para ir probando y
 * mejorando la web: todos los cursos (también los gratis y los que se venden fuera), todas las
 * lecturas y productos digitales, las tres membresías, los próximos círculos de la luna, «Mi energía»
 * (suscriptora confirmada de las novedades) y sus datos de nacimiento.
 *
 * Lo que ya tenía no se toca. Idempotente: se puede lanzar las veces que haga falta (también después
 * de crear productos nuevos). Lo usan prisma/seed.ts y scripts/give-laura-everything.ts.
 */
import type { PrismaClient } from "@prisma/client";

export const FULL_ACCESS_EMAIL = "laura@example.com";

export async function grantFullAccess(prisma: PrismaClient, o: { creatorId: string; ownerUserId: string; now?: Date }): Promise<number> {
  const now = o.now ?? new Date();
  const user = await prisma.user.findUnique({ where: { email: FULL_ACCESS_EMAIL } });
  if (!user) return 0;
  const customer =
    (await prisma.customer.findFirst({ where: { creatorId: o.creatorId, userId: user.id } })) ??
    (await prisma.customer.create({
      data: { creatorId: o.creatorId, userId: user.id, email: user.email, name: user.name, marketingOptIn: true, marketingOptInAt: now, totalSpentCents: 0, ordersCount: 0, firstPurchaseAt: now, lastPurchaseAt: now },
    }));

  const products = await prisma.product.findMany({ where: { creatorId: o.creatorId, status: "PUBLISHED" } });
  const has = new Set(
    (await prisma.access.findMany({ where: { userId: user.id, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { productId: true } })).map((a) => a.productId),
  );
  let given = 0;
  for (const p of products) {
    if (has.has(p.id)) continue;
    const isCircle = p.type === "SESSION" && p.groupSession;
    // Las sesiones 1:1 se reservan con fecha (Reservas → «Dar una sesión»); los talleres ya pasados, tampoco.
    if (p.type === "SESSION" && (!isCircle || !p.eventStartAt || p.eventStartAt <= now)) continue;
    const order = await prisma.order.create({
      data: {
        creatorId: o.creatorId, customerId: customer.id, productId: p.id, productTitle: p.title, productType: p.type,
        buyerEmail: user.email, buyerName: user.name, status: "PAID", amountCents: 0, commissionBps: 0, platformFeeCents: 0, netCents: 0,
        paymentProvider: "manual", createdAt: now, paidAt: now, chargedAt: now,
        metadata: { grantedByUserId: o.ownerUserId, accessGrantedAt: now.toISOString() },
      },
    });
    await prisma.access.create({ data: { creatorId: o.creatorId, userId: user.id, productId: p.id, orderId: order.id } });
    if (isCircle)
      await prisma.booking.create({
        data: {
          creatorId: o.creatorId, productId: p.id, customerId: customer.id, userId: user.id, orderId: order.id, status: "CONFIRMED", groupSeat: true,
          startAt: p.eventStartAt, endAt: new Date(p.eventStartAt!.getTime() + (p.durationMin ?? 60) * 60000), meetingUrl: p.meetingUrl,
        },
      });
    given++;
  }
  if (given) await prisma.customer.update({ where: { id: customer.id }, data: { ordersCount: { increment: given } } });

  // «Mi energía» y el Portal: suscriptora confirmada de las novedades.
  const sub = await prisma.subscriber.findUnique({ where: { creatorId_email: { creatorId: o.creatorId, email: user.email } } });
  if (!sub)
    await prisma.subscriber.create({
      data: { creatorId: o.creatorId, email: user.email, name: user.name, status: "CONFIRMED", source: "FORM", tags: [], consentAt: now, consentText: "Quiero recibir las novedades.", confirmedAt: now },
    });
  else if (sub.status !== "CONFIRMED") await prisma.subscriber.update({ where: { id: sub.id }, data: { status: "CONFIRMED", confirmedAt: now, unsubscribedAt: null, unsubscribeVia: null } });

  // Sus datos de nacimiento (para «Tu Marte» y «Mi energía»): Valencia, 3 de marzo de 1991, 06:40.
  if (!(await prisma.birthProfile.findFirst({ where: { creatorId: o.creatorId, userId: user.id, isOwn: true }, select: { id: true } })))
    await prisma.birthProfile.create({
      data: {
        creatorId: o.creatorId, userId: user.id, name: "Laura", relation: "yo", isOwn: true, birthDate: "1991-03-03", birthTime: "06:40",
        placeName: "Valencia", placeDetail: "Comunidad Valenciana, España", lat: 39.4699, lon: -0.3763, tz: "Europe/Madrid", consentAt: now,
      },
    });
  // Otra persona guardada (su pareja), para probar la sinastría: Madrid, 21 de octubre de 1988, 22:15.
  if (!(await prisma.birthProfile.findFirst({ where: { creatorId: o.creatorId, userId: user.id, isOwn: false }, select: { id: true } })))
    await prisma.birthProfile.create({
      data: {
        creatorId: o.creatorId, userId: user.id, name: "Marcos", relation: "pareja", isOwn: false, birthDate: "1988-10-21", birthTime: "22:15",
        placeName: "Madrid", placeDetail: "Comunidad de Madrid, España", lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid", consentAt: now,
      },
    });
  return given;
}
