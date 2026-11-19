"use client";

import { ArrowDown, ArrowUp, Columns2, Eye, EyeOff, Film, Image as ImageIcon, ImagePlus, Images, LayoutGrid, Loader2, Milestone, Moon, Orbit, Pill, Plus, Quote, Settings2, Sparkles, Trash2, Type, X } from "lucide-react";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ContentBlocks } from "@/components/creator-page/content-blocks";
import type { PublicProduct } from "@/components/creator-page/creator-page-view";
import type { OracleDecks } from "@/components/models/data/oracle";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import {
  BLOCK_LABEL,
  BLOCK_LOOK_LABEL,
  BLOCK_LOOKS,
  CARDS_MAX,
  newBlock,
  newCard,
  newPill,
  newTimelineItem,
  PILLS_MAX,
  TIMELINE_MAX,
  type BlockKind,
  type BlockCard,
  type BlockLook,
  type ContentBlock,
} from "@/lib/page-blocks";
import { BlocksEditor, type BlocksUpdate } from "./blocks-editor";
import type { LinkTarget } from "./link-input";
import type { OracleDeckOption } from "./rich-block-fields";

/**
 * El editor de bloques de Páginas escrito sobre la propia web: cada bloque se ve como en la web y sus
 * títulos y textos se escriben encima. Arriba de cada bloque, su barra: el estilo (Tarjeta, Sin burbuja,
 * Panel dorado), el título dorado, «Ajustes» (fotos, enlaces y lo demás), visible, subir, bajar y
 * borrar. Entre bloques, un «+» para añadir otro justo ahí.
 */

const ICON: Record<BlockKind, typeof Type> = { text: Type, image: ImageIcon, gallery: Images, video: Film, photoText: Columns2, cards: LayoutGrid, quote: Quote, timeline: Milestone, model: Orbit, pills: Pill, moonCircles: Moon };
const ADD_ORDER: BlockKind[] = ["text", "photoText", "cards", "quote", "timeline", "pills", "image", "gallery", "video", "moonCircles", "model"];
/** Los que se rellenan sobre todo en «Ajustes» (fotos, vídeos, modelos): al añadirlos se abren. */
const SETTINGS_FIRST = new Set<BlockKind>(["image", "gallery", "video", "model"]);
/** Los que tienen título que se puede poner en dorado. */
const HAS_TITLE = new Set<BlockKind>(["text", "photoText", "cards", "timeline", "pills", "image", "gallery", "video", "model", "moonCircles"]);
/** Los que cambian con el estilo (los demás van siempre igual). */
const HAS_LOOK = new Set<BlockKind>(["text", "photoText", "cards", "quote", "timeline", "pills"]);

/** Lo que se escribe encima: sin caja, con una línea dorada suave al pasar o escribir (como el estudio de lecturas). */
const inline =
  "rounded-lg bg-transparent outline-none ring-1 ring-[color-mix(in_oklab,var(--c-gold)_14%,transparent)] transition placeholder:opacity-40 hover:ring-[color-mix(in_oklab,var(--c-gold)_40%,transparent)] focus:ring-[color-mix(in_oklab,var(--c-gold)_75%,transparent)]";

const uid = () => Math.random().toString(36).slice(2, 10);

