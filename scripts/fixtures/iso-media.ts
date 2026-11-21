/**
 * Vídeos y audios sintéticos (solo cabeceras, sin imagen ni sonido de verdad) para probar
 * lib/media-probe.ts: los usan las pruebas unitarias, las de BD y las e2e.
 *   mp4({ codec: "hvc1", width: 1920, height: 1080, rotation: 90, durationSec: 42 }) → vertical del iPhone
 */
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};
const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
const zeros = (n: number) => Buffer.alloc(n);
const ascii = (s: string) => Buffer.from(s, "latin1");

function box(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload);
  return Buffer.concat([u32(8 + body.length), ascii(type), body]);
}

const IDENTITY = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];
const ROT90 = [0, 0x10000, 0, -0x10000, 0, 0, 0, 0, 0x40000000];
const ROT270 = [0, -0x10000, 0, 0x10000, 0, 0, 0, 0, 0x40000000];

function matrix(rotation: number) {
  const m = rotation === 90 ? ROT90 : rotation === 270 ? ROT270 : IDENTITY;
  return Buffer.concat(m.map((v) => u32(v)));
}

function mvhd(durationSec: number) {
  const timescale = 1000;
  return box("mvhd", zeros(4), zeros(8), u32(timescale), u32(durationSec * timescale), u32(0x10000), u16(0x100), zeros(10), matrix(0), zeros(24), u32(3));
}

function tkhd(id: number, durationSec: number, o: { width?: number; height?: number; rotation?: number }) {
  return box(
    "tkhd",
    Buffer.from([0, 0, 0, 3]),
    zeros(8),
    u32(id),
    zeros(4),
    u32(durationSec * 1000),
    zeros(8),
    zeros(4),
    u16(o.width ? 0 : 0x100),
    zeros(2),
    matrix(o.rotation ?? 0),
    u32((o.width ?? 0) * 65536),
    u32((o.height ?? 0) * 65536),
  );
}

/** QuickTime (.mov del iPhone o del Mac): «mhlr» en mdia y, además, un «dhlr alis» dentro de minf. */
function hdlr(handler: "vide" | "soun" | "alis", component?: "mhlr" | "dhlr") {
  return box("hdlr", zeros(4), component ? ascii(component) : zeros(4), ascii(handler), zeros(12), Buffer.from([0]));
}

function visualEntry(codec: string, width: number, height: number) {
  return box(codec, zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x480000), u32(0x480000), zeros(4), u16(1), zeros(32), u16(0x18), u16(0xffff));
}

function audioEntry() {
  return box("mp4a", zeros(6), u16(1), zeros(8), u16(2), u16(16), zeros(4), u32(44100 * 65536));
}

function trak(id: number, durationSec: number, kind: "vide" | "soun", o: { codec?: string; width?: number; height?: number; rotation?: number; qt?: boolean } = {}) {
  const entry = kind === "vide" ? visualEntry(o.codec ?? "avc1", o.width ?? 0, o.height ?? 0) : audioEntry();
  const stsd = box("stsd", zeros(4), u32(1), entry);
  const mdhd = box("mdhd", zeros(4), zeros(8), u32(1000), u32(durationSec * 1000), zeros(4));
  const minf = o.qt ? box("minf", hdlr("alis", "dhlr"), box("stbl", stsd)) : box("minf", box("stbl", stsd));
  return box("trak", tkhd(id, durationSec, kind === "vide" ? o : {}), box("mdia", mdhd, hdlr(kind, o.qt ? "mhlr" : undefined), minf));
}

export function mp4(o: {
  codec?: string;
  width?: number;
  height?: number;
  rotation?: number;
  durationSec?: number;
  moovAtEnd?: boolean;
  largeMdat?: boolean;
  audio?: boolean;
  brand?: string;
  /** Bytes de «imagen» (para hacer el archivo más grande). */
  mdatBytes?: number;
}): Buffer {
  const d = o.durationSec ?? 42;
  const ftyp = box("ftyp", ascii(o.brand ?? "isom"), u32(0x200), ascii("isomiso2mp41"));
  const qt = o.brand === "qt  ";
  const traks = [trak(1, d, "vide", { codec: o.codec ?? "avc1", width: o.width ?? 1920, height: o.height ?? 1080, rotation: o.rotation, qt })];
  if (o.audio !== false) traks.push(trak(2, d, "soun", { qt }));
  const moov = box("moov", mvhd(d), ...traks);
  const payload = zeros(o.mdatBytes ?? 1024);
  const mdat = o.largeMdat
    ? Buffer.concat([u32(1), ascii("mdat"), (() => {
        const b = Buffer.alloc(8);
        b.writeBigUInt64BE(BigInt(16 + payload.length));
        return b;
      })(), payload])
    : box("mdat", payload);
  return o.moovAtEnd ? Buffer.concat([ftyp, mdat, moov]) : Buffer.concat([ftyp, moov, mdat]);
}

export function m4a(o: { durationSec?: number } = {}): Buffer {
  const d = o.durationSec ?? 95;
  const ftyp = box("ftyp", ascii("M4A "), u32(0), ascii("M4A mp42isom"));
  return Buffer.concat([ftyp, box("moov", mvhd(d), trak(1, d, "soun")), box("mdat", zeros(512))]);
}

/** WAV PCM 8 kHz, mono, 8 bits (8.000 bytes por segundo): pequeño y con su duración real. */
export function wav(o: { durationSec?: number } = {}): Buffer {
  const d = o.durationSec ?? 5;
  const byteRate = 8000;
  const data = Buffer.alloc(byteRate * d, 0x80);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(8000, 4);
  fmt.writeUInt32LE(byteRate, 8);
  fmt.writeUInt16LE(1, 12);
  fmt.writeUInt16LE(8, 14);
  const chunk = (id: string, b: Buffer) => {
    const h = Buffer.alloc(8);
    h.write(id, 0, "latin1");
    h.writeUInt32LE(b.length, 4);
    return Buffer.concat([h, b]);
  };
  const body = Buffer.concat([Buffer.from("WAVE", "latin1"), chunk("fmt ", fmt), chunk("data", data)]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "latin1");
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

/** Lector en memoria con la firma de parseMediaInfo. */
export const bufferReader = (buf: Buffer) => async (offset: number, length: number) => buf.subarray(offset, offset + length);
