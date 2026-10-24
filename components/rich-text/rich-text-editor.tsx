"use client";
import { Bold, ChevronDown, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Minus, Quote } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { uploadImage } from "@/components/ui/image-upload";
import { RICH_IMAGE_ACCEPT } from "@/lib/file-types";
import { RICH_TEXT_FORMAT } from "@/lib/rich-text";
import {
  continueListOnEnter,
  insertDivider,
  insertImage,
  insertLink,
  normalizeLinkInput,
  toggleInline,
  toggleLinePrefix,
  type LineTool,
  type Splice,
} from "@/lib/rich-text-edit";
import type { LegacyFlavor } from "./legacy-text";
import { RichContent, type RichTone } from "./rich-content";

/**
 * Editor de texto con formato pensado para el iPhone: un <textarea> normal (teclado, dictado,
 * autocorrección y «Deshacer» del sistema) con una barra de botones que escribe las marcas
 * (**negrita**, ## Encabezado…) y una vista previa «Cómo queda» debajo.
 *
 *   · Sin control (formularios con server actions): name, defaultValue, formatName, initialFormat.
 *     Un <input hidden name={formatName}> envía "MD" en cuanto se toca el texto; mientras no se
 *     toca envía el formato que tenía ("" = texto de antes), así un texto antiguo se guarda igual.
 *   · Con control (editor de la página): value, onChange, onFormatChange.
 *
 * Los botones no quitan el foco (preventDefault en pointerdown) y los cambios se aplican con
 * execCommand("insertText") para que el «Deshacer» nativo funcione.
 */
type Tool = "bold" | "italic" | "h2" | "h3" | "ul" | "ol" | "link" | "image" | "quote" | "hr";

const TOOL_INFO: Record<Tool, { label: string; icon: typeof Bold }> = {
  bold: { label: "Negrita", icon: Bold },
  italic: { label: "Cursiva", icon: Italic },
  h2: { label: "Encabezado", icon: Heading2 },
  h3: { label: "Subencabezado", icon: Heading3 },
  ul: { label: "Lista", icon: List },
  ol: { label: "Lista numerada", icon: ListOrdered },
  link: { label: "Enlace", icon: Link2 },
  image: { label: "Imagen", icon: ImagePlus },
  quote: { label: "Cita", icon: Quote },
  hr: { label: "Línea", icon: Minus },
};

const PREVIEW_KEY = "cirella:rte-preview";

