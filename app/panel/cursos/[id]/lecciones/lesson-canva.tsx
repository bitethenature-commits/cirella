"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  FileText,
  Headphones,
  Image as ImageIcon,
  Loader2,
  Palette,
  Paperclip,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PieceFrame } from "@/components/course/course-look";
import type { BlockContext } from "@/components/course/lesson-blocks";
import { LeadPart, LessonParts, type PlayerPart } from "@/components/course/lesson-parts";
import { askConfirm } from "@/components/ui/ask-confirm";
import type { UploadedFile } from "@/components/ui/upload-client";
import { hasLookPatch, mergeLook, pieceFonts, type CourseLook, type PieceLook } from "@/lib/course-design";
import { BLOCK_LABEL, emptyBlock, isBlockKind, type BlockKind, type BlockPart } from "@/lib/lesson-blocks";
import { MODEL_LABEL, type ModelKind } from "@/lib/page-blocks";
import { ADD_PART, LESSON_LAST_PUBLISHED, MAX_LESSON_PARTS, lessonPartViews, partView, suggestedLessonMinutes, type AddPartKind } from "@/lib/lesson-parts";
import { BarButton, EditText } from "@/app/panel/canva/canva-ui";
import { saveLesson } from "@/app/panel/productos/actions";
import { AddPartOptions } from "@/app/panel/productos/[id]/lecciones/add-part-sheet";
import { PartFields, partLabel, type EditorFile, type EditorPart } from "@/app/panel/productos/[id]/lecciones/part-card";
import { useUploadQueue } from "@/app/panel/productos/[id]/lecciones/use-upload-queue";
import { deleteStudioLesson, renameStudioCourse } from "../../actions";
import type { BoardModule } from "../structure-board";
import { CourseCanvaShell, type CanvaCourse, type CanvaPanel } from "./course-canva";
import { CourseDesignPanel, PieceDesignPanel, useCourseLook } from "./design-panel";
import { BlockBar, BlockEdit, MediaBar } from "./piece-edit";
import { InlineRich } from "./inline-rich";

export type CanvaLesson = {
  id: string;
  moduleId: string;
  title: string;
  durationMin: number | null;
  version: number;
  parts: EditorPart[];
  /** Borrador (false) o publicada (true). */
  published: boolean;
  dripDays: number | null;
  /** Su propio diseño, encima del del curso (vacío = como el curso). */
  design: Partial<CourseLook>;
};

type Serial = ({ kind: "TEXT"; body: string; format: string } | { kind: "FILE"; fileId: string } | { kind: "EMBED"; url: string } | BlockPart) & { design: PieceLook | null };
/** Lo que se guarda (las subidas en curso no: se guardan al terminar). */
type Data = { title: string; moduleId: string; durationMin: string; parts: Serial[]; published: boolean; dripDays: string; design: Partial<CourseLook> };
/** Lo que se abre a la izquierda, en el sitio del índice. */
type Panel = { kind: "design" } | { kind: "piece"; key: string } | { kind: "add"; add: AddPartKind } | null;
type SaveUi = { kind: "idle" | "saving" | "saved" } | { kind: "error"; error: string };
type UploadPart = Extract<EditorPart, { kind: "UPLOAD" }>;
type TextStart = "h3" | "h4" | "p" | "blockquote";

/** Los textos que se añaden, como en Canva: cada uno con su aspecto. */
const TEXT_BUTTONS: { as: TextStart; label: string; cls: string }[] = [
  { as: "h3", label: "Título", cls: "display text-[1.35rem] leading-none" },
  { as: "h4", label: "Subtítulo", cls: "text-[1rem] font-semibold" },
  { as: "p", label: "Texto", cls: "text-[0.9rem] font-normal" },
  { as: "blockquote", label: "Cita", cls: "text-[0.95rem] font-normal italic" },
];

/** Los modelos principales (los de la web: lib/page-blocks.ts), con su nombre corto para los botones de «Añadir». */
const MAIN_BUTTONS: { model: ModelKind; label: string }[] = [
  { model: "chart", label: "Carta natal" },
  { model: "bodygraph", label: "Bodygraph" },
  { model: "geneKeys", label: "Gene Keys" },
  { model: "lunar", label: "Luna" },
  { model: "runes", label: "Runas" },
  { model: "oracle", label: "Oráculo" },
  { model: "geometry", label: "Geometría sagrada" },
  { model: "kundalini", label: "Kundalini" },
];

const MEDIA_BUTTONS: { add: AddPartKind; label: string; icon: LucideIcon }[] = [
  { add: "VIDEO", label: "Vídeo", icon: PlayCircle },
  { add: "AUDIO", label: "Audio", icon: Headphones },
  { add: "PDF", label: "PDF", icon: FileText },
  { add: "IMAGE", label: "Imagen", icon: ImageIcon },
  { add: "OTHER", label: "Otro", icon: Paperclip },
];

/** Sin carta de la alumna: las piezas interactivas se ven como las ve quien aún no ha guardado la suya. */
const BLOCK_CTX: BlockContext = { profile: null, computed: null, energyHref: null };
const SAVE_DELAY = 900;

let seq = 0;
const newKey = () => `n${++seq}-${Date.now().toString(36)}`;

function serialParts(parts: EditorPart[]): Serial[] {
  return parts.flatMap((p): Serial[] => {
    const design = p.design ?? null;
    return p.kind === "TEXT"
      ? [{ kind: "TEXT", body: p.body, format: p.format ?? "", design }]
      : p.kind === "FILE"
        ? [{ kind: "FILE", fileId: p.fileId, design }]
        : p.kind === "EMBED"
          ? [{ kind: "EMBED", url: p.url, design }]
          : isBlockKind(p.kind)
            ? [{ kind: p.kind, data: (p as BlockPart).data, design } as Serial]
            : [];
  });
}

function formOf(id: string, version: number, d: Data, dripByLesson: boolean) {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("moduleId", d.moduleId);
  fd.set("title", d.title.trim());
  fd.set("durationMin", d.durationMin.trim());
  fd.set("version", String(version));
  fd.set("parts", JSON.stringify(d.parts));
  fd.set("published", d.published ? "1" : "0");
  fd.set("design", JSON.stringify(d.design));
  if (dripByLesson) fd.set("dripDays", d.dripDays.trim());
  return fd;
}

