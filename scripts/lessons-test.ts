/**
 * Lecciones por partes contra Postgres (lib/lessons.ts, lib/lesson-parts.ts y la migración).
 *   npm run test:lessons     (con la BD sembrada: npm run db:reset)
 *
 *   · el relleno de la migración (el bloque «relleno», tal cual) da las mismas partes que su gemelo
 *     partsFromLegacy y es idempotente; la regla CHECK rechaza partes mal formadas;
 *   · saveLessonWithParts: crear, editar (versión), conflicto, mover de módulo, duración
 *     automática, copia de compatibilidad, textos limpios, avisos de enlaces;
 *   · aislamiento: ids de María, archivos de otro producto, lecciones de otra creadora;
 *   · cascadas, progreso (un solo paso por lección), courseMaterials y loadLessonEditor.
 * Usa un curso temporal de Cirella (y uno de María) y deja la BD como estaba.
 */
import "./load-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { courseMaterials, getCustomerLibrary } from "../lib/customer";
import { prisma } from "../lib/db";
import { partsFromLegacy } from "../lib/lesson-parts";
import { LESSON_CONFLICT, LESSON_EMBED_WARNING, LESSON_FILE_GONE, LessonSaveError, loadLessonEditor, saveLessonWithParts } from "../lib/lessons";
import { parseRich } from "../lib/rich-text";
import { tenantDb } from "../lib/tenant";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

async function rejects(fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof LessonSaveError && e.message === message;
  }
}

const TAG = `lecciones-${Date.now()}`;
const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261018120000_lecciones_por_partes/migration.sql");

