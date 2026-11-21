/**
 * Las lecturas (productos DIGITAL) se envían por email: la web no guarda sus archivos. En una base ya
 * creada: todas pasan a «Lo preparo yo» y se borran sus archivos (de la base y del almacenamiento).
 *   npx tsx prisma/demo-lecturas-por-email.ts
 */
import { PrismaClient } from "@prisma/client";
import { privateKey, storage } from "../lib/storage";

const prisma = new PrismaClient();

async function main() {
  const modes = await prisma.product.updateMany({ where: { type: "DIGITAL", deliveryMode: { not: "PERSONAL" } }, data: { deliveryMode: "PERSONAL" } });
  const files = await prisma.productFile.findMany({ where: { product: { type: "DIGITAL" } }, select: { id: true, storageKey: true } });
  const keys = files.map((f) => f.storageKey).filter((k): k is string => !!k).map(privateKey);
  if (keys.length) await storage().delete(keys).catch((e) => console.warn("Almacenamiento:", String(e)));
  const del = await prisma.productFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
  console.log(`Lecturas a «Lo preparo yo»: ${modes.count}. Archivos borrados: ${del.count}.`);
}

main().finally(() => prisma.$disconnect());