/** Un vídeo, audio, PDF o archivo como lo pinta el reproductor de la alumna (null si no hay nada que pintar). */
function toPlayer(p: EditorPart, files: Map<string, EditorFile>): PlayerPart | null {
  if (p.kind === "EMBED") return p.url.trim() ? { id: p.key, view: "EMBED", body: null, bodyFormat: null, url: p.url.trim(), file: null } : null;
  if (p.kind === "FILE") {
    const f = files.get(p.fileId);
    return f ? { id: p.key, view: partView("FILE", f.kind), body: null, bodyFormat: null, url: null, file: { ...f, sizeBytes: f.sizeBytes } } : null;
  }
  return null;
}

/** El vídeo de arriba de la lección (como en la vista de alumna: el primero, si es un vídeo). */
function isLead(p: EditorPart | undefined, files: Map<string, EditorFile>) {
  if (!p) return false;
  if (p.kind === "EMBED") return true;
  return p.kind === "FILE" && partView("FILE", files.get(p.fileId)?.kind) === "VIDEO";
}

/** ¿Lleva su propio diseño? (los capítulos solo dividen la lección). */
const hasDesign = (p: EditorPart) => p.kind !== "CHAPTER" && p.kind !== "UPLOAD";

/** Un icono de la columna de una pieza. */
function PieceTool({ icon: Icon, title, label, onClick, disabled, on, danger }: { icon: LucideIcon; title: string; label: string; onClick: () => void; disabled?: boolean; on?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={`${title}: ${label}`}
      aria-pressed={on}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30 aria-pressed:bg-[#e9cc8e]/25 aria-pressed:text-[#f7e7bd] ${danger ? "hover:text-[#f2a99f]" : ""}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Una pieza de la lección sobre la vista de alumna, con su diseño. Al pasar por encima (o elegida), su marco y,
 * pegada a su borde derecho, la columna de iconos (diseño, subir, bajar, duplicar, quitar), como en Canva. Al tocarla
 * (fuera de sus botones, vídeos y enlaces) se elige y, si tiene algo que elegir que no se escribe encima (qué modelo,
 * qué planeta, el enlace del vídeo…), sale su barrita encima (`bar`, piece-edit.tsx).
 */
function CanvaPiece({ active, design, tools, bar, onSelect, children }: { active: boolean; design?: PieceLook | null; tools: ReactNode; bar?: ReactNode; onSelect: () => void; children: ReactNode }) {
  return (
    <div
      className="canva-piece"
      data-active={active ? "" : undefined}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("[data-canva-ui], button, summary, input, textarea, select, label, a, video, audio, iframe")) return;
        onSelect();
      }}
    >
      {active && bar}
      <div data-canva-ui className="canva-piece-tools">
        <div className="flex flex-col items-center gap-0.5 rounded-full border border-[#e9cc8e]/45 bg-[#0e0e10]/95 p-1 text-[#f3e2b3] shadow-[0_10px_24px_-10px_rgb(0_0_0/.7)]">{tools}</div>
      </div>
      <PieceFrame look={design}>{children}</PieceFrame>
    </div>
  );
}

