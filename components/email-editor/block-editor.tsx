"use client";

import { ArrowDown, ArrowUp, Copy, ImagePlus, Loader2, Minus, MousePointerClick, Plus, Space, Trash2, Type, Heading } from "lucide-react";
import { useRef, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { uploadFile } from "@/components/ui/upload-client";
import { type Align, BLOCK_LABEL, EMAIL_BLOCKS_MAX, EMAIL_TEXT_MAX, newBlock, newBlockId, VARIABLE_HELP, type EmailBlock, type EmailBlockType, type EmailDesign, type EmailVars } from "@/lib/email-blocks";
import { RICH_IMAGE_ACCEPT } from "@/lib/file-types";
import { normalizeLinkInput } from "@/lib/rich-text-edit";

/**
 * Editor visual de un email, pensado para el iPhone: una columna de tarjetas (una por bloque) con
 * ↑ ↓, duplicar y borrar (botones de 44 px, sin arrastrar) y «Añadir bloque» al final. Lo usan la
 * newsletter y los emails automáticos. Nunca se escribe HTML: son datos (lib/email-blocks.ts).
 */
const ADD: { t: Exclude<EmailBlockType, "hero" | "spotlight" | "video" | "columns" | "social">; icon: typeof Type; hint: string }[] = [
  { t: "title", icon: Heading, hint: "Un titular" },
  { t: "text", icon: Type, hint: "Párrafos con negrita, listas y enlaces" },
  { t: "image", icon: ImagePlus, hint: "Tu imagen de Canva o una foto" },
  { t: "button", icon: MousePointerClick, hint: "Un botón con enlace" },
  { t: "divider", icon: Minus, hint: "Una línea" },
  { t: "spacer", icon: Space, hint: "Aire entre bloques" },
];

export function BlockEditor({ value, onChange, vars }: { value: EmailDesign; onChange: (d: EmailDesign) => void; vars: (keyof EmailVars)[] }) {
  const [adding, setAdding] = useState(false);
  const blocks = value.blocks;
  const set = (next: EmailBlock[]) => onChange({ v: 1, blocks: next });
  const update = (id: string, patch: Partial<EmailBlock>) => set(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const full = blocks.length >= EMAIL_BLOCKS_MAX;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Puedes escribir {vars.map((v, i) => (
          <span key={v}>
            {i > 0 && (i === vars.length - 1 ? " y " : ", ")}
            <code className="rounded bg-sand px-1 text-ink">{`{${v}}`}</code> ({VARIABLE_HELP[v]})
          </span>
        ))}
        : se cambian solos al enviar.
      </p>
      {blocks.length === 0 && <p className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">Aún no hay nada: añade un texto.</p>}
      {blocks.map((b, i) => (
        <div key={b.id} className="card p-3 sm:p-4" data-block={b.t}>
          <div className="mb-2 flex items-center gap-1">
            <p className="flex-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{BLOCK_LABEL[b.t]}</p>
            <IconButton label="Subir" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></IconButton>
            <IconButton label="Bajar" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><ArrowDown className="h-4 w-4" /></IconButton>
            <IconButton label="Duplicar" onClick={() => !full && set([...blocks.slice(0, i + 1), { ...b, id: newBlockId() }, ...blocks.slice(i + 1)])} disabled={full}><Copy className="h-4 w-4" /></IconButton>
            <IconButton label="Borrar" onClick={() => set(blocks.filter((x) => x.id !== b.id))}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
          <BlockFields block={b} onChange={(patch) => update(b.id, patch)} />
        </div>
      ))}
      {adding ? (
        <div className="card p-3" role="group" aria-label="Añadir bloque">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ADD.map(({ t, icon: Icon, hint }) => (
              <button
                key={t}
                type="button"
                className="flex min-h-14 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-left text-sm hover:border-ink/30"
                onClick={() => {
                  set([...blocks, newBlock(t)]);
                  setAdding(false);
                }}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <span>
                  <span className="block font-semibold">{BLOCK_LABEL[t]}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="btn btn-outline h-12 w-full" disabled={full} onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Añadir bloque
        </button>
      )}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink disabled:opacity-25">
      {children}
    </button>
  );
}

function LinkInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        id={id}
        className="input text-base sm:text-sm"
        type="text"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setError(null);
          onChange(e.target.value);
        }}
        onBlur={() => {
          if (!value.trim()) return;
          const r = normalizeLinkInput(value);
          if ("error" in r) setError(r.error);
          else onChange(r.href);
        }}
        aria-invalid={!!error}
      />
      {error && <p className="mt-1 text-xs text-rose" role="alert">{error}</p>}
    </div>
  );
}

