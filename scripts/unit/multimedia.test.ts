/**
 * Multimedia: tipos de archivo, límites por modo, partes de la subida, lectura de vídeos y audios
 * (lib/media-probe.ts), enlaces de YouTube y Vimeo, cómo se entrega cada tipo, el aviso de vídeo
 * pesado y cuándo renovar una URL firmada. Puro (sin BD ni servidor).
 */
import {
  deliveryFor,
  inlineContentType,
  isHeic,
  MULTIPART_THRESHOLD,
  planParts,
  PRIVATE_ACCEPT,
  PRIVATE_TYPES,
  privateFileType,
  RICH_IMAGE_ACCEPT,
  uploadPolicy,
  videoWeight,
} from "../../lib/file-types";
import { parseMediaInfo } from "../../lib/media-probe";
import { needsMediaRefresh } from "../../lib/media-url";
import { bufferReader, m4a, mp4, wav } from "../fixtures/iso-media";
import { eq, ok, test } from "./harness";

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

// ── Tipos ──
test("privateFileType: MOV, M4V, M4A, JPG, WebP y GIF", () => {
  eq(privateFileType("video/quicktime", "clase.mov"), "video/quicktime");
  eq(PRIVATE_TYPES["video/quicktime"], { ext: "mov", kind: "VIDEO" });
  eq(privateFileType("", "clase.MOV"), "video/quicktime");
  eq(privateFileType("application/octet-stream", "clase.m4v"), "video/mp4");
  eq(privateFileType("video/x-m4v", "clase.m4v"), "video/mp4");
  eq(privateFileType("audio/m4a", "voz.m4a"), "audio/mp4");
  eq(privateFileType("image/jpg", "ficha.jpg"), "image/jpeg");
  eq(PRIVATE_TYPES[privateFileType("image/webp", "ficha.webp")!].kind, "IMAGE");
  eq(PRIVATE_TYPES[privateFileType("image/gif", "a.gif")!].kind, "IMAGE");
});

test("HEIC: no se admite y se reconoce por tipo o por nombre", () => {
  eq(privateFileType("image/heic", "foto.heic"), null);
  eq(privateFileType("", "foto.heic"), null);
  ok(isHeic("image/heic", "x"));
  ok(isHeic("image/heif", "x"));
  ok(isHeic("", "IMG_0001.HEIC"));
  ok(!isHeic("image/jpeg", "foto.jpg"));
});

test("accept: PRIVATE_ACCEPT empieza por .pdf e incluye MOV y M4A; RICH_IMAGE_ACCEPT empieza por .jpg", () => {
  ok(PRIVATE_ACCEPT.startsWith(".pdf"));
  for (const x of [".mov", "video/quicktime", ".m4a", ".webp", ".gif"]) ok(PRIVATE_ACCEPT.split(",").includes(x), x);
  ok(RICH_IMAGE_ACCEPT.startsWith(".jpg"));
  ok(!RICH_IMAGE_ACCEPT.startsWith("image/"));
});

// ── Límites por modo ──
test("uploadPolicy: la plataforma no cambia; la web personal admite vídeos de 4 GB por partes", () => {
  const platform = uploadPolicy(false);
  eq([platform.videoMax, platform.fileMax, platform.multipart, platform.label], [GiB, GiB, false, "Hasta 1 GB por archivo."]);
  const personal = uploadPolicy(true);
  eq([personal.videoMax, personal.fileMax, personal.multipart], [4 * GiB, GiB, true]);
  eq(personal.imageMax, 25 * MiB);
});

test("planParts: 64 MiB + 1 byte → 5 partes (la última de 1 byte); 4 GiB → 256", () => {
  const a = planParts(MULTIPART_THRESHOLD + 1);
  eq([a.partSize, a.partCount, a.sizeOf(1), a.sizeOf(4), a.sizeOf(5)], [16 * MiB, 5, 16 * MiB, 16 * MiB, 1]);
  const b = planParts(4 * GiB);
  eq([b.partCount, b.sizeOf(256)], [256, 16 * MiB]);
  const c = planParts(70 * MiB);
  eq([c.partCount, c.sizeOf(5)], [5, 6 * MiB]);
});

