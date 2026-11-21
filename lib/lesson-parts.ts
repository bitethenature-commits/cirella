/**
 * Lecciones por partes: una lección («punto de progreso») lleva, en el orden que elige la dueña,
 * vídeo, audio, texto con formato, PDF, imágenes, vídeos de YouTube/Vimeo y otros archivos. La
 * lección entera sigue siendo UN paso del progreso (LessonProgress no cambia).
 *
 * Solo hay tres tipos de parte guardada:
 *   · TEXT  → texto (bodyFormat null = de antes, "MD" = con formato; lib/rich-text.ts);
 *   · FILE  → un archivo de los materiales del curso. Cómo se ve lo decide ProductFile.kind
 *             (VIDEO, AUDIO, PDF, IMAGE → visor; LINK, OTHER → botón), así nunca se contradicen;
 *   · EMBED → un enlace de YouTube o Vimeo (o, si no lo es, un botón «Abrir el vídeo»).
 *
 * Y las de las lecciones largas (capítulos, modelo por partes, «en tu carta», «hoy», repaso y glosario),
 * con su contenido en LessonPart.data: lib/lesson-blocks.ts.
 *
 * Puro y seguro en el navegador (solo zod): lo usan el editor, el reproductor, la página pública,
 * lib/lessons.ts y las pruebas unitarias.
 */
import { z } from "zod";
import { readPieceLook, type PieceLook } from "./course-design";
import { BLOCK_KINDS, isBlockKind, parseBlock, type BlockPart } from "./lesson-blocks";
import { parseTextFormat } from "./rich-text";
import type { LessonKind } from "./types";

export const LESSON_PART_KINDS = ["TEXT", "FILE", "EMBED", ...BLOCK_KINDS] as const;
export type LessonPartKind = (typeof LESSON_PART_KINDS)[number];

/** Una lección larga lleva muchos capítulos y piezas: hasta 120 partes. */
export const MAX_LESSON_PARTS = 120;
/** No se puede pasar a borrador la última lección publicada de un curso publicado (lo dice el guardado; el editor lo deshace). */
export const LESSON_LAST_PUBLISHED =
  "Es la única lección publicada de un curso publicado: tus alumnas se quedarían sin nada. Publica otra antes o pasa el curso a borrador.";
export const LESSON_TEXT_MAX = 20_000;
/** Tope del JSON de las partes: deja el formulario bajo el bodySizeLimit de 2 MB (next.config) aun con caracteres de 3 bytes. */
export const LESSON_PARTS_JSON_MAX = 1_500_000;

export const LESSON_PARTS_UNREADABLE = "No hemos podido leer el contenido de la lección. Recarga la página y vuelve a intentarlo.";
export const LESSON_PARTS_TOO_MANY = `Una lección puede tener hasta ${MAX_LESSON_PARTS} partes`;
export const LESSON_TEXT_TOO_LONG = "Cada texto de la lección admite hasta 20 000 caracteres";
export const EMBED_URL_ERROR = "El enlace del vídeo debe empezar por https://";

export type LessonPartInput = ({ kind: "TEXT"; body: string; format: "MD" | null | undefined } | { kind: "FILE"; fileId: string } | { kind: "EMBED"; url: string } | BlockPart) & {
  /** Su diseño (lib/course-design.ts); null = sin diseño propio. */
  design?: PieceLook | null;
};

export const lessonPartSchema: z.ZodType<LessonPartInput, z.ZodTypeDef, unknown> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEXT"),
    body: z.string().max(LESSON_TEXT_MAX, LESSON_TEXT_TOO_LONG),
    format: z.string().max(8).optional().transform(parseTextFormat),
  }),
  z.object({ kind: z.literal("FILE"), fileId: z.string().min(1).max(40) }),
  z.object({
    kind: z.literal("EMBED"),
    url: z.string().trim().max(500, "El enlace del vídeo es demasiado largo").regex(/^https?:\/\//i, EMBED_URL_ERROR),
  }),
]) as z.ZodType<LessonPartInput, z.ZodTypeDef, unknown>;

