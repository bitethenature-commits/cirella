/**
 * Elena (elena@example.com, contraseña demo1234): la alumna de la demo con un poco de todo en su área,
 * para ver cómo queda «Mi cuenta» con varios accesos a la vez. Ana se los dio a mano (pedidos de 0 €
 * «manual», como «Dar acceso» del panel):
 *   · tres cursos: Human Design desde cero, Tu carta y tu energía y Conócete a través de tu energía;
 *   · una lectura que prepara Ana («Lectura de tu año»), ya entregada con su mensaje;
 *   · una sesión 1:1 con fecha dentro de unos días;
 *   · los próximos círculos de la luna, cada uno por separado;
 *   · la membresía más barata (Esencia), con sus textos.
 * Idempotente: si Elena ya existe no hace nada. Lo usan prisma/seed.ts y, para una BD ya sembrada,
 * scripts/add-demo-student.ts.
 */
import type { PrismaClient } from "@prisma/client";
import { addDaysToKey, dateKeyInTz, zonedTimeToUtc } from "../lib/tz";

export const DEMO_STUDENT_EMAIL = "elena@example.com";

const COURSES = ["human-design-desde-cero", "tu-carta-y-tu-energia", "curso-conocete-tu-energia"];
const READING = "lectura-de-tu-ano";
const SESSION = "sesion-1-1";
const MEMBERSHIP = "esencia";

const READING_MESSAGE = `Hola, Elena:

Aquí tienes tu lectura del año. La he preparado con calma a partir de tu carta y tu revolución solar.

**Lo esencial**
- Es un año para sembrar despacio: lo que empieces en primavera dará fruto en otoño.
- Tu Luna en Cáncer pide cuidar el hogar y tus ritmos de descanso.
- Marte pasa por tu casa 10 en junio: buen momento para dar un paso visible en tu trabajo.

Léela sin prisa y vuelve a ella cada luna nueva. Si te surge cualquier duda, escríbeme.

Con cariño,
Ana`;

export async function seedDemoStudent(
  prisma: PrismaClient,
  o: { creatorId: string; ownerUserId: string; passwordHash: string; timezone: string; now?: Date },
): Promise<string | null> {
  if (await prisma.user.findUnique({ where: { email: DEMO_STUDENT_EMAIL }, select: { id: true } })) return null;
  const now = o.now ?? new Date();
  const day = 86_400_000;
  const ago = (days: number) => new Date(now.getTime() - days * day);

  const products = await prisma.product.findMany({ where: { creatorId: o.creatorId, status: "PUBLISHED" } });
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const circles = products
    .filter((p) => p.type === "SESSION" && p.groupSession && p.moonCircle && p.eventStartAt && p.eventStartAt > now)
    .sort((a, b) => a.eventStartAt!.getTime() - b.eventStartAt!.getTime());

  const joinedAt = ago(40);
  const user = await prisma.user.create({
    data: { email: DEMO_STUDENT_EMAIL, name: "Elena Sanz", passwordHash: o.passwordHash, emailVerifiedAt: joinedAt, createdAt: joinedAt },
  });
  const customer = await prisma.customer.create({
    data: {
      creatorId: o.creatorId, userId: user.id, email: user.email, name: user.name, marketingOptIn: true, marketingOptInAt: joinedAt,
      totalSpentCents: 0, ordersCount: 0, firstPurchaseAt: joinedAt, lastPurchaseAt: ago(2), createdAt: joinedAt,
    },
  });

  /** Un acceso dado a mano: pedido de 0 € y su acceso, como grantManualAccess / createManualOrder. */
  async function give(slug: string, at: Date, extra: { deliveredAt?: Date; deliveryMessage?: string; intake?: object } = {}) {
    const p = bySlug.get(slug);
    if (!p) return null;
    const order = await prisma.order.create({
      data: {
        creatorId: o.creatorId, customerId: customer.id, productId: p.id, productTitle: p.title, productType: p.type,
        buyerEmail: user.email, buyerName: user.name, status: "PAID", amountCents: 0, commissionBps: 0, platformFeeCents: 0, netCents: 0,
        paymentProvider: "manual", createdAt: at, paidAt: at, chargedAt: at,
        metadata: { grantedByUserId: o.ownerUserId, accessGrantedAt: at.toISOString() },
        ...(extra.deliveredAt ? { deliveredAt: extra.deliveredAt, deliveryMessage: extra.deliveryMessage ?? null, deliveryMessageFormat: "MD" } : {}),
        ...(extra.intake ? { intake: extra.intake, intakeUpdatedAt: at } : {}),
      },
    });
    await prisma.access.create({ data: { creatorId: o.creatorId, userId: user.id, productId: p.id, orderId: order.id, createdAt: at } });
    await prisma.customer.update({ where: { id: customer.id }, data: { ordersCount: { increment: 1 } } });
    return { order, product: p };
  }

  // Cursos, con la primera lección hecha en el primero (a medias).
  for (const [i, slug] of COURSES.entries()) {
    const g = await give(slug, ago(35 - i * 9));
    if (!g || i > 0) continue;
    const lessons = await prisma.lesson.findMany({ where: { productId: g.product.id, published: true }, orderBy: [{ sortOrder: "asc" }], select: { id: true }, take: 1 });
    for (const [j, l] of lessons.entries())
      await prisma.lessonProgress.create({ data: { creatorId: o.creatorId, userId: user.id, productId: g.product.id, lessonId: l.id, completedAt: ago(30 - j * 3) } });
  }

  // La lectura que prepara Ana, ya entregada.
  await give(READING, ago(12), {
    deliveredAt: ago(3),
    deliveryMessage: READING_MESSAGE,
    intake: { v: 1, birth: { date: "1990-07-14", time: "08:30", timeUnknown: false, place: "Sevilla, España" }, answers: [] },
  });

  // Sesión 1:1 dentro de cinco días, a las 12:00 de la dueña.
  const session = await give(SESSION, ago(6));
  if (session) {
    const start = zonedTimeToUtc(addDaysToKey(dateKeyInTz(now, o.timezone), 5), 12 * 60, o.timezone);
    const minutes = session.product.durationMin ?? 60;
    await prisma.booking.create({
      data: {
        creatorId: o.creatorId, productId: session.product.id, customerId: customer.id, userId: user.id, orderId: session.order.id, status: "CONFIRMED",
        startAt: start, endAt: new Date(start.getTime() + minutes * 60000), meetingUrl: session.product.meetingUrl, customerTimezone: o.timezone, createdAt: ago(6),
      },
    });
  }

  // Los próximos círculos de la luna, cada uno por separado (una plaza en cada taller).
  for (const c of circles) {
    const g = await give(c.slug, ago(2));
    if (!g) continue;
    await prisma.booking.create({
      data: {
        creatorId: o.creatorId, productId: c.id, customerId: customer.id, userId: user.id, orderId: g.order.id, status: "CONFIRMED", groupSeat: true,
        startAt: c.eventStartAt, endAt: new Date(c.eventStartAt!.getTime() + (c.durationMin ?? 60) * 60000), meetingUrl: c.meetingUrl, customerTimezone: o.timezone, createdAt: ago(2),
      },
    });
  }

  // La membresía más barata (Esencia): ve sus textos.
  await give(MEMBERSHIP, ago(20));
  return user.id;
}
