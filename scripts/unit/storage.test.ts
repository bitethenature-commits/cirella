import { createS3Driver } from "../../lib/storage/s3";
import { contentDisposition, isSafeKey, parseRange, signToken, verifyToken } from "../../lib/storage/signing";
import { imageSrcSet, isMediaPath, mediaUrl } from "../../lib/media-url";
import { eq, ok, test } from "./harness";

const SECRET = "secreto-de-prueba-0123456789abcdef";
const NOW = 1_700_000_000_000;

// ── Tokens firmados (billetes de subida y URLs del driver local) ──
test("signToken/verifyToken: ida y vuelta", () => {
  const t = signToken({ op: "get", k: "private/c1/a.pdf" }, SECRET, 600, NOW);
  eq(verifyToken<{ op: string; k: string }>(t, SECRET, NOW)?.k, "private/c1/a.pdf");
});
test("verifyToken rechaza un contenido manipulado", () => {
  const t = signToken({ k: "private/c1/a.pdf" }, SECRET, 600, NOW);
  const [, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ k: "private/c2/b.pdf", exp: Math.floor(NOW / 1000) + 600 })).toString("base64url");
  eq(verifyToken(`${forged}.${sig}`, SECRET, NOW), null);
});
test("verifyToken rechaza una firma manipulada", () => {
  const [body, sig] = signToken({ k: "x" }, SECRET, 600, NOW).split(".");
  const first = sig[0] === "A" ? "B" : "A";
  eq(verifyToken(`${body}.${first}${sig.slice(1)}`, SECRET, NOW), null);
});
test("verifyToken rechaza un token caducado", () => {
  const t = signToken({ k: "x" }, SECRET, 600, NOW);
  eq(verifyToken(t, SECRET, NOW + 601_000), null);
});
test("verifyToken rechaza otra clave", () => eq(verifyToken(signToken({ k: "x" }, SECRET, 600, NOW), "otra-clave", NOW), null));
test("verifyToken rechaza basura", () => {
  eq(verifyToken("", SECRET), null);
  eq(verifyToken("abc", SECRET), null);
  eq(verifyToken("a.b.c", SECRET), null);
});

// ── Claves de objeto ──
test("isSafeKey acepta claves con forma conocida", () => {
  ok(isSafeKey("private/abc123/x1.pdf"));
  ok(isSafeKey("public/abc123/0123456789abcdef0123-w400.webp"));
  ok(isSafeKey("incoming/abc123/ffee00"));
});
for (const key of ["../x", "private/../etc/passwd", "/private/a/b", "private\\a\\b", "other/a/b", "private/a/..", "private/a/b/c", "private/A/b"])
  test(`isSafeKey rechaza ${JSON.stringify(key)}`, () => eq(isSafeKey(key), false));

// ── Range ──
test("parseRange", () => {
  eq(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  eq(parseRange("bytes=900-", 1000), { start: 900, end: 999 });
  eq(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  eq(parseRange("bytes=990-5000", 1000), { start: 990, end: 999 });
  eq(parseRange("bytes=1000-", 1000), "invalid");
  eq(parseRange("bytes=5-2", 1000), "invalid");
  eq(parseRange("bytes=-", 1000), "invalid");
  eq(parseRange("bytes=0-1,5-6", 1000), "invalid");
  eq(parseRange(null, 1000), null);
});

// ── Content-Disposition ──
test("contentDisposition codifica el nombre en UTF-8", () => {
  eq(contentDisposition("Carta natal ñ.pdf", false), "attachment; filename*=UTF-8''Carta%20natal%20%C3%B1.pdf");
  eq(contentDisposition("Curso (1).mp4", true), "inline; filename*=UTF-8''Curso%20%281%29.mp4");
  eq(contentDisposition(undefined, true), "inline");
});

// ── URLs de imágenes ──
test("imageSrcSet lista las variantes de una imagen procesada", () => {
  const url = mediaUrl("ckabc", "0123456789abcdef0123");
  eq(url, "/media/ckabc/0123456789abcdef0123.webp");
  eq(
    imageSrcSet(url),
    "/media/ckabc/0123456789abcdef0123-w400.webp 400w, /media/ckabc/0123456789abcdef0123-w800.webp 800w, /media/ckabc/0123456789abcdef0123-w1200.webp 1200w, /media/ckabc/0123456789abcdef0123.webp 1600w",
  );
});
test("imageSrcSet: sin variantes para /demo/ y subidas antiguas", () => {
  eq(imageSrcSet("/demo/ana-cover.webp"), undefined);
  eq(imageSrcSet("/media/ckabc/ff.jpg"), undefined);
  eq(imageSrcSet(null), undefined);
});
test("isMediaPath", () => {
  ok(isMediaPath("ckabc/0123456789abcdef0123.webp"));
  ok(isMediaPath("ckabc/0123456789abcdef0123-w800.webp"));
  ok(isMediaPath("ckabc/ff00aa.jpg"));
  for (const bad of ["ckabc/0123456789abcdef0123-w500.webp", "../ckabc/ff.jpg", "ckabc/../ff.jpg", "ckabc/ff.svg", "ckabc/sub/ff.webp"])
    eq(isMediaPath(bad), false, bad);
});

// ── Driver S3 (R2): las URLs se firman sin red ──
const s3 = createS3Driver({
  endpoint: "https://acc.eu.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "b",
  accessKeyId: "x",
  secretAccessKey: "x",
});
test("S3 presignGet: path-style, caducidad y nombre del archivo", async () => {
  const url = new URL(await s3.presignGet("private/c1/f.pdf", { expiresInSec: 600, filename: "á.pdf", contentType: "application/pdf" }));
  eq(url.host, "acc.eu.r2.cloudflarestorage.com");
  eq(url.pathname, "/b/private/c1/f.pdf");
  eq(url.searchParams.get("X-Amz-Expires"), "600");
  ok(url.searchParams.get("response-content-disposition")?.includes("filename*=UTF-8''%C3%A1.pdf"), "falta filename*");
  eq(url.searchParams.get("response-content-type"), "application/pdf");
});
test("S3 presignPut firma content-type y content-length", async () => {
  const { url, headers } = await s3.presignPut("private/c1/f.pdf", { contentType: "application/pdf", contentLength: 1234, expiresInSec: 900 });
  const u = new URL(url);
  const signed = u.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
  ok(signed.includes("content-length"), `X-Amz-SignedHeaders=${signed.join(";")}`);
  ok(signed.includes("content-type"), `X-Amz-SignedHeaders=${signed.join(";")}`);
  eq(u.searchParams.get("X-Amz-Expires"), "900");
  eq(u.searchParams.has("x-amz-checksum-crc32"), false, "sin suma de comprobación en la URL");
  eq(headers, { "Content-Type": "application/pdf" });
});
test("S3 presignPart: path-style, firma content-length, uploadId y partNumber", async () => {
  const { url, headers } = await s3.presignPart("private/c1/v.mov", "up-123", 7, { contentLength: 16 * 1024 * 1024, expiresInSec: 3600 });
  const u = new URL(url);
  eq(u.pathname, "/b/private/c1/v.mov");
  ok((u.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? []).includes("content-length"), "content-length firmado");
  eq(u.searchParams.get("uploadId"), "up-123");
  eq(u.searchParams.get("partNumber"), "7");
  eq(u.searchParams.get("X-Amz-Expires"), "3600");
  eq(u.searchParams.has("x-amz-checksum-crc32"), false, "sin suma de comprobación en la URL");
  eq(headers, {});
});
