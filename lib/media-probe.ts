/**
 * Lee del propio archivo la duración, el códec y el tamaño de un vídeo o audio (MP4, MOV, M4A, M4V
 * y WAV) sin herramientas externas: solo unas pocas lecturas por tramos (cabeceras de las cajas
 * ISO-BMFF y la caja «moov», o la cabecera RIFF del WAV). Nunca descarga el archivo entero.
 *
 * Límites para que un archivo malicioso no cueste nada: moov ≤ 32 MiB, ≤ 64 cajas de primer nivel
 * y ≤ 8 niveles de profundidad. Cualquier cosa rara → null (nunca lanza al flujo de subida).
 */
export type MediaInfo = { durationSec?: number; video?: { codec: "H264" | "HEVC" | "OTHER"; width: number; height: number }; hasAudio: boolean };

type Read = (offset: number, length: number) => Promise<Buffer>;

const MAX_MOOV = 32 * 1024 * 1024;
const MAX_TOP_BOXES = 64;
const MAX_DEPTH = 8;
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

export async function parseMediaInfo(read: Read, size: number, mime: string): Promise<MediaInfo | null> {
  try {
    if (!Number.isFinite(size) || size < 12) return null;
    const head = await read(0, Math.min(16, size));
    if (head.length >= 12 && head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WAVE") return await parseWav(read, size);
    if (/^audio\/(wav|x-wav|wave)/.test(mime)) return null;
    return await parseIsoBmff(read, size);
  } catch {
    return null;
  }
}

async function parseWav(read: Read, size: number): Promise<MediaInfo | null> {
  let offset = 12;
  let byteRate = 0;
  for (let i = 0; i < 64 && offset + 8 <= size; i++) {
    const h = await read(offset, 8);
    if (h.length < 8) return null;
    const id = h.toString("latin1", 0, 4);
    const len = h.readUInt32LE(4);
    if (id === "fmt ") {
      const fmt = await read(offset + 8, Math.min(16, len));
      if (fmt.length < 12) return null;
      byteRate = fmt.readUInt32LE(8);
    } else if (id === "data") {
      if (!byteRate) return null;
      // Algunos programas dejan el tamaño a 0 o 0xFFFFFFFF al grabar en directo: el resto del archivo.
      const available = size - (offset + 8);
      const dataLen = len === 0 || len === 0xffffffff || len > available ? available : len;
      return { durationSec: Math.round(dataLen / byteRate), hasAudio: true };
    }
    offset += 8 + len + (len % 2);
  }
  return null;
}

type Track = { handler?: string; codec?: string; tkW?: number; tkH?: number; rotated?: boolean; entryW?: number; entryH?: number };

async function parseIsoBmff(read: Read, size: number): Promise<MediaInfo | null> {
  let offset = 0;
  for (let i = 0; i < MAX_TOP_BOXES && offset + 8 <= size; i++) {
    const h = await read(offset, Math.min(16, size - offset));
    if (h.length < 8) return null;
    let boxSize = h.readUInt32BE(0);
    const type = h.toString("latin1", 4, 8);
    let header = 8;
    if (boxSize === 1) {
      if (h.length < 16) return null;
      const big = h.readBigUInt64BE(8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      boxSize = Number(big);
      header = 16;
    } else if (boxSize === 0) boxSize = size - offset;
    if (boxSize < header) return null;
    if (i === 0 && type !== "ftyp" && type !== "moov" && type !== "wide" && type !== "mdat" && type !== "free") return null;
    if (type === "moov") {
      const len = boxSize - header;
      if (len > MAX_MOOV || offset + boxSize > size) return null;
      return parseMoov(await read(offset + header, len));
    }
    offset += boxSize;
  }
  return null;
}

function parseMoov(moov: Buffer): MediaInfo | null {
  let durationSec: number | undefined;
  const tracks: Track[] = [];
  let current: Track | null = null;

  const walk = (buf: Buffer, start: number, end: number, depth: number) => {
    if (depth > MAX_DEPTH) return;
    let off = start;
    while (off + 8 <= end) {
      let size = buf.readUInt32BE(off);
      const type = buf.toString("latin1", off + 4, off + 8);
      let header = 8;
      if (size === 1) {
        if (off + 16 > end) return;
        size = Number(buf.readBigUInt64BE(off + 8));
        header = 16;
      } else if (size === 0) size = end - off;
      if (size < header || off + size > end) return;
      const body = off + header;
      const bodyEnd = off + size;
      if (type === "trak") {
        current = {};
        tracks.push(current);
        walk(buf, body, bodyEnd, depth + 1);
        current = null;
      } else if (CONTAINERS.has(type)) walk(buf, body, bodyEnd, depth + 1);
      else if (type === "mvhd") {
        const v = buf[body];
        const timescale = v === 1 ? buf.readUInt32BE(body + 20) : buf.readUInt32BE(body + 12);
        const duration = v === 1 ? Number(buf.readBigUInt64BE(body + 24)) : buf.readUInt32BE(body + 16);
        if (timescale > 0 && duration > 0 && duration !== 0xffffffff) durationSec = Math.round(duration / timescale);
      } else if (type === "tkhd" && current) {
        const v = buf[body];
        // Tras la cabecera: reservado(8), capa(2), grupo(2), volumen(2), reservado(2), matriz(36), ancho, alto.
        const m = body + 4 + (v === 1 ? 32 : 20) + 16;
        if (m + 44 <= bodyEnd) {
          const a = buf.readInt32BE(m);
          const b = buf.readInt32BE(m + 4);
          const c = buf.readInt32BE(m + 12);
          const d = buf.readInt32BE(m + 16);
          current.rotated = a === 0 && d === 0 && b !== 0 && c !== 0;
          current.tkW = Math.round(buf.readUInt32BE(m + 36) / 65536);
          current.tkH = Math.round(buf.readUInt32BE(m + 40) / 65536);
        }
      } else if (type === "hdlr" && current) {
        // En un .mov (QuickTime) hay otro hdlr dentro de minf, «dhlr» (alis/url): no dice el tipo de pista.
        if (buf.toString("latin1", body + 4, body + 8) !== "dhlr") current.handler = buf.toString("latin1", body + 8, body + 12);
      } else if (type === "stsd" && current) {
        const entry = body + 8;
        if (entry + 8 <= bodyEnd) {
          current.codec = buf.toString("latin1", entry + 4, entry + 8);
          // Entrada visual: 6 reservados + 2 + 16 → ancho y alto (16 bits).
          if (entry + 36 <= bodyEnd) {
            current.entryW = buf.readUInt16BE(entry + 32);
            current.entryH = buf.readUInt16BE(entry + 34);
          }
        }
      }
      off = bodyEnd;
    }
  };

  walk(moov, 0, moov.length, 0);
  const video = tracks.find((t) => t.handler === "vide");
  const hasAudio = tracks.some((t) => t.handler === "soun");
  const info: MediaInfo = { hasAudio };
  if (durationSec !== undefined) info.durationSec = durationSec;
  if (video) {
    let w = video.tkW || video.entryW || 0;
    let h = video.tkH || video.entryH || 0;
    // tkhd ya trae el tamaño de pantalla; si viene girado (vertical del iPhone), se intercambian.
    if (video.rotated) [w, h] = [h, w];
    info.video = { codec: codecOf(video.codec), width: w, height: h };
  }
  if (!video && !hasAudio && durationSec === undefined) return null;
  return info;
}

function codecOf(fourcc: string | undefined): "H264" | "HEVC" | "OTHER" {
  if (fourcc === "avc1" || fourcc === "avc3") return "H264";
  if (fourcc === "hvc1" || fourcc === "hev1" || fourcc === "dvh1" || fourcc === "dvhe") return "HEVC";
  return "OTHER";
}

/** Lee los datos de un archivo ya guardado (por tramos). Nunca lanza: null si no se pudo. */
export async function probeStoredFile(key: string, size: number, mime: string): Promise<MediaInfo | null> {
  try {
    const { storage } = await import("./storage");
    const s = storage();
    const read: Read = async (offset, length) => {
      if (length <= 0) return Buffer.alloc(0);
      const r = await s.getStream(key, { start: offset, end: Math.min(size, offset + length) - 1 });
      if (!r) throw new Error("no existe");
      const chunks: Buffer[] = [];
      let got = 0;
      const reader = r.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(Buffer.from(value));
          got += value.length;
          if (got >= length) break;
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return Buffer.concat(chunks).subarray(0, length);
    };
    return await parseMediaInfo(read, size, mime);
  } catch {
    return null;
  }
}
