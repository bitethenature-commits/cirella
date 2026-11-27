/**
 * Driver S3 (Cloudflare R2 en producción, jurisdicción UE). Un único bucket privado con los
 * prefijos public/, private/ e incoming/. Las URLs firmadas se calculan en local (sin llamadas
 * a la red), así que se prueban sin conexión (scripts/unit/storage.test.ts).
 */
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageDriver } from "./index";
import { contentDisposition } from "./signing";

export type S3Config = { endpoint: string; region?: string; bucket: string; accessKeyId: string; secretAccessKey: string };

function isNotFound(e: unknown) {
  if (e instanceof S3ServiceException && e.$metadata?.httpStatusCode === 404) return true;
  const name = (e as { name?: string } | null)?.name;
  return name === "NotFound" || name === "NoSuchKey";
}

export function createS3Driver(c: S3Config): StorageDriver {
  const client = new S3Client({
    region: c.region || "auto",
    endpoint: c.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    // Sin sumas de comprobación automáticas: R2 no las admite todas y, en una URL firmada para el
    // navegador, la suma del cuerpo no se conoce al firmar (la subida fallaría).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = c.bucket;

  return {
    name: "s3",

    async presignPut(key, o) {
      const cmd = new PutObjectCommand({ Bucket, Key: key, ContentType: o.contentType, ContentLength: o.contentLength });
      // Content-Length firmado: el almacenamiento rechaza un archivo de otro tamaño.
      const url = await getSignedUrl(client, cmd, {
        expiresIn: o.expiresInSec,
        signableHeaders: new Set(["content-type", "content-length"]),
      });
      return { url, headers: { "Content-Type": o.contentType } };
    },

    async presignGet(key, o) {
      const cmd = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(o.filename, !!o.inline),
        ResponseContentType: o.contentType ?? undefined,
        ResponseCacheControl: "private, max-age=600",
      });
      return getSignedUrl(client, cmd, { expiresIn: o.expiresInSec });
    },

    async head(key) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: r.ContentLength ?? 0, contentType: r.ContentType };
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },

    async getBuffer(key, maxBytes) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!r.Body) throw new Error("El archivo no existe");
      if ((r.ContentLength ?? 0) > maxBytes) {
        await r.Body.transformToWebStream().cancel();
        throw new Error("El archivo es demasiado grande");
      }
      return Buffer.from(await r.Body.transformToByteArray());
    },

    async getStream(key, range) {
      try {
        const r = await client.send(new GetObjectCommand({ Bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
        if (!r.Body) return null;
        const total = r.ContentRange?.match(/\/(\d+)$/)?.[1];
        return {
          body: r.Body.transformToWebStream() as ReadableStream<Uint8Array>,
          size: total ? Number(total) : (r.ContentLength ?? 0),
          contentType: r.ContentType,
        };
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },

    async put(key, body, o) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: o.contentType, CacheControl: o.cacheControl }));
    },

    async createMultipart(key, o) {
      const r = await client.send(new CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: o.contentType }));
      if (!r.UploadId) throw new Error("El almacenamiento no devolvió el id de la subida por partes");
      return { uploadId: r.UploadId };
    },

    async presignPart(key, uploadId, n, o) {
      const cmd = new UploadPartCommand({ Bucket, Key: key, UploadId: uploadId, PartNumber: n, ContentLength: o.contentLength });
      // Tamaño exacto firmado: una parte de otro tamaño se rechaza. El navegador no necesita leer
      // el ETag (se piden con ListParts al completar), así que la regla CORS de R2 no cambia.
      const url = await getSignedUrl(client, cmd, { expiresIn: o.expiresInSec, signableHeaders: new Set(["content-length"]) });
      return { url, headers: {} };
    },

    async completeMultipart(key, uploadId) {
      const parts: { ETag: string; PartNumber: number }[] = [];
      let marker: string | undefined;
      for (let page = 0; page < 20; page++) {
        const r = await client.send(new ListPartsCommand({ Bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
        for (const p of r.Parts ?? []) if (p.ETag && p.PartNumber) parts.push({ ETag: p.ETag, PartNumber: p.PartNumber });
        if (!r.IsTruncated) break;
        marker = r.NextPartNumberMarker;
      }
      parts.sort((a, b) => a.PartNumber - b.PartNumber);
      if (!parts.length || parts.some((p, i) => p.PartNumber !== i + 1)) throw new Error("Faltan partes de la subida");
      await client.send(new CompleteMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
    },

    async abortMultipart(key, uploadId) {
      await client.send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }));
    },

    async delete(keys) {
      // Uno a uno (de 10 en 10): DeleteObjects exige una suma de comprobación del cuerpo y los
      // borrados aquí son de pocos archivos (los de un producto). Borrar lo que no existe no falla.
      for (let i = 0; i < keys.length; i += 10)
        await Promise.all(keys.slice(i, i + 10).map((Key) => client.send(new DeleteObjectCommand({ Bucket, Key }))));
    },
  };
}
