/**
 * Aislamiento entre creadoras en las subidas y el almacenamiento.
 *   npx tsx scripts/storage-isolation-test.ts   (parte de npm run test:isolation)
 *
 * Usa la BD de la demo (Ana y María) y el driver local en una carpeta temporal: no toca ./storage.
 * Comprueba que un billete de subida de Ana no sirve a María, que nadie sube archivos a un
 * producto ajeno (ni falsificando el billete) y que las claves siempre van en la carpeta de quien sube.
 */
import type { SingleUpload } from "../lib/uploads";
import "./load-env";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = mkdtempSync(path.join(os.tmpdir(), "cirella-storage-"));
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_DIR = tmp;

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
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

async function main() {
  // Después de fijar STORAGE_DIR: el driver se crea con la configuración del primer uso.
  const { prisma } = await import("../lib/db");
  const { abortUpload, completeUpload, createUpload, signUploadParts } = await import("../lib/uploads");
  const { uploadPolicy } = await import("../lib/file-types");
  const { privateKey, signToken, storage, storageSecret } = await import("../lib/storage");
  const sharp = (await import("sharp")).default;

  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const anaProduct = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL" } });
  const mariaProduct = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } });
  const s = storage();
  const keyOf = (uploadUrl: string) => s.name === "local" && (s as import("../lib/storage").LocalDriver).verify(new URL(uploadUrl, "http://x").searchParams.get("t"))?.k;
  const created: string[] = [];

  try {
    // ── Imagen: el billete de Ana no sirve a María ──
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c9a" } }).png().toBuffer();
    const img = (await createUpload(ana.id, { purpose: "image", name: "foto.png", contentType: "image/png", size: png.length })) as SingleUpload;
    const imgKey = keyOf(img.uploadUrl) || "";
    check("la imagen se sube a incoming/<Ana>/", imgKey.startsWith(`incoming/${ana.id}/`));
    await s.put(imgKey, png, { contentType: "image/png" });
    check("María no puede completar la subida de Ana", await rejects(() => completeUpload(maria.id, img.ticket), /caducado/));
    const done = await completeUpload(ana.id, img.ticket);
    check("Ana sí: la imagen queda en /media/<Ana>/", "url" in done && done.url.startsWith(`/media/${ana.id}/`));
    check("el original sin procesar se borra", (await s.head(imgKey)) === null);
    check("un billete ya usado no vuelve a valer", await rejects(() => completeUpload(ana.id, img.ticket), /archivo completo/));

    // ── Archivo privado: solo en productos propios ──
    check(
      "Ana no puede pedir una subida a un producto de María",
      await rejects(() => createUpload(ana.id, { purpose: "file", productId: mariaProduct.id, name: "x.pdf", contentType: "application/pdf", size: 10 }), /Producto no encontrado/),
    );
    const pdf = Buffer.from("%PDF-1.4 prueba de aislamiento");
    const up = (await createUpload(ana.id, { purpose: "file", productId: anaProduct.id, name: "guía.pdf", contentType: "application/pdf", size: pdf.length })) as SingleUpload;
    const fileKey = keyOf(up.uploadUrl) || "";
    check("el archivo se sube a private/<Ana>/", fileKey.startsWith(`private/${ana.id}/`) && fileKey.endsWith(".pdf"));
    await s.put(fileKey, pdf, { contentType: "application/pdf" });
    const result = await completeUpload(ana.id, up.ticket);
    const row = "file" in result ? await prisma.productFile.findUnique({ where: { id: result.file.id } }) : null;
    if (row) created.push(row.id);
    check("el ProductFile es de Ana y apunta a su carpeta", !!row && row.creatorId === ana.id && row.productId === anaProduct.id && privateKey(row.storageKey ?? "") === fileKey);
    const again = await completeUpload(ana.id, up.ticket);
    check("repetir el paso 2 no duplica el archivo", "file" in again && again.file.id === row?.id);

    // ── Billete falsificado (firmado con la clave, como si se filtrara): el producto de María sigue fuera de alcance ──
    const forgedKey = `private/${ana.id}/${"ab".repeat(12)}.pdf`;
    await s.put(forgedKey, pdf, { contentType: "application/pdf" });
    const forged = signToken({ k: forgedKey, c: ana.id, p: "file", pid: mariaProduct.id, n: "x.pdf", ct: "application/pdf", s: pdf.length }, storageSecret(), 600);
    check("un billete con el producto de María se rechaza al completar", await rejects(() => completeUpload(ana.id, forged), /Producto no encontrado/));
    check("y el archivo subido se borra", (await s.head(forgedKey)) === null);
    check("ningún archivo nuevo en el producto de María", (await prisma.productFile.count({ where: { productId: mariaProduct.id, name: "x.pdf" } })) === 0);

    // Clave en la carpeta de María con un billete «de Ana»
    const crossKey = `private/${maria.id}/${"cd".repeat(12)}.pdf`;
    await s.put(crossKey, pdf, { contentType: "application/pdf" });
    const cross = signToken({ k: crossKey, c: ana.id, p: "file", pid: anaProduct.id, n: "x.pdf", ct: "application/pdf", s: pdf.length }, storageSecret(), 600);
    check("un billete de Ana no puede registrar un archivo de la carpeta de María", await rejects(() => completeUpload(ana.id, cross), /caducado/));
    await s.delete([crossKey]);

    // ── Tamaño distinto del firmado ──
    const short = (await createUpload(ana.id, { purpose: "file", productId: anaProduct.id, name: "corto.pdf", contentType: "application/pdf", size: 1000 })) as SingleUpload;
    const shortKey = keyOf(short.uploadUrl) || "";
    await s.put(shortKey, pdf, { contentType: "application/pdf" });
    check("si el archivo no llega entero, se rechaza", await rejects(() => completeUpload(ana.id, short.ticket), /archivo completo/));
    check("y se borra lo recibido", (await s.head(shortKey)) === null);

    // ── Subida por partes (web personal): el billete es solo de Ana ──
    const mp = (await createUpload(
      ana.id,
      { purpose: "file", productId: anaProduct.id, name: "clase.mp4", contentType: "video/mp4", size: 70 * 1024 * 1024 },
      uploadPolicy(true),
    )) as { multipart?: { partCount: number }; ticket: string };
    const mpTicket = (await import("../lib/storage")).verifyToken<{ k: string; u?: string }>(mp.ticket, storageSecret());
    check("por partes: la clave va bajo private/<Ana>/", !!mp.multipart && !!mpTicket?.u && mpTicket.k.startsWith(`private/${ana.id}/`));
    check("María no puede firmar partes del billete de Ana", await rejects(() => signUploadParts(maria.id, mp.ticket, [1]), /caducado/));
    check("…ni completarlo", await rejects(() => completeUpload(maria.id, mp.ticket), /caducado/));
    check("…ni cancelarlo", await rejects(() => abortUpload(maria.id, mp.ticket), /caducado/));
    const forgedMp = signToken({ ...mpTicket, c: maria.id }, "otra-clave", 600);
    check("un billete falsificado no vale", await rejects(() => signUploadParts(maria.id, forgedMp, [1]), /caducado/));
    const crossMp = signToken({ ...mpTicket, c: maria.id }, storageSecret(), 600);
    check("un billete con la clave de Ana y el id de María no vale", await rejects(() => signUploadParts(maria.id, crossMp, [1]), /caducado/));
    check("Ana sí puede firmar sus partes", (await signUploadParts(ana.id, mp.ticket, [1, 2])).length === 2);
    await abortUpload(ana.id, mp.ticket);
  } finally {
    if (created.length) await prisma.productFile.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nAislamiento del almacenamiento correcto ✓");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
