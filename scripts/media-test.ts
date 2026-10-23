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
  const { abortUpload, createUpload, completeUpload, signUploadParts, UploadError } = await import("../lib/uploads");
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
    const big3 = (await createUpload(ana.id, input("clase.mov", "video/quicktime", 3 * GiB), personal)) as { multipart?: { partSize: number; partCount: number } };
    check("personal: un vídeo de 3 GB se sube por partes", big3.multipart?.partCount === 192 && big3.multipart.partSize === 16 * MiB, big3);
    check(
      "personal: un vídeo de 5 GB se rechaza con el consejo de InShot",
      /supera 4 GB.*InShot/.test((await errorOf(() => createUpload(ana.id, input("clase.mov", "video/quicktime", 5 * GiB), personal))) ?? ""),
    );

    // ── Subida por partes (web personal) ──
    const local = storage() as import("../lib/storage").LocalDriver;
    const size = 70 * MiB;
    const bytes = Buffer.alloc(size);
    for (let i = 0; i < size; i += 4096) bytes[i] = (i / 4096) % 251;
    const mp = (await createUpload(ana.id, input(`${TAG}-grande.mp4`, "video/mp4", size), personal)) as { multipart: { partSize: number; partCount: number }; ticket: string };
    check("70 MB → 5 partes de 16 MiB", mp.multipart.partSize === 16 * MiB && mp.multipart.partCount === 5, mp.multipart);
    const parts = await signUploadParts(ana.id, mp.ticket, [1, 2, 3, 4, 5]);
    const tokens = parts.map((p) => local.verify(new URL(p.url, "http://x").searchParams.get("t")));
    check("cada parte tiene su URL firmada del disco con su tamaño", tokens.every((t, i) => t?.op === "part" && t.n === i + 1 && t.max === (i < 4 ? 16 * MiB : 6 * MiB)), tokens);
    check("las partes 0 y 6 no existen", !!(await errorOf(() => signUploadParts(ana.id, mp.ticket, [0]))) && !!(await errorOf(() => signUploadParts(ana.id, mp.ticket, [6]))));
    check("como mucho 10 partes por petición", !!(await errorOf(() => signUploadParts(ana.id, mp.ticket, Array.from({ length: 11 }, (_, i) => i + 1)))));
    check("sin todas las partes no se completa", /archivo completo/.test((await errorOf(() => completeUpload(ana.id, mp.ticket))) ?? ""));
    for (const [i, t] of tokens.entries()) {
      if (t?.op !== "part") continue;
      const chunk = bytes.subarray(i * 16 * MiB, Math.min(size, (i + 1) * 16 * MiB));
      await local.receivePart(t.uid, t.n, new Blob([chunk]).stream(), t.max);
    }
    const mpDone = (await completeUpload(ana.id, mp.ticket)) as { file: { id: string; sizeBytes: number } };
    check("completa: un archivo de 73.400.320 bytes (number, JSON sin problemas)", mpDone.file.sizeBytes === 73400320 && JSON.stringify(mpDone).includes("73400320"), mpDone);
    const row = await prisma.productFile.findUniqueOrThrow({ where: { id: mpDone.file.id } });
    const { createHash } = await import("node:crypto");
    const stored = await storage().getBuffer(`private/${row.storageKey}`, 100 * MiB);
    check("las partes se juntan en orden", createHash("sha1").update(stored).digest("hex") === createHash("sha1").update(bytes).digest("hex"));
    const again = (await completeUpload(ana.id, mp.ticket)) as { file: { id: string } };
    check("repetir el paso 2 no duplica el archivo", again.file.id === mpDone.file.id && (await prisma.productFile.count({ where: { productId: course.id, name: `${TAG}-grande.mp4` } })) === 1);
    const { existsSync, readdirSync } = await import("node:fs");
    const mdir = path.join(dir, ".multipart");
    const uid = tokens[0]?.op === "part" ? tokens[0].uid : "";
    check("no quedan sus partes en .multipart", !!uid && !existsSync(path.join(mdir, uid)) && !readdirSync(mdir).includes(uid));
    const cancel = (await createUpload(ana.id, input(`${TAG}-cancelada.mp4`, "video/mp4", size), personal)) as { ticket: string };
    const [first] = await signUploadParts(ana.id, cancel.ticket, [1]);
    const ft = local.verify(new URL(first.url, "http://x").searchParams.get("t"));
    if (ft?.op === "part") await local.receivePart(ft.uid, ft.n, new Blob([bytes.subarray(0, 16 * MiB)]).stream(), ft.max);
    check("…la parte recibida está en disco", ft?.op === "part" && existsSync(path.join(mdir, ft.uid, "1")));
    await abortUpload(ana.id, cancel.ticket);
    check("«Cancelar» borra las partes", ft?.op === "part" && !existsSync(path.join(mdir, ft.uid)));
    check("y no se crea ningún archivo", (await prisma.productFile.count({ where: { productId: course.id, name: `${TAG}-cancelada.mp4` } })) === 0);
    const plat = (await createUpload(ana.id, input("grande.mp4", "video/mp4", size), platform)) as { multipart?: unknown };
    check("en la plataforma, nunca por partes", !plat.multipart);

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
