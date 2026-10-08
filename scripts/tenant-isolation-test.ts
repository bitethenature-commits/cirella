/**
 * Prueba de aislamiento multi-tenant.
 *   npm run test:isolation
 *
 * Comprueba que el cliente `tenantDb(ana)` jamás lee, modifica ni borra datos
 * de otra creadora (María), aunque se le pasen sus ids directamente.
 */
import { prisma } from "../lib/db";
import { tenantDb } from "../lib/tenant";

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures++;
}

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const db = tenantDb(ana.id);

  const mariaProduct = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } });
  const mariaOrder = await prisma.order.findFirstOrThrow({ where: { creatorId: maria.id } });
  const mariaCustomer = await prisma.customer.findFirstOrThrow({ where: { creatorId: maria.id } });
  const mariaFile = await prisma.productFile.findFirstOrThrow({ where: { creatorId: maria.id } });

  // Lecturas
  const products = await db.product.findMany();
  check("findMany solo devuelve productos de Ana", products.length > 0 && products.every((p) => p.creatorId === ana.id));
  check("findFirst con id de producto de María → null", (await db.product.findFirst({ where: { id: mariaProduct.id } })) === null);
  check("findUnique con id de pedido de María → null", (await db.order.findUnique({ where: { id: mariaOrder.id } })) === null);
  check("findUnique con id de clienta de María → null", (await db.customer.findUnique({ where: { id: mariaCustomer.id } })) === null);
  check("archivos privados de María invisibles", (await db.productFile.findFirst({ where: { id: mariaFile.id } })) === null);
  const customers = await db.customer.findMany();
  check("clientes: solo la relación con Ana (Carmen compra a ambas, pero son filas distintas)", customers.every((c) => c.creatorId === ana.id) && !customers.some((c) => c.id === mariaCustomer.id));
  const agg = await db.order.aggregate({ _sum: { amountCents: true }, where: { status: "PAID" } });
  const real = await prisma.order.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", creatorId: ana.id } });
  check("aggregate de ventas = solo ventas de Ana", agg._sum.amountCents === real._sum.amountCents);
  const groups = await db.analyticsEvent.groupBy({ by: ["creatorId"] });
  check("groupBy de analytics solo ve el tenant de Ana", groups.length === 1 && groups[0].creatorId === ana.id);
  check("count de reservas no incluye las de otras", (await db.booking.count()) === (await prisma.booking.count({ where: { creatorId: ana.id } })));

  // Escrituras (el siguiente "prisma:error" es esperado: Prisma rechaza el update)
  let threw = false;
  try {
    await db.product.update({ where: { id: mariaProduct.id }, data: { title: "hackeado" } });
  } catch {
    threw = true;
  }
  check("update sobre producto de María falla", threw);
  const um = await db.product.updateMany({ where: { id: mariaProduct.id }, data: { title: "hackeado" } });
  check("updateMany sobre producto de María afecta 0 filas", um.count === 0);
  const dm = await db.productFile.deleteMany({ where: { id: mariaFile.id } });
  check("deleteMany sobre archivo de María afecta 0 filas", dm.count === 0);
  const forged = await db.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", slug: `isolation-${Date.now()}`, title: "Intento", priceCents: 100, status: "DRAFT" },
  });
  check("create con creatorId ajeno se reasigna a Ana", forged.creatorId === ana.id);
  await db.product.delete({ where: { id: forged.id } });
  const still = await prisma.product.findUniqueOrThrow({ where: { id: mariaProduct.id } });
  check("el producto de María sigue intacto", still.title === mariaProduct.title);

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nAislamiento multi-tenant correcto ✓");
  process.exit(failures ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
