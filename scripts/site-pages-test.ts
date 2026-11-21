/**
 * Editor de la página y páginas extra, contra Postgres (con la BD sembrada: npm run db:reset):
 *   tsx --conditions=react-server scripts/site-pages-test.ts            (web personal de Cirella)
 *   tsx --conditions=react-server scripts/site-pages-test.ts platform   (modo plataforma)
 *   (los dos: npm run test:pages)
 *
 *   · aislamiento: tenantDb(Cirella).sitePage no ve, no cambia ni borra la página de María;
 *   · crear desde las plantillas, el máximo de páginas, direcciones (sobre-mi, sobre-mi-2, rutas de
 *     la web y la dueña rechazadas; María puede tener también sobre-mi);
 *   · saneamiento al guardar: imágenes y vídeos de María, texto MD sin imágenes, vídeo subido solo
 *     en la web personal;
 *   · borrador y publicado: lo público no cambia hasta publicar, despublicar da null y conserva lo
 *     publicado, borrar la quita; el pie de la web (getPublicCreator.pages) y su dirección por modo;
 *   · «Añadir un botón en mi portada» va al borrador y no se duplica;
 *   · subidas: el vídeo de la página (public/video/<Cirella>/…, con sus medidas y códec), sus límites,
 *     y la imagen «graphic» con medidas; en la plataforma no se puede subir un vídeo.
 * Usa el driver local en una carpeta temporal y borra al final lo que crea.
 */
import "./load-env";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const platform = process.argv[2] === "platform";
const tmp = mkdtempSync(path.join(os.tmpdir(), "cirella-pages-"));
Object.assign(process.env, {
  STORAGE_DRIVER: "local",
  STORAGE_DIR: tmp,
  SITE_MODE: platform ? "platform" : "personal",
  OWNER_USERNAME: platform ? "" : "ana",
  PAYMENT_PROVIDER: platform ? "simulated" : "none",
  EMAIL_PROVIDER: "log",
  DEMO_MODE: "true",
});

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

async function rejects(fn: () => Promise<unknown>, match: RegExp) {
  try {
    await fn();
    return false;
  } catch (e) {
    return match.test(e instanceof Error ? e.message : String(e));
  }
}

const TAG = `pg${Date.now().toString(36)}`;

