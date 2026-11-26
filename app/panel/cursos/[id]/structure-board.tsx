"use client";
import { askConfirm } from "@/components/ui/ask-confirm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Eye, FileText, GripVertical, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { PART_ICON } from "@/components/media/part-icons";
import { useHoverTip } from "@/components/ui/hover-tip";
import { dripDayFor, dripDayLabel, type DripSettings } from "@/lib/course-drip";
import type { PartView } from "@/lib/lesson-parts";
import {
  addStudioLesson,
  addStudioModule,
  deleteStudioLesson,
  deleteStudioModule,
  duplicateLesson,
  moveLessonChapter,
  renameStudioModule,
  reorderCourse,
  setLessonDripDays,
  setLessonPublished,
  type StudioResult,
} from "../actions";
import { Tr, useT } from "@/lib/i18n/client";

/** Un capítulo de una lección larga (su título y sus minutos). */
export type BoardChapter = { title: string };
export type BoardLesson = { id: string; title: string; durationMin: number | null; views: PartView[]; published: boolean; dripDays: number | null; chapters: BoardChapter[] };
export type BoardModule = { id: string; title: string; lessons: BoardLesson[] };

/** Lo que se arrastra: un módulo, una lección o un capítulo (de `lessonId`, el que estaba en `from`). */
type Drag = { kind: "lesson" | "module" | "chapter"; id: string; startY: number; y: number; lessonId?: string; from?: number };
type Target = { kind: "lesson"; moduleId: string; index: number } | { kind: "module"; index: number } | { kind: "chapter"; lessonId: string; index: number };

const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-sand hover:text-ink disabled:pointer-events-none disabled:opacity-25";
const chapterKey = (lessonId: string, i: number) => `ch:${lessonId}:${i}`;
/** Un capítulo de `from` a `to` (contando `to` sin él). */
function placeChapter<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [c] = next.splice(from, 1);
  next.splice(to, 0, c);
  return next;
}
const menuItem = "flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 hover:bg-sand disabled:opacity-40";

function layoutOf(mods: BoardModule[]) {
  return mods.map((m) => ({ id: m.id, lessons: m.lessons.map((l) => l.id) }));
}

/** Mueve una lección a (módulo, posición) contando la posición sin la propia lección. */
function placeLesson(mods: BoardModule[], id: string, moduleId: string, index: number): BoardModule[] {
  const lesson = mods.flatMap((m) => m.lessons).find((l) => l.id === id);
  if (!lesson) return mods;
  const without = mods.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== id) }));
  return without.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons.slice(0, index), lesson, ...m.lessons.slice(index)] } : m));
}

function placeModule(mods: BoardModule[], id: string, index: number): BoardModule[] {
  const mod = mods.find((m) => m.id === id);
  if (!mod) return mods;
  const without = mods.filter((m) => m.id !== id);
  return [...without.slice(0, index), mod, ...without.slice(index)];
}

/** Línea que marca dónde caerá lo que se arrastra (sin ocupar sitio: nada salta mientras se mueve). */
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

function DropLine({ at = "top" }: { at?: "top" | "bottom" }) {
  return <span aria-hidden className={`pointer-events-none absolute inset-x-2 z-10 h-[3px] rounded-full bg-lavender-deep ${at === "top" ? "-top-[2px]" : "-bottom-[2px]"}`} data-drop-line />;
}

/**
 * Estructura del curso, en escalera (sin tarjetas): el módulo a la izquierda, sus lecciones un poco a la derecha y,
 * debajo de cada lección, sus capítulos un poco más a la derecha. Se reordena arrastrando del asa (ratón o dedo; las
 * lecciones también de un módulo a otro) o con los botones ↑/↓ (teclado y lectores de pantalla:
 * en el borde de un módulo, la lección pasa al de al lado). Cada lección tiene su estado (Borrador /
 * Publicada), se duplica, se abre como alumna o se elimina. El orden se guarda entero de una vez
 * (reorderCourse) y, si falla, vuelve a como estaba. «Añadir lección» la crea al momento y la abre en el editor.
 *
 * Los capítulos de una lección también se reordenan arrastrándolos (con el ratón), dentro de su lección.
 *
 * `compact`: el índice estrecho de la izquierda del editor de lecciones. Solo los números (en el ordenador; el título
 * sale al pasar el ratón; en el móvil, con sus títulos), sin asas, sin minutos y sin menús: un módulo se mueve
 * arrastrando su número, y una lección o un capítulo, arrastrándolos enteros. El nombre de un módulo, borrarlo o
 * cambiar una lección de estado se hace en «Estructura» o en la propia lección. La lección (y el capítulo) que se
 * edita sale resaltada.
 */
