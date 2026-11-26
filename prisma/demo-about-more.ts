/**
 * Añade a «Sobre mí» de Cirella un texto libre debajo de sus métodos (antes de «¿Hablamos?»), en el borrador y en
 * lo publicado, si aún no lo tiene. Se puede ejecutar solo: `npx tsx prisma/demo-about-more.ts`.
 */
import "../scripts/load-env";
import { PrismaClient, type Prisma } from "@prisma/client";

const BLOCK = {
  "id": "mas-sobre-mi",
  "kind": "text",
  "title": "Más allá de los métodos",
  "body": "Cuando no estoy leyendo cartas, me encontrarás **caminando por el campo al atardecer**, con una libreta en el bolsillo y la Luna por compañera.\n\nCreo en las mañanas lentas, en el té caliente y en escribir a mano lo que siento. Cada luna nueva enciendo una vela y escribo mis intenciones, como te propongo a ti.\n\nLo que más me emociona de este trabajo es ver el momento en que alguien **se reconoce en su propio mapa**: ese «ahora lo entiendo» que lo cambia todo.",
  "format": "MD",
  "enabled": true
};

function withBlock(raw: Prisma.JsonValue | null): Prisma.InputJsonValue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const page = { ...(raw as Record<string, unknown>) };
  const blocks = Array.isArray(page.blocks) ? [...(page.blocks as { id?: string }[])] : [];
  if (blocks.some((b) => b.id === BLOCK.id)) return null;
  const at = blocks.findIndex((b) => b.id === "hablamos");
  blocks.splice(at < 0 ? blocks.length : at, 0, BLOCK);
  page.blocks = blocks;
  return page as Prisma.InputJsonValue;
}

const prisma = new PrismaClient();
(async () => {
  const ana = await prisma.creator.findFirst({ where: { username: "ana" }, select: { id: true } });
  if (!ana) throw new Error("No encuentro la cuenta de Cirella.");
  const page = await prisma.sitePage.findFirst({ where: { creatorId: ana.id, slug: "aboutme" } });
  if (!page) throw new Error("No encuentro su página «Sobre mí».");
  const draft = withBlock(page.draft);
  const published = withBlock(page.published);
  await prisma.sitePage.update({ where: { id: page.id }, data: { ...(draft ? { draft } : {}), ...(published ? { published } : {}) } });
  console.log(draft || published ? "Añadido «Más allá de los métodos» a «Sobre mí»" : "Ya lo tenía");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