export function RichTextEditor({
  id,
  name,
  ariaLabel,
  formatName,
  defaultValue = "",
  initialFormat = null,
  value: controlledValue,
  onChange,
  onFormatChange,
  maxLength,
  required,
  tools = "full",
  headings = false,
  images = false,
  preview = true,
  tone = "account",
  headingLevel = 2,
  listMarker = "dot",
  legacy = "links",
  placeholder,
  rows = 8,
}: {
  id?: string;
  name?: string;
  ariaLabel?: string;
  formatName?: string;
  defaultValue?: string;
  initialFormat?: string | null;
  value?: string;
  onChange?: (v: string) => void;
  onFormatChange?: (f: "MD") => void;
  maxLength?: number;
  required?: boolean;
  tools?: "full" | "basic";
  headings?: boolean;
  images?: boolean;
  preview?: boolean;
  tone?: RichTone;
  headingLevel?: 2 | 3 | 4;
  listMarker?: "dot" | "star";
  /** Cómo se pintaba este texto antes del formato (para la vista previa de un texto sin tocar). */
  legacy?: LegacyFlavor;
  placeholder?: string;
  rows?: number;
}) {
  const autoId = useId();
  const fieldId = id ?? `rte-${autoId.replace(/:/g, "")}`;
  const controlled = controlledValue !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ? controlledValue : inner;
  const wasRich = initialFormat === RICH_TEXT_FORMAT;
  const [touched, setTouched] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const savedSel = useRef<{ s: number; e: number }>({ s: 0, e: 0 });
  const [link, setLink] = useState<{ text: string; href: string; error: string | null } | null>(null);
  const [upload, setUpload] = useState<{ pct: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shown, setShown] = useState(value);
  const [previewOpen, setPreviewOpen] = useState(true);

  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInner(v);
      onChange?.(v);
      if (!touched) {
        setTouched(true);
        onFormatChange?.(RICH_TEXT_FORMAT);
      }
    },
    [controlled, onChange, onFormatChange, touched],
  );

  // El texto crece con lo escrito (Safari no tiene field-sizing): sin scroll dentro del scroll.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  // «Cómo queda» se actualiza al escribir, sin repintar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 150);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    try {
      if (localStorage.getItem(PREVIEW_KEY) === "0") setPreviewOpen(false);
    } catch {
      /* sin almacenamiento: abierta */
    }
  }, []);

  // form.reset() (p. ej. tras publicar en la membresía) vacía también el editor.
  useEffect(() => {
    const form = ta.current?.form;
    if (!form || controlled) return;
    const onReset = () => {
      setInner(defaultValue);
      setShown(defaultValue);
      setTouched(false);
      setLink(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  const apply = (sp: Splice) => {
    const el = ta.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(sp.from, sp.to);
    const expected = el.value.slice(0, sp.from) + sp.insert + el.value.slice(sp.to);
    let done = false;
    try {
      done = sp.insert ? document.execCommand("insertText", false, sp.insert) : sp.from === sp.to || document.execCommand("delete");
    } catch {
      done = false;
    }
    if (!done || el.value !== expected) {
      el.value = el.value === expected ? expected : el.value.slice(0, sp.from) + sp.insert + el.value.slice(sp.to);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      setValue(el.value);
    }
    el.setSelectionRange(sp.selStart, sp.selEnd);
  };

  const sel = () => {
    const el = ta.current!;
    return { v: el.value, s: el.selectionStart, e: el.selectionEnd };
  };

  const run = (tool: Tool) => {
    const { v, s, e } = sel();
    if (tool === "bold") return apply(toggleInline(v, s, e, "**", "negrita"));
    if (tool === "italic") return apply(toggleInline(v, s, e, "_", "cursiva"));
    if (tool === "hr") return apply(insertDivider(v, s));
    if (tool === "link") {
      savedSel.current = { s, e };
      setLink({ text: v.slice(s, e), href: "", error: null });
      return;
    }
    if (tool === "image") {
      savedSel.current = { s, e };
      fileInput.current?.click();
      return;
    }
    apply(toggleLinePrefix(v, s, e, tool as LineTool));
  };

  const confirmLink = () => {
    if (!link) return;
    const res = normalizeLinkInput(link.href);
    if ("error" in res) return setLink({ ...link, error: res.error });
    const el = ta.current;
    if (!el) return;
    const { s, e } = savedSel.current;
    setLink(null);
    apply(insertLink(el.value, s, e, link.text, res.href));
  };

  const list: Tool[] =
    tools === "full"
      ? ["bold", "italic", "h2", "h3", "ul", "ol", "link", ...(images ? (["image"] as Tool[]) : []), "quote", "hr"]
      : ["bold", "italic", ...(headings ? (["h2", "h3"] as Tool[]) : []), "ul", "link"];

  const format = touched ? RICH_TEXT_FORMAT : (initialFormat ?? "");
  const legacyText = !wasRich && !!defaultValue.trim();
  const count = value.length;

  return (
    <div className="rte min-w-0">
      <div
        role="toolbar"
        aria-label="Barra de formato"
        aria-controls={fieldId}
        className="sticky top-[var(--rte-sticky-top,3.5rem)] z-20 flex w-0 min-w-full gap-1 overflow-x-auto rounded-t-xl border border-b-0 border-line bg-white/95 px-1 py-1 backdrop-blur [mask-image:linear-gradient(to_right,#000_92%,transparent)] [scrollbar-width:none]"
      >
        {list.map((tool) => {
          const { label, icon: Icon } = TOOL_INFO[tool];
          return (
            <button
              key={tool}
              type="button"
              aria-label={label}
              title={label}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(tool)}
              disabled={tool === "image" && !!upload}
              className="inline-flex h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[0.68rem] font-medium text-ink/80 hover:bg-sand active:bg-sand disabled:opacity-50"
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span aria-hidden>{label}</span>
            </button>
          );
        })}
      </div>

      {link && (
        <div className="border border-b-0 border-line bg-cream/60 p-3" role="group" aria-label="Añadir un enlace">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor={`${fieldId}-link-text`}>Texto que se ve</label>
              <input
                id={`${fieldId}-link-text`}
                className="input text-base sm:text-sm"
                value={link.text}
                onChange={(e) => setLink({ ...link, text: e.target.value })}
                placeholder="Mi Instagram"
              />
            </div>
            <div>
              <label className="field-label" htmlFor={`${fieldId}-link-href`}>Dirección</label>
              <input
                id={`${fieldId}-link-href`}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                className="input text-base sm:text-sm"
                value={link.href}
                onChange={(e) => setLink({ ...link, href: e.target.value, error: null })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmLink();
                  }
                  if (e.key === "Escape") setLink(null);
                }}
                placeholder="instagram.com/tu_usuario, tu email, un teléfono o /mi-curso"
                aria-invalid={!!link.error}
                aria-describedby={link.error ? `${fieldId}-link-error` : undefined}
              />
            </div>
          </div>
          {link.error && (
            <p id={`${fieldId}-link-error`} className="mt-2 text-sm text-rose" role="alert">
              {link.error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={confirmLink}>
              Insertar enlace
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLink(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <textarea
        ref={ta}
        id={fieldId}
        name={name}
        aria-label={ariaLabel}
        className="input block w-full resize-none overflow-hidden rounded-t-none text-base leading-relaxed"
        style={{ minHeight: `${Math.max(3, rows) * 1.65 + 1.5}rem` }}
        rows={rows}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoCapitalize="sentences"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
          const el = e.currentTarget;
          if (el.selectionStart !== el.selectionEnd) return;
          const sp = continueListOnEnter(el.value, el.selectionStart);
          if (!sp) return;
          e.preventDefault();
          apply(sp);
        }}
      />
      {formatName && <input type="hidden" name={formatName} value={format} />}

      {images && (
        <input
          ref={fileInput}
          type="file"
          accept={RICH_IMAGE_ACCEPT}
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploadError(null);
            setUpload({ pct: 0 });
            try {
              const url = await uploadImage(f, (pct) => setUpload({ pct }));
              const el = ta.current;
              if (el) apply(insertImage(el.value, Math.min(savedSel.current.e, el.value.length), url, ""));
            } catch (err) {
              setUploadError(err instanceof Error ? err.message : "No se pudo subir la imagen");
            } finally {
              setUpload(null);
            }
          }}
        />
      )}

      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <div className="min-w-0 flex-1 space-y-1">
          {upload && (
            <p className="flex items-center gap-1.5 font-medium text-ink" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {upload.pct < 100 ? `Subiendo imagen… ${upload.pct} %` : "Optimizando…"}
            </p>
          )}
          {uploadError && <p className="text-rose" role="alert">{uploadError}</p>}
          {legacyText && <p className="text-[#7a5a1c]">Este texto es de antes del formato: revisa cómo queda antes de guardar.</p>}
          <FormatHelp headings={tools === "full" || headings} />
        </div>
        {maxLength ? (
          <span className="tabular-nums" aria-live="off">
            {count.toLocaleString("es-ES")} / {maxLength.toLocaleString("es-ES")}
          </span>
        ) : null}
      </div>

      {preview && (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-white/60">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted"
            aria-expanded={previewOpen}
            onClick={() => {
              const next = !previewOpen;
              setPreviewOpen(next);
              try {
                localStorage.setItem(PREVIEW_KEY, next ? "1" : "0");
              } catch {
                /* sin almacenamiento */
              }
            }}
          >
            Cómo queda
            <ChevronDown className={`h-4 w-4 transition ${previewOpen ? "rotate-180" : ""}`} />
          </button>
          {previewOpen && (
            <div className="border-t border-line px-4 py-4 text-[0.98rem] leading-relaxed text-ink/85" data-rte-preview>
              {shown.trim() ? (
                <RichContent
                  text={shown}
                  format={touched || wasRich ? RICH_TEXT_FORMAT : null}
                  legacy={legacy}
                  tone={tone}
                  headingLevel={headingLevel}
                  listMarker={listMarker}
                  className="space-y-3"
                />
              ) : (
                <p className="text-sm text-muted">Aquí verás el texto con su formato.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormatHelp({ headings }: { headings: boolean }): ReactNode {
  return (
    <details className="group">
      <summary className="cursor-pointer select-none font-medium text-ink/70 hover:text-ink">Cómo dar formato</summary>
      <p className="mt-1 leading-relaxed">
        **negrita** (o *negrita*, como en WhatsApp) · _cursiva_ ·{headings ? " ## Encabezado · ### Subencabezado ·" : ""} - lista · 1. lista · &gt; cita · --- línea ·
        [texto](https://…). Un hashtag sin espacio (#astrología) se queda como texto. Deja una línea en blanco entre párrafos.
      </p>
    </details>
  );
}
