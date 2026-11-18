"use client";
import { askConfirm } from "@/components/ui/ask-confirm";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, Eye, FileText, GripVertical, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PART_ICON } from "@/components/media/part-icons";
import { dripDayFor, dripDayLabel, type DripSettings } from "@/lib/course-drip";
import { partsLabel, type PartView } from "@/lib/lesson-parts";
import {
  addStudioModule,
  deleteStudioLesson,
  deleteStudioModule,
  duplicateLesson,
  renameStudioModule,
  reorderCourse,
  setLessonDripDays,
  setLessonPublished,
  type StudioResult,
} from "../actions";

export type BoardLesson = { id: string; title: string; durationMin: number | null; views: PartView[]; published: boolean; dripDays: number | null };
export type BoardModule = { id: string; title: string; lessons: BoardLesson[] };

type Drag = { kind: "lesson" | "module"; id: string; startY: number; y: number };
type Target = { kind: "lesson"; moduleId: string; index: number } | { kind: "module"; index: number };

const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-sand hover:text-ink disabled:pointer-events-none disabled:opacity-25";

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
 * Estructura del curso: módulos y lecciones. Se reordena arrastrando del asa (ratón o dedo; las
 * lecciones también de un módulo a otro) o con los botones ↑/↓ (teclado y lectores de pantalla:
 * en el borde de un módulo, la lección pasa al de al lado). Cada lección tiene su estado (Borrador /
 * Publicada), se duplica, se abre como alumna o se elimina. El orden se guarda entero de una vez
 * (reorderCourse) y, si falla, vuelve a como estaba.
 */
