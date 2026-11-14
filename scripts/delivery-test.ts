/**
 * Entrega de productos contra Postgres (lib/delivery.ts).
 *   npm run test:delivery     (con la BD sembrada: npm run db:reset)
 *
 *   · el estado por defecto de un producto es borrador: publicar siempre es explícito;
 *   · productDeliveryIssue cuenta archivos, enlaces y lecciones, y simula cambios sin guardarlos
 *     (otro modo de entrega, otras instrucciones o borrar el último archivo/lección);
 *   · listDeliveryIssues: lo que bloquea sale siempre; una membresía vacía solo si está publicada;
 *     los archivados no salen.
 * Usa productos temporales de Cirella y deja la BD como estaba.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { listDeliveryIssues, productDeliveryIssue } from "../lib/delivery";
import { tenantDb } from "../lib/tenant";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `entrega-${Date.now()}`;

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const db = tenantDb(ana.id);
  const product = (type: string, slug: string, extra: Record<string, unknown> = {}) =>
    db.product.create({ data: { creatorId: ana.id, type, slug: `${TAG}-${slug}`, title: `Prueba ${slug}`, priceCents: 1900, ...extra } });

  const digital = await product("DIGITAL", "digital");
  const course = await product("COURSE", "curso");
  const emptyClub = await product("MEMBERSHIP", "club", { status: "PUBLISHED" });
  const draftClub = await product("MEMBERSHIP", "club-borrador");
  const archived = await product("DIGITAL", "archivado", { status: "ARCHIVED" });
  try {
    check("un producto nuevo nace en borrador", digital.status === "DRAFT" && digital.deliveryMode === "AUTOMATIC");

    check("digital sin archivos → NO_CONTENT", (await productDeliveryIssue(db, digital.id))?.issue?.code === "NO_CONTENT");
    await db.productFile.create({ data: { creatorId: ana.id, productId: digital.id, name: "Tirada en PDF", kind: "LINK", url: "https://example.com/tirada.pdf" } });
    check("…con un enlace ya tiene qué entregar", (await productDeliveryIssue(db, digital.id))?.issue === null);
    check("…pero borrar ese enlace lo dejaría vacío", (await productDeliveryIssue(db, digital.id, { minus: { files: 1 } }))?.issue?.code === "NO_CONTENT");
    check(
      "pasar a «lo preparo yo» sin instrucciones bloquea, aunque haya archivos",
      (await productDeliveryIssue(db, digital.id, { deliveryMode: "PERSONAL", instructions: null }))?.issue?.code === "NO_INSTRUCTIONS",
    );
    check(
      "…y con instrucciones, no",
      (await productDeliveryIssue(db, digital.id, { deliveryMode: "PERSONAL", instructions: "Te lo envío por email en 3 días" }))?.issue === null,
    );

    const mod = await db.courseModule.create({ data: { creatorId: ana.id, productId: course.id, title: "Módulo 1", sortOrder: 0 } });
    check("curso con un módulo vacío → NO_LESSONS", (await productDeliveryIssue(db, course.id))?.issue?.code === "NO_LESSONS");
    await db.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: mod.id, title: "Bienvenida", kind: "TEXT", body: "Hola", sortOrder: 0 } });
    check("…con una lección, nada", (await productDeliveryIssue(db, course.id))?.issue === null);
    check("…borrar la última lección lo dejaría vacío", (await productDeliveryIssue(db, course.id, { minus: { lessons: 1 } }))?.issue?.code === "NO_LESSONS");

    const ids = new Map((await listDeliveryIssues(db)).map((x) => [x.product.id, x.issue]));
    check("listDeliveryIssues: la membresía publicada y vacía sale como aviso", ids.get(emptyClub.id)?.code === "NO_POSTS" && ids.get(emptyClub.id)?.blocking === false);
    check("…la membresía en borrador no", !ids.has(draftClub.id));
    check("…los archivados no", !ids.has(archived.id));
    check("…los que ya tienen entrega no", !ids.has(digital.id) && !ids.has(course.id));
  } finally {
    await prisma.product.deleteMany({ where: { creatorId: ana.id, slug: { startsWith: TAG } } });
  }

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nEntrega de productos correcta ✓");
  process.exit(failures ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
