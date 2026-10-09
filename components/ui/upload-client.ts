"use client";

/**
 * Subida directa al almacenamiento desde el navegador (ver lib/uploads.ts):
 *   1. /api/upload/sign      → URL firmada + billete
 *   2. PUT del archivo       → directamente al almacenamiento, con progreso
 *   3. /api/upload/complete  → el servidor lo comprueba y lo guarda
 */
export type UploadedFile = { id: string; name: string; kind: string; sizeBytes: number | null };

const NETWORK_ERROR = "No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) throw new Error(NETWORK_ERROR);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? NETWORK_ERROR);
  return json as T;
}

function put(url: string, file: File, headers: Record<string, string>, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(NETWORK_ERROR)));
    xhr.onerror = () => reject(new Error(NETWORK_ERROR));
    xhr.onabort = () => reject(new Error(NETWORK_ERROR));
    xhr.send(file);
  });
}

export async function uploadFile(
  file: File,
  o: { purpose: "image" | "file"; productId?: string; onProgress?: (pct: number) => void },
): Promise<{ url?: string; file?: UploadedFile }> {
  const signed = await postJson<{ uploadUrl: string; headers: Record<string, string>; ticket: string }>("/api/upload/sign", {
    purpose: o.purpose,
    productId: o.productId,
    name: file.name || "archivo",
    contentType: file.type,
    size: file.size,
  });
  await put(signed.uploadUrl, file, signed.headers, o.onProgress);
  o.onProgress?.(100);
  return postJson("/api/upload/complete", { ticket: signed.ticket });
}