export function StructureBoard({
  productId,
  modules,
  drip,
  compact = false,
  current = null,
  navigate,
  onMoveChapter,
}: {
  productId: string;
  modules: BoardModule[];
  drip: DripSettings;
  compact?: boolean;
  /** La lección abierta en el editor y su capítulo (null si no tiene capítulos). */
  current?: { lessonId: string; chapter: number | null } | null;
  /** Ir a otra lección o capítulo (el editor guarda antes lo que le falte). Sin él, enlaces normales. */
  navigate?: (href: string) => void;
  /** Mover un capítulo de la lección abierta: lo hace el editor (la lección se guarda entera desde allí). */
  onMoveChapter?: (from: number, to: number) => void;
}) {
  const router = useRouter();
  const headingId = useId();
  const [mods, setMods] = useState(modules);
  const [msg, setMsg] = useState<StudioResult | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ drag: Drag; target: Target | null } | null>(null);
  // Tras arrastrar una lección o un capítulo enteros, el clic de al soltarlos no los abre.
  const dragged = useRef(false);
  const tip = useHoverTip();

  // Lo que llega del servidor (tras guardar o desde otra pantalla) manda.
  const serverKey = JSON.stringify(modules);
  useEffect(() => setMods(modules), [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar el menú «…» al pulsar fuera o con Escape.
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest?.(`[data-menu="${menu}"]`)) setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const go = (href: string) => (navigate ? navigate(href) : router.push(href));
  // Un enlace del índice: con `navigate`, lo lleva el editor (sin perder lo que se está guardando).
  const follow = (href: string) => (e: React.MouseEvent) => {
    if (dragged.current) return e.preventDefault();
    if (!navigate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };

  const run = <R extends StudioResult>(key: string, fn: () => Promise<R>, after?: (r: R) => void) => {
    setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      setMsg(r);
      after?.(r);
    });
  };

  const persist = (next: BoardModule[], say: string) => {
    const prev = mods;
    if (JSON.stringify(layoutOf(prev)) === JSON.stringify(layoutOf(next))) return;
    setMods(next);
    setAnnounce(say);
    start(async () => {
      const r = await reorderCourse(productId, layoutOf(next));
      if (r.error) {
        setMods(prev);
        setMsg(r);
      } else setMsg(null);
    });
  };

  // ── Teclado (↑/↓) ──
  const moveLesson = (mi: number, li: number, dir: -1 | 1) => {
    const m = mods[mi];
    const lesson = m.lessons[li];
    let next: BoardModule[];
    let where: string;
    if (li + dir >= 0 && li + dir < m.lessons.length) {
      next = placeLesson(mods, lesson.id, m.id, li + dir);
      where = `posición ${li + dir + 1} del módulo ${mi + 1}`;
    } else {
      const other = mods[mi + dir];
      if (!other) return;
      next = placeLesson(mods, lesson.id, other.id, dir === -1 ? other.lessons.length : 0);
      where = `módulo ${mi + dir + 1}, ${dir === -1 ? "al final" : "al principio"}`;
    }
    persist(next, `«${lesson.title}» movida a la ${where}`);
    // El foco sigue en el mismo botón de la lección movida.
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-lesson-id="${lesson.id}"] [data-move="${dir === -1 ? "up" : "down"}"]`)?.focus());
  };
  const moveModule = (mi: number, dir: -1 | 1) => {
    if (!mods[mi + dir]) return;
    const m = mods[mi];
    persist(placeModule(mods, m.id, mi + dir), `Módulo «${m.title}» movido a la posición ${mi + dir + 1}`);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-module-id="${m.id}"] [data-move-module="${dir === -1 ? "up" : "down"}"]`)?.focus());
  };
  /** Un capítulo a otro sitio de su lección (con todo lo que tiene dentro). */
  const moveChapter = (lessonId: string, from: number, to: number) => {
    if (from === to) return;
    const lesson = mods.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    if (!lesson) return;
    setAnnounce(`Capítulo ${from + 1} de «${lesson.title}» movido a la posición ${to + 1}`);
    // El de la lección abierta lo mueve el editor (que guarda la lección entera).
    if (onMoveChapter && current?.lessonId === lessonId) return onMoveChapter(from, to);
    const prev = mods;
    setMods(mods.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, chapters: placeChapter(l.chapters, from, to) } : l)) })));
    start(async () => {
      const r = await moveLessonChapter(lessonId, from, to);
      if (r.error) {
        setMods(prev);
        setMsg(r);
      } else setMsg(null);
    });
  };

  // ── Arrastrar (ratón y dedo, con el asa) ──
  const computeTarget = (d: Drag): Target | null => {
    const board = boardRef.current;
    if (!board) return null;
    const y = d.y;
    if (d.kind === "chapter") {
      // Dentro de su lección: cuántos capítulos (sin él) quedan por encima.
      const rows = [...board.querySelectorAll<HTMLElement>(`[data-lesson-id="${d.lessonId}"] [data-chapter-row]`)].filter((r) => r.dataset.chapterRow !== d.id);
      const index = rows.filter((row) => {
        const r = row.getBoundingClientRect();
        return r.top + r.height / 2 < y;
      }).length;
      return { kind: "chapter", lessonId: d.lessonId!, index };
    }
    const cards = [...board.querySelectorAll<HTMLElement>("[data-module-id]")];
    if (d.kind === "module") {
      const others = cards.filter((c) => c.dataset.moduleId !== d.id);
      const index = others.filter((c) => {
        const r = c.getBoundingClientRect();
        return r.top + r.height / 2 < y;
      }).length;
      return { kind: "module", index };
    }
    if (!cards.length) return null;
    let card = cards.find((c) => {
      const r = c.getBoundingClientRect();
      return y >= r.top && y <= r.bottom;
    });
    if (!card) card = y < cards[0].getBoundingClientRect().top ? cards[0] : cards[cards.length - 1];
    const rows = [...card.querySelectorAll<HTMLElement>("[data-lesson-id]")].filter((r) => r.dataset.lessonId !== d.id);
    const index = rows.filter((row) => {
      const r = row.getBoundingClientRect();
      return r.top + r.height / 2 < y;
    }).length;
    return { kind: "lesson", moduleId: card.dataset.moduleId!, index };
  };

  const startDrag = (e: React.PointerEvent, kind: Drag["kind"], id: string) => {
    if (e.button !== 0 || pending) return;
    e.preventDefault();
    setMenu(null);
    const d: Drag = { kind, id, startY: e.clientY, y: e.clientY };
    dragRef.current = { drag: d, target: null };
    setDrag(d);
  };

  // Sin asa: una lección (en el índice estrecho) o un capítulo se arrastran enteros con el ratón en cuanto se mueven
  // unos píxeles (un clic sin moverlos los abre, como siempre). Con el dedo no, para poder desplazar el índice.
  const pressDrag = (e: React.PointerEvent, what: Pick<Drag, "kind" | "id" | "lessonId" | "from">) => {
    if (e.button !== 0 || e.pointerType === "touch" || pending) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 6) return;
      stop();
      dragged.current = true;
      setMenu(null);
      tip.hide();
      const d: Drag = { ...what, startY: y0, y: ev.clientY };
      dragRef.current = { drag: d, target: null };
      setDrag(d);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  useEffect(() => {
    if (!drag) return;
    let raf = 0;
    const tick = () => {
      const cur = dragRef.current;
      if (!cur) return;
      // Cerca del borde, se desplaza solo: la página o, en el índice del editor, su caja.
      const edge = 70;
      const y = cur.drag.y;
      const box = boardRef.current?.closest<HTMLElement>("[data-board-scroll]");
      if (box) {
        const r = box.getBoundingClientRect();
        if (y < r.top + edge) box.scrollBy(0, -Math.ceil((r.top + edge - y) / 5));
        else if (y > r.bottom - edge) box.scrollBy(0, Math.ceil((y - (r.bottom - edge)) / 5));
      } else if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 5));
      else if (y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((y - (window.innerHeight - edge)) / 5));
      const t = computeTarget(cur.drag);
      if (JSON.stringify(t) !== JSON.stringify(cur.target)) {
        cur.target = t;
        setTarget(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current.drag = { ...dragRef.current.drag, y: e.clientY };
      setDrag(dragRef.current.drag);
    };
    const end = (e: PointerEvent) => {
      const cur = dragRef.current;
      dragRef.current = null;
      cancelAnimationFrame(raf);
      setDrag(null);
      setTarget(null);
      // El clic que llega justo después de soltar no cuenta.
      window.setTimeout(() => (dragged.current = false), 0);
      if (!cur || e.type === "pointercancel" || !cur.target) return;
      const t = cur.target;
      if (t.kind === "module" && cur.drag.kind === "module") {
        const m = mods.find((x) => x.id === cur.drag.id)!;
        persist(placeModule(mods, cur.drag.id, t.index), `Módulo «${m.title}» movido a la posición ${t.index + 1}`);
      } else if (t.kind === "lesson" && cur.drag.kind === "lesson") {
        const l = mods.flatMap((x) => x.lessons).find((x) => x.id === cur.drag.id)!;
        const mi = mods.findIndex((x) => x.id === t.moduleId);
        persist(placeLesson(mods, cur.drag.id, t.moduleId, t.index), `«${l.title}» movida a la posición ${t.index + 1} del módulo ${mi + 1}`);
      } else if (t.kind === "chapter" && cur.drag.kind === "chapter" && cur.drag.from != null) {
        moveChapter(t.lessonId, cur.drag.from, t.index);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    // Solo al empezar y terminar de arrastrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.kind]);

  // Día de apertura de cada lección publicada, en el orden de ahora (se ve al momento al moverla).
  const dripLabels = useMemo(() => {
    const out = new Map<string, string>();
    if (!drip.mode) return out;
    mods.flatMap((m) => m.lessons).filter((l) => l.published).forEach((l, i) => out.set(l.id, dripDayLabel(dripDayFor(drip, i, l.dripDays))));
    return out;
  }, [mods, drip]);

  const total = mods.reduce((a, m) => a + m.lessons.length, 0);
  const drafts = mods.reduce((a, m) => a + m.lessons.filter((l) => !l.published).length, 0);
  const editBase = `/panel/cursos/${productId}/lecciones`;
  const lift = (id: string) => (drag?.id === id ? { transform: `translateY(${drag.y - drag.startY}px)`, zIndex: 30, position: "relative" as const } : undefined);
  // Lo que se resalta en el editor: la lección abierta y su capítulo.
  const here = "bg-[rgb(217_191_140/.14)] shadow-[inset_2px_0_0_#d9bf8c]";

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={headingId} className={compact ? "sr-only" : "font-semibold"}><Tr s={"Módulos y lecciones"} /></h2>
          {/* Las cifras, en cápsulas doradas; el orden se cambia arrastrando (desde los puntitos o, en el índice estrecho, la lección entera). */}
          {/* En el índice estrecho del ordenador no caben: solo en el móvil (y en «Estructura»). */}
          <p
            className={`flex flex-wrap gap-1.5 text-xs ${compact ? "lg:hidden" : "mt-2"}`}
            title={compact ? "Arrastra el número de un módulo, una lección o un capítulo para cambiar el orden." : "Arrastra desde los puntitos o usa las flechas para cambiar el orden."}
          >
            <span className="studio-count">{mods.length} {mods.length === 1 ? <Tr s={"módulo"} /> : <Tr s={"módulos"} />}</span>
            <span className="studio-count">{total} {total === 1 ? <Tr s={"lección"} /> : "lecciones"}</span>
            {drafts > 0 && <span className="studio-count is-draft">{drafts}{" "}<Tr s={"en borrador"} /></span>}
          </p>
        </div>
        <p className={`text-xs text-muted ${compact ? "" : "min-h-5"}`} aria-live="polite">
          {pending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}<Tr s={"Guardando…"} /></span>
          ) : (
            // Estrecho, el aviso de lo movido solo lo oyen los lectores de pantalla.
            <span className={compact ? "sr-only" : ""}><Tr s={announce} /></span>
          )}
        </p>
      </div>
      {msg?.error && (
        <p className={`mt-3 rounded-xl border border-[#f0d2cc] bg-[#fbe9e6] text-[#9a3a2e] ${compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"}`} role="alert">
          <Tr s={msg.error} />
        </p>
      )}
      {msg?.ok && !pending && !compact && (
        <p className={`mt-3 rounded-xl bg-[#e7f3ec] text-[#2f6b4a] ${compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"}`} role="status">
          <Tr s={msg.ok} />
        </p>
      )}

      <div ref={boardRef} className={`${compact ? "mt-3 space-y-4" : "mt-4 space-y-6"} ${drag ? "select-none" : ""}`} data-structure-board>
        {mods.map((m, mi) => {
          const showModuleLine = target?.kind === "module" && drag?.kind === "module";
          const others = mods.filter((x) => x.id !== drag?.id);
          const otherIndex = others.findIndex((x) => x.id === m.id);
          const lineTop = showModuleLine && drag?.id !== m.id && otherIndex === target.index;
          const lineBottom = showModuleLine && drag?.id !== m.id && otherIndex === others.length - 1 && target.index === others.length;
          const lessonTarget = target?.kind === "lesson" && target.moduleId === m.id ? target.index : null;
          const rest = m.lessons.filter((l) => l.id !== drag?.id);
          return (
            <div
              key={m.id}
              // Sin tarjeta: solo al arrastrarlo (o al soltar una lección en él) se ve su recuadro.
              className={`relative rounded-2xl transition-shadow ${m.lessons.some((l) => l.id === menu) || menu === `m:${m.id}` ? "z-20" : ""} ${drag?.id === m.id ? "bg-paper shadow-lift ring-2 ring-lavender-deep" : ""} ${lessonTarget !== null && drag?.kind === "lesson" ? "ring-2 ring-[#d9cdf0]" : ""}`}
              style={lift(m.id)}
              data-module-id={m.id}
              data-module
            >
              {lineTop && <DropLine />}
              {lineBottom && <DropLine at="bottom" />}
              {compact ? (
                // Estrecho: solo su número, que es también el asa para arrastrarlo (su nombre, al pasar el ratón; en
                // el móvil, al lado).
                <div className="flex items-center gap-1 py-1">
                  <span
                    className="studio-num shrink-0 cursor-grab touch-none active:cursor-grabbing"
                    aria-label={`Módulo ${mi + 1}: ${m.title}`}
                    tabIndex={0}
                    onPointerDown={(e) => {
                      tip.hide();
                      startDrag(e, "module", m.id);
                    }}
                    data-drag-module
                    {...tip.on({ sub: `Módulo ${ROMAN[mi] ?? mi + 1} · ${m.lessons.length} ${m.lessons.length === 1 ? "lección" : "lecciones"}`, title: m.title })}
                  >
                    <Tr s={ROMAN[mi] ?? mi + 1} />
                  </span>
                  <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold lg:hidden">{m.title}</span>
                </div>
              ) : (
              <div className="flex items-center gap-1 py-1 pr-2">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className="grid h-10 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-faint hover:bg-sand hover:text-ink active:cursor-grabbing"
                  onPointerDown={(e) => startDrag(e, "module", m.id)}
                  title="Arrastra para mover el módulo"
                  data-drag-module
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <span className="studio-num shrink-0" aria-label={`Módulo ${mi + 1}`}><Tr s={ROMAN[mi] ?? mi + 1} /></span>
                <ModuleName id={m.id} title={m.title} onSaved={(r) => setMsg(r)} />
                <button type="button" className={iconBtn} disabled={mi === 0} onClick={() => moveModule(mi, -1)} aria-label={`Subir el módulo «${m.title}»`} data-move-module="up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" className={iconBtn} disabled={mi === mods.length - 1} onClick={() => moveModule(mi, 1)} aria-label={`Bajar el módulo «${m.title}»`} data-move-module="down">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`${iconBtn} hover:text-rose`}
                  disabled={pending}
                  aria-label={`Eliminar el módulo «${m.title}»`}
                  onClick={async () => {
                    if (!(await askConfirm(m.lessons.length ? `¿Eliminar «${m.title}» y sus ${m.lessons.length} lecciones? Tus alumnas perderán su progreso en ellas.` : `¿Eliminar «${m.title}»?`))) return;
                    const hadCurrent = !!current && m.lessons.some((l) => l.id === current.lessonId);
                    run(`m-del-${m.id}`, () => deleteStudioModule(m.id), (r) => {
                      if (!r.error && hadCurrent) go(editBase);
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              )}

              {/* Las lecciones, un poco a la derecha del módulo, colgando de una línea que baja desde su número. */}
              <ul className={compact ? "studio-tree ml-[1.05rem] pl-1" : "studio-tree ml-[1.1rem] pl-1.5 sm:ml-[3.3rem] sm:pl-2"} aria-label={`Lecciones de «${m.title}»`}>
                {m.lessons.map((l, li) => {
                  const restIndex = rest.findIndex((x) => x.id === l.id);
                  const lineHere = lessonTarget !== null && drag?.id !== l.id && restIndex === lessonTarget;
                  const lineAfter = lessonTarget !== null && drag?.id !== l.id && restIndex === rest.length - 1 && lessonTarget === rest.length;
                  const draftTag = compact && !l.published;
                  const dripTag = dripLabels.get(l.id) ?? null;
                  const first = mi === 0 && li === 0;
                  const last = mi === mods.length - 1 && li === m.lessons.length - 1;
                  const open = current?.lessonId === l.id;
                  const href = `${editBase}/${l.id}`;
                  return (
                    <li
                      key={l.id}
                      className={`relative py-0.5 text-sm ${drag?.id === l.id ? "rounded-xl bg-paper shadow-lift ring-2 ring-lavender-deep" : ""}`}
                      style={lift(l.id)}
                      data-lesson-id={l.id}
                      data-lesson-row
                    >
                      {lineHere && <DropLine />}
                      <div className={`flex items-center gap-1 ${compact ? "" : "pr-1.5 sm:pr-2"}`}>
                      {lineAfter && <DropLine at="bottom" />}
                      {!compact && (
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-hidden
                          className="grid h-10 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-faint hover:bg-sand hover:text-ink active:cursor-grabbing"
                          onPointerDown={(e) => startDrag(e, "lesson", l.id)}
                          title="Arrastra para mover la lección"
                          data-drag-lesson
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                      )}
                      <Link
                        href={href}
                        onClick={follow(href)}
                        onPointerDown={compact ? (e) => pressDrag(e, { kind: "lesson", id: l.id }) : undefined}
                        aria-current={open && (current?.chapter == null || !l.chapters.length) ? "page" : undefined}
                        aria-label={compact ? `Lección ${li + 1}: ${l.title}${l.published ? "" : " (borrador)"}` : undefined}
                        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 ${compact ? "select-none" : ""} ${open ? here : "hover:bg-sand/60"}`}
                        draggable={false}
                        data-drag-lesson={compact ? "" : undefined}
                        {...(compact
                          ? tip.on({
                              sub: [`Lección ${li + 1}`, l.views.length ? null : "Vacía", l.published ? null : "Borrador", dripTag].filter(Boolean).join(" · "),
                              title: l.title,
                            })
                          : {})}
                      >
                        {/* En borrador, su número con el borde de rayas. */}
                        <span className={`studio-lnum shrink-0 ${compact && !l.published ? "is-draft" : ""}`} aria-hidden>
                          {li + 1}
                        </span>
                        {!compact && (
                          <span className="hidden w-8 shrink-0 grid-cols-2 gap-0.5 text-gold sm:grid" aria-hidden>
                            {l.views.slice(0, 4).map((v) => {
                              const Icon = PART_ICON[v];
                              return <Icon key={v} className="h-3.5 w-3.5" />;
                            })}
                            {l.views.length === 0 && <FileText className="h-3.5 w-3.5 opacity-40" />}
                          </span>
                        )}
                        {/* Estrecho (ordenador): sin su título (sale al pasar el ratón). En el móvil, con él. */}
                        <span className={`min-w-0 flex-1 ${compact ? "lg:hidden" : ""}`}>
                          <span className="line-clamp-2 block font-medium leading-snug">{l.title}</span>
                          {(!l.views.length || draftTag || dripTag) && (
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-faint">
                              {!l.views.length && (
                                <span className="inline-flex rounded-full border border-[#ecdcb8] bg-[#fbf5e8] px-2 py-0.5 text-[0.7rem] font-semibold text-[#7a5a1c]"><Tr s={"Vacía"} /></span>
                              )}
                              {draftTag && <span className="font-semibold text-[#ebd29c]"><Tr s={"Borrador"} /></span>}
                              {dripTag && <span className="text-lavender-deep"><Tr s={draftTag ? "· " : ""} /><Tr s={dripTag} /></span>}
                            </span>
                          )}
                        </span>
                      </Link>
                      {!compact && (
                        <>
                          <button
                            type="button"
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.72rem] font-semibold transition ${l.published ? "bg-[#e7f3ec] text-[#2f6b4a] hover:bg-[#d8ecdf]" : "bg-[#f8efdc] text-[#8a6420] hover:bg-[#f1e3c6]"}`}
                            aria-pressed={l.published}
                            aria-label={`${l.published ? "Publicada" : "Borrador"}: «${l.title}». Pulsa para ${l.published ? "pasarla a borrador" : "publicarla"}`}
                            disabled={pending}
                            onClick={() => run(`pub-${l.id}`, () => setLessonPublished(l.id, !l.published))}
                            data-lesson-status={l.published ? "published" : "draft"}
                          >
                            {busy === `pub-${l.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${l.published ? "bg-[#2f6b4a]" : "bg-[#c99a3c]"}`} />}
                            {l.published ? <Tr s={"Publicada"} /> : <Tr s={"Borrador"} />}
                          </button>
                          <button type="button" className={`${iconBtn} hidden sm:grid`} disabled={first} onClick={() => moveLesson(mi, li, -1)} aria-label={`Subir «${l.title}»`} data-move="up">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" className={`${iconBtn} hidden sm:grid`} disabled={last} onClick={() => moveLesson(mi, li, 1)} aria-label={`Bajar «${l.title}»`} data-move="down">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {!compact && (
                      <div className="relative" data-menu={l.id}>
                        <button
                          type="button"
                          className={iconBtn}
                          aria-haspopup="menu"
                          aria-expanded={menu === l.id}
                          aria-label={`Más acciones de «${l.title}»`}
                          onClick={() => setMenu(menu === l.id ? null : l.id)}
                        >
                          {busy === `pub-${l.id}` || busy === `dup-${l.id}` || busy === `del-${l.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </button>
                        {menu === l.id && (
                          <div role="menu" className="absolute right-0 top-10 z-40 w-60 rounded-2xl border border-line bg-white p-1.5 text-sm shadow-lift animate-fade-in">
                            {!open && (
                              <Link role="menuitem" href={href} onClick={follow(href)} className={menuItem}>
                                <Pencil className="h-4 w-4 text-muted" />{" "}<Tr s={"Editar"} /></Link>
                            )}
                            <button role="menuitem" type="button" className={`${menuItem} sm:hidden`} disabled={first} onClick={() => (setMenu(null), moveLesson(mi, li, -1))}>
                              <ArrowUp className="h-4 w-4 text-muted" />{" "}<Tr s={"Subir"} /></button>
                            <button role="menuitem" type="button" className={`${menuItem} sm:hidden`} disabled={last} onClick={() => (setMenu(null), moveLesson(mi, li, 1))}>
                              <ArrowDown className="h-4 w-4 text-muted" />{" "}<Tr s={"Bajar"} /></button>
                            <button
                              role="menuitem"
                              type="button"
                              className={menuItem}
                              onClick={() => {
                                setMenu(null);
                                run(`dup-${l.id}`, () => duplicateLesson(l.id));
                              }}
                            >
                              <Copy className="h-4 w-4 text-muted" />{" "}<Tr s={"Duplicar"} /></button>
                            <a role="menuitem" href={`/area/courses/${productId}?leccion=${l.id}`} target="_blank" rel="noopener" className={menuItem}>
                              <Eye className="h-4 w-4 text-muted" />{" "}<Tr s={"Ver como alumna"} /></a>
                            {drip.mode === "LESSON" && <DripDaysField lesson={l} onSaved={(r) => setMsg(r)} />}
                            <button
                              role="menuitem"
                              type="button"
                              className={`${menuItem} text-[#9a3a2e] hover:bg-[#fbe9e6]`}
                              onClick={async () => {
                                setMenu(null);
                                if (!(await askConfirm(`¿Eliminar «${l.title}»? Tus alumnas perderán su progreso en ella.`))) return;
                                run(`del-${l.id}`, () => deleteStudioLesson(l.id), (r) => {
                                  if (!r.error && open) go(editBase);
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />{" "}<Tr s={"Eliminar"} /></button>
                          </div>
                        )}
                      </div>
                      )}
                      </div>
                      {/* Sus capítulos, un poco más a la derecha, colgando del número de la lección. Al tocarlo, se abre ese
                          capítulo; arrastrándolo (con el ratón), cambia de sitio dentro de la lección. */}
                      {l.chapters.length > 0 && (
                        <ol className={`studio-tree mb-1 ${compact ? "ml-[1rem] pl-1.5" : "ml-[3.25rem] pl-2"}`} aria-label={`Capítulos de «${l.title}»`}>
                          {l.chapters.map((c, ci) => {
                            const chHref = `${href}?capitulo=${ci}`;
                            const on = open && current?.chapter === ci;
                            const key = chapterKey(l.id, ci);
                            // Dónde caerá el capítulo que se arrastra (contando sin él).
                            const chTarget = target?.kind === "chapter" && target.lessonId === l.id ? target.index : null;
                            const moving = drag?.kind === "chapter" && drag.lessonId === l.id ? (drag.from ?? -1) : -1;
                            const restCount = moving >= 0 ? l.chapters.length - 1 : l.chapters.length;
                            const restIndex = moving >= 0 && ci > moving ? ci - 1 : ci;
                            const lineTop = chTarget !== null && ci !== moving && restIndex === chTarget;
                            const lineBottom = chTarget !== null && ci !== moving && restIndex === restCount - 1 && chTarget === restCount;
                            return (
                              <li key={ci} className="relative" style={lift(key)} data-chapter-row={key}>
                                {lineTop && <DropLine />}
                                {lineBottom && <DropLine at="bottom" />}
                                <Link
                                  href={chHref}
                                  onClick={follow(chHref)}
                                  onPointerDown={(e) => pressDrag(e, { kind: "chapter", id: key, lessonId: l.id, from: ci })}
                                  aria-current={on ? "page" : undefined}
                                  aria-label={compact ? `Capítulo ${ci + 1}: ${c.title}` : undefined}
                                  className={`flex select-none items-center gap-2 rounded-lg px-1.5 py-1 ${compact ? "min-h-7" : "min-h-8 text-[0.82rem]"} ${drag?.id === key ? "bg-paper shadow-lift ring-2 ring-lavender-deep" : on ? here : "hover:bg-sand/60"}`}
                                  draggable={false}
                                  {...(compact ? tip.on({ sub: `Capítulo ${ci + 1}`, title: c.title }) : {})}
                                >
                                  <span className="shrink-0 whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-gold"><Tr s={"Cap."} />{" "}{ci + 1}</span>
                                  <span className={`min-w-0 flex-1 truncate ${compact ? "text-[0.82rem] lg:hidden" : ""}`}>{c.title}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </li>
                  );
                })}
                {(m.lessons.length === 0 || (rest.length === 0 && drag?.kind === "lesson")) && (
                  <li className="relative py-3 pl-2 text-xs text-muted">
                    {lessonTarget === 0 && <DropLine />}
                    {drag?.kind === "lesson" ? (compact ? <Tr s={"Suelta aquí"} /> : <Tr s={"Suelta aquí la lección"} />) : compact ? <Tr s={"Sin lecciones"} /> : <Tr s={"Este módulo aún no tiene lecciones."} />}
                  </li>
                )}
                <li className="pt-1">
                  <button
                    type="button"
                    // Estrecho (ordenador): un «+» redondo, a la altura de los números de las lecciones.
                    className={
                      compact
                        ? "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm text-muted transition hover:bg-sand/60 hover:text-ink lg:ml-1 lg:h-6 lg:min-h-0 lg:w-6 lg:justify-center lg:border lg:border-dashed lg:border-[#d9bf8c]/50 lg:px-0 lg:hover:border-[#d9bf8c]"
                        : "btn btn-ghost btn-sm"
                    }
                    disabled={busy === `add-${m.id}`}
                    aria-label={`Añadir lección a «${m.title}»`}
                    onClick={() =>
                      run(`add-${m.id}`, () => addStudioLesson(productId, m.id), (r) => {
                        if (r.lessonId) go(`${editBase}/${r.lessonId}?nueva=1`);
                      })
                    }
                    {...(compact ? tip.on({ sub: `Módulo ${ROMAN[mi] ?? mi + 1}`, title: "Añadir lección" }) : {})}
                  >
                    {busy === `add-${m.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />}
                    <span className={compact ? "lg:sr-only" : ""}><Tr s={"Añadir lección"} /></span>
                  </button>
                </li>
              </ul>
            </div>
          );
        })}
      </div>

      {compact ? (
        // Estrecho: un módulo nuevo al momento, con su nombre de siempre («Módulo 3»; se cambia en «Estructura»).
        <AddModuleButton productId={productId} count={mods.length} onSaved={(r) => setMsg(r)} tipOn={tip.on} />
      ) : (
        <AddModule productId={productId} count={mods.length} compact={compact} onSaved={(r) => setMsg(r)} />
      )}
      {tip.node}
    </section>
  );
}

function AddModuleButton({ productId, count, onSaved, tipOn }: { productId: string; count: number; onSaved: (r: StudioResult) => void; tipOn: ReturnType<typeof useHoverTip>["on"] }) {
  const [saving, start] = useTransition();
  return (
    <button
      type="button"
      className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm text-muted transition hover:bg-sand/60 hover:text-ink lg:h-[2.1rem] lg:min-h-0 lg:w-[2.1rem] lg:justify-center lg:border lg:border-dashed lg:border-[#d9bf8c]/50 lg:px-0 lg:hover:border-[#d9bf8c]"
      disabled={saving}
      aria-label={`Añadir el módulo ${count + 1}`}
      onClick={() => start(async () => onSaved(await addStudioModule(productId, "")))}
      {...tipOn({ sub: `Módulo ${ROMAN[count] ?? count + 1}`, title: "Añadir módulo" })}
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      <span className="lg:sr-only"><Tr s={"Añadir módulo"} /></span>
    </button>
  );
}

/** Nombre del módulo, editable en su sitio: se guarda al salir del campo o con Intro. */
function ModuleName({ id, title, onSaved }: { id: string; title: string; onSaved: (r: StudioResult) => void }) {
  const t = useT();
  const [value, setValue] = useState(title);
  const [saving, start] = useTransition();
  useEffect(() => setValue(title), [title]);
  const save = () => {
    const v = value.trim();
    if (!v || v === title) return setValue(title);
    start(async () => onSaved(await renameStudioModule(id, v)));
  };
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(title);
          (e.target as HTMLInputElement).blur();
        }
      }}
      maxLength={120}
      aria-label={t("Nombre del módulo")}
      disabled={saving}
      className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base font-semibold outline-none hover:bg-sand focus:bg-white focus:ring-1 focus:ring-line sm:text-sm"
    />
  );
}

function AddModule({ productId, count, compact, onSaved }: { productId: string; count: number; compact: boolean; onSaved: (r: StudioResult) => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [saving, start] = useTransition();
  return (
    <form
      className={`mt-4 flex gap-2 ${compact ? "flex-col" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addStudioModule(productId, name);
          onSaved(r);
          if (r.ok) setName("");
        });
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Módulo ${count + 1}`} aria-label={t("Nombre del módulo nuevo")} maxLength={120} className="input h-11 flex-1 text-base sm:text-sm" />
      <button className="btn btn-outline h-11" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}<Tr s={"Añadir módulo"} /></button>
    </form>
  );
}

/** «Disponible a los N días» dentro del menú (apertura por lección). */
function DripDaysField({ lesson, onSaved }: { lesson: BoardLesson; onSaved: (r: StudioResult) => void }) {
  const t = useT();
  const [value, setValue] = useState(lesson.dripDays ? String(lesson.dripDays) : "");
  const [saving, start] = useTransition();
  return (
    <form
      className="mx-1 my-1 rounded-xl bg-sand/70 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => onSaved(await setLessonDripDays(lesson.id, value ? Number(value) : null)));
      }}
    >
      <label className="text-xs font-semibold" htmlFor={`drip-${lesson.id}`}><Tr s={"Disponible a los … días"} /></label>
      <div className="mt-1.5 flex gap-1.5">
        <input
          id={`drip-${lesson.id}`}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          placeholder="0"
          className="input h-9 w-20 text-base sm:text-sm"
        />
        <button className="btn btn-primary btn-sm h-9" disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("Guardar")}
        </button>
      </div>
      <p className="mt-1 text-[0.7rem] text-muted"><Tr s={"Vacío o 0: desde el primer día."} /></p>
    </form>
  );
}