test("inlineContentType: un MOV se reproduce como MP4", () => {
  eq(inlineContentType("video/quicktime"), "video/mp4");
  eq(inlineContentType("audio/mpeg"), "audio/mpeg");
  eq(inlineContentType(null), null);
});

// ── Lectura de vídeos y audios ──
const probe = (b: Buffer, mime: string) => parseMediaInfo(bufferReader(b), b.length, mime);

test("probe: avc1 1920×1080 de 42 s", async () => {
  eq(await probe(mp4({ codec: "avc1", width: 1920, height: 1080, durationSec: 42 }), "video/mp4"), {
    hasAudio: true,
    durationSec: 42,
    video: { codec: "H264", width: 1920, height: 1080 },
  });
});

test("probe: hvc1 girado 90° (vertical del iPhone) → HEVC 1080×1920", async () => {
  const info = await probe(mp4({ codec: "hvc1", width: 1920, height: 1080, rotation: 90, durationSec: 42, brand: "qt  " }), "video/quicktime");
  eq(info?.video, { codec: "HEVC", width: 1080, height: 1920 });
  eq(info?.durationSec, 42);
});

test("probe: dvh1 es HEVC; ap4h es OTHER", async () => {
  eq((await probe(mp4({ codec: "dvh1" }), "video/mp4"))?.video?.codec, "HEVC");
  eq((await probe(mp4({ codec: "ap4h" }), "video/quicktime"))?.video?.codec, "OTHER");
});

test("probe: el moov tras un mdat de 64 bits también se encuentra", async () => {
  eq((await probe(mp4({ moovAtEnd: true, largeMdat: true, durationSec: 7 }), "video/mp4"))?.durationSec, 7);
});

test("probe: m4a con duración y sin vídeo; WAV por su byteRate", async () => {
  const a = await probe(m4a({ durationSec: 95 }), "audio/mp4");
  eq([a?.durationSec, a?.video, a?.hasAudio], [95, undefined, true]);
  eq((await probe(wav({ durationSec: 5 }), "audio/wav"))?.durationSec, 5);
});

test("probe: truncado, vacío o basura → null, nunca lanza", async () => {
  eq(await probe(Buffer.alloc(0), "video/mp4"), null);
  eq(await probe(Buffer.from("esto no es un vídeo, es un texto cualquiera"), "video/mp4"), null);
  eq(await probe(mp4({}).subarray(0, 100), "video/mp4"), null);
  eq(await probe(wav({}).subarray(0, 20), "audio/wav"), null);
  eq(await parseMediaInfo(async () => {
    throw new Error("red");
  }, 1000, "video/mp4"), null);
});

// ── Entrega y avisos ──
test("deliveryFor: vídeo firmado; audio por /api/stream solo en la web personal; PDF e imagen por stream", () => {
  eq(deliveryFor("VIDEO", true), "signed");
  eq(deliveryFor("VIDEO", false), "signed");
  eq(deliveryFor("AUDIO", true), "stream");
  eq(deliveryFor("AUDIO", false), "signed");
  eq(deliveryFor("PDF", false), "stream");
  eq(deliveryFor("IMAGE", true), "stream");
  eq(deliveryFor("OTHER", true), "download");
});

test("videoWeight: 1 GB en 23 min va bien; 2,3 GB en 10 min pesa demasiado; sin duración, bien", () => {
  eq(videoWeight(1e9, 23 * 60), "ok");
  eq(videoWeight(2.3e9, 10 * 60), "heavy");
  eq(videoWeight(2.3e9, null), "ok");
});

test("needsMediaRefresh: recién firmada no; a 14 min de caducar sí; con el reloj atrasado no", () => {
  const ttl = 10800;
  const t0 = 1_000_000_000;
  eq(needsMediaRefresh(t0, ttl, t0), false);
  eq(needsMediaRefresh(t0, ttl, t0 + (ttl - 14 * 60) * 1000), true);
  eq(needsMediaRefresh(t0, ttl, t0 - 5000), false);
});
