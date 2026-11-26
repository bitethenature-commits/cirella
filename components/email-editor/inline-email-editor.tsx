"use client";

import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Columns2,
  Film,
  GripVertical,
  Heading,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Minus,
  MousePointerClick,
  MoveVertical,
  PanelTop,
  Plus,
  Redo2,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { uploadFile } from "@/components/ui/upload-client";
import {
  BLOCK_LABEL,
  DEFAULT_EMAIL_STYLE,
  EMAIL_BLOCKS_MAX,
  EMAIL_TEXT_MAX,
  newBlock,
  type EmailBlock,
  type EmailBlockType,
  type EmailDesign,
  type EmailStyle,
  type EmailVars,
  type SocialNetwork,
} from "@/lib/email-blocks";
import { cornerCss, patternCss } from "@/lib/email-patterns";
import { BlockSettings } from "./block-editor";
import { StylePanel } from "./style-panel";
import { Tr, useT } from "@/lib/i18n/client";

/** Las variables, en palabras: lo que se cambia solo en cada email. */
const VAR_LABEL: Record<keyof EmailVars, string> = {
  nombre: "Su nombre",
  mi_nombre: "Tu nombre",
  producto: "El producto",
  fecha: "La fecha",
  luna: "La luna",
} as Record<keyof EmailVars, string>;

/** Lo que se puede añadir escribiendo encima (el resto, con «Ajustes»). */
const ADD: EmailBlockType[] = ["title", "text", "button", "image", "spotlight", "divider", "hero", "columns", "video", "social", "spacer"];

/** Lo que se escribe encima del email: sin caja, con una línea dorada suave al pasar o escribir. */
const inline =
  "rounded-lg bg-transparent outline-none ring-1 ring-[rgb(217_191_140/.16)] transition placeholder:text-[#A99FC2]/50 hover:ring-[rgb(217_191_140/.45)] focus:ring-[rgb(217_191_140/.8)]";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Un textarea que crece con lo escrito. */
