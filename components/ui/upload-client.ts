"use client";

/**
 * Subida directa al almacenamiento desde el navegador (ver lib/uploads.ts):
 *   1. /api/upload/sign      → URL firmada + billete
 *   2. PUT del archivo       → directamente al almacenamiento, con progreso
 *   3. /api/upload/complete  → el servidor lo comprueba y lo guarda
 */
export type UploadedFile = { id: string; name: string; kind: string; sizeBytes: number | null; durationSec?: number | null; videoCodec?: string | null };

export type UploadProgress = (pct: number, loaded: number, total: number) => void;

export const UPLOAD_CANCELLED = "Subida cancelada";

const NETWORK_ERROR = "No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.";

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }).catch(() => null);
  if (signal?.aborted) throw new Error(UPLOAD_CANCELLED);
  if (!res) throw new Error(NETWORK_ERROR);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? NETWORK_ERROR);
  return json as T;
}

/** PUT con progreso (bytes enviados) y cancelable. */
function put(url: string, body: Blob, headers: Record<string, string>, onLoaded?: (loaded: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error(UPLOAD_CANCELLED));
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (onLoaded) onLoaded(e.lengthComputable ? e.loaded : 0);
    };
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const done = (fn: () => void) => {
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    xhr.onload = () => done(() => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(NETWORK_ERROR))));
    xhr.onerror = () => done(() => reject(new Error(NETWORK_ERROR)));
    xhr.onabort = () => done(() => reject(new Error(signal?.aborted ? UPLOAD_CANCELLED : NETWORK_ERROR)));
    xhr.send(body);
  });
}

export async function uploadFile(
  file: File,
  o: { purpose: "image" | "file"; productId?: string; onProgress?: UploadProgress; signal?: AbortSignal },
): Promise<{ url?: string; file?: UploadedFile }> {
  const total = file.size;
  const report = (loaded: number) => o.onProgress?.(total ? Math.min(100, Math.round((loaded / total) * 100)) : 100, loaded, total);
  const signed = await postJson<{ uploadUrl: string; headers: Record<string, string>; ticket: string }>(
    "/api/upload/sign",
    { purpose: o.purpose, productId: o.productId, name: file.name || "archivo", contentType: file.type, size: file.size },
    o.signal,
  );
  await put(signed.uploadUrl, file, signed.headers, report, o.signal);
  report(total);
  return postJson("/api/upload/complete", { ticket: signed.ticket }, o.signal);
}
