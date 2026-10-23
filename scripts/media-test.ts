/**
 * Multimedia contra Postgres y el almacenamiento en disco (lib/uploads.ts, lib/media-probe.ts,
 * lib/storage/stream.ts).
 *   npm run test:media     (con la BD sembrada: npm run db:reset)
 *
 *   · límites por modo: la plataforma sigue en 1 GB y un solo PUT; la web personal admite MOV,
 *     M4A, WebP y GIF, vídeos de 4 GB, y rechaza HEIC y un PDF de más de 1 GB;
 *   · al completar la subida se leen duración, códec y tamaño (HEVC vertical, M4A, WAV); un
 *     archivo que no se puede leer se guarda igual, sin esos datos;
 *   · /api/stream: 200 con el tipo de la lista, nosniff y attachment para PDF; 206 con Range;
 *     un tramo abierto de un archivo grande se recorta a 8 MiB; 416 fuera de rango.
 * Usa una carpeta temporal y un curso temporal de Ana; deja la BD como estaba.
 */
import "./load-env";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { m4a, mp4, wav } from "./fixtures/iso-media";

const dir = mkdtempSync(path.join(tmpdir(), "cirella-media-"));
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_DIR = dir;

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const TAG = `media-${Date.now()}`;

async function main() {
  const { prisma } = await import("../lib/db");
  const { uploadPolicy, HEIC_ERROR } = await import("../lib/file-types");
  const { createUpload, completeUpload, UploadError } = await import("../lib/uploads");
  const { storage, storageSecret, verifyToken } = await import("../lib/storage");
  const { streamObjectResponse } = await import("../lib/storage/stream");
  const { tenantDb } = await import("../lib/tenant");

  const platform = uploadPolicy(false);
  const personal = uploadPolicy(true);
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const db = tenantDb(ana.id);
  const course = await db.product.create({ data: { creatorId: ana.id, type: "COURSE", slug: `${TAG}-curso`, title: "Curso multimedia", priceCents: 0 } });

  const errorOf = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return null;
    } catch (e) {
      return e instanceof UploadError ? e.message : `inesperado: ${String(e)}`;
    }
  };
  const input = (name: string, contentType: string, size: number) => ({ purpose: "file" as const, productId: course.id, name, contentType, size });

  /** Sube los bytes como lo haría el navegador (directo al disco) y completa la subida. */
  async function uploadBytes(name: string, contentType: string, bytes: Buffer, policy = personal) {
    const r = (await createUpload(ana.id, input(name, contentType, bytes.length), policy)) as { ticket: string; uploadUrl?: string };
    const t = verifyToken<{ k: string; ct: string }>(r.ticket, storageSecret())!;
    await storage().put(t.k, bytes, { contentType: t.ct });
    return completeUpload(ana.id, r.ticket);
  }

  try {
    // ── Límites por modo ──
    check("plataforma: un vídeo de 3 GB se rechaza («supera 1 GB»)", /supera 1 GB/.test((await errorOf(() => createUpload(ana.id, input("clase.mp4", "video/mp4", 3 * GiB), platform))) ?? ""));
    const single = (await createUpload(ana.id, input("grande.mp4", "video/mp4", 70 * MiB), platform)) as { uploadUrl?: string; multipart?: unknown };
    check("plataforma: 70 MB van en un solo PUT", !!single.uploadUrl && !single.multipart);
    for (const [name, ct] of [["clase.mov", "video/quicktime"], ["voz.m4a", "audio/x-m4a"], ["ficha.webp", "image/webp"], ["animada.gif", "image/gif"]] as const)
      check(`personal: ${name} (${ct}) se admite en un curso`, (await errorOf(() => createUpload(ana.id, input(name, ct, 5 * MiB), personal))) === null);
    check("personal: HEIC se rechaza con su explicación", (await errorOf(() => createUpload(ana.id, input("foto.heic", "image/heic", MiB), personal))) === HEIC_ERROR);
    check("personal: un PDF de 1,5 GB se rechaza", /supera 1 GB/.test((await errorOf(() => createUpload(ana.id, input("libro.pdf", "application/pdf", 1.5 * GiB), personal))) ?? ""));
    check("personal: un vídeo de 3 GB se admite", (await errorOf(() => createUpload(ana.id, input("clase.mov", "video/quicktime", 3 * GiB), personal))) === null);
    check(
      "personal: un vídeo de 5 GB se rechaza con el consejo de InShot",
      /supera 4 GB.*InShot/.test((await errorOf(() => createUpload(ana.id, input("clase.mov", "video/quicktime", 5 * GiB), personal))) ?? ""),
    );

    // ── Lectura al completar ──
    const hevc = (await uploadBytes("vertical.mov", "video/quicktime", mp4({ codec: "hvc1", width: 1920, height: 1080, rotation: 90, durationSec: 42, brand: "qt  " }))) as {
      file: { id: string; durationSec: number | null; videoCodec: string | null };
    };
    const hevcRow = await prisma.productFile.findUniqueOrThrow({ where: { id: hevc.file.id } });
    check(
      "vídeo HEVC vertical (.mov) → HEVC, 1080×1920, 42 s",
      hevcRow.videoCodec === "HEVC" && hevcRow.width === 1080 && hevcRow.height === 1920 && hevcRow.durationSec === 42 && hevcRow.mimeType === "video/quicktime",
      hevcRow,
    );
    check("…y la respuesta trae la duración y el códec", hevc.file.durationSec === 42 && hevc.file.videoCodec === "HEVC");
    check("…sizeBytes es un number (JSON sin problemas)", typeof hevcRow.sizeBytes === "number" && JSON.stringify({ s: hevcRow.sizeBytes }).length > 0);
    const audio = (await uploadBytes("voz.m4a", "audio/mp4", m4a({ durationSec: 95 }))) as { file: { id: string } };
    const audioRow = await prisma.productFile.findUniqueOrThrow({ where: { id: audio.file.id } });
    check("M4A → 95 s, sin datos de vídeo", audioRow.durationSec === 95 && audioRow.videoCodec === null && audioRow.width === null);
    const w = (await uploadBytes("pista.wav", "audio/wav", wav({ durationSec: 4 }))) as { file: { id: string } };
    check("WAV → 4 s", (await prisma.productFile.findUniqueOrThrow({ where: { id: w.file.id } })).durationSec === 4);
    const junk = (await uploadBytes("roto.mp4", "video/mp4", Buffer.alloc(4096, 7))) as { file: { id: string } };
    const junkRow = await prisma.productFile.findUniqueOrThrow({ where: { id: junk.file.id } });
    check("un .mp4 ilegible se guarda igual, sin datos", junkRow.durationSec === null && junkRow.videoCodec === null && junkRow.sizeBytes === 4096);

    // ── Respuesta con Range (lo que usa /api/stream) ──
    const big = Buffer.alloc(20 * MiB, 1);
    await storage().put(`private/${ana.id}/${TAG}.png`, big, { contentType: "image/png" });
    await storage().put(`private/${ana.id}/${TAG}.pdf`, Buffer.from("%PDF-1.4 prueba"), { contentType: "application/pdf" });
    const req = (range?: string) => new Request("http://x/", { headers: range ? { range } : {} });
    const png = await streamObjectResponse(req(), { key: `private/${ana.id}/${TAG}.png`, contentType: "image/png", filename: "a.png", disposition: "inline", maxChunk: 8 * MiB });
    check("200 con el tipo de la lista y nosniff", png.status === 200 && png.headers.get("content-type") === "image/png" && png.headers.get("x-content-type-options") === "nosniff");
    await png.body?.cancel();
    const pdf = await streamObjectResponse(req(), { key: `private/${ana.id}/${TAG}.pdf`, contentType: "application/pdf", filename: "guía.pdf", disposition: "attachment", maxChunk: 8 * MiB });
    check("PDF como attachment", (pdf.headers.get("content-disposition") ?? "").startsWith("attachment"));
    await pdf.body?.cancel();
    const part = await streamObjectResponse(req("bytes=0-99"), { key: `private/${ana.id}/${TAG}.png`, contentType: "image/png", disposition: "inline", maxChunk: 8 * MiB });
    check("206 con Content-Range para bytes=0-99", part.status === 206 && part.headers.get("content-range") === `bytes 0-99/${big.length}` && (await part.arrayBuffer()).byteLength === 100);
    const open = await streamObjectResponse(req("bytes=0-"), { key: `private/${ana.id}/${TAG}.png`, contentType: "image/png", disposition: "inline", maxChunk: 8 * MiB });
    check("tramo abierto de 20 MB → 206 recortado a 8 MiB", open.status === 206 && open.headers.get("content-range") === `bytes 0-${8 * MiB - 1}/${big.length}` && open.headers.get("content-length") === String(8 * MiB));
    await open.body?.cancel();
    const out = await streamObjectResponse(req(`bytes=${big.length + 10}-`), { key: `private/${ana.id}/${TAG}.png`, contentType: "image/png", disposition: "inline" });
    check("416 fuera de rango", out.status === 416);
  } finally {
    await prisma.productFile.deleteMany({ where: { productId: course.id } });
    await prisma.product.deleteMany({ where: { id: course.id } });
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nTodo bien ✓");
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
});
