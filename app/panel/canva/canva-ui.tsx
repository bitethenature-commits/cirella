"use client";
import { ArrowLeft, Check, ExternalLink, ImagePlus, Link2, Loader2, Paintbrush, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { askText } from "@/components/ui/ask-confirm";
import { uploadImage } from "@/components/ui/image-upload";

/**
 * Las piezas del modo Canva (app/panel/canva): la barra de arriba, los textos que se escriben encima, las
 * fotos con «Cambiar foto» y el botón de los enlaces. Todo lo que es del Canva lleva data-canva-ui: sus
 * clics no se cancelan (los de la web sí, para no salir de la página mientras se edita).
 */

export type SaveState = { kind: "idle" | "pending" | "saving" | "ok" } | { kind: "error"; error: string };

export type CanvaPage = { id: string; title: string; slug: string; status: string };

/** La barra fija de arriba: qué página se edita, si ya está publicado y salir. */
export function CanvaBar({ pages, current, state, viewHref, extra }: { pages: CanvaPage[]; current: string | null; state: SaveState; viewHref: string; extra?: ReactNode }) {
  return (
    <div data-canva-ui className="sticky top-0 z-[85] flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0f0d22]/95 px-3 py-2 text-[#f3ecdd] backdrop-blur sm:px-4">
      <Link href="/panel/pagina" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Panel
      </Link>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#e9cc8e]">
        <Paintbrush className="h-4 w-4" /> Canva
      </span>
      <select
        aria-label="Página que editas"
        value={current ?? ""}
        onChange={(e) => {
          const p = pages.find((x) => x.id === e.target.value);
          window.location.href = p ? `/panel/canva?pagina=${encodeURIComponent(p.slug)}` : "/panel/canva";
        }}
        className="h-9 max-w-[12rem] rounded-full border border-white/15 bg-white/5 px-3 text-sm text-white outline-none"
      >
        <option value="" className="text-ink">Portada</option>
        {pages.map((p) => (
          <option key={p.id} value={p.id} className="text-ink">
            {p.title}
            {p.status !== "PUBLISHED" ? " (sin publicar)" : ""}
          </option>
        ))}
      </select>
      <span className="ml-auto inline-flex items-center gap-1.5 text-xs" role="status">
        {state.kind === "saving" || state.kind === "pending" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Publicando…
          </>
        ) : state.kind === "ok" ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400" /> Publicado
          </>
        ) : state.kind === "error" ? (
          <span className="inline-flex items-center gap-1.5 text-[#f2a99f]">
            <TriangleAlert className="h-3.5 w-3.5" /> No se ha publicado: {state.error}
          </span>
        ) : (
          <span className="text-white/55">Escribe encima de tu web: se publica al momento</span>
        )}
      </span>
      {extra}
      <a href={viewHref} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#e9cc8e] px-3.5 text-sm font-semibold text-[#1d1838] hover:bg-[#f3dca6]">
        <ExternalLink className="h-4 w-4" /> Ver la web
      </a>
    </div>
  );
}

/** Un texto que se escribe encima de la web. Se guarda al salir de él (Intro en los de una línea; Esc deshace). */
export function EditText({ value, onCommit, multiline = false, placeholder }: { value: string; onCommit: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <span
      key={value}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder ?? "Escribe aquí"}
      className={`canva-text ${multiline ? "whitespace-pre-line" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.textContent = value;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const raw = (e.currentTarget.innerText ?? "").replace(/ /g, " ");
        const next = multiline ? raw.replace(/\n{3,}/g, "\n\n").trim() : raw.replace(/\s+/g, " ").trim();
        if (next !== value) onCommit(next);
      }}
    >
      {value}
    </span>
  );
}

/** Una foto de la web con «Cambiar foto» (y «Quitar» si se puede dejar sin ella). */
export function EditImage({ children, onChange, onFile, round = false, label, removable = false, hasImage }: { children: ReactNode; onChange: (url: string | null) => void; /** Subir la foto a su manera (p. ej. con sus medidas). */ onFile?: (file: File) => Promise<void>; round?: boolean; label?: string; removable?: boolean; hasImage: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={`group/img relative ${round ? "inline-block" : "block"}`}>
      {children}
      <span data-canva-ui className={`absolute inset-0 z-20 flex flex-wrap items-center justify-center gap-1.5 ${round ? "rounded-full" : ""} ${hasImage ? "bg-black/0 opacity-0 transition group-hover/img:bg-black/35 group-hover/img:opacity-100 focus-within:opacity-100" : ""}`}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1838]/90 px-3 py-1.5 text-xs font-semibold text-[#f3e2b3] shadow-lg"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {round ? "" : label ?? (hasImage ? "Cambiar foto" : "Añadir foto")}
        </button>
        {removable && hasImage && (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg" aria-label="Quitar la foto">
            <X className="h-3.5 w-3.5" /> {round ? "" : "Quitar"}
          </button>
        )}
        {error && <span className="w-full text-center text-xs font-semibold text-[#f2a99f]">{error}</span>}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            if (onFile) await onFile(file);
            else onChange(await uploadImage(file));
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo subir");
          } finally {
            setBusy(false);
          }
        }}
      />
    </span>
  );
}

/** El botón para cambiar un enlace (con sus páginas y productos como sugerencias). */
export function EditLink({ url, onChange, suggestions }: { url: string; onChange: (v: string) => void; suggestions: { value: string; label: string }[] }) {
  return (
    <button
      type="button"
      data-canva-ui
      onClick={async (e) => {
        const next = await askText("¿Adónde lleva?", url, { from: e.currentTarget, placeholder: "/sobre-mi o https://…", suggestions });
        if (next !== null && next !== url) onChange(next);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e9cc8e]/60 bg-[#1d1838]/85 px-2.5 py-1 text-[0.7rem] font-semibold text-[#f3e2b3] shadow"
      title={url || "Sin enlace"}
    >
      <Link2 className="h-3 w-3" /> Enlace
    </button>
  );
}

/** Los clics de la web no llevan a ningún sitio mientras se edita (sí los del Canva). */
export function stopWebLinks(e: React.MouseEvent) {
  // También al pulsar un botón del Canva que está dentro de un enlace de la web (la foto de una burbuja…).
  const t = e.target as HTMLElement;
  if (t instanceof HTMLInputElement && t.type === "file") return; // el selector de fotos («Cambiar foto»)
  const a = t.closest("a");
  if (a && !a.closest("[data-canva-ui]")) e.preventDefault();
}
