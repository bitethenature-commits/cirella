/**
 * En la página «Mi energía» de Cirella, el oráculo sale antes que las runas (en el borrador y en lo publicado).
 * Se puede ejecutar solo: `npx tsx prisma/demo-energy-order.ts`.
 */
import "../scripts/load-env";
import { PrismaClient, type Prisma } from "@prisma/client";

function oracleFirst(raw: Prisma.JsonValue | null): Prisma.InputJsonValue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const page = { ...(raw as Record<string, unknown>) };
  const blocks = Array.isArray(page.blocks) ? [...(page.blocks as { id?: string; model?: string }[])] : [];
  const r = blocks.findIndex((b) => b.model === "runes");
  const o = blocks.findIndex((b) => b.model === "oracle");
  if (r < 0 || o < 0 || o < r) return null;
  const [oracle] = blocks.splice(o, 1);
  blocks.splice(r, 0, oracle);
  page.blocks = blocks;
  return page as Prisma.InputJsonValue;
}

const prisma = new PrismaClient();
(async () => {
  const ana = await prisma.creator.findFirst({ where: { username: "ana" }, select: { id: true } });
  if (!ana) throw new Error("No encuentro la cuenta de Cirella.");
  const page = await prisma.sitePage.findFirst({ where: { creatorId: ana.id, slug: "energy" } });
  if (!page) throw new Error("No encuentro su página «Mi energía».");
  const draft = oracleFirst(page.draft);
  const published = oracleFirst(page.published);
  if (draft || published) await prisma.sitePage.update({ where: { id: page.id }, data: { ...(draft ? { draft } : {}), ...(published ? { published } : {}) } });
  console.log(draft || published ? "El oráculo ya sale antes que las runas" : "Ya estaba así");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