/** La foto de una tarjeta: se toca para subirla o cambiarla, encima de la web (con el marco de la web). */
function CardPhoto({ image, fancy, onChange }: { image: BlockCard["image"]; fancy: boolean; onChange: (img: BlockCard["image"]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const r = await uploadImageInfo(file);
      onChange({ src: r.url, alt: image?.alt ?? "", width: r.width || 800, height: r.height || 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`group/photo relative w-full ${fancy ? "cp-gift-photo aspect-[4/5]" : "cp-photo-bubble cp-photo-in aspect-[4/3]"}`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={image.alt} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="cp-gold absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed text-sm"
          style={{ borderColor: "color-mix(in oklab, var(--c-gold) 45%, transparent)", borderRadius: "inherit", background: "color-mix(in oklab, var(--c-gold) 6%, transparent)" }}
        >
          <ImagePlus className="h-7 w-7" strokeWidth={1.3} />
          Añadir foto
        </button>
      )}
      {image && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 opacity-90 transition group-hover/photo:opacity-100">
          <button type="button" onClick={() => input.current?.click()} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            Cambiar foto
          </button>
          <button type="button" onClick={() => onChange(null)} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            Quitar
          </button>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white" style={{ borderRadius: "inherit" }}>
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}
      {error && <p className="absolute inset-x-2 top-2 rounded-lg bg-red-600/90 px-2 py-1 text-center text-xs text-white">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
    </div>
  );
}

/** Un textarea que crece con lo escrito. */
function Grow({ value, onChange, className = "", placeholder, maxLength, label }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; maxLength?: number; label: string }) {
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

type Mode = { bare: boolean; luxe: boolean };

export function InlineBlocks({
  blocks,
  onChange,
  mode,
  personal,
  linkTargets,
  bodyMax,
  max,
  oracleDecks,
  oracleDeckViews,
  username,
  hiddenSlugs,
  siteOrigin,
  moonCircles,
  onUploadingChange,
}: {
  blocks: ContentBlock[];
  onChange: (next: BlocksUpdate) => void;
  /** El aspecto de la página (lo que llevan los bloques sin estilo propio). */
  mode: Mode;
  personal: boolean;
  linkTargets: LinkTarget[];
  bodyMax: number;
  max: number;
  oracleDecks: OracleDeckOption[];
  oracleDeckViews: OracleDecks;
  username: string;
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin: string;
  moonCircles: PublicProduct[];
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const full = blocks.length >= max;

  const patch = (id: string, fn: (b: ContentBlock) => ContentBlock) => onChange((prev) => prev.map((b) => (b.id === id ? fn(b) : b)));
  const move = (i: number, dir: -1 | 1) =>
    onChange((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = [...prev];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const insert = (at: number, kind: BlockKind) => {
    const b = newBlock(kind, uid());
    onChange((prev) => (prev.length >= max ? prev : [...prev.slice(0, at), b, ...prev.slice(at)]));
    setAdding(null);
    if (SETTINGS_FIRST.has(kind)) setOpen(b.id);
  };

  const plus = (at: number) => (
    <div className="relative flex items-center justify-center py-2" data-insert={at}>
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px opacity-0 transition group-hover/ins:opacity-100" style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--c-gold) 50%, transparent), transparent)" }} />
      <button
        type="button"
        disabled={full}
        onClick={() => setAdding(adding === at ? null : at)}
        className="relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition disabled:opacity-30"
        style={{ borderColor: "color-mix(in oklab, var(--c-gold) 45%, transparent)", color: "var(--c-gold)", background: "var(--c-bg)" }}
        aria-expanded={adding === at}
      >
        <Plus className="h-4 w-4" /> Añadir aquí
      </button>
      {adding === at && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[color:var(--n-gold,#d9b46a)]/40 bg-[color:var(--n-deep,#0d0c22)] p-3 text-[color:var(--n-ivory,#f1ebdf)] shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--n-gold,#d9b46a)]">¿Qué añades?</p>
            <button type="button" onClick={() => setAdding(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ADD_ORDER.map((k) => {
              const Icon = ICON[k];
              return (
                <button key={k} type="button" onClick={() => insert(at, k)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-white/10">
                  <Icon className="h-4 w-4 shrink-0 text-[color:var(--n-gold,#d9b46a)]" /> {BLOCK_LABEL[k]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div data-inline-blocks>
      <div className="group/ins">{plus(0)}</div>
      {blocks.map((b, i) => {
        const Icon = ICON[b.kind];
        const pageLook: BlockLook = mode.bare ? "bare" : mode.luxe ? "panel" : "card";
        const look = b.look ?? pageLook;
        return (
          <div key={b.id}>
            <div className="group/blk relative" data-edit-block={b.kind}>
              {/* La barra del bloque */}
              <div className="mb-3 flex justify-center">
                <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-[color:var(--n-gold,#d9b46a)]/35 bg-[color:var(--n-deep,#0d0c22)]/90 px-2 py-1.5 text-[0.75rem] text-[color:var(--n-ivory,#f1ebdf)] opacity-80 shadow-lg backdrop-blur transition group-hover/blk:opacity-100 group-focus-within/blk:opacity-100">
                  <span className="inline-flex items-center gap-1.5 px-1.5 font-semibold text-[color:var(--n-gold,#d9b46a)]">
                    <Icon className="h-3.5 w-3.5" /> {BLOCK_LABEL[b.kind]}
                  </span>
                  {HAS_LOOK.has(b.kind) && (
                    <span className="inline-flex rounded-full bg-white/5 p-0.5" role="radiogroup" aria-label="Estilo">
                      {BLOCK_LOOKS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          role="radio"
                          aria-checked={look === l}
                          onClick={() => patch(b.id, (x) => ({ ...x, look: l }))}
                          className={`h-7 rounded-full px-2.5 font-semibold transition ${look === l ? "bg-[color:var(--n-gold,#d9b46a)] text-[#0d0c22]" : "text-[color:var(--n-lilac,#cfc8e4)] hover:text-white"}`}
                        >
                          {BLOCK_LOOK_LABEL[l]}
                        </button>
                      ))}
                    </span>
                  )}
                  {HAS_TITLE.has(b.kind) && (
                    <button
                      type="button"
                      aria-pressed={!!b.goldTitle}
                      onClick={() => patch(b.id, (x) => ({ ...x, goldTitle: !x.goldTitle }))}
                      className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-semibold transition ${b.goldTitle ? "bg-[color:var(--n-gold,#d9b46a)]/20 text-[color:var(--n-gold-pale,#f7e5b8)] ring-1 ring-[color:var(--n-gold,#d9b46a)]" : "text-[color:var(--n-lilac,#cfc8e4)] hover:text-white"}`}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Título dorado
                    </button>
                  )}
                  <button
                    type="button"
                    aria-expanded={open === b.id}
                    onClick={() => setOpen(open === b.id ? null : b.id)}
                    className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-semibold transition ${open === b.id ? "bg-white text-[#0d0c22]" : "text-[color:var(--n-lilac,#cfc8e4)] hover:text-white"}`}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Ajustes
                  </button>
                  <button type="button" onClick={() => patch(b.id, (x) => ({ ...x, enabled: !x.enabled }))} className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--n-lilac,#cfc8e4)] hover:bg-white/10 hover:text-white" aria-label={b.enabled ? "Ocultar bloque" : "Mostrar bloque"} title={b.enabled ? "Visible" : "Oculto"}>
                    {b.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--n-lilac,#cfc8e4)] hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Subir bloque">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--n-lilac,#cfc8e4)] hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Bajar bloque">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onChange((prev) => prev.filter((x) => x.id !== b.id))} className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--n-lilac,#cfc8e4)] hover:bg-rose-500/20 hover:text-rose-300" aria-label="Borrar bloque">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className={b.enabled ? "" : "opacity-40"}>
                {!b.enabled && <p className="cp-eyebrow mb-2 text-center">Oculto · no sale en la web</p>}
                <EditableBlock
                  b={b}
                  mode={mode}
                  onPatch={(fn) => patch(b.id, fn)}
                  onSettings={() => setOpen(b.id)}
                  bodyMax={bodyMax}
                  username={username}
                  hiddenSlugs={hiddenSlugs}
                  siteOrigin={siteOrigin}
                  oracleDecks={oracleDeckViews}
                  moonCircles={moonCircles}
                />
              </div>

              {/* Ajustes: los campos de siempre de este bloque (fotos, enlaces, botones…) */}
              {open === b.id && (
                <div className="mt-4 rounded-2xl bg-white p-4 text-ink shadow-2xl" data-block-settings>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Ajustes · {BLOCK_LABEL[b.kind]}</p>
                    <button type="button" onClick={() => setOpen(null)} className="btn btn-ghost btn-sm">
                      <X className="h-4 w-4" /> Cerrar
                    </button>
                  </div>
                  <BlocksEditor
                    single
                    blocks={[b]}
                    onChange={(next) =>
                      onChange((prev) =>
                        prev.map((x) => {
                          if (x.id !== b.id) return x;
                          const out = typeof next === "function" ? next([x]) : next;
                          return out[0] ?? x;
                        }),
                      )
                    }
                    personal={personal}
                    linkTargets={linkTargets}
                    bodyMax={bodyMax}
                    max={max}
                    onUploadingChange={onUploadingChange}
                    oracleDecks={oracleDecks}
                  />
                </div>
              )}
            </div>
            <div className="group/ins">{plus(i + 1)}</div>
          </div>
        );
      })}
      {full && <p className="cp-muted text-center text-xs">Máximo {max} bloques</p>}
    </div>
  );
}

// ── Cada bloque, escrito encima ──

type EditProps = {
  b: ContentBlock;
  mode: Mode;
  onPatch: (fn: (b: ContentBlock) => ContentBlock) => void;
  onSettings: () => void;
  bodyMax: number;
  username: string;
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin: string;
  oracleDecks: OracleDecks;
  moonCircles: PublicProduct[];
};

/** El título de un bloque escrito encima: centrado con su estrella y su raya en los estilos de lujo. */
function EdTitle({ value, onChange, luxe, placeholder = "Título (opcional)" }: { value: string; onChange: (v: string) => void; luxe: boolean; placeholder?: string }) {
  if (luxe)
    return (
      <div className="cp-section-heading">
        <span className="cp-section-star" aria-hidden>
          ✦
        </span>
        <h2 className="cp-display cp-thin text-[2.2rem] leading-tight sm:text-[2.6rem]">
          <Grow value={value} onChange={onChange} placeholder={placeholder} maxLength={80} label="Título del bloque" className="text-center" />
        </h2>
        <div aria-hidden className="cp-section-rule">
          <span />
          <i>✦</i>
          <span />
        </div>
      </div>
    );
  return (
    <h2 className="cp-display text-[1.75rem] leading-tight sm:text-[2rem]">
      <Grow value={value} onChange={onChange} placeholder={placeholder} maxLength={80} label="Título del bloque" />
    </h2>
  );
}

/** El texto con formato, escrito sobre la web (la barra de formato con los colores de la web). */
function EdBody({ value, format, onChange, bodyMax, center }: { value: string; format?: string | null; onChange: (v: string) => void; bodyMax: number; center?: boolean }) {
  return (
    <div className={`studio-rte page-rte ${center ? "text-left" : ""}`}>
      <RichTextEditor ariaLabel="Texto del bloque" placeholder="Escribe aquí…" value={value} initialFormat={format ?? null} onChange={onChange} maxLength={bodyMax} tools="basic" headings preview={false} tone="page" headingLevel={3} rows={3} />
    </div>
  );
}

/** El botón tal y como sale (su texto y su enlace se ponen en «Ajustes»). */
function ButtonPreview({ label, onSettings, sacred }: { label?: string; onSettings: () => void; sacred?: boolean }) {
  return label ? (
    <button type="button" onClick={onSettings} className={sacred ? "cp-sacred-btn" : "cp-btn-ghost"} title="Cambiar el botón en Ajustes">
      {sacred ? <span className="cp-sacred-label">{label}</span> : label}
    </button>
  ) : (
    <button type="button" onClick={onSettings} className="cp-faint text-xs underline underline-offset-4">
      + Añadir un botón (en Ajustes)
    </button>
  );
}

/** Lo que aún no tiene contenido (una foto, un vídeo): un hueco que abre «Ajustes». */
function Empty({ children, onSettings }: { children: ReactNode; onSettings: () => void }) {
  return (
    <button type="button" onClick={onSettings} className="cp-line cp-muted flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border border-dashed p-6 text-center text-sm">
      <Settings2 className="h-5 w-5 opacity-70" />
      {children}
    </button>
  );
}

function EditableBlock(p: EditProps) {
  const { b, mode, onPatch, onSettings, bodyMax } = p;
  const look = b.look;
  // Igual que en la web (content-blocks.tsx): el estilo del bloque manda sobre el de la página.
  const panelWrap = look === "panel" && b.kind !== "text";
  const bare = look ? look === "bare" || panelWrap : mode.bare;
  const luxe = look ? look === "panel" && !panelWrap : mode.luxe;
  const wrap = (node: ReactNode) => (
    <div data-look={look} data-gold-title={b.goldTitle ? "" : undefined} className={panelWrap ? "cp-include-panel" : undefined}>
      {node}
    </div>
  );
  const set = <K extends string>(k: K, v: unknown) => onPatch((x) => ({ ...x, [k]: v }) as ContentBlock);

  switch (b.kind) {
    case "text":
      return wrap(
        <div className={bare ? "mx-auto max-w-2xl text-center" : luxe ? "cp-include-panel" : "cp-card p-6 sm:p-7"}>
          <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={bare} />
          {luxe && <span aria-hidden className="cp-luxe-underline" />}
          <div className={`mt-4 ${bare ? "cp-thin-text mx-auto max-w-xl" : ""}`}>
            <EdBody value={b.body} format={b.format} onChange={(v) => onPatch((x) => ({ ...x, body: v, format: "MD" }) as ContentBlock)} bodyMax={bodyMax} center={bare} />
          </div>
          <div className={`mt-6 flex ${bare ? "justify-center" : ""}`}>
            <ButtonPreview label={b.buttonLabel} onSettings={onSettings} sacred={bare} />
          </div>
        </div>,
      );
    case "photoText":
      return wrap(
        <div className={bare ? "grid items-center gap-5 sm:grid-cols-2 sm:gap-10" : "cp-card grid items-center p-3 sm:grid-cols-2 sm:p-4"}>
          <div className={`relative aspect-[9/16] ${bare ? "cp-luxe-frame" : "cp-photo-bubble"} mx-auto w-full max-w-[20rem] ${b.imageSide === "right" ? "sm:order-last" : ""}`}>
            {b.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.image.src} alt={b.image.alt} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0">
                <Empty onSettings={onSettings}>Añade la foto</Empty>
              </div>
            )}
            {b.image && (
              <button type="button" onClick={onSettings} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
                Cambiar foto
              </button>
            )}
          </div>
          <div className={`flex flex-col justify-center ${bare ? "" : "p-6 sm:p-7"}`}>
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={false} />
            <div className="mt-4">
              <EdBody value={b.body} format={b.format} onChange={(v) => onPatch((x) => ({ ...x, body: v, format: "MD" }) as ContentBlock)} bodyMax={bodyMax} />
            </div>
            <div className="mt-5">
              <ButtonPreview label={b.buttonLabel} onSettings={onSettings} />
            </div>
          </div>
        </div>,
      );
    case "cards": {
      const fancy = bare || luxe;
      const cols = b.cards.length % 3 === 0 ? "sm:grid-cols-3" : "sm:grid-cols-2";
      const patchCard = (i: number, p: Partial<BlockCard>) => onPatch((x) => (x.kind === "cards" ? { ...x, cards: x.cards.map((c, j) => (j === i ? { ...c, ...p } : c)) } : x));
      const setCard = (i: number, k: "title" | "text", v: string) => patchCard(i, { [k]: v });
      return wrap(
        <section>
          <div className={fancy ? "mb-8 text-center" : "mb-4"}>
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={fancy} />
          </div>
          <div className={`grid gap-4 ${cols} ${fancy ? "sm:gap-6" : ""}`}>
            {b.cards.map((c, i) => (
              <div key={i} className={`cp-card relative flex flex-col ${fancy ? "cp-uno-gift" : ""}`} data-card>
                <button
                  type="button"
                  onClick={() => onPatch((x) => (x.kind === "cards" ? { ...x, cards: x.cards.filter((_, j) => j !== i) } : x))}
                  className="absolute right-2 top-2 z-[2] grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white opacity-70 hover:opacity-100"
                  aria-label="Quitar tarjeta"
                >
                  <X className="h-4 w-4" />
                </button>
                <CardPhoto image={c.image} fancy={fancy} onChange={(image) => patchCard(i, { image })} />
                <div className={`flex w-full flex-1 flex-col ${fancy ? "items-center px-5 py-8 text-center" : "p-5"}`}>
                  <h3 data-card-title className={`cp-display w-full ${fancy ? "cp-thin mt-3 text-[1.7rem] italic" : "text-[1.3rem]"} leading-tight`}>
                    <Grow value={c.title} onChange={(v) => setCard(i, "title", v)} placeholder="Título" maxLength={80} label="Título de la tarjeta" className={fancy ? "text-center" : ""} />
                  </h3>
                  {fancy && (
                    <span aria-hidden className="cp-section-rule mt-3 !w-24">
                      <span />
                      <i>✦</i>
                      <span />
                    </span>
                  )}
                  <Grow value={c.text} onChange={(v) => setCard(i, "text", v)} placeholder="Texto corto" maxLength={240} label="Texto de la tarjeta" className={`cp-muted mt-2 text-[0.95rem] leading-relaxed ${fancy ? "cp-thin-text text-center" : ""}`} />
                  <input
                    value={c.price ?? ""}
                    onChange={(e) => patchCard(i, { price: e.target.value })}
                    maxLength={40}
                    placeholder="Precio (opcional)"
                    aria-label="Precio de la tarjeta"
                    className={`cp-gold cp-display mt-3 w-full px-2 py-0.5 text-[1.3rem] ${fancy ? "text-center" : ""} ${inline}`}
                  />
                  {fancy && c.href && (
                    <span className="cp-gift-cta mt-4" aria-hidden>
                      {/^mailto:/i.test(c.href) ? "Pedirlo" : "Ver más"} <span>✦</span>
                    </span>
                  )}
                  <input
                    value={c.href ?? ""}
                    onChange={(e) => patchCard(i, { href: e.target.value || undefined })}
                    maxLength={500}
                    placeholder="Enlace del botón: https://… o mailto:tu@email (opcional)"
                    aria-label="Enlace de la tarjeta"
                    className={`cp-faint mt-3 w-full px-2 py-1 text-[0.72rem] ${fancy ? "text-center" : ""} ${inline}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {b.cards.length < CARDS_MAX && (
              <button type="button" onClick={() => onPatch((x) => (x.kind === "cards" ? { ...x, cards: [...x.cards, newCard()] } : x))} className="cp-btn-ghost">
                <Plus className="h-4 w-4" /> Añadir tarjeta
              </button>
            )}
            <button type="button" onClick={onSettings} className="cp-faint text-xs underline underline-offset-4">
              Más ajustes de las tarjetas
            </button>
          </div>
        </section>,
      );
    }
    case "quote":
      return wrap(
        bare ? (
          <figure className="cp-luxe-quote relative mx-auto max-w-2xl px-4 text-center">
            <span aria-hidden className="cp-luxe-quote-mark">
              “
            </span>
            <blockquote className="cp-display cp-thin text-[1.75rem] italic leading-snug sm:text-[2.2rem]">
              <Grow value={b.text} onChange={(v) => set("text", v)} placeholder="Tu frase" maxLength={600} label="La frase" className="text-center" />
            </blockquote>
            <div aria-hidden className="cp-section-rule mt-6">
              <span />
              <i>✦</i>
              <span />
            </div>
            <input value={b.author ?? ""} onChange={(e) => set("author", e.target.value)} placeholder="Quién lo dice (opcional)" maxLength={120} aria-label="Autora" className={`cp-gold mx-auto mt-4 block w-64 px-2 py-1 text-center text-[0.78rem] uppercase tracking-[0.4em] ${inline}`} />
          </figure>
        ) : (
          <figure className={`relative px-7 pb-8 pt-12 text-center sm:px-12 ${luxe ? "cp-include-panel" : "cp-card"}`}>
            <span aria-hidden className="cp-gold cp-display pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[4.5rem] leading-none">
              “
            </span>
            <blockquote className="cp-display text-[1.45rem] leading-snug sm:text-[1.7rem]">
              <Grow value={b.text} onChange={(v) => set("text", v)} placeholder="Tu frase" maxLength={600} label="La frase" className="text-center" />
            </blockquote>
            <input value={b.author ?? ""} onChange={(e) => set("author", e.target.value)} placeholder="— Quién lo dice (opcional)" maxLength={120} aria-label="Autora" className={`cp-eyebrow mx-auto mt-5 block w-64 px-2 py-1 text-center ${inline}`} />
          </figure>
        ),
      );
    case "timeline": {
      const setItem = (i: number, k: "label" | "title" | "text", v: string) => onPatch((x) => (x.kind === "timeline" ? { ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) } : x));
      const moveItem = (i: number, dir: -1 | 1) =>
        onPatch((x) => {
          if (x.kind !== "timeline") return x;
          const j = i + dir;
          if (j < 0 || j >= x.items.length) return x;
          const a = [...x.items];
          [a[i], a[j]] = [a[j], a[i]];
          return { ...x, items: a };
        });
      return wrap(
        <section className={bare ? "py-2" : luxe ? "cp-include-panel" : "cp-card p-6 sm:p-7"}>
          <div className="mb-10 text-center">
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={bare} />
          </div>
          <ol className="relative space-y-10">
            <span aria-hidden className="absolute bottom-2 left-[11px] top-2 w-[2px] rounded-full" style={{ background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--c-gold) 70%, transparent) 6%, color-mix(in oklab, var(--c-gold) 45%, transparent) 88%, transparent)" }} />
            {b.items.map((it, i) => (
              <li key={i} className="relative pl-10">
                <span aria-hidden className="cp-luxe-knot absolute left-0 top-[0.55rem] z-[1] grid h-6 w-6 place-items-center">
                  ✦
                </span>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input value={it.label} onChange={(e) => setItem(i, "label", e.target.value)} placeholder="Año o número" maxLength={40} aria-label="Etiqueta" className={`cp-display cp-gold w-full px-2 text-[2rem] leading-none sm:text-[2.4rem] ${inline}`} />
                    <p className="cp-display cp-thin mt-2 text-[1.45rem] leading-snug">
                      <Grow value={it.title} onChange={(v) => setItem(i, "title", v)} placeholder="Título" maxLength={100} label="Título del hito" />
                    </p>
                    <Grow value={it.text} onChange={(v) => setItem(i, "text", v)} placeholder="Texto" maxLength={400} label="Texto del hito" className="cp-muted cp-thin-text mt-1.5 text-[0.98rem] leading-relaxed" />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 opacity-70">
                    <button type="button" disabled={i === 0} onClick={() => moveItem(i, -1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-25" aria-label="Subir">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={i === b.items.length - 1} onClick={() => moveItem(i, 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-25" aria-label="Bajar">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onPatch((x) => (x.kind === "timeline" ? { ...x, items: x.items.filter((_, j) => j !== i) } : x))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" aria-label="Quitar">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {b.items.length < TIMELINE_MAX && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={() => onPatch((x) => (x.kind === "timeline" ? { ...x, items: [...x.items, newTimelineItem()] } : x))} className="cp-btn-ghost">
                <Plus className="h-4 w-4" /> Añadir paso
              </button>
            </div>
          )}
        </section>,
      );
    }
    case "pills":
      return wrap(
        <nav className="pt-2">
          <div className={`text-center ${bare || luxe ? "mb-8" : "mb-5"}`}>
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={bare || luxe} />
          </div>
          <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            {b.items.map((it, i) => (
              <li key={i} className="relative sm:min-w-[11rem] sm:max-w-[18rem] sm:flex-1">
                <div className="flex min-h-14 w-full items-center justify-center rounded-full border px-4 py-2" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 45%, transparent)", background: "color-mix(in oklab, var(--c-gold) 6%, transparent)" }}>
                  <input
                    value={it.label}
                    onChange={(e) => onPatch((x) => (x.kind === "pills" ? { ...x, items: x.items.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)) } : x))}
                    placeholder="Texto del enlace"
                    maxLength={60}
                    aria-label="Texto del enlace"
                    className={`w-full px-2 py-1 text-center text-[0.95rem] font-semibold ${inline}`}
                  />
                  <button type="button" onClick={() => onPatch((x) => (x.kind === "pills" ? { ...x, items: x.items.filter((_, j) => j !== i) } : x))} className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-60 hover:opacity-100" aria-label="Quitar">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {b.items.length < PILLS_MAX && (
              <button type="button" onClick={() => onPatch((x) => (x.kind === "pills" ? { ...x, items: [...x.items, newPill()] } : x))} className="cp-btn-ghost">
                <Plus className="h-4 w-4" /> Añadir enlace
              </button>
            )}
            <button type="button" onClick={onSettings} className="cp-faint text-xs underline underline-offset-4">
              Adónde lleva cada uno (en Ajustes)
            </button>
          </div>
        </nav>,
      );
    case "moonCircles":
      return (
        <section data-gold-title={b.goldTitle ? "" : undefined} className="cp-line rounded-[var(--r-card)] border border-dashed p-5 text-center">
          <h3 className="cp-eyebrow">
            <input value={b.title} onChange={(e) => set("title", e.target.value)} placeholder="Los próximos círculos de la luna" maxLength={80} aria-label="Título" className={`w-full px-2 py-1 text-center ${inline}`} />
          </h3>
          <p className="cp-muted mt-2 text-[0.85rem]">Aquí salen solos tus dos próximos círculos de la luna, con su fecha, el precio y «Apuntarme».</p>
        </section>
      );
    default: {
      // Foto, galería, vídeo y modelo: se ven como en la web; se cambian en «Ajustes».
      const empty =
        (b.kind === "image" && !b.image) || (b.kind === "gallery" && !b.images.length) || (b.kind === "video" && !b.upload && !b.embedUrl);
      if (empty)
        return (
          <Empty onSettings={onSettings}>
            {b.kind === "image" ? "Añade la imagen" : b.kind === "gallery" ? "Añade las fotos de la galería" : "Añade el vídeo"}
          </Empty>
        );
      return (
        <div className="relative">
          <div className="pointer-events-none">
            <ContentBlocks blocks={[b]} username={p.username} titleLevel={2} hiddenSlugs={p.hiddenSlugs} siteOrigin={p.siteOrigin} oracleDecks={p.oracleDecks} moonCircles={p.moonCircles} bare={mode.bare} luxe={mode.luxe} />
          </div>
          <button type="button" onClick={onSettings} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
            <Settings2 className="h-3.5 w-3.5" /> Cambiar
          </button>
        </div>
      );
    }
  }
}
