"use client";

/**
 * Subida directa al almacenamiento desde el navegador (ver lib/uploads.ts):
 *   1. /api/upload/sign      → URL firmada + billete (o, en la web personal y si es grande, por partes)
 *   2. PUT del archivo       → directamente al almacenamiento, con progreso
 *      (por partes: /api/upload/parts da las URLs y se suben 3 partes a la vez, con reintentos)
 *   3. /api/upload/complete  → el servidor lo comprueba y lo guarda
 * «Cancelar» (signal) avisa a /api/upload/abort para borrar lo que haya llegado.
 */
export type UploadedFile = { id: string; name: string; kind: string; sizeBytes: number | null; durationSec?: number | null; videoCodec?: string | null };

/** Vídeo subido a un bloque de la página (lib/page-blocks.ts → PageVideo). */
export type UploadedPageVideo = { src: string; width: number | null; height: number | null; durationSec: number | null; codec: "H264" | "HEVC" | "OTHER" | null; sizeBytes: number | null };

/** Archivo privado del Portal de Noticias: un billete firmado que el formulario envía al guardar. */
export type UploadedPortalMedia = { token: string; kind: "VIDEO" | "AUDIO" | "IMAGE"; name: string; sizeBytes: number };

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

type SignAnswer = { uploadUrl: string; headers: Record<string, string>; ticket: string } | { multipart: { partSize: number; partCount: number }; ticket: string };

export async function uploadFile(
  file: File,
  o: { purpose: "image" | "file" | "video" | "portal"; graphic?: boolean; email?: boolean; audio?: boolean; productId?: string; orderId?: string; onProgress?: UploadProgress; signal?: AbortSignal },
): Promise<{ url?: string; width?: number; height?: number; file?: UploadedFile; video?: UploadedPageVideo; portal?: UploadedPortalMedia }> {
  const total = file.size;
  const report = (loaded: number) => o.onProgress?.(total ? Math.min(100, Math.round((loaded / total) * 100)) : 100, loaded, total);
  const signed = await postJson<SignAnswer>(
    "/api/upload/sign",
    { purpose: o.purpose, graphic: o.graphic || undefined, email: o.email || undefined, audio: o.audio || undefined, productId: o.productId, orderId: o.orderId, name: file.name || "archivo", contentType: file.type, size: file.size },
    o.signal,
  );
  try {
    if ("multipart" in signed) await uploadParts(file, signed.ticket, signed.multipart, report, o.signal);
    else await put(signed.uploadUrl, file, signed.headers, report, o.signal);
  } catch (e) {
    // Cancelada o sin remedio: se borra lo que haya llegado (best effort).
    void fetch("/api/upload/abort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: signed.ticket }), keepalive: true }).catch(() => {});
    throw e;
  }
  report(total);
  return postJson("/api/upload/complete", { ticket: signed.ticket }, o.signal);
}

const PARALLEL = 3;
const RETRY_DELAYS_MS = [1000, 4000, 10000];
const BATCH = 10;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error(UPLOAD_CANCELLED));
      },
      { once: true },
    );
  });

/** Mantiene la pantalla encendida mientras sube (si el navegador lo permite). */
function keepAwake() {
  type Sentinel = { release(): Promise<void> };
  const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<Sentinel> } };
  let lock: Sentinel | null = null;
  let active = true;
  const acquire = () => {
    if (!active || !nav.wakeLock || document.visibilityState !== "visible") return;
    nav.wakeLock.request("screen").then((l) => (lock = l), () => {});
  };
  const onVisible = () => acquire();
  document.addEventListener("visibilitychange", onVisible);
  acquire();
  return () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release().catch(() => {});
  };
}

/**
 * Subida por partes (web personal): pide las URLs de 10 en 10 por adelantado, sube 3 partes a la
 * vez con File.slice, reintenta cada parte hasta 4 veces (1, 4 y 10 s) y suma el progreso.
 */
async function uploadParts(
  file: File,
  ticket: string,
  plan: { partSize: number; partCount: number },
  report: (loaded: number) => void,
  signal?: AbortSignal,
) {
  const release = keepAwake();
  try {
    const urls = new Map<number, { url: string; headers: Record<string, string> }>();
    const pending = new Map<number, Promise<void>>();
    const batchOf = (n: number) => Math.floor((n - 1) / BATCH);
    const fetchBatch = (b: number) => {
      const first = b * BATCH + 1;
      if (first > plan.partCount) return Promise.resolve();
      if (pending.has(b)) return pending.get(b)!;
      const numbers = Array.from({ length: Math.min(BATCH, plan.partCount - first + 1) }, (_, i) => first + i);
      const p = postJson<{ parts: { n: number; url: string; headers: Record<string, string> }[] }>("/api/upload/parts", { ticket, partNumbers: numbers }, signal).then((r) => {
        for (const part of r.parts) urls.set(part.n, { url: part.url, headers: part.headers });
      });
      pending.set(b, p);
      p.catch(() => pending.delete(b));
      return p;
    };
    const urlFor = async (n: number, fresh = false) => {
      if (fresh) {
        urls.delete(n);
        pending.delete(batchOf(n));
      }
      if (!urls.has(n)) await fetchBatch(batchOf(n));
      // La siguiente tanda, por adelantado.
      void fetchBatch(batchOf(n) + 1).catch(() => {});
      return urls.get(n)!;
    };
    const loaded = new Map<number, number>();
    const sum = () => {
      let t = 0;
      for (const v of loaded.values()) t += v;
      report(t);
    };
    let next = 1;
    const worker = async () => {
      for (;;) {
        const n = next++;
        if (n > plan.partCount) return;
        const start = (n - 1) * plan.partSize;
        const blob = file.slice(start, Math.min(file.size, start + plan.partSize));
        for (let attempt = 0; ; attempt++) {
          if (signal?.aborted) throw new Error(UPLOAD_CANCELLED);
          try {
            const target = await urlFor(n, attempt > 0);
            await put(target.url, blob, target.headers, (l) => {
              loaded.set(n, l);
              sum();
            }, signal);
            loaded.set(n, blob.size);
            sum();
            break;
          } catch (e) {
            if (signal?.aborted || (e instanceof Error && e.message === UPLOAD_CANCELLED)) throw new Error(UPLOAD_CANCELLED);
            if (attempt >= RETRY_DELAYS_MS.length) throw e;
            loaded.set(n, 0);
            await sleep(RETRY_DELAYS_MS[attempt], signal);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, plan.partCount) }, worker));
  } finally {
    release();
  }
}
