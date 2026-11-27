/**
 * Lecciones por partes (lib/lesson-parts.ts): lectura de las partes que envía el editor, cómo se ve
 * cada parte, la etiqueta «Vídeo + texto + PDF», la copia de compatibilidad de Lesson y su gemelo
 * del relleno SQL, la duración automática y los accept de los botones. Puro (sin BD ni servidor).
 */
import { mimeFromExt, privateFileType, PRIVATE_TYPES } from "../../lib/file-types";
import {
  ADD_PART,
  EMBED_URL_ERROR,
  fileUsage,
  LESSON_PARTS_JSON_MAX,
  LESSON_PARTS_TOO_MANY,
  LESSON_PARTS_UNREADABLE,
  LESSON_TEXT_MAX,
  LESSON_TEXT_TOO_LONG,
  legacyLessonColumns,
  lessonPartViews,
  parseLessonParts,
  partsFromLegacy,
  partView,
  primaryLessonKind,
  splitLead,
  suggestedLessonMinutes,
  type PartView,
} from "../../lib/lesson-parts";
import { eq, ok, test } from "./harness";

const parse = (v: unknown) => parseLessonParts(JSON.stringify(v));
const err = (r: ReturnType<typeof parseLessonParts>) => (r.ok ? null : r.error);

test("parseLessonParts: TEXT MD, FILE y EMBED en su orden", () => {
  const r = parse([{ kind: "FILE", fileId: "f1" }, { kind: "TEXT", body: "## Hola", format: "MD" }, { kind: "EMBED", url: "https://youtu.be/abcdefghijk" }]);
  eq(r, { ok: true, parts: [{ kind: "FILE", fileId: "f1" }, { kind: "TEXT", body: "## Hola", format: "MD" }, { kind: "EMBED", url: "https://youtu.be/abcdefghijk" }] });
});

test("parseLessonParts: formato '' o 'HTML' → null; sin formato → undefined", () => {
  const r = parse([{ kind: "TEXT", body: "a", format: "" }, { kind: "TEXT", body: "b", format: "HTML" }, { kind: "TEXT", body: "c" }]);
  ok(r.ok);
  eq(r.parts.map((p) => (p.kind === "TEXT" ? p.format : "x")), [null, null, undefined]);
});

test("parseLessonParts: quita los textos en blanco y conserva los espacios del texto de verdad", () => {
  const r = parse([{ kind: "TEXT", body: "  \n\n " }, { kind: "TEXT", body: "\n" }, { kind: "TEXT", body: "  hola  mundo" }]);
  ok(r.ok);
  eq(JSON.stringify(r.parts), JSON.stringify([{ kind: "TEXT", body: "  hola  mundo" }]));
});

test("parseLessonParts: JSON roto o que no es una lista", () => {
  eq(err(parseLessonParts("{no")), LESSON_PARTS_UNREADABLE);
  eq(err(parseLessonParts(JSON.stringify({ kind: "TEXT" }))), LESSON_PARTS_UNREADABLE);
  eq(err(parseLessonParts(undefined)), LESSON_PARTS_UNREADABLE);
  eq(err(parseLessonParts(null)), LESSON_PARTS_UNREADABLE);
});

test("parseLessonParts: tipo desconocido, FILE sin id o con id de más de 40", () => {
  ok(err(parse([{ kind: "HTML", body: "x" }])));
  ok(err(parse([{ kind: "FILE" }])));
  ok(err(parse([{ kind: "FILE", fileId: "x".repeat(41) }])));
});

test("parseLessonParts: 13 partes, un texto de 20 001 caracteres y un JSON enorme", () => {
  eq(err(parse(Array.from({ length: 13 }, () => ({ kind: "FILE", fileId: "f" })))), LESSON_PARTS_TOO_MANY);
  ok(parse(Array.from({ length: 12 }, () => ({ kind: "FILE", fileId: "f" }))).ok);
  eq(err(parse([{ kind: "TEXT", body: "a".repeat(LESSON_TEXT_MAX + 1) }])), LESSON_TEXT_TOO_LONG);
  ok(parse([{ kind: "TEXT", body: "a".repeat(LESSON_TEXT_MAX) }]).ok);
  ok(err(parseLessonParts(" ".repeat(LESSON_PARTS_JSON_MAX + 1))));
});