function Grow({ value, onChange, className = "", placeholder, label, maxLength }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; label: string; maxLength?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full resize-none overflow-hidden px-2 py-1 ${inline} ${className}`}
    />
  );
}

/** Una foto del email: se toca para subirla o cambiarla. */
function Photo({ url, onChange, className = "", label = "Añadir foto" }: { url: string; onChange: (url: string) => void; className?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={`group/photo relative overflow-hidden rounded-xl ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="block h-full w-full object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9BF8C]/50 bg-[#D9BF8C]/5 text-sm text-[#D9BF8C]"
        >
          <ImagePlus className="h-7 w-7" strokeWidth={1.3} />
          <Tr s={label} />
        </button>
      )}
      {url && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
          <button type="button" onClick={() => input.current?.click()} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"><Tr s={"Cambiar foto"} /></button>
          <button type="button" onClick={() => onChange("")} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"><Tr s={"Quitar"} /></button>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}
      {error && <p className="absolute inset-x-2 top-2 rounded-lg bg-red-600/90 px-2 py-1 text-center text-xs text-white"><Tr s={error} /></p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setError(null);
          try {
            const r = await uploadFile(f, { purpose: "image", email: true });
            if (r.url) onChange(r.url);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo subir la foto");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** El texto con formato, escrito encima (negrita, cursiva, listas, enlaces, títulos y resaltar). */
function Body({ value, onChange, label, placeholder = "Escribe aquí…" }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <div className="studio-rte page-rte mail-rte">
      <RichTextEditor ariaLabel={label} value={value} initialFormat="MD" onChange={onChange} maxLength={EMAIL_TEXT_MAX} tools="basic" headings highlight preview={false} tone="page" rows={3} placeholder={placeholder} />
    </div>
  );
}

const alignClass = (a?: string) => (a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left");

const BLOCK_ICON: Record<EmailBlockType, LucideIcon> = {
  hero: PanelTop,
  title: Heading,
  text: AlignLeft,
  image: ImageIcon,
  button: MousePointerClick,
  spotlight: Sparkles,
  video: Film,
  columns: Columns2,
  social: Share2,
  divider: Minus,
  spacer: MoveVertical,
};

/** Una línea para reconocer el bloque en la estructura. */
function blockSummary(b: EmailBlock): string {
  const clip = (s: string) => s.replace(/[#*_>`\[\]()]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  switch (b.t) {
    case "title":
      return clip(b.text);
    case "text":
      return clip(b.body);
    case "button":
      return clip(b.label);
    case "image":
      return b.url ? "Con foto" : "Sin foto";
    case "spotlight":
    case "hero":
    case "video":
    case "columns":
      return clip(b.title);
    case "social":
      return `${Object.values(b.links).filter(Boolean).length} redes`;
    default:
      return "";
  }
}

/** ¿Pantalla ancha? (las 3 zonas: bloques, email y ajustes). */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

const DRAG_TYPE = "text/x-email-block";

/** Línea dorada donde caerá el bloque que se arrastra. */
const DropLine = () => <div className="my-1 h-0.5 rounded-full bg-[#D9BF8C] shadow-[0_0_10px_#D9BF8C]" aria-hidden />;

/**
 * El email escrito encima, en 3 zonas (en pantallas anchas):
 *   · izquierda: los bloques para añadir (se arrastran al email o se tocan) y la estructura del
 *     email (saltar a un bloque o reordenarlo arrastrando);
 *   · centro: el email como le llega (noche y oro), con su asunto, escrito donde está;
 *   · derecha: los ajustes del bloque elegido o, sin ninguno, el estilo de todo el email.
 * En el móvil y la tablet, el email solo, con «Añadir aquí» y los ajustes en una ventana.
 * Deshacer y rehacer (botones y Ctrl+Z / Ctrl+Y fuera de los campos de texto).
 */
export function InlineEmailEditor(p: {
  value: EmailDesign;
  onChange: (d: EmailDesign) => void;
  vars: (keyof EmailVars)[];
  brand: string;
  subject: string;
  onSubject: (s: string) => void;
  defaultSubject: string;
  /** Lo que se añade solo debajo (o «» si nada). */
  fixed: string;
  mode: "body" | "intro";
  palette: string[];
  socials: Partial<Record<SocialNetwork, string>>;
  siteUrl: string;
  videoUploads?: boolean;
}) {
  const blocks = p.value.blocks;
  const style = p.value.style ?? DEFAULT_EMAIL_STYLE;
  const wide = useWide();
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<{ at: number; zone: "mail" | "list" } | null>(null);
  const dragging = useRef<string | null>(null);
  const last = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const blockEls = useRef(new Map<string, HTMLDivElement>());

  // ── Deshacer / rehacer ──
  const valueRef = useRef(p.value);
  valueRef.current = p.value;
  const onChangeRef = useRef(p.onChange);
  onChangeRef.current = p.onChange;
  const hist = useRef<{ past: EmailDesign[]; future: EmailDesign[]; at: number }>({ past: [], future: [], at: 0 });
  const [, bump] = useState(0);
  /** merge: lo que se escribe seguido (menos de 1 s) cuenta como un solo paso. */
  const commit = (next: EmailDesign, merge = false) => {
    const h = hist.current;
    const now = Date.now();
    if (!merge || now - h.at > 1000) {
      h.past.push(valueRef.current);
      if (h.past.length > 100) h.past.shift();
    }
    h.at = merge ? now : 0;
    h.future = [];
    bump((x) => x + 1);
    p.onChange(next);
  };
  const undo = () => {
    const h = hist.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(valueRef.current);
    h.at = 0;
    bump((x) => x + 1);
    onChangeRef.current(prev);
  };
  const redo = () => {
    const h = hist.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(valueRef.current);
    h.at = 0;
    bump((x) => x + 1);
    onChangeRef.current(next);
  };
  const undoRef = useRef({ undo, redo });
  undoRef.current = { undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // En un campo de texto, deshace el navegador (letra a letra).
      if (t && (t.closest("input, textarea, select, [contenteditable='true']") || t.isContentEditable)) return;
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current.undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        undoRef.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Cambios ──
  const set = (next: EmailBlock[], merge = false) => commit({ ...p.value, blocks: next }, merge);
  const patch = (id: string, change: Partial<EmailBlock>) => set(blocks.map((b) => (b.id === id ? ({ ...b, ...change } as EmailBlock) : b)), true);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  /** Lleva el bloque `id` al hueco `to` (0 = arriba del todo, blocks.length = abajo del todo). */
  const moveTo = (id: string, to: number) => {
    const from = blocks.findIndex((b) => b.id === id);
    if (from < 0) return;
    const at = from < to ? to - 1 : to;
    if (at === from) return;
    const next = [...blocks];
    const [b] = next.splice(from, 1);
    next.splice(at, 0, b);
    set(next);
  };
  const focusBlock = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => blockEls.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const add = (at: number, t: EmailBlockType) => {
    if (blocks.length >= EMAIL_BLOCKS_MAX) return;
    const nb = newBlock(t, style);
    const b = { ...(nb.t === "social" ? { ...nb, links: { ...p.socials } } : nb), id: uid() } as EmailBlock;
    const next = [...blocks];
    next.splice(at, 0, b);
    set(next);
    setAdding(null);
    focusBlock(b.id);
    if (!wide && !["title", "text", "button", "image", "spotlight", "divider", "spacer", "hero"].includes(t)) setSheet(true);
  };
  const remove = (id: string) => {
    set(blocks.filter((x) => x.id !== id));
    if (selected === id) setSelected(null);
  };
  /** Tocar un bloque de la izquierda: va debajo del elegido (o al final). */
  const addHere = (t: EmailBlockType) => {
    const i = selected ? blocks.findIndex((b) => b.id === selected) : -1;
    add(i >= 0 ? i + 1 : blocks.length, t);
  };
  const openSettings = (id: string) => {
    setSelected(id);
    if (!wide) setSheet(true);
  };

  // ── Arrastrar ──
  const startDrag = (e: React.DragEvent, what: string, image?: HTMLElement | null) => {
    dragging.current = what;
    e.dataTransfer.setData(DRAG_TYPE, what);
    e.dataTransfer.effectAllowed = what.startsWith("new:") ? "copy" : "move";
    if (image) e.dataTransfer.setDragImage(image, 24, 16);
  };
  const overItem = (e: React.DragEvent, i: number, zone: "mail" | "list") => {
    if (!dragging.current) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const at = e.clientY < r.top + r.height / 2 ? i : i + 1;
    if (dropAt?.at !== at || dropAt.zone !== zone) setDropAt({ at, zone });
  };
  const endDrag = () => {
    dragging.current = null;
    setDropAt(null);
  };
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    const what = dragging.current;
    const at = dropAt?.at;
    endDrag();
    if (!what || at === undefined) return;
    if (what.startsWith("new:")) add(at, what.slice(4) as EmailBlockType);
    else moveTo(what.slice(5), at);
  };

  /** Pone una variable ({nombre}…) donde está el cursor (en el último sitio en que escribió). */
  const insertVar = (k: keyof EmailVars) => {
    const el = last.current;
    const token = `{${k}}`;
    if (!el || !document.body.contains(el)) {
      void navigator.clipboard?.writeText(token).catch(() => {});
      return;
    }
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setter?.call(el, el.value.slice(0, start) + token + el.value.slice(end));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    el.setSelectionRange(start + token.length, start + token.length);
  };

  const AddHere = ({ at }: { at: number }) =>
    wide || blocks.length >= EMAIL_BLOCKS_MAX ? null : (
      <div className="relative flex justify-center py-1.5">
        <button
          type="button"
          onClick={() => setAdding(adding === at ? null : at)}
          className="inline-flex items-center gap-1 rounded-full border border-[#D9BF8C]/30 px-3 py-1 text-[0.72rem] text-[#D9BF8C]/80 opacity-60 transition hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />{" "}<Tr s={"Añadir aquí"} /></button>
        {adding === at && (
          <div className="absolute top-full z-20 mt-1 grid w-[min(22rem,90vw)] grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-2 text-ink shadow-lift sm:grid-cols-3">
            {ADD.map((t) => (
              <button key={t} type="button" onClick={() => add(at, t)} className="rounded-xl px-2.5 py-2 text-left text-sm hover:bg-sand">
                <Tr s={BLOCK_LABEL[t]} />
              </button>
            ))}
          </div>
        )}
      </div>
    );

  const editing = selected ? blocks.find((b) => b.id === selected) ?? null : null;
  const canUndo = hist.current.past.length > 0;
  const canRedo = hist.current.future.length > 0;

  /** Los ajustes de un bloque: el editor de bloques con solo ese bloque. */
  const settingsFor = (b: EmailBlock) => (
    <BlockSettings block={b} style={style} palette={p.palette} videoUploads={p.videoUploads} onChange={(nb) => set(blocks.map((x) => (x.id === b.id ? nb : x)), true)} />
  );

  const full = blocks.length >= EMAIL_BLOCKS_MAX;

  return (
    <div className="min-[1280px]:mx-[max(-12rem,min(0px,calc(36rem+124px+1.5rem-50vw)))]">
      <div className="min-[1280px]:grid min-[1280px]:grid-cols-[12rem_minmax(0,1fr)_17.5rem] min-[1280px]:items-start min-[1280px]:gap-4 min-[1600px]:grid-cols-[14rem_minmax(0,1fr)_20rem]">
        {/* ── Izquierda: bloques y estructura ── */}
        {wide && (
          <aside className="mail-side sticky top-20 max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto">
            <div className="card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted"><Tr s={"Bloques"} /></p>
              <div className="grid grid-cols-2 gap-1.5">
                {ADD.map((t) => {
                  const Icon = BLOCK_ICON[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      draggable={!full}
                      disabled={full}
                      onDragStart={(e) => startDrag(e, `new:${t}`)}
                      onDragEnd={endDrag}
                      onClick={() => addHere(t)}
                      title={`Arrástralo al email, o tócalo y va ${selected ? "debajo del bloque elegido" : "al final"}`}
                      className="mail-tool flex cursor-grab flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 text-center text-[0.72rem] font-medium active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.6} />
                      <Tr s={BLOCK_LABEL[t]} />
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[0.7rem] leading-snug text-muted">{full ? `Máximo ${EMAIL_BLOCKS_MAX} bloques.` : <Tr s={"Arrástralo al email o tócalo."} />}</p>
            </div>

            <div className="card p-3" onDragOver={(e) => dragging.current && blocks.length === 0 && (e.preventDefault(), setDropAt({ at: 0, zone: "list" }))} onDrop={drop}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted"><Tr s={"Estructura"} /></p>
              {blocks.length === 0 ? (
                <p className="text-xs text-muted"><Tr s={"Aún no hay bloques."} /></p>
              ) : (
                <ol className="space-y-0.5">
                  {blocks.map((b, i) => {
                    const Icon = BLOCK_ICON[b.t];
                    const sum = blockSummary(b);
                    return (
                      <li key={b.id} onDragOver={(e) => overItem(e, i, "list")} onDrop={drop}>
                        {dropAt?.zone === "list" && dropAt.at === i && <DropLine />}
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => startDrag(e, `move:${b.id}`)}
                          onDragEnd={endDrag}
                          onClick={() => focusBlock(b.id)}
                          aria-current={selected === b.id ? "true" : undefined}
                          className="mail-row flex w-full cursor-grab items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-40" />
                          <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-semibold"><Tr s={BLOCK_LABEL[b.t]} /></span>
                            {sum && <span className="text-muted"> · <Tr s={sum} /></span>}
                          </span>
                        </button>
                        {dropAt?.zone === "list" && dropAt.at === blocks.length && i === blocks.length - 1 && <DropLine />}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </aside>
        )}

        {/* ── Centro: el email ── */}
        <div className={`min-w-0 ${wide ? "" : "mx-auto max-w-3xl"}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            {p.vars.length > 0 && (
              <>
                <span><Tr s={"Toca para ponerlo donde escribes:"} /></span>
                {p.vars.map((k) => (
                  <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVar(k)} className="chip" title={`Se cambia solo por ${VAR_LABEL[k]?.toLowerCase() ?? k}`}>
                    <Tr s={VAR_LABEL[k] ?? k} /> <code className="opacity-60">{`{${k}}`}</code>
                  </button>
                ))}
              </>
            )}
            <span className="ml-auto inline-flex gap-1">
              <button type="button" onClick={undo} disabled={!canUndo} className="btn btn-ghost btn-sm disabled:opacity-30" aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
                <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline"><Tr s={"Deshacer"} /></span>
              </button>
              <button type="button" onClick={redo} disabled={!canRedo} className="btn btn-ghost btn-sm disabled:opacity-30" aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
                <Redo2 className="h-4 w-4" /> <span className="hidden sm:inline"><Tr s={"Rehacer"} /></span>
              </button>
            </span>
          </div>

          <div
            className="mail-canvas overflow-hidden rounded-[1.6rem] border border-line shadow-lift"
            onFocusCapture={(e) => {
              const t = e.target;
              if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === "text")) last.current = t;
            }}
          >
            {/* Como en el buzón: de quién y el asunto. */}
            <div className="border-b border-[#3A3354] bg-[#120F30] px-4 py-3 text-sm sm:px-6">
              <p className="text-xs text-[#A99FC2]"><Tr s={"De:"} />{" "}<span className="text-[#E8DFCB]"><Tr s={p.brand} /></span>
              </p>
              <label className="mt-1 flex items-center gap-2">
                <span className="shrink-0 text-xs text-[#A99FC2]"><Tr s={"Asunto:"} /></span>
                <input
                  type="text"
                  value={p.subject}
                  onChange={(e) => p.onSubject(e.target.value)}
                  maxLength={150}
                  placeholder={p.defaultSubject}
                  aria-label="Asunto"
                  className={`w-full px-2 py-1 text-[1rem] font-semibold text-[#F4EBD8] ${inline}`}
                />
              </label>
            </div>

            <div
              className="mail-sky px-3 py-10 sm:px-8 min-[1280px]:px-4 min-[1600px]:px-8"
              style={p.value.style ? patternCss(p.value.style) : undefined}
              onMouseDown={(e) => {
                // Tocar fuera de los bloques: vuelve al estilo del email.
                if (!(e.target as HTMLElement).closest("[data-email-block]")) setSelected(null);
              }}
            >
              <div className="mx-auto max-w-[560px]">
                <div className="mb-6 text-center font-serif">
                  <p className="text-[0.62rem] tracking-[0.6em] text-[#D9BF8C]">✦ ✦ ✦</p>
                  <p className="mt-2 text-[1.5rem] tracking-[0.08em] text-[#F3E3BF]"><Tr s={p.brand} /></p>
                </div>
                <div className="rounded-[24px] border border-[#6E5B3A] p-[5px]">
                  <div
                    className="rounded-[19px] border border-[#3A3354] bg-[#17143A] px-4 py-8 sm:px-8 min-[1280px]:px-5"
                    style={p.value.style ? { backgroundColor: style.content, ...cornerCss({ bg: style.content, pattern: style.cornerPattern, patternColor: style.patternColor, patternStrength: style.patternStrength, pos: style.cornerPos }) } : undefined}
                    onDragOver={(e) => {
                      if (!dragging.current) return;
                      e.preventDefault();
                      if (blocks.length === 0 && dropAt?.at !== 0) setDropAt({ at: 0, zone: "mail" });
                    }}
                    onDrop={drop}
                  >
                    {p.mode === "intro" && blocks.length === 0 && (
                      <p className="mb-2 text-center text-xs text-[#A99FC2]"><Tr s={"Tu texto va aquí arriba, antes de lo que el email pone solo. Añade un bloque si quieres escribir algo."} /></p>
                    )}
                    {wide && blocks.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-[#D9BF8C]/40 px-4 py-10 text-center text-sm text-[#A99FC2]"><Tr s={"Arrastra aquí un bloque de la izquierda, o tócalo."} /></div>
                    )}
                    <AddHere at={0} />
                    {blocks.map((b, i) => (
                      <div key={b.id}>
                        {dropAt?.zone === "mail" && dropAt.at === i && <DropLine />}
                        <div
                          ref={(el) => {
                            if (el) blockEls.current.set(b.id, el);
                            else blockEls.current.delete(b.id);
                          }}
                          className={`group/block relative rounded-xl py-2 transition hover:bg-white/[0.02] ${selected === b.id ? "ring-1 ring-[#D9BF8C]/70 ring-offset-4 ring-offset-transparent" : ""}`}
                          data-email-block={b.t}
                          onMouseDownCapture={() => setSelected(b.id)}
                          onFocusCapture={() => setSelected(b.id)}
                          onDragOver={(e) => overItem(e, i, "mail")}
                          onDrop={drop}
                        >
                          {/* La barra del bloque */}
                          <div
                            className={`absolute -top-3 right-0 z-10 flex items-center gap-0.5 rounded-full border border-line bg-white px-1 py-0.5 text-ink shadow-soft transition group-hover/block:opacity-100 group-focus-within/block:opacity-100 ${selected === b.id ? "opacity-100" : "opacity-0"}`}
                          >
                            {wide && (
                              <span
                                draggable
                                onDragStart={(e) => startDrag(e, `move:${b.id}`, blockEls.current.get(b.id))}
                                onDragEnd={endDrag}
                                className="grid h-7 w-7 cursor-grab place-items-center rounded-full hover:bg-sand active:cursor-grabbing"
                                title="Arrastra para moverlo"
                                aria-hidden
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <span className="px-2 text-[0.68rem] font-semibold text-muted"><Tr s={BLOCK_LABEL[b.t]} /></span>
                            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-full hover:bg-sand disabled:opacity-30" aria-label="Subir">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="grid h-7 w-7 place-items-center rounded-full hover:bg-sand disabled:opacity-30" aria-label="Bajar">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            {!wide && (
                              <button type="button" onClick={() => openSettings(b.id)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-sand" aria-label="Ajustes" title="Colores, tamaños y más">
                                <Settings2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button type="button" onClick={() => remove(b.id)} className="grid h-7 w-7 place-items-center rounded-full text-rose hover:bg-sand" aria-label="Borrar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <BlockOnMail block={b} look={style} patch={(c) => patch(b.id, c)} onSettings={() => openSettings(b.id)} />
                        </div>
                        {dropAt?.zone === "mail" && dropAt.at === blocks.length && i === blocks.length - 1 && <DropLine />}
                        <AddHere at={i + 1} />
                      </div>
                    ))}

                    {/* Lo que el email pone solo */}
                    {p.fixed && (
                      <div className="mt-4 rounded-2xl border border-dashed border-[#D9BF8C]/35 px-4 py-4 text-center">
                        <p className="text-[0.62rem] uppercase tracking-[0.3em] text-[#D9BF8C]"><Tr s={"Esto lo pone el email solo"} /></p>
                        <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[#A99FC2]"><Tr s={p.fixed} /></p>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-5 text-center text-[0.7rem] tracking-[0.5em] text-[#6E5B3A]">✦</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Derecha: ajustes del bloque elegido o estilo del email ── */}
        {wide && (
          <aside className="mail-side sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto">
            {editing ? (
              <div className="card p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold"><Tr s={"Ajustes ·"} />{" "}<Tr s={BLOCK_LABEL[editing.t]} /></p>
                  <button type="button" onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-sand" aria-label="Cerrar los ajustes" title="Volver al estilo del email (Esc)">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {settingsFor(editing)}
              </div>
            ) : (
              <div className="space-y-2">
                <StylePanel value={style} palette={p.palette} onChange={(s) => commit({ ...p.value, style: s }, true)} defaultOpen />
                <p className="px-1 text-[0.7rem] leading-snug text-muted"><Tr s={"Toca un bloque del email para cambiar sus ajustes. Los colores del texto y los botones se ven en «Cómo le llega»."} /></p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Móvil y tablet: los ajustes de un bloque en una ventana */}
      {!wide && sheet && editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={() => setSheet(false)}>
          <div className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 text-ink shadow-lift sm:rounded-3xl sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold"><Tr s={"Ajustes ·"} />{" "}<Tr s={BLOCK_LABEL[editing.t]} /></p>
              <button type="button" onClick={() => setSheet(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
            {settingsFor(editing)}
            <button type="button" onClick={() => setSheet(false)} className="btn btn-primary mt-4 w-full"><Tr s={"Listo"} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Un bloque tal y como sale en el email, con lo que se escribe encima. */
function BlockOnMail({ block: b, look, patch, onSettings }: { block: EmailBlock; look: EmailStyle; patch: (c: Partial<EmailBlock>) => void; onSettings: () => void }) {
  const t = useT();
  switch (b.t) {
    case "title":
      return (
        <Grow
          value={b.text}
          onChange={(text) => patch({ text })}
          placeholder={t("Un título")}
          label={t("Título")}
          maxLength={200}
          className={`font-serif text-[1.75rem] leading-tight text-[#F3E3BF] ${alignClass(b.align)}`}
        />
      );
    case "text":
      return <Body value={b.body} onChange={(body) => patch({ body })} label={t("Texto")} />;
    case "button":
      return (
        <div className={alignClass(b.align)}>
          <span className="inline-block rounded-full bg-[#D9BF8C] px-1.5 py-1">
            <input
              type="text"
              value={b.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder={t("Texto del botón")}
              aria-label={t("Texto del botón")}
              maxLength={60}
              size={Math.max(12, b.label.length + 2)}
              className="rounded-full bg-transparent px-4 py-2 text-center text-[0.8rem] font-bold uppercase tracking-[0.14em] text-[#1A1408] outline-none placeholder:text-[#1A1408]/40 focus:ring-2 focus:ring-[#1A1408]/30"
            />
          </span>
          <input
            type="text"
            value={b.href}
            onChange={(e) => patch({ href: e.target.value })}
            placeholder={t("Enlace del botón: https://…")}
            aria-label={t("Enlace del botón")}
            className={`mx-auto mt-2 block w-full max-w-sm px-2 py-1 text-center text-xs text-[#A99FC2] ${inline}`}
          />
        </div>
      );
    case "image":
      return <Photo url={b.url} onChange={(url) => patch({ url })} className={b.width === "narrow" ? "mx-auto max-w-[70%]" : ""} />;
    case "divider":
      return <p className="py-2 text-center text-[0.7rem] tracking-[0.5em] text-[#D9BF8C]"><Tr s={b.style === "stars" ? "✦ ✦ ✦" : "— ✦ —"} /></p>;
    case "spacer":
      return <div className={b.size === "s" ? "h-3" : b.size === "l" ? "h-12" : "h-6"} aria-label={t("Espacio")} />;
    case "spotlight":
      return (
        <div className="rounded-2xl border-l-2 px-4 py-4" style={{ borderColor: b.accent, ...patternCss({ bg: b.bg, pattern: look.bubblePattern, patternColor: look.patternColor, patternStrength: look.patternStrength }) }}>
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={b.icon}
              onChange={(e) => patch({ icon: e.target.value })}
              aria-label={t("Icono")}
              maxLength={4}
              className={`w-10 px-1 py-0.5 text-center text-lg ${inline}`}
            />
            <div className="min-w-0 flex-1">
              <Grow value={b.title} onChange={(title) => patch({ title })} placeholder={t("Título del destacado")} label={t("Título del destacado")} maxLength={120} className="font-serif text-[1.25rem] text-[#F3E3BF]" />
              <Body value={b.body} onChange={(body) => patch({ body })} label={t("Texto del destacado")} placeholder={t("Lo que no se tiene que perder…")} />
            </div>
          </div>
        </div>
      );
    case "hero":
      return (
        <div className="relative overflow-hidden rounded-2xl">
          <Photo url={b.image} onChange={(image) => patch({ image })} className="min-h-56" label={t("Foto de fondo")} />
          <div className="pointer-events-none absolute inset-0 bg-black/40" />
          <div className={`absolute inset-x-4 top-1/2 -translate-y-1/2 space-y-1 ${b.align === "center" ? "text-center" : ""}`}>
            <Grow value={b.title} onChange={(title) => patch({ title })} placeholder={t("Título de la portada")} label={t("Título de la portada")} maxLength={120} className="font-serif text-[1.8rem] leading-tight text-white" />
            <Grow value={b.subtitle} onChange={(subtitle) => patch({ subtitle })} placeholder={t("Subtítulo")} label={t("Subtítulo de la portada")} maxLength={200} className="text-[0.95rem] text-white/85" />
          </div>
        </div>
      );
    default:
      return <Summary block={b} onSettings={onSettings} />;
  }
}

/** Vídeo, dos columnas y redes: un resumen que abre sus ajustes. */
function Summary({ block: b, onSettings }: { block: EmailBlock; onSettings: () => void }): ReactNode {
  const text =
    b.t === "video" ? b.title || (b.url || b.src ? "Vídeo listo" : "Falta el vídeo") : b.t === "columns" ? b.title || "Foto y texto, una al lado de la otra" : b.t === "social" ? `${Object.values(b.links).filter(Boolean).length} redes` : "";
  return (
    <button type="button" onClick={onSettings} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#D9BF8C]/30 px-4 py-4 text-left text-sm text-[#E8DFCB] hover:border-[#D9BF8C]/60">
      <span>
        <span className="block text-[0.62rem] uppercase tracking-[0.3em] text-[#D9BF8C]"><Tr s={BLOCK_LABEL[b.t]} /></span>
        <Tr s={text} />
      </span>
      <Settings2 className="h-4 w-4 text-[#D9BF8C]" />
    </button>
  );
}
