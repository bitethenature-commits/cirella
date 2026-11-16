"use client";

import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Settings2, Trash2, X } from "lucide-react";
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
  type EmailVars,
  type SocialNetwork,
} from "@/lib/email-blocks";
import { BlockEditor } from "./block-editor";

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
          {label}
        </button>
      )}
      {url && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
          <button type="button" onClick={() => input.current?.click()} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            Cambiar foto
          </button>
          <button type="button" onClick={() => onChange("")} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            Quitar
          </button>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}
      {error && <p className="absolute inset-x-2 top-2 rounded-lg bg-red-600/90 px-2 py-1 text-center text-xs text-white">{error}</p>}
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

/**
 * El email escrito encima: se ve como le llega (noche y oro), con su asunto arriba, y cada parte se
 * escribe donde está. Cada bloque tiene su barra (subir, bajar, ajustes, borrar) y entre bloques se
 * añade otro con «Añadir aquí». Lo que el editor de bloques sabe hacer de más (colores, fondos,
 * tamaños), en «Ajustes». Abajo, lo que el email añade solo (el recibo, el acceso, la fecha…).
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
  const [settings, setSettings] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const last = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const set = (next: EmailBlock[]) => p.onChange({ ...p.value, blocks: next });
  const patch = (id: string, change: Partial<EmailBlock>) => set(blocks.map((b) => (b.id === id ? ({ ...b, ...change } as EmailBlock) : b)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const add = (at: number, t: EmailBlockType) => {
    const b = { ...newBlock(t, style), id: uid() } as EmailBlock;
    const next = [...blocks];
    next.splice(at, 0, b);
    set(next);
    setAdding(null);
    if (!["title", "text", "button", "image", "spotlight", "divider", "spacer", "hero"].includes(t)) setSettings(b.id);
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
    blocks.length >= EMAIL_BLOCKS_MAX ? null : (
      <div className="relative flex justify-center py-1.5">
        <button
          type="button"
          onClick={() => setAdding(adding === at ? null : at)}
          className="inline-flex items-center gap-1 rounded-full border border-[#D9BF8C]/30 px-3 py-1 text-[0.72rem] text-[#D9BF8C]/80 opacity-60 transition hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir aquí
        </button>
        {adding === at && (
          <div className="absolute top-full z-20 mt-1 grid w-[min(22rem,90vw)] grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-2 text-ink shadow-lift sm:grid-cols-3">
            {ADD.map((t) => (
              <button key={t} type="button" onClick={() => add(at, t)} className="rounded-xl px-2.5 py-2 text-left text-sm hover:bg-sand">
                {BLOCK_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    );

  const editing = settings ? blocks.find((b) => b.id === settings) : null;

  return (
    <div>
      {/* Las variables: se ponen donde está el cursor. */}
      {p.vars.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Toca para ponerlo donde escribes:</span>
          {p.vars.map((k) => (
            <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVar(k)} className="chip" title={`Se cambia solo por ${VAR_LABEL[k]?.toLowerCase() ?? k}`}>
              {VAR_LABEL[k] ?? k} <code className="opacity-60">{`{${k}}`}</code>
            </button>
          ))}
        </div>
      )}

      <div
        className="mail-canvas overflow-hidden rounded-[1.6rem] border border-line shadow-lift"
        onFocusCapture={(e) => {
          const t = e.target;
          if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === "text")) last.current = t;
        }}
      >
        {/* Como en el buzón: de quién y el asunto. */}
        <div className="border-b border-[#3A3354] bg-[#120F30] px-4 py-3 text-sm sm:px-6">
          <p className="text-xs text-[#A99FC2]">
            De: <span className="text-[#E8DFCB]">{p.brand}</span>
          </p>
          <label className="mt-1 flex items-center gap-2">
            <span className="shrink-0 text-xs text-[#A99FC2]">Asunto:</span>
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

        <div className="mail-sky px-3 py-10 sm:px-8">
          <div className="mx-auto max-w-[560px]">
            <div className="mb-6 text-center font-serif">
              <p className="text-[0.62rem] tracking-[0.6em] text-[#D9BF8C]">✦ ✦ ✦</p>
              <p className="mt-2 text-[1.5rem] tracking-[0.08em] text-[#F3E3BF]">{p.brand}</p>
            </div>
            <div className="rounded-[24px] border border-[#6E5B3A] p-[5px]">
              <div className="rounded-[19px] border border-[#3A3354] bg-[#17143A] px-4 py-8 sm:px-8">
                {p.mode === "intro" && blocks.length === 0 && (
                  <p className="mb-2 text-center text-xs text-[#A99FC2]">Tu texto va aquí arriba, antes de lo que el email pone solo. Añade un bloque si quieres escribir algo.</p>
                )}
                <AddHere at={0} />
                {blocks.map((b, i) => (
                  <div key={b.id}>
                    <div className="group/block relative rounded-xl py-2 transition hover:bg-white/[0.02]" data-email-block={b.t}>
                      {/* La barra del bloque */}
                      <div className="absolute -top-3 right-0 z-10 flex items-center gap-0.5 rounded-full border border-line bg-white px-1 py-0.5 text-ink opacity-0 shadow-soft transition group-hover/block:opacity-100 group-focus-within/block:opacity-100">
                        <span className="px-2 text-[0.68rem] font-semibold text-muted">{BLOCK_LABEL[b.t]}</span>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-full hover:bg-sand disabled:opacity-30" aria-label="Subir">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="grid h-7 w-7 place-items-center rounded-full hover:bg-sand disabled:opacity-30" aria-label="Bajar">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setSettings(b.id)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-sand" aria-label="Ajustes" title="Colores, tamaños y más">
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => set(blocks.filter((x) => x.id !== b.id))} className="grid h-7 w-7 place-items-center rounded-full text-rose hover:bg-sand" aria-label="Borrar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <BlockOnMail block={b} patch={(c) => patch(b.id, c)} onSettings={() => setSettings(b.id)} />
                    </div>
                    <AddHere at={i + 1} />
                  </div>
                ))}

                {/* Lo que el email pone solo */}
                {p.fixed && (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#D9BF8C]/35 px-4 py-4 text-center">
                    <p className="text-[0.62rem] uppercase tracking-[0.3em] text-[#D9BF8C]">Esto lo pone el email solo</p>
                    <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[#A99FC2]">{p.fixed}</p>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-5 text-center text-[0.7rem] tracking-[0.5em] text-[#6E5B3A]">✦</p>
          </div>
        </div>
      </div>

      {/* Ajustes de un bloque: el editor de bloques con solo ese bloque */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={() => setSettings(null)}>
          <div className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 text-ink shadow-lift sm:rounded-3xl sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">Ajustes · {BLOCK_LABEL[editing.t]}</p>
              <button type="button" onClick={() => setSettings(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <BlockEditor
              value={{ v: 1, blocks: [editing], style: p.value.style }}
              onChange={(d) => {
                const at = blocks.findIndex((b) => b.id === editing.id);
                if (at < 0) return;
                const next = [...blocks];
                next.splice(at, 1, ...d.blocks);
                set(next);
                if (!d.blocks.some((b) => b.id === editing.id)) setSettings(null);
              }}
              vars={p.vars}
              palette={p.palette}
              socials={p.socials}
              siteUrl={p.siteUrl}
              videoUploads={p.videoUploads}
            />
            <button type="button" onClick={() => setSettings(null)} className="btn btn-primary mt-4 w-full">
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Un bloque tal y como sale en el email, con lo que se escribe encima. */
function BlockOnMail({ block: b, patch, onSettings }: { block: EmailBlock; patch: (c: Partial<EmailBlock>) => void; onSettings: () => void }) {
  switch (b.t) {
    case "title":
      return (
        <Grow
          value={b.text}
          onChange={(text) => patch({ text })}
          placeholder="Un título"
          label="Título"
          maxLength={200}
          className={`font-serif text-[1.75rem] leading-tight text-[#F3E3BF] ${alignClass(b.align)}`}
        />
      );
    case "text":
      return <Body value={b.body} onChange={(body) => patch({ body })} label="Texto" />;
    case "button":
      return (
        <div className={alignClass(b.align)}>
          <span className="inline-block rounded-full bg-[#D9BF8C] px-1.5 py-1">
            <input
              type="text"
              value={b.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="Texto del botón"
              aria-label="Texto del botón"
              maxLength={60}
              size={Math.max(12, b.label.length + 2)}
              className="rounded-full bg-transparent px-4 py-2 text-center text-[0.8rem] font-bold uppercase tracking-[0.14em] text-[#1A1408] outline-none placeholder:text-[#1A1408]/40 focus:ring-2 focus:ring-[#1A1408]/30"
            />
          </span>
          <input
            type="text"
            value={b.href}
            onChange={(e) => patch({ href: e.target.value })}
            placeholder="Enlace del botón: https://…"
            aria-label="Enlace del botón"
            className={`mx-auto mt-2 block w-full max-w-sm px-2 py-1 text-center text-xs text-[#A99FC2] ${inline}`}
          />
        </div>
      );
    case "image":
      return <Photo url={b.url} onChange={(url) => patch({ url })} className={b.width === "narrow" ? "mx-auto max-w-[70%]" : ""} />;
    case "divider":
      return <p className="py-2 text-center text-[0.7rem] tracking-[0.5em] text-[#D9BF8C]">{b.style === "stars" ? "✦ ✦ ✦" : "— ✦ —"}</p>;
    case "spacer":
      return <div className={b.size === "s" ? "h-3" : b.size === "l" ? "h-12" : "h-6"} aria-label="Espacio" />;
    case "spotlight":
      return (
        <div className="rounded-2xl border-l-2 border-[#D9BF8C] bg-[#211D49] px-4 py-4">
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={b.icon}
              onChange={(e) => patch({ icon: e.target.value })}
              aria-label="Icono"
              maxLength={4}
              className={`w-10 px-1 py-0.5 text-center text-lg ${inline}`}
            />
            <div className="min-w-0 flex-1">
              <Grow value={b.title} onChange={(title) => patch({ title })} placeholder="Título del destacado" label="Título del destacado" maxLength={120} className="font-serif text-[1.25rem] text-[#F3E3BF]" />
              <Body value={b.body} onChange={(body) => patch({ body })} label="Texto del destacado" placeholder="Lo que no se tiene que perder…" />
            </div>
          </div>
        </div>
      );
    case "hero":
      return (
        <div className="relative overflow-hidden rounded-2xl">
          <Photo url={b.image} onChange={(image) => patch({ image })} className="min-h-56" label="Foto de fondo" />
          <div className="pointer-events-none absolute inset-0 bg-black/40" />
          <div className={`absolute inset-x-4 top-1/2 -translate-y-1/2 space-y-1 ${b.align === "center" ? "text-center" : ""}`}>
            <Grow value={b.title} onChange={(title) => patch({ title })} placeholder="Título de la portada" label="Título de la portada" maxLength={120} className="font-serif text-[1.8rem] leading-tight text-white" />
            <Grow value={b.subtitle} onChange={(subtitle) => patch({ subtitle })} placeholder="Subtítulo" label="Subtítulo de la portada" maxLength={200} className="text-[0.95rem] text-white/85" />
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
        <span className="block text-[0.62rem] uppercase tracking-[0.3em] text-[#D9BF8C]">{BLOCK_LABEL[b.t]}</span>
        {text}
      </span>
      <Settings2 className="h-4 w-4 text-[#D9BF8C]" />
    </button>
  );
}
