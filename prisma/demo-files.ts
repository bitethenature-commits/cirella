/**
 * Generadores de archivos de demostración (sin dependencias):
 *   · makePdf  → PDF real con portada y texto (fuentes estándar, WinAnsi)
 *   · makeWav  → audio de meditación (cuenco tibetano sintetizado)
 *   · makeVideo → vídeo corto con ffmpeg (si está instalado)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WIN_ANSI: Record<string, number> = { "—": 0x97, "–": 0x96, "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "…": 0x85, "•": 0x95, "€": 0x80 };

function pdfString(s: string) {
  const bytes: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    let b = WIN_ANSI[ch] ?? (code < 256 ? code : 0x3f);
    if (b === 0x28 || b === 0x29 || b === 0x5c) bytes.push(0x5c);
    bytes.push(b);
  }
  return Buffer.from(bytes);
}

function wrap(text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > max) {
        out.push(line.trim());
        line = w;
      } else line += " " + w;
    }
    out.push(line.trim());
  }
  return out;
}

export function makePdf(opts: { title: string; subtitle: string; author: string; sections: { heading: string; body: string }[] }) {
  type Line = { font: "F1" | "F2" | "F3"; size: number; text: string; gap: number; color?: string };
  const lines: Line[] = [];
  for (const s of opts.sections) {
    lines.push({ font: "F2", size: 17, text: s.heading, gap: 30 });
    for (const l of wrap(s.body, 84)) lines.push({ font: "F1", size: 10.5, text: l, gap: l ? 15.5 : 9 });
  }
  const pages: Line[][] = [];
  let cur: Line[] = [];
  let used = 0;
  const firstCapacity = 560;
  const capacity = 700;
  for (const l of lines) {
    const cap = pages.length === 0 ? firstCapacity : capacity;
    if (used + l.gap > cap) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(l);
    used += l.gap;
  }
  if (cur.length) pages.push(cur);

  const streams: Buffer[] = pages.map((pageLines, i) => {
    const parts: Buffer[] = [];
    const push = (s: string | Buffer) => parts.push(typeof s === "string" ? Buffer.from(s, "latin1") : s);
    push("0.965 0.945 0.906 rg 0 0 595 842 re f\n");
    let y: number;
    if (i === 0) {
      push("0.043 0.055 0.122 rg 0 640 595 202 re f\n");
      push("0.85 0.75 0.55 rg 60 690 m 535 690 l 0.5 w S\n");
      push("BT /F3 9 Tf 0.85 0.75 0.55 rg 60 790 Td ");
      push(Buffer.concat([Buffer.from("("), pdfString(opts.author.toUpperCase()), Buffer.from(") Tj ET\n")]));
      push("BT /F2 30 Tf 0.953 0.925 0.867 rg 60 740 Td ");
      push(Buffer.concat([Buffer.from("("), pdfString(opts.title), Buffer.from(") Tj ET\n")]));
      push("BT /F1 11 Tf 0.79 0.73 0.95 rg 60 708 Td ");
      push(Buffer.concat([Buffer.from("("), pdfString(opts.subtitle), Buffer.from(") Tj ET\n")]));
      y = 600;
    } else {
      y = 780;
    }
    for (const l of pageLines) {
      y -= l.gap;
      const color = l.font === "F2" ? "0.043 0.055 0.122 rg" : "0.22 0.21 0.3 rg";
      push(`BT /${l.font} ${l.size} Tf ${color} 60 ${y.toFixed(1)} Td `);
      push(Buffer.concat([Buffer.from("("), pdfString(l.text), Buffer.from(") Tj ET\n")]));
    }
    push(`BT /F1 8 Tf 0.55 0.53 0.6 rg 60 36 Td (${i + 1} / ${pages.length}) Tj ET\n`);
    return Buffer.concat(parts);
  });

  const objects: Buffer[] = [];
  const pageIds: number[] = [];
  // 1 catalog, 2 pages, 3-5 fonts, then [page, content] pairs
  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>");
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>");
  objects[5] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  let id = 6;
  for (const s of streams) {
    const pageId = id++;
    const contentId = id++;
    pageIds.push(pageId);
    objects[pageId] = Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects[contentId] = Buffer.concat([Buffer.from(`<< /Length ${s.length} >>\nstream\n`), s, Buffer.from("\nendstream")]);
  }
  objects[2] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets: number[] = [];
  let pos = chunks[0].length;
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pos;
    const c = Buffer.concat([Buffer.from(`${i} 0 obj\n`), objects[i], Buffer.from("\nendobj\n")]);
    chunks.push(c);
    pos += c.length;
  }
  const xref = [`xref\n0 ${objects.length}\n`, "0000000000 65535 f \n"];
  for (let i = 1; i < objects.length; i++) xref.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  chunks.push(Buffer.from(xref.join("")));
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

/** Cuenco sintetizado: fundamental 136,1 Hz (OM) + armónicos y batido suave. */
export function makeWav(seconds = 30, sampleRate = 22050) {
  const n = Math.floor(seconds * sampleRate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  const f = 136.1;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 3) * Math.min(1, (seconds - t) / 4);
    const strike = Math.exp(-((t % 10) / 6)) * 0.6 + 0.4;
    const s =
      0.3 * Math.sin(2 * Math.PI * f * t) +
      0.16 * Math.sin(2 * Math.PI * (f * 2.01) * t + 0.4) +
      0.08 * Math.sin(2 * Math.PI * (f * 2.99) * t + 1.1) +
      0.05 * Math.sin(2 * Math.PI * (f * 4.2) * t);
    const v = s * env * strike * (1 + 0.12 * Math.sin(2 * Math.PI * 0.18 * t));
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 26000))), 44 + i * 2);
  }
  return buf;
}

/** Vídeo corto (zoom lento sobre una imagen + audio). Devuelve null si no hay ffmpeg. */
export function makeVideo(imagePath: string, seconds = 16): Buffer | null {
  try {
    if (!existsSync(imagePath)) return null;
    const dir = mkdtempSync(path.join(tmpdir(), "cirella-"));
    const wav = path.join(dir, "a.wav");
    const out = path.join(dir, "v.mp4");
    writeFileSync(wav, makeWav(seconds));
    execFileSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-loop", "1", "-framerate", "24", "-i", imagePath,
        "-i", wav,
        "-filter_complex",
        "[0:v]scale=1600:1200,zoompan=z='min(zoom+0.0008,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=960x540:fps=24,format=yuv420p[v]",
        "-map", "[v]", "-map", "1:a",
        "-t", String(seconds),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
        "-c:a", "aac", "-b:a", "64k",
        "-movflags", "+faststart",
        out,
      ],
      { stdio: "pipe", timeout: 120000 },
    );
    return readFileSync(out);
  } catch {
    return null;
  }
}