function Empty({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const cls = "block w-full rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted";
  return onClick ? (
    <button type="button" data-canva-ui className={`${cls} hover:border-gold/60 hover:text-ink`} onClick={onClick}>
      {children}
    </button>
  ) : (
    <p className={cls}>{children}</p>
  );
}

/**
 * Editor de una lección sobre la vista de alumna, como en Canva: la lección se ve como la verá ella (con el diseño
 * del curso o el suyo) y todo se cambia encima. Los textos se escriben en su sitio, con su barra (títulos, citas,
 * listas, negrita, color, enlaces…). Cada pieza lleva pegada a su borde derecho su columna de iconos; su diseño, sus
 * datos, «Añadir…», «Diseño» (de todo el curso o de esta lección) y «Lección» (estado, módulo, duración y apertura)
 * se abren a la izquierda, en el sitio del índice: nunca nada a la derecha. Abajo, «Añadir» (a la lección o al
 * capítulo abierto). Todo se guarda solo, un momento después de cada cambio (y antes de ir a otra lección), con la
 * versión para no pisar lo guardado desde otra pantalla.
 */
export function LessonCanva({
  course,
  board,
  files: initialFiles,
  lesson,
  place,
  initialChapter = 0,
  fresh = false,
}: {
  course: CanvaCourse;
  board: BoardModule[];
  files: EditorFile[];
  lesson: CanvaLesson;
  /** Su puesto entre las lecciones que ve la alumna («Lección 3 de 9») y para la apertura poco a poco. */
  place: { number: number; total: number; dripIndex: number };
  initialChapter?: number;
  /** Recién creada: el título, seleccionado para escribirlo encima. */
  fresh?: boolean;
}) {
  const router = useRouter();
  const base = `/panel/cursos/${course.id}/lecciones`;
  const viewHref = `/cuenta/cursos/${course.id}?leccion=${lesson.id}`;
  const dripByLesson = course.drip.mode === "LESSON";

  const [title, setTitle] = useState(lesson.title);
  // El módulo y los minutos ya no se tocan aquí (el módulo se cambia en «Estructura»): se guardan como están.
  const [moduleId, setModuleId] = useState(lesson.moduleId);
  const [durationMin] = useState(lesson.durationMin ? String(lesson.durationMin) : "");
  const [published, setPublished] = useState(lesson.published);
  const [dripDays, setDripDays] = useState(lesson.dripDays ? String(lesson.dripDays) : "");
  const [design, setDesign] = useState<Partial<CourseLook>>(lesson.design);
  const [parts, setParts] = useState<EditorPart[]>(lesson.parts);
  const [files, setFiles] = useState<EditorFile[]>(initialFiles);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [scope, setScope] = useState<"course" | "lesson">(hasLookPatch(lesson.design) ? "lesson" : "course");
  const [freshText, setFreshText] = useState<{ key: string; as: TextStart } | null>(null);
  const [chapter, setChapter] = useState(initialChapter);
  const [follow, setFollow] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [save, setSave] = useState<SaveUi>({ kind: "idle" });
  const [warning, setWarning] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const courseLook = useCourseLook(course.id, course.design);

  const data: Data = useMemo(
    () => ({ title, moduleId, durationMin, parts: serialParts(parts), published, dripDays, design }),
    [title, moduleId, durationMin, parts, published, dripDays, design],
  );
  const serial = JSON.stringify(data);
  const [saved, setSaved] = useState(serial);
  const dirty = serial !== saved;
  const canSave = title.trim().length > 0;
  const uploading = parts.some((p) => p.kind === "UPLOAD" && p.status !== "error");

  // Lo último de cada cosa, para guardar fuera del pintado (el temporizador, al salir).
  const dataRef = useRef(data);
  dataRef.current = data;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const version = useRef(lesson.version);
  const inFlight = useRef<Promise<void> | null>(null);
  const sent = useRef<Data | null>(null);
  const gone = useRef(false);

  const fileById = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const suggested = suggestedLessonMinutes([...new Set(parts.flatMap((p) => (p.kind === "FILE" ? [p.fileId] : [])))].map((id) => fileById.get(id)?.durationSec));

  // ── Guardar solo ──
  const doSave = useCallback(async (): Promise<void> => {
    if (gone.current) return;
    if (inFlight.current) return inFlight.current;
    const snap = dataRef.current;
    const snapSerial = JSON.stringify(snap);
    if (!snap.title.trim() || snapSerial === savedRef.current) return;
    const before = JSON.parse(savedRef.current) as Data;
    sent.current = snap;
    setSave({ kind: "saving" });
    const run = (async () => {
      try {
        const r = await saveLesson(undefined, formOf(lesson.id, version.current, snap, dripByLesson));
        if (r?.ok) {
          if (r.version != null) version.current = r.version;
          savedRef.current = snapSerial;
          setSaved(snapSerial);
          setSave({ kind: "saved" });
          setWarning(r.warning ?? null);
        } else {
          setSave({ kind: "error", error: r?.error ?? "No se ha podido guardar" });
          // La única lección publicada de un curso publicado no puede pasar a borrador: vuelve a «Publicada».
          if (r?.error === LESSON_LAST_PUBLISHED && before.published && !snap.published) setPublished(true);
        }
      } catch {
        setSave({ kind: "error", error: "Sin conexión. Toca aquí para reintentar." });
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, [lesson.id, dripByLesson]);

  useEffect(() => {
    if (!dirty || !canSave || gone.current) return;
    const t = setTimeout(() => void doSave(), SAVE_DELAY);
    return () => clearTimeout(t);
  }, [serial, saved, dirty, canSave, doSave]);

  // Lo que cambia desde el índice (otro módulo, publicada o no, el día de apertura) manda, sin volver a guardarlo.
  const fromServer = (patch: Partial<Data>) =>
    setSaved((s) => {
      const next = JSON.stringify({ ...(JSON.parse(s) as Data), ...patch });
      savedRef.current = next;
      return next;
    });
  useEffect(() => {
    if (sent.current?.moduleId === lesson.moduleId) return;
    setModuleId(lesson.moduleId);
    fromServer({ moduleId: lesson.moduleId });
  }, [lesson.moduleId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sent.current?.published === lesson.published) return;
    setPublished(lesson.published);
    fromServer({ published: lesson.published });
  }, [lesson.published]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sent.current && (Number(sent.current.dripDays) || null) === (lesson.dripDays ?? null)) return;
    const v = lesson.dripDays ? String(lesson.dripDays) : "";
    setDripDays(v);
    fromServer({ dripDays: v });
  }, [lesson.dripDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar o recargar con algo sin guardar o subiéndose: el navegador pregunta.
  const pendingLook = courseLook.dirty || courseLook.state.kind === "saving";
  useEffect(() => {
    if (!dirty && !uploading && save.kind !== "saving" && !pendingLook) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uploading, save.kind, pendingLook]);

  // Al salir por otro sitio (las pestañas del panel), lo último se guarda igual.
  useEffect(
    () => () => {
      if (gone.current || inFlight.current) return;
      const d = dataRef.current;
      if (d.title.trim() && JSON.stringify(d) !== savedRef.current) void saveLesson(undefined, formOf(lesson.id, version.current, d, dripByLesson)).catch(() => undefined);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Recién creada: fuera el «?nueva=1» de la dirección (el título ya se selecciona solo).
  useEffect(() => {
    if (fresh) window.history.replaceState(null, "", `${base}/${lesson.id}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const freshRef = useRef(fresh);
  const titleRef = useCallback((node: HTMLElement | null) => {
    if (!node || !freshRef.current) return;
    freshRef.current = false;
    requestAnimationFrame(() => {
      const el = node.querySelector<HTMLElement>(".canva-text");
      if (!el) return;
      el.focus();
      const doc = el.ownerDocument;
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = doc.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, []);

  /** Antes de ir a otra lección o pantalla: lo que falte, guardado. */
  const flush = async () => {
    // El texto que se está escribiendo se guarda al salir de él (la lección va dentro de su marco).
    const doc = Array.from(document.querySelectorAll("iframe"))
      .map((f) => f.contentDocument)
      .find((d) => d?.querySelector("[data-lesson-canva]"));
    (doc?.activeElement as HTMLElement | null | undefined)?.blur?.();
    await new Promise((r) => setTimeout(r, 0));
    if (inFlight.current) await inFlight.current;
    if (dataRef.current.title.trim() && JSON.stringify(dataRef.current) !== savedRef.current) await doSave();
    return courseLook.flush();
  };
  const navigate = async (href: string) => {
    const u = new URL(href, window.location.origin);
    // Un capítulo de esta misma lección: se abre aquí.
    if (u.pathname === `${base}/${lesson.id}`) {
      const c = Number(u.searchParams.get("capitulo") ?? 0);
      setChapter(Number.isFinite(c) && c >= 0 ? c : 0);
      return;
    }
    if (uploading && !(await askConfirm("Hay un archivo subiéndose: si sales ahora, se cancela. ¿Salir igualmente?", { okLabel: "Salir" }))) return;
    setLeaving(true);
    const lookOk = await flush();
    if (
      (JSON.stringify(dataRef.current) !== savedRef.current || !lookOk) &&
      !(await askConfirm("No se ha podido guardar el último cambio. ¿Salir sin él?", { okLabel: "Salir sin guardar" }))
    ) {
      setLeaving(false);
      return;
    }
    router.push(href);
  };

  // ── Las partes ──
  const update = (key: string, fn: (p: EditorPart) => EditorPart | null) =>
    setParts((list) => list.flatMap((p) => (p.key === key ? [fn(p)].filter((x): x is EditorPart => !!x) : [p])));

  const queue = useUploadQueue(course.id, {
    onStart: (key) => update(key, (p) => (p.kind === "UPLOAD" ? { ...p, status: "uploading", pct: 0, error: undefined } : p)),
    onProgress: (key, pct, loaded, total) => update(key, (p) => (p.kind === "UPLOAD" ? { ...p, pct, loaded, total } : p)),
    onDone: (key, f: UploadedFile) => {
      setFiles((list) => (list.some((x) => x.id === f.id) ? list : [...list, { id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes, durationSec: f.durationSec ?? null, videoCodec: f.videoCodec ?? null }]));
      update(key, () => ({ key, kind: "FILE", fileId: f.id }));
    },
    onError: (key, message) => update(key, (p) => (p.kind === "UPLOAD" ? { ...p, status: "error", error: message } : p)),
  });

  // Los capítulos: dónde empieza cada uno (su parte «Capítulo») y el abierto.
  const markers = parts.flatMap((p, i) => (p.kind === "CHAPTER" ? [i] : []));
  const hasChapters = markers.length > 0;
  const ch = hasChapters ? Math.min(Math.max(chapter, 0), markers.length - 1) : 0;
  const lead = isLead(parts[0], fileById) ? parts[0] : null;
  const from = lead ? 1 : 0;
  // Lo nuevo va al final del capítulo abierto (o de la lección).
  const insertAt = hasChapters ? (markers[ch + 1] ?? parts.length) : parts.length;
  const room = MAX_LESSON_PARTS - parts.length;

  // Al mover o añadir algo que cae en otro capítulo, se abre ese capítulo.
  useEffect(() => {
    if (!follow) return;
    const i = parts.findIndex((p) => p.key === follow);
    setFollow(null);
    if (i < 0) return;
    const k = parts.slice(0, i + 1).filter((p) => p.kind === "CHAPTER").length - 1;
    if (k >= 0) setChapter(k);
  }, [parts, follow]);

  // Si se quita la pieza elegida (o la abierta a la izquierda), se deja de elegir.
  useEffect(() => {
    if (panel?.kind === "piece" && !parts.some((p) => p.key === panel.key)) setPanel(null);
    if (selected && !parts.some((p) => p.key === selected)) setSelected(null);
  }, [parts, panel, selected]);

  const insert = (items: EditorPart[], at = insertAt) => {
    setNote(null);
    setParts((list) => {
      const pos = Math.min(at, list.length);
      return [...list.slice(0, pos), ...items, ...list.slice(pos)].slice(0, MAX_LESSON_PARTS);
    });
  };
  /** Abre a la izquierda el diseño de una pieza (su contenido se cambia encima); otra vez, se cierra. */
  const openPiece = (p: EditorPart) => {
    setSelected(p.key);
    setPanel((cur) => (cur?.kind === "piece" && cur.key === p.key ? null : { kind: "piece", key: p.key }));
  };
  /** Elegir una pieza: si a la izquierda está abierto el diseño de otra, pasa a esta (o se cierra si no lleva). */
  const select = (p: EditorPart) => {
    setSelected(p.key);
    setPanel((cur) => (cur?.kind !== "piece" || cur.key === p.key ? cur : hasDesign(p) ? { kind: "piece", key: p.key } : null));
  };
  const togglePanel = (kind: "design") => setPanel((cur) => (cur?.kind === kind ? null : { kind }));

  const addText = (as: TextStart) => {
    const key = newKey();
    setFreshText({ key, as });
    insert([{ key, kind: "TEXT", body: "", format: "MD" }]);
    setSelected(key);
    setPanel((cur) => (cur?.kind === "piece" || cur?.kind === "add" ? null : cur));
  };
  const addBlock = (k: BlockKind, model?: ModelKind) => {
    const key = newKey();
    if (k === "CHAPTER") {
      // El primero divide la lección: lo que ya tiene (menos el vídeo de arriba) pasa a ser el capítulo 1. Los
      // demás van justo detrás del abierto, y se abre el nuevo.
      const part = { key, kind: "CHAPTER", data: { title: `Capítulo ${hasChapters ? ch + 2 : 1}` } } as EditorPart;
      insert([part], hasChapters ? insertAt : from);
      setFollow(key);
      setSelected(key);
      setPanel((cur) => (cur?.kind === "piece" || cur?.kind === "add" ? null : cur));
      return;
    }
    // Se rellena encima (y lo que no es texto, en su barrita). Un modelo principal, ya con el elegido.
    const block = emptyBlock(k);
    insert([{ key, ...(block.kind === "MAIN" && model ? { ...block, data: { ...block.data, model } } : block) } as EditorPart]);
    setSelected(key);
    setPanel((cur) => (cur?.kind === "piece" || cur?.kind === "add" ? null : cur));
  };
  const upload = (kind: AddPartKind, list: File[]) => {
    setPanel(null);
    const take = list.slice(0, Math.max(0, room));
    if (take.length < list.length) setNote(`Una lección puede tener hasta ${MAX_LESSON_PARTS} partes: hemos añadido ${take.length}.`);
    const items = take.map((f): EditorPart => ({ key: newKey(), kind: "UPLOAD", add: kind, name: f.name, pct: 0, loaded: 0, total: f.size, status: "queued" }));
    insert(items);
    items.forEach((p, i) => queue.enqueue(p.key, take[i]));
  };

  const movePart = (key: string, dir: -1 | 1) => {
    setParts((list) => {
      const i = list.findIndex((p) => p.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setFollow(key);
  };
  /** Un capítulo entero (con lo que tiene dentro) antes o después del de al lado. */
  const moveChapter = (k: number, dir: -1 | 1) => {
    const j = k + dir;
    if (j < 0 || j >= markers.length) return;
    setParts((list) => {
      const idx = list.flatMap((p, i) => (p.kind === "CHAPTER" ? [i] : []));
      const a = Math.min(k, j);
      const b = a + 1;
      const sA = idx[a];
      const sB = idx[b];
      const eB = idx[b + 1] ?? list.length;
      return [...list.slice(0, sA), ...list.slice(sB, eB), ...list.slice(sA, sB), ...list.slice(eB)];
    });
    setChapter(j);
  };
  /** Un capítulo entero de `from` a `to` (arrastrándolo en el índice). El que está abierto sigue abierto. */
  const moveChapterTo = (fromCh: number, to: number) => {
    if (fromCh === to || fromCh >= markers.length || to >= markers.length) return;
    setParts((list) => {
      const idx = list.flatMap((p, i) => (p.kind === "CHAPTER" ? [i] : []));
      const head = list.slice(0, idx[0]);
      const blocks = idx.map((s, k) => list.slice(s, idx[k + 1] ?? list.length));
      const [m] = blocks.splice(fromCh, 1);
      blocks.splice(to, 0, m);
      return [...head, ...blocks.flat()];
    });
    const order = markers.map((_, i) => i);
    const [m] = order.splice(fromCh, 1);
    order.splice(to, 0, m);
    setChapter(order.indexOf(ch));
  };
  /** Una copia justo debajo (con su diseño). */
  const duplicatePart = (p: EditorPart) => {
    if (p.kind === "UPLOAD" || p.kind === "CHAPTER") return;
    if (room <= 0) return setNote(`Una lección puede tener hasta ${MAX_LESSON_PARTS} partes. Para más, crea otra lección.`);
    const key = newKey();
    const copy = { ...(JSON.parse(JSON.stringify(p)) as EditorPart), key };
    insert([copy], parts.indexOf(p) + 1);
    setSelected(key);
    setFollow(key);
  };
  const removePart = async (p: EditorPart) => {
    if (p.kind === "UPLOAD") {
      if (p.status !== "error") queue.cancel(p.key);
      update(p.key, () => null);
      return;
    }
    if (p.kind === "CHAPTER") {
      const k = markers.indexOf(parts.indexOf(p));
      if (!(await askConfirm(`¿Quitar el capítulo «${p.data.title}»? Lo que tiene dentro pasa ${k > 0 ? "al capítulo anterior" : "al principio de la lección"}.`, { okLabel: "Quitar" }))) return;
      update(p.key, () => null);
      setChapter(Math.max(0, k - 1));
      return;
    }
    if ((p.kind === "TEXT" && p.body.trim()) || isBlockKind(p.kind)) {
      if (!(await askConfirm(`¿Quitar ${p.kind === "TEXT" ? "este texto" : `«${BLOCK_LABEL[p.kind as BlockKind]}»`} de la lección?`, { okLabel: "Quitar" }))) return;
    }
    if (p.kind === "FILE") setNote("Quitado de la lección. El archivo sigue en los materiales del curso.");
    update(p.key, () => null);
  };
  const setPieceLook = (key: string, l: PieceLook | null) => update(key, (x) => ({ ...x, design: l }) as EditorPart);
  const setText = (key: string, md: string) => update(key, (x) => (x.kind === "TEXT" ? { ...x, body: md, format: "MD" } : x));
  const setChapterTitle = (key: string, v: string) => update(key, (x) => (x.kind === "CHAPTER" ? { ...x, data: { ...x.data, title: v.slice(0, 140) || x.data.title } } : x));
  const chapterOf = (k: number) => {
    const p = parts[markers[k]];
    return p?.kind === "CHAPTER" ? p.data : { title: "" };
  };

  // ── El título del curso, escrito encima (se guarda al salir de él) ──
  const [courseTitle, setCourseTitle] = useState(course.title);
  const shownCourse = useMemo(() => (courseTitle === course.title ? course : { ...course, title: courseTitle }), [course, courseTitle]);
  const renameCourse = async (v: string) => {
    const next = v.replace(/\s+/g, " ").trim().slice(0, 100);
    if (next.length < 2 || next === courseTitle) return;
    const before = courseTitle;
    setCourseTitle(next);
    try {
      const r = await renameStudioCourse(course.id, next);
      if (r.error) throw new Error(r.error);
    } catch (e) {
      setCourseTitle(before);
      setSave({ kind: "error", error: e instanceof Error && e.message ? e.message : "No se ha podido guardar el título del curso" });
    }
  };

  // ── Lección: borrar (duplicarla está en «Estructura») ──
  const remove = async () => {
    if (!(await askConfirm(`¿Eliminar «${title}»? Tus alumnas perderán su progreso en ella.`, { okLabel: "Eliminar" }))) return;
    setRemoving(true);
    gone.current = true;
    const r = await deleteStudioLesson(lesson.id);
    if (r.error) {
      gone.current = false;
      setRemoving(false);
      setSave({ kind: "error", error: r.error });
      return;
    }
    router.replace(base);
  };

  // ── Lo que se ve ──
  const views = lessonPartViews(parts.flatMap((p) => (p.kind === "UPLOAD" ? [] : [{ kind: p.kind, file: p.kind === "FILE" ? { kind: fileById.get(p.fileId)?.kind ?? "OTHER" } : null }])));
  const minutes = Number(durationMin) || suggested || null;
  const liveBoard = useMemo(
    () =>
      board.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) =>
          l.id === lesson.id
            ? {
                ...l,
                title: title.trim() || l.title,
                durationMin: minutes,
                views,
                published,
                chapters: parts.flatMap((p) => (p.kind === "CHAPTER" ? [{ title: p.data.title }] : [])),
              }
            : l,
        ),
      })),
    // views sale de parts y files.
    [board, lesson.id, title, minutes, published, parts, fileById], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const look = mergeLook(courseLook.look, design);
  const fonts = useMemo(() => pieceFonts(parts.map((p) => p.design)), [parts]);

  const partEl = (p: EditorPart) => {
    if (p.kind === "TEXT")
      return (
        <InlineRich
          value={p.body}
          format={p.format}
          active={selected === p.key}
          onChange={(md) => setText(p.key, md)}
          look={p.design}
          onLook={(l) => setPieceLook(p.key, l)}
          startAs={freshText?.key === p.key ? freshText.as : undefined}
          autoFocus={freshText?.key === p.key}
          onFocus={() => {
            select(p);
            if (freshText?.key === p.key) setFreshText(null);
          }}
        />
      );
    if (isBlockKind(p.kind))
      return <BlockEdit part={p as BlockPart} active={selected === p.key} ctx={BLOCK_CTX} onChange={(data) => update(p.key, (x) => ({ ...x, data }) as EditorPart)} />;
    const pp = toPlayer(p, fileById);
    if (!pp)
      return p.kind === "EMBED" ? (
        <Empty onClick={() => select(p)}>Vídeo sin enlace: pega el de YouTube o Vimeo en la barrita de arriba.</Empty>
      ) : (
        <Empty>Este archivo ya no está en los materiales del curso: quítalo de la lección.</Empty>
      );
    return <LessonParts parts={[pp]} lessonTitle={title} courseTitle={courseTitle} poster={course.imageUrl} personal={course.personal} />;
  };
  const uploadCard = (p: UploadPart) => (
    <div key={p.key} data-canva-ui className="card p-4" data-part-key={p.key}>
      <PartFields
        part={p}
        onPatch={() => undefined}
        onCancel={() => void removePart(p)}
        onRemove={() => update(p.key, () => null)}
        onRetry={() => {
          if (!queue.retry(p.key)) update(p.key, () => null);
          else update(p.key, (x) => (x.kind === "UPLOAD" ? { ...x, status: "queued", error: undefined, pct: 0 } : x));
        }}
      />
    </div>
  );
  const isOpen = (p: EditorPart) => panel?.kind === "piece" && panel.key === p.key;
  /** La barrita negra encima de la pieza elegida: lo que no se escribe sobre ella (enlace, planeta, modelo, minutos…). */
  const barOf = (p: EditorPart): ReactNode => {
    if (p.kind === "FILE" || p.kind === "EMBED")
      return (
        <MediaBar
          part={p}
          file={p.kind === "FILE" ? fileById.get(p.fileId) : undefined}
          onUrl={(url) => update(p.key, (x) => (x.kind === "EMBED" ? { ...x, url } : x))}
        />
      );
    if (isBlockKind(p.kind)) return <BlockBar part={p as BlockPart} onChange={(data) => update(p.key, (x) => ({ ...x, data }) as EditorPart)} />;
    return null;
  };
  const editable = (p: EditorPart, body?: ReactNode) => {
    if (p.kind === "UPLOAD") return uploadCard(p);
    const i = parts.indexOf(p);
    const name = partLabel(p, p.kind === "FILE" ? fileById.get(p.fileId) : undefined);
    return (
      <CanvaPiece
        key={p.key}
        active={selected === p.key || (panel?.kind === "piece" && panel.key === p.key)}
        design={p.design}
        onSelect={() => select(p)}
        bar={barOf(p)}
        tools={
          <>
            <PieceTool icon={Palette} title="Diseño" label={name} on={isOpen(p)} onClick={() => openPiece(p)} />
            <PieceTool icon={ArrowUp} title="Subir" label={name} disabled={i <= 0} onClick={() => movePart(p.key, -1)} />
            <PieceTool icon={ArrowDown} title="Bajar" label={name} disabled={i >= parts.length - 1} onClick={() => movePart(p.key, 1)} />
            <PieceTool icon={Copy} title="Duplicar" label={name} disabled={room <= 0} onClick={() => duplicatePart(p)} />
            <PieceTool icon={Trash2} title="Quitar" label={name} danger onClick={() => void removePart(p)} />
          </>
        }
      >
        {body ?? partEl(p)}
      </CanvaPiece>
    );
  };

  const addBar = (
    <div data-canva-ui className="mt-10 rounded-3xl border border-dashed border-gold/45 p-4 sm:p-5" data-lesson-add>
      <p className="text-sm font-semibold">{hasChapters ? `Añadir al capítulo ${ch + 1}` : "Añadir a la lección"}</p>
      {room > 0 ? (
        <>
          <p className="mt-3 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">Texto</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEXT_BUTTONS.map((b) => (
              <button key={b.as} type="button" className="btn btn-outline h-auto min-h-14 px-2 py-2" onClick={() => addText(b.as)}>
                <span className={b.cls}>{b.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">Vídeo, audio y archivos</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {MEDIA_BUTTONS.map((b) => (
              <button
                key={b.add}
                type="button"
                aria-pressed={panel?.kind === "add" && panel.add === b.add}
                className="btn btn-outline h-auto min-h-14 flex-col gap-1 px-1 py-2 text-xs aria-pressed:border-gold aria-pressed:text-gold"
                onClick={() => setPanel((cur) => (cur?.kind === "add" && cur.add === b.add ? null : { kind: "add", add: b.add }))}
              >
                <b.icon className="h-5 w-5" /> {b.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">Modelos principales</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MAIN_BUTTONS.map((b) => (
              <button key={b.model} type="button" className="btn btn-outline btn-sm" title={MODEL_LABEL[b.model]} onClick={() => addBlock("MAIN", b.model)}>
                <Sparkles className="h-4 w-4" /> {b.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">Otros modelos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["MODEL", "CHART", "MYCHART", "TODAY"] as const).map((k) => (
              <button key={k} type="button" className="btn btn-outline btn-sm" onClick={() => addBlock(k)}>
                <Sparkles className="h-4 w-4" /> {BLOCK_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">Para repasar</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["QUIZ", "GLOSSARY"] as const).map((k) => (
              <button key={k} type="button" className="btn btn-outline btn-sm" onClick={() => addBlock(k)}>
                <Sparkles className="h-4 w-4" /> {BLOCK_LABEL[k]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Una lección puede tener hasta {MAX_LESSON_PARTS} partes. Para más, crea otra lección.</p>
      )}
      {note && (
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );

  const flat = parts.slice(from);
  const intro = hasChapters ? parts.slice(from, markers[0]) : [];
  const chapterParts = hasChapters ? parts.slice(markers[ch] + 1, markers[ch + 1] ?? parts.length) : [];
  const chapterPart = hasChapters ? parts[markers[ch]] : null;
  const chData = chapterOf(ch);
  // Un capítulo nuevo: dorado y abajo a la izquierda, aparte de «Añadir» (que añade al capítulo abierto).
  const addChapter = (
    <button
      type="button"
      data-canva-ui
      className="btn btn-primary btn-sm"
      disabled={room <= 0}
      title={hasChapters ? `Un capítulo nuevo detrás del ${ch + 1}` : "Lo que ya tiene la lección pasa a ser el capítulo 1"}
      onClick={() => addBlock("CHAPTER")}
    >
      <Plus className="h-4 w-4" /> Añadir capítulo
    </button>
  );

  const body = hasChapters ? (
    <>
      {intro.length > 0 && <div className="mb-8 space-y-8">{intro.map((p) => editable(p))}</div>}
      {/* Un capítulo cada vez, a todo el ancho: se elige en el índice de la izquierda (o con los botones de abajo) y
          uno nuevo se añade con «Añadir capítulo», abajo a la izquierda. */}
      <div className="min-w-0">
        {chapterPart && (
          <CanvaPiece
            active={selected === chapterPart.key || (panel?.kind === "piece" && panel.key === chapterPart.key)}
            onSelect={() => select(chapterPart)}
            tools={
              <>
                <PieceTool icon={ArrowUp} title="Antes" label="Capítulo" disabled={ch === 0} onClick={() => moveChapter(ch, -1)} />
                <PieceTool icon={ArrowDown} title="Después" label="Capítulo" disabled={ch >= markers.length - 1} onClick={() => moveChapter(ch, 1)} />
                <PieceTool icon={Trash2} title="Quitar" label="Capítulo" danger onClick={() => void removePart(chapterPart)} />
              </>
            }
          >
            <p className="eyebrow">
              Capítulo {ch + 1} de {markers.length}
            </p>
            <h3 className="display mt-1 text-[1.9rem] leading-tight">
              <EditText value={chData.title} placeholder="Título del capítulo" onCommit={(v) => setChapterTitle(chapterPart.key, v)} />
            </h3>
          </CanvaPiece>
        )}
        <div className="mt-5 space-y-8">{chapterParts.length ? chapterParts.map((p) => editable(p)) : <p className="text-muted">Este capítulo aún no tiene contenido.</p>}</div>
        {addBar}
        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          {ch > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setChapter(ch - 1)}>
              <ArrowLeft className="h-4 w-4" /> Cap. {ch} · {chapterOf(ch - 1).title}
            </button>
          )}
          {ch < markers.length - 1 && (
            <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={() => setChapter(ch + 1)}>
              Cap. {ch + 2} · {chapterOf(ch + 1).title} <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {ch === markers.length - 1 && <p className="ml-auto text-sm text-muted">Has llegado al final de la lección ✦</p>}
        </div>
        <div className="mt-4">{addChapter}</div>
      </div>
    </>
  ) : (
    <>
      {flat.length ? (
        <div className="space-y-8">{flat.map((p) => editable(p))}</div>
      ) : (
        !lead && <p className="text-muted">Esta lección aún está vacía. Añade un título, un texto, un vídeo, un audio, un PDF o una imagen.</p>
      )}
      {addBar}
      <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-5">
        {addChapter}
        <span className="text-xs text-muted">Para una lección larga: lo que ya tiene pasa a ser el capítulo 1.</span>
      </div>
    </>
  );

  // ── Lo de los lados ──
  const lookError = courseLook.state.kind === "error" ? courseLook.state.error : null;
  const statusEl = (
    <span className="inline-flex shrink-0 items-center gap-1.5 px-1 text-xs" role="status">
      {uploading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> <span className="hidden sm:inline">Subiendo…</span>
        </>
      ) : save.kind === "error" ? (
        <button type="button" onClick={() => void doSave()} className="inline-flex items-center gap-1.5 font-semibold text-[#d0675b]" title={`No se ha guardado: ${save.error} Toca para reintentar.`}>
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> <span className="hidden max-w-[16rem] truncate sm:inline">No se ha guardado: {save.error}</span>
        </button>
      ) : lookError ? (
        <button type="button" onClick={() => void courseLook.flush()} className="inline-flex items-center gap-1.5 font-semibold text-[#d0675b]" title={`No se ha guardado el diseño: ${lookError}. Toca para reintentar.`}>
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> <span className="hidden max-w-[16rem] truncate sm:inline">No se ha guardado el diseño</span>
        </button>
      ) : !canSave ? (
        <span className="font-semibold text-[#e9cc8e]">Ponle un título</span>
      ) : save.kind === "saving" || dirty || leaving || pendingLook ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> <span className="hidden sm:inline">Guardando…</span>
        </>
      ) : save.kind === "saved" || courseLook.state.kind === "saved" ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" /> <span className="hidden sm:inline">Guardado</span>
        </>
      ) : (
        <span className="hidden max-w-[20rem] opacity-70 2xl:inline">Escribe encima de la lección: se guarda sola</span>
      )}
    </span>
  );

  const closePanel = () => setPanel(null);
  const panelPart = panel?.kind === "piece" ? (parts.find((p) => p.key === panel.key) ?? null) : null;
  let panelEl: CanvaPanel | null = null;
  if (panel?.kind === "design") {
    panelEl = {
      title: "Diseño",
      onClose: closePanel,
      body: <CourseDesignPanel scope={scope} setScope={setScope} course={courseLook.look} setCourse={courseLook.setLook} patch={design} setPatch={setDesign} />,
    };
  } else if (panel?.kind === "add") {
    const add = panel.add;
    const what = ADD_PART[add].label;
    panelEl = {
      title: `Añadir ${what === what.toUpperCase() ? what : what.toLowerCase()}`,
      onClose: closePanel,
      body: (
        <AddPartOptions
          add={add}
          files={files}
          uploadLabel={course.uploadLabel}
          onUpload={(list) => upload(add, list)}
          onPick={(fileId) => {
            const key = newKey();
            setPanel(null);
            insert([{ key, kind: "FILE", fileId }]);
            setSelected(key);
          }}
          onEmbed={() => {
            const key = newKey();
            // El enlace se pega en la barrita que sale encima del vídeo.
            setPanel(null);
            insert([{ key, kind: "EMBED", url: "" }]);
            setSelected(key);
          }}
        />
      ),
    };
  } else if (panel?.kind === "piece" && panelPart && panelPart.kind !== "UPLOAD" && hasDesign(panelPart)) {
    // A la izquierda solo el diseño: el contenido se cambia encima de la pieza.
    const p = panelPart;
    panelEl = {
      title: `Diseño · ${partLabel(p, p.kind === "FILE" ? fileById.get(p.fileId) : undefined)}`,
      onClose: closePanel,
      body: (
        <div key={p.key}>
          <PieceDesignPanel look={p.design} onChange={(l) => setPieceLook(p.key, l)} text={p.kind === "TEXT" || isBlockKind(p.kind)} />
        </div>
      ),
    };
  }

  const notice = warning ? (
    <p>{warning}</p>
  ) : !published ? (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <span>
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#e9cc8e] align-middle" aria-hidden />
        Esta lección está en borrador: tus alumnas aún no la ven.
      </span>
      <button type="button" className="font-semibold text-[#e9cc8e] underline-offset-2 hover:underline" onClick={() => setPublished(true)}>
        Publicarla
      </button>
    </p>
  ) : null;

  return (
    <CourseCanvaShell
      course={shownCourse}
      board={liveBoard}
      onMoveChapter={moveChapterTo}
      current={{ lessonId: lesson.id, chapter: hasChapters ? ch : null }}
      navigate={(href) => void navigate(href)}
      status={statusEl}
      tools={<BarButton icon={Palette} label="Diseño" active={panel?.kind === "design"} onClick={() => togglePanel("design")} />}
      viewHref={viewHref}
      notice={notice}
      panel={panelEl}
      look={look}
      fonts={fonts}
    >
      {(device) => (
        // A la derecha, sitio para la columna de iconos de cada pieza (pegada a su borde, sin tapar nada).
        <div
          className={`mx-auto max-w-4xl pb-32 pl-5 pr-[3.75rem] sm:pl-8 sm:pr-[4.5rem] ${device === "movil" ? "pt-8" : "pt-24"}`}
          data-lesson-canva
          onClick={(e) => {
            // Al tocar fuera de las piezas, ninguna elegida.
            if (!(e.target as HTMLElement).closest(".canva-piece, [data-canva-ui]")) setSelected(null);
          }}
        >
          <h1 className="display text-[2.2rem] leading-tight sm:text-[2.8rem]">
            <EditText value={courseTitle} placeholder="Título del curso" onCommit={(v) => void renameCourse(v)} />
          </h1>
          <article className="mt-6 min-w-0 sm:mt-8">
            {lead &&
              editable(
                lead,
                <div className="overflow-hidden rounded-2xl bg-black sm:rounded-3xl" data-lesson-lead>
                  {(() => {
                    const pp = toPlayer(lead, fileById);
                    return pp ? (
                      <LeadPart key={lead.key} part={pp} lessonTitle={title} poster={course.imageUrl} personal={course.personal} />
                    ) : (
                      <Empty onClick={() => select(lead)}>Vídeo sin enlace: pega el de YouTube o Vimeo en la barrita de arriba.</Empty>
                    );
                  })()}
                </div>,
              )}
            {/* «Lección 3 de 9» y, a su lado, el estado (borrador o publicada) y eliminarla. */}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${lead ? "mt-6" : ""}`}>
              <p className="eyebrow">
                Lección {place.number} de {place.total}
              </p>
              <div className="flex flex-wrap items-center gap-1.5" data-canva-ui>
                <div className="inline-flex h-7 items-center rounded-full bg-white/90 p-0.5 shadow-soft ring-1 ring-black/5" role="radiogroup" aria-label="Estado de la lección">
                  {([false, true] as const).map((v) => {
                    const on = published === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPublished(v)}
                        title={v ? "La ven tus alumnas" : "Solo la ves tú"}
                        className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.7rem] font-semibold transition ${on ? (v ? "bg-[#e7f3ec] text-[#2f6b4a]" : "bg-[#f8efdc] text-[#8a6420]") : "text-muted hover:text-ink"}`}
                      >
                        {on && <span className={`h-1.5 w-1.5 rounded-full ${v ? "bg-[#2f6b4a]" : "bg-[#c99a3c]"}`} />}
                        {v ? "Publicada" : "Borrador"}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={removing}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[0.7rem] font-semibold text-[#b4473b] shadow-soft ring-1 ring-black/5 transition hover:bg-[#fbeeee] disabled:opacity-60"
                  title="Eliminar esta lección"
                >
                  {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Eliminar
                </button>
                {hasLookPatch(design) && (
                  <button
                    type="button"
                    onClick={() => {
                      setScope("lesson");
                      setPanel({ kind: "design" });
                    }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gold/40 px-2.5 text-[0.7rem] font-semibold text-gold"
                    title="Esta lección lleva su propio diseño"
                  >
                    <Palette className="h-3 w-3" /> Diseño propio
                  </button>
                )}
              </div>
            </div>
            <h2 ref={titleRef} className="display mt-2 text-[2rem] leading-tight">
              <EditText value={title} placeholder="Título de la lección" onCommit={(v) => setTitle(v.slice(0, 140) || title)} />
            </h2>
            <div className="mt-5">{body}</div>
          </article>
        </div>
      )}
    </CourseCanvaShell>
  );
}