function BlockFields({ block: b, onChange }: { block: EmailBlock; onChange: (patch: Partial<EmailBlock>) => void }) {
  const fid = `blk-${b.id}`;
  switch (b.t) {
    case "title":
      return (
        <div className="space-y-2">
          <input id={fid} aria-label="Título" className="input text-base" maxLength={140} value={b.text} placeholder="Hola, {nombre}" onChange={(e) => onChange({ text: e.target.value })} />
          <Align value={b.align} onChange={(align) => onChange({ align })} />
        </div>
      );
    case "text":
      return (
        <RichTextEditor
          ariaLabel="Texto"
          value={b.body}
          initialFormat="MD"
          onChange={(body) => onChange({ body })}
          maxLength={EMAIL_TEXT_MAX}
          tools="basic"
          headings
          preview={false}
          rows={4}
          placeholder="Escribe aquí…"
        />
      );
    case "image":
      return <ImageFields block={b} onChange={onChange} />;
    case "button":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor={`${fid}-label`}>Texto del botón</label>
            <input id={`${fid}-label`} className="input text-base sm:text-sm" maxLength={40} value={b.label} placeholder="Reservar mi lectura" onChange={(e) => onChange({ label: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor={`${fid}-href`}>Enlace</label>
            <LinkInput id={`${fid}-href`} value={b.href} onChange={(href) => onChange({ href })} placeholder="/mi-curso o https://…" />
          </div>
          <Align value={b.align} onChange={(align) => onChange({ align })} />
        </div>
      );
    case "divider":
      return <hr className="border-line" />;
    case "spacer":
      return (
        <select aria-label="Tamaño del espacio" className="input h-11 text-base sm:text-sm" value={b.size} onChange={(e) => onChange({ size: e.target.value as "s" | "m" | "l" })}>
          <option value="s">Pequeño</option>
          <option value="m">Mediano</option>
          <option value="l">Grande</option>
        </select>
      );
  }
}

function Align({ value, onChange }: { value: Align; onChange: (v: Align) => void }) {
  return (
    <div className="inline-flex rounded-full bg-sand p-1 text-xs">
      {(["left", "center"] as const).map((a) => (
        <button key={a} type="button" onClick={() => onChange(a)} className={`rounded-full px-3 py-1.5 font-medium ${value === a ? "bg-white shadow-soft" : "text-muted"}`} aria-pressed={value === a}>
          {a === "left" ? "A la izquierda" : "Centrado"}
        </button>
      ))}
    </div>
  );
}

function ImageFields({ block: b, onChange }: { block: Extract<EmailBlock, { t: "image" }>; onChange: (patch: Partial<EmailBlock>) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fid = `blk-${b.id}`;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative grid min-h-28 w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-white text-sm text-muted hover:border-ink/30"
      >
        {b.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.url} alt="" className={`h-auto ${b.width === "narrow" ? "max-w-[320px]" : "w-full"}`} />
        ) : (
          <span className="flex flex-col items-center gap-1.5 py-6">
            <ImagePlus className="h-6 w-6" /> Subir imagen
          </span>
        )}
        {pct !== null && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/80 text-xs font-medium text-ink" aria-live="polite">
            <Loader2 className="h-5 w-5 animate-spin" /> {pct < 100 ? `${pct} %` : "Optimizando…"}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={RICH_IMAGE_ACCEPT}
        className="hidden"
        aria-label="Imagen"
        data-testid={`${fid}-file`}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setError(null);
          setPct(0);
          try {
            const r = await uploadFile(f, { purpose: "image", email: true, onProgress: (p) => setPct(p) });
            if (r.url) onChange({ url: r.url });
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
          } finally {
            setPct(null);
          }
        }}
      />
      {error && <p className="text-xs text-rose" role="alert">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${fid}-alt`}>Qué se ve (texto alternativo)</label>
          <input id={`${fid}-alt`} className="input text-base sm:text-sm" maxLength={200} value={b.alt} placeholder="Luna llena sobre el mar" onChange={(e) => onChange({ alt: e.target.value })} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fid}-href`}>Enlace al pulsarla (opcional)</label>
          <LinkInput id={`${fid}-href`} value={b.href ?? ""} onChange={(href) => onChange({ href: href || undefined })} placeholder="/mi-curso o https://…" />
        </div>
      </div>
      <select aria-label="Ancho de la imagen" className="input h-11 text-base sm:text-sm" value={b.width} onChange={(e) => onChange({ width: e.target.value as "full" | "narrow" })}>
        <option value="full">Todo el ancho</option>
        <option value="narrow">Más pequeña, centrada</option>
      </select>
    </div>
  );
}