test("parseLessonParts EMBED: rechaza javascript:, data:, ftp:// y sin esquema; recorta https y http", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://x", "www.youtube.com/watch?v=abcdefghijk"])
    eq(err(parse([{ kind: "EMBED", url }])), EMBED_URL_ERROR, url);
  eq(parse([{ kind: "EMBED", url: "  https://youtu.be/abcdefghijk  " }]), { ok: true, parts: [{ kind: "EMBED", url: "https://youtu.be/abcdefghijk" }] });
  ok(parse([{ kind: "EMBED", url: "http://example.com/v" }]).ok);
});

test("partView: lo decide el tipo del archivo", () => {
  for (const k of ["VIDEO", "AUDIO", "PDF", "IMAGE"] as const) eq(partView("FILE", k), k);
  for (const k of ["LINK", "OTHER", null, undefined]) eq(partView("FILE", k), "DOWNLOAD");
  eq(partView("TEXT"), "TEXT");
  eq(partView("EMBED"), "EMBED");
});

test("lessonPartViews: orden de aparición, sin repetir, YouTube cuenta como vídeo", () => {
  eq(
    lessonPartViews([{ kind: "EMBED" }, { kind: "TEXT" }, { kind: "FILE", file: { kind: "VIDEO" } }, { kind: "FILE", file: { kind: "PDF" } }, { kind: "TEXT" }]),
    ["VIDEO", "TEXT", "PDF"],
  );
});

test("primaryLessonKind", () => {
  eq(primaryLessonKind(["TEXT", "AUDIO"]), "AUDIO");
  eq(primaryLessonKind(["TEXT", "VIDEO", "AUDIO"]), "VIDEO");
  eq(primaryLessonKind(["IMAGE"]), "PDF");
  eq(primaryLessonKind(["DOWNLOAD"]), "PDF");
  eq(primaryLessonKind(["TEXT"]), "TEXT");
  eq(primaryLessonKind([]), "TEXT");
});

test("legacyLessonColumns: la copia de compatibilidad", () => {
  eq(
    legacyLessonColumns([
      { kind: "FILE", fileId: "v", fileKind: "VIDEO" },
      { kind: "TEXT", body: "## T", format: "MD" },
      { kind: "FILE", fileId: "p", fileKind: "PDF" },
    ]),
    { kind: "VIDEO", body: "## T", bodyFormat: "MD", fileId: "v", mediaUrl: null },
  );
  eq(legacyLessonColumns([{ kind: "EMBED", url: "https://youtu.be/x" }]), { kind: "VIDEO", body: null, bodyFormat: null, fileId: null, mediaUrl: "https://youtu.be/x" });
  eq(legacyLessonColumns([{ kind: "FILE", fileId: "a", fileKind: "AUDIO" }, { kind: "FILE", fileId: "p", fileKind: "PDF" }]), {
    kind: "AUDIO", body: null, bodyFormat: null, fileId: "a", mediaUrl: null,
  });
  eq(legacyLessonColumns([{ kind: "FILE", fileId: "i", fileKind: "IMAGE" }]), { kind: "PDF", body: null, bodyFormat: null, fileId: "i", mediaUrl: null });
  eq(legacyLessonColumns([]), { kind: "TEXT", body: null, bodyFormat: null, fileId: null, mediaUrl: null });
});

const L = (kind: string, o: { body?: string; bodyFormat?: string | null; fileId?: string; mediaUrl?: string } = {}) => ({
  kind,
  body: o.body ?? null,
  bodyFormat: o.bodyFormat ?? null,
  fileId: o.fileId ?? null,
  mediaUrl: o.mediaUrl ?? null,
});