/** Lee las partes que envía el editor (JSON). Quita los textos vacíos; errores en castellano. */
export function parseLessonParts(raw: unknown): { ok: true; parts: LessonPartInput[] } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: LESSON_PARTS_UNREADABLE };
  if (raw.length > LESSON_PARTS_JSON_MAX) return { ok: false, error: "La lección es demasiado larga. Divide el texto en dos lecciones." };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: LESSON_PARTS_UNREADABLE };
  }
  if (!Array.isArray(data)) return { ok: false, error: LESSON_PARTS_UNREADABLE };
  if (data.length > MAX_LESSON_PARTS) return { ok: false, error: LESSON_PARTS_TOO_MANY };
  const parts: LessonPartInput[] = [];
  for (const item of data) {
    const k = (item as { kind?: unknown } | null)?.kind;
    const design = readPieceLook((item as { design?: unknown } | null)?.design);
    if (typeof k === "string" && isBlockKind(k)) {
      const b = parseBlock(k, (item as { data?: unknown }).data);
      if (!b.ok) return { ok: false, error: b.error };
      parts.push({ ...b.part, design });
      continue;
    }
    const r = lessonPartSchema.safeParse(item);
    if (!r.success) {
      const custom = r.error.issues.find((i) => i.message === LESSON_TEXT_TOO_LONG || i.message === EMBED_URL_ERROR || i.message.startsWith("El enlace"));
      return { ok: false, error: custom?.message ?? "Una parte de la lección no es válida. Recarga la página y vuelve a intentarlo." };
    }
    if (r.data.kind === "TEXT" && !/\S/.test(r.data.body)) continue;
    parts.push({ ...r.data, design });
  }
  return { ok: true, parts };
}

// ───────────── Cómo se ve cada parte ─────────────

export type PartView = "VIDEO" | "AUDIO" | "PDF" | "IMAGE" | "TEXT" | "EMBED" | "DOWNLOAD" | "BLOCK";

export const PART_VIEW_LABEL: Record<PartView, string> = {
  VIDEO: "Vídeo",
  AUDIO: "Audio",
  PDF: "PDF",
  IMAGE: "Imagen",
  TEXT: "Texto",
  EMBED: "Vídeo de YouTube o Vimeo",
  DOWNLOAD: "Archivo",
  BLOCK: "Interactivo",
};

const FILE_VIEWS = new Set<PartView>(["VIDEO", "AUDIO", "PDF", "IMAGE"]);

/** Visor de una parte: el de su archivo (LINK, OTHER o desconocido → botón de descarga). */
export function partView(kind: string, fileKind?: string | null): PartView {
  if (kind === "TEXT") return "TEXT";
  if (kind === "EMBED") return "EMBED";
  if (isBlockKind(kind)) return "BLOCK";
  return fileKind && FILE_VIEWS.has(fileKind as PartView) ? (fileKind as PartView) : "DOWNLOAD";
}