async function main() {
  const { prisma } = await import("../lib/db");
  const { tenantDb } = await import("../lib/tenant");
  const pages = await import("../lib/site-pages.server");
  const { sanitizeBlocks } = await import("../lib/page-blocks.server");
  const { starterContent, readSitePageContent } = await import("../lib/site-pages");
  const { getPublicCreator } = await import("../lib/public");
  const { createUpload, completeUpload } = await import("../lib/uploads");
  const { storage } = await import("../lib/storage");
  const { mp4 } = await import("./fixtures/iso-media");
  const sharp = (await import("sharp")).default;

  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const anaDraftBefore = ana.pageDraft;
  const created: string[] = [];
  const own = (cid: string) => `/media/${cid}/0123456789abcdef0123.webp`;
  const img = (cid: string) => ({ src: own(cid), alt: "", width: 800, height: 600 });
  const textBlock = (body: string) => ({ id: "t", kind: "text" as const, title: "Hola", body, format: "MD" as const, enabled: true });

  try {
    if (!platform) {
      // ── Aislamiento ──
      const mariaPage = await prisma.sitePage.create({ data: { creatorId: maria.id, slug: `${TAG}-maria`, title: "De María", draft: starterContent("blank", "De María") } });
      created.push(mariaPage.id);
      const anaDb = tenantDb(ana.id);
      check("Cirella no ve la página de María por su id", !(await anaDb.sitePage.findFirst({ where: { id: mariaPage.id } })));
      check("ni la cambia", (await anaDb.sitePage.updateMany({ where: { id: mariaPage.id }, data: { title: "Robada" } })).count === 0);
      check("ni la borra", !(await pages.deleteSitePage(ana.id, mariaPage.id)) && !!(await prisma.sitePage.findUnique({ where: { id: mariaPage.id } })));
      const saveOther = await pages.saveSitePage(ana.id, mariaPage.id, { content: starterContent("blank", "X"), slug: "x", showInNav: true }, { publish: true });
      check("ni la publica", !saveOther.ok);

      // ── Crear y direcciones ──
      const titles = [`Sobre mí ${TAG}`, `Sobre mí ${TAG}`];
      const ids: string[] = [];
      for (const t of titles) {
        const r = await pages.createSitePage(ana.id, { template: "about", title: t });
        check(`crear «${t}»`, "id" in r, r);
        if ("id" in r) {
          ids.push(r.id);
          created.push(r.id);
        }
      }
      const [p1, p2] = await Promise.all(ids.map((id) => prisma.sitePage.findUniqueOrThrow({ where: { id } })));
      check("dos títulos iguales → sobre-mi… y sobre-mi…-2", p2.slug === `${p1.slug}-2`, [p1.slug, p2.slug]);
      check("la plantilla «Sobre mí» valida y está en borrador", p1.status === "DRAFT" && readSitePageContent(p1.draft, "").blocks.length === 3);
      for (const t of ["faq", "blank"] as const) {
        const r = await pages.createSitePage(ana.id, { template: t });
        check(`crear desde «${t}»`, "id" in r);
        if ("id" in r) created.push(r.id);
      }
      const content = readSitePageContent(p1.draft, "");
      for (const bad of ["panel", "ana", "novedades"]) {
        const r = await pages.saveSitePage(ana.id, p1.id, { content, slug: bad, showInNav: true }, { publish: false });
        check(`la dirección «${bad}» se rechaza`, !r.ok && /la usa la web/.test(r.error), r);
      }
      const mariaSame = await prisma.sitePage.create({ data: { creatorId: maria.id, slug: p1.slug, title: "x", draft: {} } });
      created.push(mariaSame.id);
      check("María puede tener la misma dirección que Cirella", !!mariaSame);

      // ── Saneamiento ──
      const withImage = (src: string) => ({ ...content, blocks: [{ id: "i", kind: "image" as const, title: "", image: { ...img(ana.id), src }, enabled: true }] });
      let r = await pages.saveSitePage(ana.id, p1.id, { content: withImage(own(maria.id)), slug: p1.slug, showInNav: true }, { publish: false });
      check("una imagen de María se rechaza", !r.ok && /no es tuya/.test(r.error), r);
      r = await pages.saveSitePage(ana.id, p1.id, { content: { ...content, cover: img(maria.id) }, slug: p1.slug, showInNav: true }, { publish: false });
      check("una cabecera de María se rechaza", !r.ok && /no es tuya/.test(r.error), r);
      const mariaVideo = { src: `/media/video/${maria.id}/0123456789abcdef01234567.mp4`, width: 1, height: 1, durationSec: 1, codec: "H264" as const, sizeBytes: 1 };
      r = await pages.saveSitePage(ana.id, p1.id, { content: { ...content, blocks: [{ id: "v", kind: "video", title: "", upload: mariaVideo, poster: null, enabled: true }] }, slug: p1.slug, showInNav: true }, { publish: false });
      check("un vídeo de María se rechaza", !r.ok && /no es tuyo/.test(r.error), r);
      const md = `Hola\n![x](/media/${ana.id}/0123456789abcdef0123.webp)\nAdiós`;
      r = await pages.saveSitePage(ana.id, p1.id, { content: { ...content, blocks: [textBlock(md)] }, slug: p1.slug, showInNav: true }, { publish: false });
      const savedText = readSitePageContent((await prisma.sitePage.findUniqueOrThrow({ where: { id: p1.id } })).draft, "").blocks[0];
      check("en el texto MD las imágenes desaparecen", r.ok && savedText.kind === "text" && savedText.body === "Hola\nAdiós", savedText);
      const homeBad = sanitizeBlocks(ana.id, [{ id: "g", kind: "gallery", title: "", images: [img(maria.id)], layout: "grid", enabled: true }]);
      check("portada: una galería con una imagen de María se rechaza", "error" in homeBad);
      const homeOk = sanitizeBlocks(ana.id, [{ id: "g", kind: "gallery", title: "", images: [img(ana.id)], layout: "grid", enabled: true }]);
      check("portada: con imágenes propias se guarda con sus medidas", "blocks" in homeOk && homeOk.blocks[0].kind === "gallery" && homeOk.blocks[0].images[0].width === 800);

      // ── Borrador y publicado ──
      const slug = p1.slug;
      const title1 = `Publicada ${TAG}`;
      check("antes de publicar no se ve", (await pages.getPublicSitePage("ana", slug)) === null);
      r = await pages.saveSitePage(ana.id, p1.id, { content: { ...content, title: title1 }, slug, showInNav: true }, { publish: true });
      check("publicar", r.ok && /Ya se ve en \//.test(r.message), r);
      let pub = await pages.getPublicSitePage("ana", slug);
      check("publicada: se ve, con la dirección de la raíz en la web personal", pub?.content.title === title1 && pub.path === `/${slug}`, pub?.path);
      check("y sale en el pie de la web", !!(await getPublicCreator("ana"))?.pages.some((p) => p.href === `/${slug}` && p.title === title1));
      await pages.saveSitePage(ana.id, p1.id, { content: { ...content, title: "Borrador nuevo" }, slug, showInNav: true }, { publish: false });
      pub = await pages.getPublicSitePage("ana", slug);
      check("guardar el borrador no cambia lo publicado", pub?.content.title === title1, pub?.content.title);
      const { sitePageState } = await import("../lib/site-pages");
      check("estado: cambios sin publicar", sitePageState(await prisma.sitePage.findUniqueOrThrow({ where: { id: p1.id } })) === "CHANGES");
      await pages.saveSitePage(ana.id, p1.id, { content: { ...content, title: title1 }, slug, showInNav: false }, { publish: true });
      check("fuera del pie: sigue publicada pero no sale en el pie", !!(await pages.getPublicSitePage("ana", slug)) && !(await getPublicCreator("ana"))?.pages.some((p) => p.href === `/${slug}`));
      check("despublicar", await pages.unpublishSitePage(ana.id, p1.id));
      const afterUnpublish = await prisma.sitePage.findUniqueOrThrow({ where: { id: p1.id } });
      check("despublicada: no se ve y conserva lo publicado", (await pages.getPublicSitePage("ana", slug)) === null && !!afterUnpublish.published);

      // ── Botón en la portada ──
      const b1 = await pages.addSitePageButton(ana.id, p1.id);
      const b2 = await pages.addSitePageButton(ana.id, p1.id);
      const fresh = await prisma.creator.findUniqueOrThrow({ where: { id: ana.id } });
      const links = (fresh.pageDraft as { links: { url: string; label: string }[] }).links.filter((l) => l.url === `/${slug}`);
      const pubLinks = (fresh.pagePublished as { links: { url: string }[] }).links.filter((l) => l.url === `/${slug}`);
      check("«Añadir un botón» va al borrador de la portada (una sola vez)", b1.ok && b2.ok && links.length === 1 && pubLinks.length === 0, links);

      // ── Borrar ──
      check("borrar", await pages.deleteSitePage(ana.id, p1.id));
      check("borrada: ya no existe", !(await prisma.sitePage.findUnique({ where: { id: p1.id } })));

      // ── Subidas ──
      const video = mp4({ codec: "hvc1", width: 1080, height: 1920, durationSec: 5 });
      const up = await createUpload(ana.id, { purpose: "video", name: "bienvenida.mov", contentType: "video/quicktime", size: video.length });
      const key = "uploadUrl" in up ? (storage() as import("../lib/storage").LocalDriver).verify(new URL(up.uploadUrl, "http://x").searchParams.get("t"))?.k ?? "" : "";
      check("el vídeo de la página va a public/video/<Cirella>/", key.startsWith(`public/video/${ana.id}/`) && key.endsWith(".mov"), key);
      await storage().put(key, video, { contentType: "video/quicktime" });
      check("María no puede completar el vídeo de Cirella", await rejects(() => completeUpload(maria.id, up.ticket), /caducado/));
      const done = await completeUpload(ana.id, up.ticket);
      const v = "video" in done ? done.video : null;
      check(
        "completar: dirección /media/video/<Cirella>/…, 1080×1920, 5 s, HEVC",
        !!v && v.src.startsWith(`/media/video/${ana.id}/`) && v.width === 1080 && v.height === 1920 && v.durationSec === 5 && v.codec === "HEVC" && v.sizeBytes === video.length,
        v,
      );
      const again = await completeUpload(ana.id, up.ticket);
      check("completarlo dos veces da lo mismo", JSON.stringify(again) === JSON.stringify(done));
      check("más de 1 GB se rechaza", await rejects(() => createUpload(ana.id, { purpose: "video", name: "x.mp4", contentType: "video/mp4", size: 1024 ** 3 + 1 }), /supera 1 GB/));
      check("un PDF no es un vídeo", await rejects(() => createUpload(ana.id, { purpose: "video", name: "x.pdf", contentType: "application/pdf", size: 1000 }), /MP4 o MOV/));
      const png = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#cab" } }).png().toBuffer();
      const imgUp = await createUpload(ana.id, { purpose: "image", name: "canva.png", contentType: "image/png", size: png.length, graphic: true });
      if ("uploadUrl" in imgUp) await storage().put((storage() as import("../lib/storage").LocalDriver).verify(new URL(imgUp.uploadUrl, "http://x").searchParams.get("t"))!.k, png, { contentType: "image/png" });
      const imgDone = await completeUpload(ana.id, imgUp.ticket);
      check("la imagen «graphic» vuelve con sus medidas (1080×1920)", "url" in imgDone && imgDone.width === 1080 && imgDone.height === 1920, imgDone);
      // Un billete de vídeo falsificado con la carpeta de Cirella pero de María no vale.
      const { signToken, storageSecret } = await import("../lib/storage");
      const forged = signToken({ k: `public/video/${ana.id}/0123456789abcdef01234567.mp4`, c: maria.id, p: "video", n: "x", ct: "video/mp4", s: 10 }, storageSecret(), 600);
      check("un billete de vídeo con la carpeta de otra creadora no vale", await rejects(() => completeUpload(maria.id, forged), /caducado/));
    } else {
      // ── Modo plataforma ──
      check("el vídeo subido se rechaza en la plataforma", await rejects(() => createUpload(ana.id, { purpose: "video", name: "x.mp4", contentType: "video/mp4", size: 1000 }), /enlace de YouTube o Vimeo/));
      const vid = (cid: string) => [{ id: "v", kind: "video" as const, title: "", upload: { src: `/media/video/${cid}/0123456789abcdef01234567.mp4`, width: 1, height: 1, durationSec: 1, codec: "H264" as const, sizeBytes: 1 }, poster: null, enabled: true }];
      check("un vídeo subido de María no se guarda", "error" in sanitizeBlocks(ana.id, vid(maria.id)));
      check("el que ya tenía su página (subido en la web personal) se conserva al guardar", "blocks" in sanitizeBlocks(ana.id, vid(ana.id)));
      const r = await pages.createSitePage(ana.id, { template: "about", title: `Sobre mí ${TAG}` });
      if ("id" in r) created.push(r.id);
      const page = "id" in r ? await prisma.sitePage.findUniqueOrThrow({ where: { id: r.id } }) : null;
      const saved = page && (await pages.saveSitePage(ana.id, page.id, { content: readSitePageContent(page.draft, ""), slug: page.slug, showInNav: true }, { publish: true }));
      const pub = page && (await pages.getPublicSitePage("ana", page.slug));
      check("en la plataforma la dirección es /ana/p/<slug>", !!saved?.ok && pub?.path === `/ana/p/${page!.slug}`, pub?.path);
      check("y el pie de la web enlaza ahí", !!(await getPublicCreator("ana"))?.pages.some((p) => p.href === `/ana/p/${page!.slug}`));
      check("María no la ve como suya", !(page && (await pages.getPublicSitePage("maria", page.slug))));
    }
  } finally {
    await prisma.sitePage.deleteMany({ where: { id: { in: created } } });
    await prisma.sitePage.deleteMany({ where: { creatorId: ana.id, title: { contains: TAG } } });
    await prisma.creator.update({ where: { id: ana.id }, data: { pageDraft: (anaDraftBefore ?? undefined) as import("@prisma/client").Prisma.InputJsonValue | undefined } });
    await prisma.$disconnect();
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} comprobaciones fallan ✗` : `\nTodas las comprobaciones pasan ✓ (${platform ? "plataforma" : "web personal"})`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