function backfillSql() {
  const sql = readFileSync(MIGRATION, "utf8");
  const start = sql.indexOf("-- relleno:inicio");
  const end = sql.indexOf("-- relleno:fin");
  if (start < 0 || end < 0) throw new Error("Faltan las marcas del relleno en la migración");
  return sql.slice(sql.indexOf("\n", start) + 1, end).trim().replace(/;\s*$/, "");
}

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const db = tenantDb(ana.id);
  const created = { products: [] as string[], users: [] as string[] };
  try {
    const course = await db.product.create({ data: { creatorId: ana.id, type: "COURSE", slug: `${TAG}-curso`, title: "Curso de prueba", priceCents: 0 } });
    const guide = await db.product.create({ data: { creatorId: ana.id, type: "DIGITAL", slug: `${TAG}-guia`, title: "Guía", priceCents: 0 } });
    const mCourse = await prisma.product.create({ data: { creatorId: maria.id, type: "COURSE", slug: `${TAG}-maria`, title: "Curso de María", priceCents: 0 } });
    created.products.push(course.id, guide.id, mCourse.id);
    const m1 = await db.courseModule.create({ data: { creatorId: ana.id, productId: course.id, title: "M1", sortOrder: 0 } });
    const m2 = await db.courseModule.create({ data: { creatorId: ana.id, productId: course.id, title: "M2", sortOrder: 1 } });
    const mm = await prisma.courseModule.create({ data: { creatorId: maria.id, productId: mCourse.id, title: "MM", sortOrder: 0 } });
    const file = (name: string, kind: string, o: { durationSec?: number; productId?: string } = {}) =>
      db.productFile.create({ data: { creatorId: ana.id, productId: o.productId ?? course.id, name, kind, mimeType: null, sizeBytes: 1000, durationSec: o.durationSec ?? null } });
    const video = await file("clase.mov", "VIDEO", { durationSec: 95 });
    const audio = await file("zoom.m4a", "AUDIO", { durationSec: 125 });
    const pdf = await file("cuaderno.pdf", "PDF");
    const img = await file("lamina.png", "IMAGE");
    const zip = await file("ejercicio.zip", "OTHER");
    const guideFile = await file("guia.pdf", "PDF", { productId: guide.id });
    const mFile = await prisma.productFile.create({ data: { creatorId: maria.id, productId: mCourse.id, name: "maria.pdf", kind: "PDF" } });
    const mLesson = await prisma.lesson.create({ data: { creatorId: maria.id, productId: mCourse.id, moduleId: mm.id, title: "De María", kind: "PDF", sortOrder: 0 } });
    await prisma.lessonPart.create({ data: { creatorId: maria.id, productId: mCourse.id, lessonId: mLesson.id, sortOrder: 0, kind: "FILE", fileId: mFile.id } });

    // ── Relleno de la migración frente a su gemelo ──
    const shapes = [
      { kind: "VIDEO", fileId: video.id, body: "Hola", bodyFormat: null, mediaUrl: null },
      { kind: "VIDEO", fileId: null, body: null, bodyFormat: null, mediaUrl: "https://youtu.be/abcdefghijk" },
      { kind: "VIDEO", fileId: video.id, body: null, bodyFormat: null, mediaUrl: "https://youtu.be/abcdefghijk" },
      { kind: "AUDIO", fileId: audio.id, body: "Escucha", bodyFormat: null, mediaUrl: null },
      { kind: "PDF", fileId: pdf.id, body: null, bodyFormat: null, mediaUrl: null },
      { kind: "EXERCISE", fileId: zip.id, body: "Haz el ejercicio", bodyFormat: null, mediaUrl: null },
      { kind: "TEXT", fileId: null, body: "## Título\n\n**hola**", bodyFormat: "MD", mediaUrl: null },
      { kind: "TEXT", fileId: null, body: "  \n ", bodyFormat: null, mediaUrl: null },
      { kind: "VIDEO", fileId: pdf.id, body: null, bodyFormat: null, mediaUrl: null },
    ];
    const legacy = [];
    for (const [i, s] of shapes.entries())
      legacy.push(await prisma.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: m1.id, title: `Antes ${i}`, sortOrder: i, ...s } }));
    const sql = backfillSql();
    await prisma.$executeRawUnsafe(sql);
    let same = true;
    for (const l of legacy) {
      const got = await prisma.lessonPart.findMany({ where: { lessonId: l.id }, orderBy: { sortOrder: "asc" } });
      const want = partsFromLegacy(l);
      const norm = got.map((p) => ({ id: p.id, sortOrder: p.sortOrder, kind: p.kind, body: p.body, bodyFormat: p.bodyFormat, fileId: p.fileId, url: p.url, creatorId: p.creatorId, productId: p.productId }));
      const expected = want.map((p) => ({
        id: `${l.id}-p${p.sortOrder}`,
        sortOrder: p.sortOrder,
        kind: p.kind,
        body: p.body ?? null,
        bodyFormat: p.kind === "TEXT" ? (p.bodyFormat ?? null) : null,
        fileId: p.fileId ?? null,
        url: p.url ?? null,
        creatorId: ana.id,
        productId: course.id,
      }));
      if (JSON.stringify(norm) !== JSON.stringify(expected)) {
        same = false;
        console.log("  ", l.title, JSON.stringify(norm), "≠", JSON.stringify(expected));
      }
    }
    check("relleno SQL = partsFromLegacy en las nueve formas (orden, tipo, campos e ids <lección>-pN)", same);
    check("la lección vacía no tiene partes", (await prisma.lessonPart.count({ where: { lessonId: legacy[7].id } })) === 0);
    check("el PDF puesto en una lección de vídeo pasa a parte FILE arriba", (await prisma.lessonPart.findFirst({ where: { lessonId: legacy[8].id } }))?.fileId === pdf.id);
    const again = await prisma.$executeRawUnsafe(sql);
    check("volver a ejecutar el relleno no inserta nada", again === 0, again);
    await prisma.lesson.deleteMany({ where: { id: { in: legacy.map((l) => l.id) } } });

    // ── CHECK de la forma ──
    const bad = async (q: string) => {
      try {
        await prisma.$executeRawUnsafe(q);
        return false;
      } catch {
        return true;
      }
    };
    const anyLesson = await prisma.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: m1.id, title: "tmp", kind: "TEXT", sortOrder: 0 } });
    const ins = (cols: string) =>
      `INSERT INTO "LessonPart" ("id","creatorId","productId","lessonId","sortOrder","kind","body","fileId","url") VALUES ('${TAG}-x-${Math.random().toString(36).slice(2)}','${ana.id}','${course.id}','${anyLesson.id}',0,${cols})`;
    check("CHECK: FILE sin archivo → rechazada", await bad(ins(`'FILE',NULL,NULL,NULL`)));
    check("CHECK: TEXT con url → rechazada", await bad(ins(`'TEXT','hola',NULL,'https://x.es'`)));
    check("CHECK: EMBED con texto → rechazada", await bad(ins(`'EMBED','hola',NULL,'https://youtu.be/x'`)));
    check("CHECK: tipo desconocido → rechazada", await bad(ins(`'HTML','x',NULL,NULL`)));
    await prisma.lesson.deleteMany({ where: { id: anyLesson.id } });

    // ── Crear ──
    for (const i of [0, 1]) await db.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: m1.id, title: `Previa ${i}`, kind: "TEXT", sortOrder: i } });
    const r = await saveLessonWithParts(ana.id, {
      moduleId: m1.id,
      title: "Cinco partes",
      durationMin: null,
      parts: [
        { kind: "TEXT", body: "## Hola\r\n\r\n**negrita**", format: "MD" },
        { kind: "FILE", fileId: video.id },
        { kind: "FILE", fileId: audio.id },
        { kind: "FILE", fileId: pdf.id },
        { kind: "FILE", fileId: img.id },
      ],
    });
    const l1 = await prisma.lesson.findUniqueOrThrow({ where: { id: r.lessonId }, include: { parts: { orderBy: { sortOrder: "asc" } } } });
    check("crear: al final del módulo (sortOrder 2), versión 0", l1.sortOrder === 2 && l1.version === 0 && r.version === 0 && r.created, { s: l1.sortOrder, v: l1.version });
    check("crear: duración automática 4 min (95 s + 125 s)", l1.durationMin === 4, l1.durationMin);
    check("crear: 5 partes en orden", JSON.stringify(l1.parts.map((p) => p.fileId ?? p.kind)) === JSON.stringify(["TEXT", video.id, audio.id, pdf.id, img.id]));
    check("crear: texto con saltos \\n y formato MD", l1.parts[0].body === "## Hola\n\n**negrita**" && l1.parts[0].bodyFormat === "MD");
    check(
      "crear: copia de compatibilidad (VIDEO, el vídeo, el texto, MD)",
      l1.kind === "VIDEO" && l1.fileId === video.id && l1.body === "## Hola\n\n**negrita**" && l1.bodyFormat === "MD" && l1.mediaUrl === null,
    );
    check("crear: cada parte con la creadora y el curso", l1.parts.every((p) => p.creatorId === ana.id && p.productId === course.id));

    // ── Editar, versión y conflicto ──
    const r2 = await saveLessonWithParts(ana.id, { id: r.lessonId, moduleId: m1.id, title: "Editada", durationMin: 7, version: 0, parts: [{ kind: "TEXT", body: "Solo texto", format: undefined }] });
    const l2 = await prisma.lesson.findUniqueOrThrow({ where: { id: r.lessonId }, include: { parts: true } });
    check("editar con la versión 0 → versión 1", r2.version === 1 && l2.version === 1 && !r2.created);
    check("editar: partes sustituidas, sin restos", l2.parts.length === 1 && l2.parts[0].body === "Solo texto" && l2.parts[0].bodyFormat === null);
    check("editar: la duración escrita (7) se respeta; copia TEXT", l2.durationMin === 7 && l2.kind === "TEXT" && l2.fileId === null);
    check(
      "editar otra vez con la versión 0 → «se ha cambiado desde otro dispositivo»",
      await rejects(() => saveLessonWithParts(ana.id, { id: r.lessonId, moduleId: m1.id, title: "Pisada", durationMin: null, version: 0, parts: [] }), LESSON_CONFLICT),
    );
    const l3 = await prisma.lesson.findUniqueOrThrow({ where: { id: r.lessonId }, include: { parts: true } });
    check("…y no se toca nada", l3.title === "Editada" && l3.parts.length === 1 && l3.version === 1);

    // ── Mover de módulo y reordenar ──
    const other = await db.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: m2.id, title: "En M2", kind: "TEXT", sortOrder: 0 } });
    const first = await prisma.lesson.findFirstOrThrow({ where: { moduleId: m1.id, sortOrder: 0 } });
    await saveLessonWithParts(ana.id, { id: first.id, moduleId: m2.id, title: first.title, durationMin: null, version: first.version, parts: [] });
    const moved = await prisma.lesson.findUniqueOrThrow({ where: { id: first.id } });
    const m1Orders = (await prisma.lesson.findMany({ where: { moduleId: m1.id }, orderBy: { sortOrder: "asc" } })).map((l) => l.sortOrder);
    check("mover: al final del otro módulo", moved.moduleId === m2.id && moved.sortOrder === 1, moved);
    check("mover: el módulo de origen queda 0..n-1", JSON.stringify(m1Orders) === JSON.stringify([0, 1]), m1Orders);
    await db.lesson.update({ where: { id: other.id }, data: { sortOrder: 1 } });
    check("reordenar no cambia la versión", (await prisma.lesson.findUniqueOrThrow({ where: { id: other.id } })).version === 0);

    // ── Aislamiento e integridad ──
    const base = { moduleId: m1.id, title: "x", durationMin: null };
    check("archivo de María → «ya no está en los materiales»", await rejects(() => saveLessonWithParts(ana.id, { ...base, parts: [{ kind: "FILE", fileId: mFile.id }] }), LESSON_FILE_GONE));
    check("archivo suyo de otro producto (guía) → el mismo error", await rejects(() => saveLessonWithParts(ana.id, { ...base, parts: [{ kind: "FILE", fileId: guideFile.id }] }), LESSON_FILE_GONE));
    check("módulo de María → «Módulo no encontrado»", await rejects(() => saveLessonWithParts(ana.id, { ...base, moduleId: mm.id, parts: [] }), "Módulo no encontrado"));
    check("lección de María en su módulo → «Esta lección ya no existe»", await rejects(() => saveLessonWithParts(ana.id, { ...base, id: mLesson.id, parts: [] }), "Esta lección ya no existe"));
    const mAfter = await prisma.lesson.findUniqueOrThrow({ where: { id: mLesson.id }, include: { parts: true } });
    check("lo de María sigue igual", mAfter.title === "De María" && mAfter.version === 0 && mAfter.parts.length === 1 && mAfter.parts[0].fileId === mFile.id);

    // ── Textos y enlaces ──
    const r3 = await saveLessonWithParts(ana.id, {
      ...base,
      title: "Textos",
      parts: [
        { kind: "TEXT", body: `<script>alert(1)</script>\n\n![x](https://evil.example/x.png)\n\n![propia](/media/${ana.id}/abc.webp)`, format: "MD" },
        { kind: "EMBED", url: "https://example.com/video" },
      ],
    });
    const texts = await prisma.lessonPart.findMany({ where: { lessonId: r3.lessonId }, orderBy: { sortOrder: "asc" } });
    // RichContent pinta los bloques de parseRich como nodos de texto de React (sin HTML; ver texto-formato.test).
    const blocks = JSON.stringify(parseRich(texts[0].body!));
    check("<script> escrito: se guarda tal cual y se lee como texto, no como HTML", texts[0].body!.includes("<script>alert(1)</script>") && blocks.includes('{"t":"text","v":"<script>alert(1)</script>"}'), blocks.slice(0, 200));
    check("imagen de otra web: fuera; la propia (/media/<ana>/…) se queda", !texts[0].body!.includes("evil.example") && texts[0].body!.includes(`/media/${ana.id}/abc.webp`));
    check("enlace que no es de YouTube/Vimeo: se guarda con aviso", r3.warning === LESSON_EMBED_WARNING && texts[1].url === "https://example.com/video");
    const r4 = await saveLessonWithParts(ana.id, { ...base, title: "YouTube", parts: [{ kind: "EMBED", url: "https://youtu.be/abcdefghijk" }] });
    check("youtu.be: sin aviso", r4.warning === null);

    // ── Progreso: la lección de cinco partes es un solo paso ──
    const r5 = await saveLessonWithParts(ana.id, {
      ...base,
      title: "Todo junto",
      parts: [{ kind: "FILE", fileId: video.id }, { kind: "TEXT", body: "x", format: "MD" }, { kind: "FILE", fileId: audio.id }, { kind: "FILE", fileId: pdf.id }, { kind: "FILE", fileId: img.id }],
    });
    const user = await prisma.user.create({ data: { email: `${TAG}@example.com`, name: "Alumna" } });
    created.users.push(user.id);
    await prisma.access.create({ data: { creatorId: ana.id, userId: user.id, productId: course.id } });
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: r5.lessonId } },
      create: { userId: user.id, lessonId: r5.lessonId, productId: course.id, creatorId: ana.id },
      update: {},
    });
    const lib = await getCustomerLibrary(user.id);
    const c = lib.courses.find((x) => x.product.id === course.id);
    const total = await prisma.lesson.count({ where: { productId: course.id, published: true } });
    check("progreso: una fila para la lección entera", (await prisma.lessonProgress.count({ where: { userId: user.id } })) === 1);
    check("…y el curso cuenta 1 de N por lecciones", c?.completed === 1 && c.total === total && c.percent === Math.round(100 / total), c && { completed: c.completed, total: c.total, percent: c.percent });

    // ── «Mis archivos» ──
    const mats = await courseMaterials(user.id, lib.courses.map((x) => ({ product: x.product, creator: x.creator })));
    const mine = mats.filter((f) => f.productId === course.id);
    const kinds = new Set(mine.map((f) => f.kind));
    check("courseMaterials: PDF, audio, imagen y otros; nunca vídeo", kinds.has("PDF") && kinds.has("AUDIO") && kinds.has("IMAGE") && kinds.has("OTHER") && !kinds.has("VIDEO"), [...kinds]);
    const firstUse = await prisma.lesson.findMany({ where: { productId: course.id, parts: { some: { fileId: pdf.id } } }, include: { module: true } });
    firstUse.sort((a, b) => a.module.sortOrder - b.module.sortOrder || a.sortOrder - b.sortOrder);
    const pdfRow = mine.find((f) => f.id === pdf.id);
    check(
      "courseMaterials: la primera lección por orden de módulo y lección, con su enlace",
      firstUse.length >= 1 && pdfRow?.lesson?.id === firstUse[0].id && pdfRow.lesson.href === `/area/courses/${course.id}?leccion=${firstUse[0].id}`,
      pdfRow?.lesson,
    );
    check("courseMaterials: un archivo sin lección → lesson null", mine.find((f) => f.id === zip.id)?.lesson === null);

    // ── Editor ──
    check("loadLessonEditor: curso de María → null", (await loadLessonEditor(ana.id, mCourse.id, null)) === null);
    check("loadLessonEditor: producto digital → null", (await loadLessonEditor(ana.id, guide.id, null)) === null);
    check("loadLessonEditor: lección desconocida → null", (await loadLessonEditor(ana.id, course.id, "no-existe")) === null);
    check("loadLessonEditor: lección de María en su curso → null", (await loadLessonEditor(ana.id, course.id, mLesson.id)) === null);
    const ed = await loadLessonEditor(ana.id, course.id, r5.lessonId);
    check(
      "loadLessonEditor: módulos, archivos con duración y partes en orden",
      ed?.modules.length === 2 && ed.files.find((f) => f.id === video.id)?.durationSec === 95 && JSON.stringify(ed.lesson?.parts.map((p) => p.fileId ?? p.kind)) === JSON.stringify([video.id, "TEXT", audio.id, pdf.id, img.id]),
    );

    // ── Cascadas ──
    const usedBy = await prisma.lessonPart.findMany({ where: { fileId: video.id }, select: { lessonId: true } });
    await db.productFile.deleteMany({ where: { id: video.id } });
    check("borrar un archivo quita sus partes", (await prisma.lessonPart.count({ where: { fileId: video.id } })) === 0 && usedBy.length >= 1);
    check("…las lecciones siguen ahí y Lesson.fileId queda vacío", (await prisma.lesson.count({ where: { id: { in: usedBy.map((u) => u.lessonId) } } })) === new Set(usedBy.map((u) => u.lessonId)).size && (await prisma.lesson.count({ where: { fileId: video.id } })) === 0);
    await db.lesson.deleteMany({ where: { id: r5.lessonId } });
    check("borrar una lección quita sus partes y su progreso", (await prisma.lessonPart.count({ where: { lessonId: r5.lessonId } })) === 0 && (await prisma.lessonProgress.count({ where: { lessonId: r5.lessonId } })) === 0);
  } finally {
    await prisma.lessonProgress.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.access.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
  }
  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nTodo bien ✓");
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