export function StructureBoard({ productId, modules, drip }: { productId: string; modules: BoardModule[]; drip: DripSettings }) {
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

  const run = (key: string, fn: () => Promise<StudioResult>, after?: (r: StudioResult) => void) => {
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

  // ── Arrastrar (ratón y dedo, con el asa) ──
  const computeTarget = (d: Drag): Target | null => {
    const board = boardRef.current;
    if (!board) return null;
    const y = d.y;
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

  useEffect(() => {
    if (!drag) return;
    let raf = 0;
    const tick = () => {
      const cur = dragRef.current;
      if (!cur) return;
      // Cerca del borde de la ventana, la página se desplaza sola.
      const edge = 70;
      const y = cur.drag.y;
      if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 5));
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
      if (!cur || e.type === "pointercancel" || !cur.target) return;
      const t = cur.target;
      if (t.kind === "module" && cur.drag.kind === "module") {
        const m = mods.find((x) => x.id === cur.drag.id)!;
        persist(placeModule(mods, cur.drag.id, t.index), `Módulo «${m.title}» movido a la posición ${t.index + 1}`);
      } else if (t.kind === "lesson" && cur.drag.kind === "lesson") {
        const l = mods.flatMap((x) => x.lessons).find((x) => x.id === cur.drag.id)!;
        const mi = mods.findIndex((x) => x.id === t.moduleId);
        persist(placeLesson(mods, cur.drag.id, t.moduleId, t.index), `«${l.title}» movida a la posición ${t.index + 1} del módulo ${mi + 1}`);
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

  return (
    <section aria-labelledby="estructura-titulo">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="estructura-titulo" className="font-semibold">
            Módulos y lecciones
          </h2>
          {/* Las cifras, en cápsulas doradas; el orden se cambia arrastrando desde los puntitos. */}
          <p className="mt-2 flex flex-wrap gap-1.5 text-xs" title="Arrastra desde los puntitos o usa las flechas para cambiar el orden.">
            <span className="studio-count">{mods.length} {mods.length === 1 ? "módulo" : "módulos"}</span>
            <span className="studio-count">{total} {total === 1 ? "lección" : "lecciones"}</span>
            {drafts > 0 && <span className="studio-count is-draft">{drafts} en borrador</span>}
          </p>
        </div>
        <p className="min-h-5 text-xs text-muted" aria-live="polite">
          {pending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
            </span>
          ) : (
            announce
          )}
        </p>
      </div>
      {msg?.error && (
        <p className="mt-3 rounded-xl border border-[#f0d2cc] bg-[#fbe9e6] px-4 py-2.5 text-sm text-[#9a3a2e]" role="alert">
          {msg.error}
        </p>
      )}
      {msg?.ok && !pending && (
        <p className="mt-3 rounded-xl bg-[#e7f3ec] px-4 py-2.5 text-sm text-[#2f6b4a]" role="status">
          {msg.ok}
        </p>
      )}

      <div ref={boardRef} className={`mt-4 space-y-4 ${drag ? "select-none" : ""}`} data-structure-board>
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
              className={`studio-module relative rounded-2xl border bg-white transition-shadow ${m.lessons.some((l) => l.id === menu) ? "z-20" : ""} ${drag?.id === m.id ? "border-lavender-deep shadow-lift" : "border-line"} ${lessonTarget !== null && drag?.kind === "lesson" ? "ring-2 ring-[#d9cdf0]" : ""}`}
              style={lift(m.id)}
              data-module-id={m.id}
              data-module
            >
              {lineTop && <DropLine />}
              {lineBottom && <DropLine at="bottom" />}
              <div className="flex items-center gap-1 border-b border-line py-2 pl-1 pr-2">
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
                <span className="studio-num shrink-0" aria-label={`Módulo ${mi + 1}`}>{ROMAN[mi] ?? mi + 1}</span>
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
                    run(`m-del-${m.id}`, () => deleteStudioModule(m.id));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <ul className="divide-y divide-line" aria-label={`Lecciones de «${m.title}»`}>
                {m.lessons.map((l, li) => {
                  const restIndex = rest.findIndex((x) => x.id === l.id);
                  const lineHere = lessonTarget !== null && drag?.id !== l.id && restIndex === lessonTarget;
                  const lineAfter = lessonTarget !== null && drag?.id !== l.id && restIndex === rest.length - 1 && lessonTarget === rest.length;
                  const label = partsLabel(l.views);
                  const first = mi === 0 && li === 0;
                  const last = mi === mods.length - 1 && li === m.lessons.length - 1;
                  return (
                    <li
                      key={l.id}
                      className={`relative flex items-center gap-1 bg-white py-1.5 pl-1 pr-1.5 text-sm sm:pr-2 ${drag?.id === l.id ? "rounded-xl shadow-lift ring-2 ring-lavender-deep" : ""}`}
                      style={lift(l.id)}
                      data-lesson-id={l.id}
                      data-lesson-row
                    >
                      {lineHere && <DropLine />}
                      {lineAfter && <DropLine at="bottom" />}
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
                      <Link href={`${editBase}/${l.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-sand/60" draggable={false}>
                        <span className="studio-lnum shrink-0" aria-hidden>{li + 1}</span>
                        <span className="hidden w-8 shrink-0 grid-cols-2 gap-0.5 text-gold sm:grid" aria-hidden>
                          {l.views.slice(0, 4).map((v) => {
                            const Icon = PART_ICON[v];
                            return <Icon key={v} className="h-3.5 w-3.5" />;
                          })}
                          {l.views.length === 0 && <FileText className="h-3.5 w-3.5 opacity-40" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block font-medium leading-snug">{l.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-faint">
                            {l.views.length ? (
                              <span>
                                {label}
                                {l.durationMin ? ` · ${l.durationMin} min` : ""}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-[#ecdcb8] bg-[#fbf5e8] px-2 py-0.5 text-[0.7rem] font-semibold text-[#7a5a1c]">Vacía</span>
                            )}
                            {dripLabels.get(l.id) && <span className="text-lavender-deep">· {dripLabels.get(l.id)}</span>}
                          </span>
                        </span>
                      </Link>
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
                        {l.published ? "Publicada" : "Borrador"}
                      </button>
                      <button type="button" className={`${iconBtn} hidden sm:grid`} disabled={first} onClick={() => moveLesson(mi, li, -1)} aria-label={`Subir «${l.title}»`} data-move="up">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" className={`${iconBtn} hidden sm:grid`} disabled={last} onClick={() => moveLesson(mi, li, 1)} aria-label={`Bajar «${l.title}»`} data-move="down">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <div className="relative" data-menu={l.id}>
                        <button
                          type="button"
                          className={iconBtn}
                          aria-haspopup="menu"
                          aria-expanded={menu === l.id}
                          aria-label={`Más acciones de «${l.title}»`}
                          onClick={() => setMenu(menu === l.id ? null : l.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menu === l.id && (
                          <div role="menu" className="absolute right-0 top-10 z-40 w-60 rounded-2xl border border-line bg-white p-1.5 text-sm shadow-lift animate-fade-in">
                            <Link role="menuitem" href={`${editBase}/${l.id}`} className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 hover:bg-sand">
                              <Pencil className="h-4 w-4 text-muted" /> Editar
                            </Link>
                            <button role="menuitem" type="button" className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 hover:bg-sand disabled:opacity-40 sm:hidden" disabled={first} onClick={() => (setMenu(null), moveLesson(mi, li, -1))}>
                              <ArrowUp className="h-4 w-4 text-muted" /> Subir
                            </button>
                            <button role="menuitem" type="button" className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 hover:bg-sand disabled:opacity-40 sm:hidden" disabled={last} onClick={() => (setMenu(null), moveLesson(mi, li, 1))}>
                              <ArrowDown className="h-4 w-4 text-muted" /> Bajar
                            </button>
                            <button
                              role="menuitem"
                              type="button"
                              className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 hover:bg-sand"
                              onClick={() => {
                                setMenu(null);
                                run(`dup-${l.id}`, () => duplicateLesson(l.id));
                              }}
                            >
                              <Copy className="h-4 w-4 text-muted" /> Duplicar
                            </button>
                            <a role="menuitem" href={`/cuenta/cursos/${productId}?leccion=${l.id}`} target="_blank" rel="noopener" className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 hover:bg-sand">
                              <Eye className="h-4 w-4 text-muted" /> Ver como alumna
                            </a>
                            {drip.mode === "LESSON" && <DripDaysField lesson={l} onSaved={(r) => setMsg(r)} />}
                            <button
                              role="menuitem"
                              type="button"
                              className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[#9a3a2e] hover:bg-[#fbe9e6]"
                              onClick={async () => {
                                setMenu(null);
                                if (!(await askConfirm(`¿Eliminar «${l.title}»? Tus alumnas perderán su progreso en ella.`))) return;
                                run(`del-${l.id}`, () => deleteStudioLesson(l.id));
                              }}
                            >
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {(m.lessons.length === 0 || (rest.length === 0 && drag?.kind === "lesson")) && (
                  <li className="relative px-4 py-5 text-center text-xs text-muted">
                    {lessonTarget === 0 && <DropLine />}
                    {drag?.kind === "lesson" ? "Suelta aquí la lección" : "Este módulo aún no tiene lecciones."}
                  </li>
                )}
              </ul>
              <div className="border-t border-line p-2.5">
                <Link href={`${editBase}/nueva?modulo=${m.id}`} className="btn btn-ghost btn-sm">
                  <Plus className="h-4 w-4" /> Añadir lección
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <AddModule productId={productId} count={mods.length} onSaved={(r) => setMsg(r)} />
    </section>
  );
}

/** Nombre del módulo, editable en su sitio: se guarda al salir del campo o con Intro. */
function ModuleName({ id, title, onSaved }: { id: string; title: string; onSaved: (r: StudioResult) => void }) {
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
      aria-label="Nombre del módulo"
      disabled={saving}
      className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base font-semibold outline-none hover:bg-sand focus:bg-white focus:ring-1 focus:ring-line sm:text-sm"
    />
  );
}

function AddModule({ productId, count, onSaved }: { productId: string; count: number; onSaved: (r: StudioResult) => void }) {
  const [name, setName] = useState("");
  const [saving, start] = useTransition();
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addStudioModule(productId, name);
          onSaved(r);
          if (r.ok) setName("");
        });
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Módulo ${count + 1}`} aria-label="Nombre del módulo nuevo" maxLength={120} className="input h-11 flex-1 text-base sm:text-sm" />
      <button className="btn btn-outline h-11" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir módulo
      </button>
    </form>
  );
}

/** «Disponible a los N días» dentro del menú (apertura por lección). */
function DripDaysField({ lesson, onSaved }: { lesson: BoardLesson; onSaved: (r: StudioResult) => void }) {
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
      <label className="text-xs font-semibold" htmlFor={`drip-${lesson.id}`}>
        Disponible a los … días
      </label>
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
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
        </button>
      </div>
      <p className="mt-1 text-[0.7rem] text-muted">Vacío o 0: desde el primer día.</p>
    </form>
  );
}