/** Lo que tiene una lección, por orden de aparición y sin repetir (un vídeo de YouTube cuenta como vídeo). */
export function lessonPartViews(parts: { kind: string; file?: { kind: string } | null }[]): PartView[] {
  const out: PartView[] = [];
  for (const p of parts) {
    // Los capítulos y el glosario ordenan la lección: no son «contenido» que contar.
    if (p.kind === "CHAPTER" || p.kind === "GLOSSARY") continue;
    let v = partView(p.kind, p.file?.kind);
    if (v === "EMBED") v = "VIDEO";
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const LABEL_WORD: Record<PartView, string> = { VIDEO: "vídeo", AUDIO: "audio", PDF: "PDF", IMAGE: "imagen", TEXT: "texto", EMBED: "vídeo", DOWNLOAD: "archivo", BLOCK: "interactivo" };

/** «Vídeo + texto + PDF»; solo texto → «Lectura» (como siempre); sin partes → "". */
export function partsLabel(views: PartView[]): string {
  if (!views.length) return "";
  if (views.length === 1 && views[0] === "TEXT") return "Lectura";
  const words = views.map((v) => LABEL_WORD[v]);
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" + ");
}

/** Tipo principal (para Lesson.kind): vídeo > audio > PDF (también imagen u otro archivo) > lectura. */
export function primaryLessonKind(views: PartView[]): LessonKind {
  if (views.includes("VIDEO") || views.includes("EMBED")) return "VIDEO";
  if (views.includes("AUDIO")) return "AUDIO";
  if (views.includes("PDF") || views.includes("IMAGE") || views.includes("DOWNLOAD")) return "PDF";
  return "TEXT";
}

// ───────────── Columnas de antes (copia de compatibilidad) ─────────────

export type LegacyLessonColumns = { kind: LessonKind; body: string | null; bodyFormat: string | null; fileId: string | null; mediaUrl: string | null };

type AnyPart = { kind: string; body?: string | null; format?: string | null; bodyFormat?: string | null; fileId?: string | null; url?: string | null; fileKind?: string | null };

/**
 * Lesson.kind/body/bodyFormat/fileId/mediaUrl calculados desde las partes: el código anterior
 * (si se vuelve a él) sigue enseñando la lección, sin las partes de más.
 */
export function legacyLessonColumns(parts: AnyPart[]): LegacyLessonColumns {
  const views = parts.map((p) => partView(p.kind, p.fileKind));
  const kind = primaryLessonKind(views);
  const text = parts.find((p) => p.kind === "TEXT");
  const want = (v: PartView) => (kind === "VIDEO" ? v === "VIDEO" : kind === "AUDIO" ? v === "AUDIO" : kind === "PDF" ? v === "PDF" || v === "IMAGE" || v === "DOWNLOAD" : false);
  const file = parts.find((p, i) => p.kind === "FILE" && want(views[i]));
  const embed = parts.find((p) => p.kind === "EMBED");
  const format = text ? (text.format !== undefined ? text.format : text.bodyFormat) : null;
  return {
    kind,
    body: text?.body ?? null,
    bodyFormat: format === "MD" ? "MD" : null,
    fileId: file?.fileId ?? null,
    mediaUrl: embed?.url ?? null,
  };
}

export type LegacyPart = { sortOrder: 0 | 1 | 2; kind: LessonPartKind; body?: string; bodyFormat?: string | null; fileId?: string; url?: string };

/**
 * Gemelo en TypeScript del relleno SQL de la migración 20261018120000_lecciones_por_partes (lo que
 * se veía antes, en el mismo orden): arriba el vídeo/audio o el vídeo de YouTube/Vimeo, luego el
 * texto y al final el PDF/archivo del ejercicio. scripts/lessons-test.ts compara ambos.
 */
export function partsFromLegacy(l: { kind: string; body: string | null; bodyFormat: string | null; fileId: string | null; mediaUrl: string | null }): LegacyPart[] {
  const out: LegacyPart[] = [];
  if ((l.kind === "VIDEO" || l.kind === "AUDIO") && l.fileId) out.push({ sortOrder: 0, kind: "FILE", fileId: l.fileId });
  else if (l.kind === "VIDEO" && !l.fileId && l.mediaUrl && /\S/.test(l.mediaUrl)) out.push({ sortOrder: 0, kind: "EMBED", url: l.mediaUrl });
  if (l.body && /\S/.test(l.body)) out.push({ sortOrder: 1, kind: "TEXT", body: l.body, bodyFormat: l.bodyFormat });
  if (!["VIDEO", "AUDIO", "TEXT"].includes(l.kind) && l.fileId) out.push({ sortOrder: 2, kind: "FILE", fileId: l.fileId });
  return out;
}

// ───────────── Ayudas ─────────────

/** Duración automática: la suma de los vídeos y audios, en minutos redondeados hacia arriba (máx. 600). */
export function suggestedLessonMinutes(durationsSec: (number | null | undefined)[]): number | null {
  const sum = durationsSec.reduce<number>((a, d) => a + (d && d > 0 ? d : 0), 0);
  if (!sum) return null;
  return Math.min(600, Math.ceil(sum / 60));
}

/** Si la lección empieza con un vídeo (propio o de YouTube/Vimeo), va arriba y a todo lo ancho. */
export function splitLead<T extends { view: PartView }>(parts: T[]): { lead: T | null; rest: T[] } {
  const first = parts[0];
  if (first && (first.view === "VIDEO" || first.view === "EMBED")) return { lead: first, rest: parts.slice(1) };
  return { lead: null, rest: parts };
}

/** En cuántas lecciones distintas está cada archivo. */
export function fileUsage(rows: { fileId: string | null; lessonId: string }[]): Record<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.fileId) continue;
    if (!seen.has(r.fileId)) seen.set(r.fileId, new Set());
    seen.get(r.fileId)!.add(r.lessonId);
  }
  return Object.fromEntries([...seen].map(([k, v]) => [k, v.size]));
}

export type AddPartKind = "VIDEO" | "AUDIO" | "PDF" | "IMAGE" | "OTHER";

/**
 * Botones «Vídeo / Audio / PDF / Imagen / Otro archivo» del editor: qué se puede subir (accept, de
 * acuerdo con lib/file-types.ts) y qué materiales del curso se ofrecen. Nunca HEIC: el servidor lo
 * rechaza con cómo hacerlo.
 */
export const ADD_PART: Record<AddPartKind, { label: string; accept: string; fileKinds: string[]; multiple: boolean; embed: boolean }> = {
  VIDEO: { label: "Vídeo", accept: "video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v", fileKinds: ["VIDEO"], multiple: false, embed: true },
  AUDIO: { label: "Audio", accept: "audio/mp4,audio/x-m4a,audio/mpeg,audio/wav,.m4a,.mp3,.wav", fileKinds: ["AUDIO"], multiple: false, embed: false },
  PDF: { label: "PDF", accept: "application/pdf,.pdf", fileKinds: ["PDF"], multiple: false, embed: false },
  IMAGE: { label: "Imagen", accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", fileKinds: ["IMAGE"], multiple: true, embed: false },
  OTHER: { label: "Otro archivo", accept: ".zip,.epub,application/zip,application/epub+zip", fileKinds: ["OTHER", "LINK"], multiple: false, embed: false },
};