test("partsFromLegacy: las nueve formas de antes", () => {
  eq(partsFromLegacy(L("VIDEO", { fileId: "v", body: "Hola" })), [
    { sortOrder: 0, kind: "FILE", fileId: "v" },
    { sortOrder: 1, kind: "TEXT", body: "Hola", bodyFormat: null },
  ]);
  eq(partsFromLegacy(L("VIDEO", { mediaUrl: "https://youtu.be/x" })), [{ sortOrder: 0, kind: "EMBED", url: "https://youtu.be/x" }]);
  eq(partsFromLegacy(L("VIDEO", { fileId: "v", mediaUrl: "https://youtu.be/x" })), [{ sortOrder: 0, kind: "FILE", fileId: "v" }]);
  eq(partsFromLegacy(L("AUDIO", { fileId: "a", body: "Escucha" })), [
    { sortOrder: 0, kind: "FILE", fileId: "a" },
    { sortOrder: 1, kind: "TEXT", body: "Escucha", bodyFormat: null },
  ]);
  eq(partsFromLegacy(L("PDF", { fileId: "p" })), [{ sortOrder: 2, kind: "FILE", fileId: "p" }]);
  eq(partsFromLegacy(L("EXERCISE", { fileId: "z", body: "Haz" })), [
    { sortOrder: 1, kind: "TEXT", body: "Haz", bodyFormat: null },
    { sortOrder: 2, kind: "FILE", fileId: "z" },
  ]);
  eq(partsFromLegacy(L("TEXT", { body: "## T", bodyFormat: "MD" })), [{ sortOrder: 1, kind: "TEXT", body: "## T", bodyFormat: "MD" }]);
  eq(partsFromLegacy(L("TEXT", { body: "  \n " })), []);
  eq(partsFromLegacy(L("VIDEO", { fileId: "pdf" })), [{ sortOrder: 0, kind: "FILE", fileId: "pdf" }]);
});

test("ida y vuelta: volver a guardar una lección migrada sin tocarla no cambia su copia", () => {
  const kinds: Record<string, string> = { v: "VIDEO", a: "AUDIO", p: "PDF" };
  for (const l of [
    L("VIDEO", { fileId: "v", body: "Hola", bodyFormat: "MD" }),
    L("VIDEO", { mediaUrl: "https://youtu.be/x" }),
    L("AUDIO", { fileId: "a", body: "Escucha" }),
    L("PDF", { fileId: "p" }),
    L("TEXT", { body: "Lee" }),
  ]) {
    const parts = partsFromLegacy(l).map((p) => ({ ...p, fileKind: p.fileId ? kinds[p.fileId] : null }));
    eq(legacyLessonColumns(parts), l, l.kind);
  }
});

test("suggestedLessonMinutes", () => {
  eq(suggestedLessonMinutes([95, 125]), 4);
  eq(suggestedLessonMinutes([59]), 1);
  eq(suggestedLessonMinutes([null, undefined]), null);
  eq(suggestedLessonMinutes([0]), null);
  eq(suggestedLessonMinutes([10_000_000]), 600);
});

test("splitLead: un vídeo o un YouTube al principio va arriba", () => {
  const v = { view: "VIDEO" as PartView, n: 1 };
  const t = { view: "TEXT" as PartView, n: 2 };
  const e = { view: "EMBED" as PartView, n: 3 };
  const p = { view: "PDF" as PartView, n: 4 };
  eq(splitLead([v, t]), { lead: v, rest: [t] });
  eq(splitLead([e, p]), { lead: e, rest: [p] });
  eq(splitLead([t, v]), { lead: null, rest: [t, v] });
  eq(splitLead([]), { lead: null, rest: [] });
});

test("fileUsage cuenta lecciones distintas", () => {
  eq(
    fileUsage([
      { fileId: "f1", lessonId: "L1" },
      { fileId: "f1", lessonId: "L1" },
      { fileId: "f1", lessonId: "L2" },
      { fileId: "f2", lessonId: "L1" },
      { fileId: null, lessonId: "L3" },
    ]),
    { f1: 2, f2: 1 },
  );
});

test("ADD_PART: .mov, .m4a, .pdf, .png y .jpg; nunca HEIC; cada extensión es del tipo esperado", () => {
  ok(ADD_PART.VIDEO.accept.includes(".mov") && ADD_PART.VIDEO.accept.includes("video/quicktime"));
  ok(ADD_PART.AUDIO.accept.includes(".m4a"));
  ok(ADD_PART.PDF.accept.includes(".pdf"));
  ok(ADD_PART.IMAGE.accept.includes(".png") && ADD_PART.IMAGE.accept.includes(".jpg"));
  for (const [kind, a] of Object.entries(ADD_PART)) {
    ok(!/heic|heif/i.test(a.accept), kind);
    for (const token of a.accept.split(",")) {
      const ct = token.startsWith(".") ? privateFileType(mimeFromExt(`x${token}`), `x${token}`) : privateFileType(token, "x");
      ok(ct, `${kind}: ${token} no se admite`);
      eq(PRIVATE_TYPES[ct!].kind, kind, `${kind}: ${token}`);
    }
  }
});
