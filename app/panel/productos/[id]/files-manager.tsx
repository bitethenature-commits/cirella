"use client";
import { FileImage, FileText, Headphones, Link2, Loader2, Trash2, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UPLOAD_CANCELLED, uploadFile } from "@/components/ui/upload-client";
import { PRIVATE_ACCEPT, videoWeight } from "@/lib/file-types";
import { addLinkFile, deleteFile } from "../actions";

type F = {
  id: string;
  name: string;
  kind: string;
  sizeBytes: number | null;
  url: string | null;
  durationSec?: number | null;
  videoCodec?: string | null;
  width?: number | null;
  height?: number | null;
};
const PREVIEWABLE = new Set(["VIDEO", "AUDIO", "PDF", "IMAGE"]);
const ICON: Record<string, typeof FileText> = { PDF: FileText, AUDIO: Headphones, VIDEO: Video, LINK: Link2, IMAGE: FileImage };

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

/** «23 min» (o «45 s» si no llega al minuto). */
export function formatDuration(sec: number) {
  return sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`;
}

/** Aviso que se despliega con su explicación (sin tecnicismos salvo la palabra HEVC). */
function Chip({ label, tone = "neutral", help }: { label: string; tone?: "neutral" | "warn"; help?: string }) {
  const cls = tone === "warn" ? "border-[#ecdcb8] bg-[#fbf5e8] text-[#7a5a1c]" : "border-line bg-sand/60 text-muted";
  if (!help) return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${cls}`}>{label}</span>;
  return (
    <details className="group">
      <summary className={`inline-flex cursor-pointer list-none rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${cls}`}>{label}</summary>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted">{help}</p>
    </details>
  );
}

const HEVC_HELP =
  "Se ve en iPhone, iPad y Mac; puede no verse en algunos navegadores. Para que se vea en todas partes: expórtalo con InShot (MP4) o activa Ajustes › Cámara › Formatos › Más compatible.";
const HEAVY_HELP = "Expórtalo en 1080p (o 720p) con InShot: tus alumnas lo verán sin cortes con datos.";

function FileChips({ f }: { f: F }) {
  if (f.kind !== "VIDEO" && f.kind !== "AUDIO") return null;
  const chips = [];
  if (f.durationSec) chips.push(<Chip key="d" label={formatDuration(f.durationSec)} />);
  if (f.kind === "VIDEO" && f.width && f.height && f.height > f.width) chips.push(<Chip key="v" label="Vertical" />);
  if (f.videoCodec === "HEVC") chips.push(<Chip key="h" label="HEVC" tone="warn" help={HEVC_HELP} />);
  if (f.kind === "VIDEO" && videoWeight(f.sizeBytes, f.durationSec) === "heavy") chips.push(<Chip key="p" label="Muy pesado para el móvil" tone="warn" help={HEAVY_HELP} />);
  return chips.length ? <div className="flex flex-wrap items-start gap-1.5 pt-1">{chips}</div> : null;
}

export function FilesManager({
  productId,
  files,
  title,
  hint,
  limitsLabel = "Hasta 1 GB por archivo.",
}: {
  productId: string;
  files: F[];
  title: string;
  hint: string;
  /** uploadPolicy(isPersonalMode()).label */
  limitsLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; pct: number; loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const router = useRouter();

  // Cerrar o recargar la pestaña a mitad de una subida la pierde: se avisa.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const upload = async (list: FileList) => {
    setBusy(true);
    setError(null);
    for (const file of Array.from(list)) {
      const ctrl = new AbortController();
      abort.current = ctrl;
      setProgress({ name: file.name, pct: 0, loaded: 0, total: file.size });
      try {
        await uploadFile(file, {
          purpose: "file",
          productId,
          signal: ctrl.signal,
          onProgress: (pct, loaded, total) => setProgress({ name: file.name, pct, loaded, total }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al subir";
        if (msg === UPLOAD_CANCELLED) {
          setError(`«${file.name}»: subida cancelada.`);
          break;
        }
        setError(`«${file.name}»: ${msg}`);
      }
    }
    abort.current = null;
    setProgress(null);
    setBusy(false);
    router.refresh();
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted">
            {hint} {limitsLabel}
          </p>
        </div>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-outline btn-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir archivos
        </button>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} accept={PRIVATE_ACCEPT} />
      </div>
      {progress && (
        <div className="mt-3 rounded-xl border border-line bg-paper p-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="min-w-0 flex-1 text-sm text-muted">
              Subiendo «{progress.name}» · {progress.pct} %{progress.total ? ` · ${formatSize(progress.loaded)} de ${formatSize(progress.total)}` : ""}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => abort.current?.abort()}>
              Cancelar
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">No bloquees el iPhone ni cambies de app mientras se sube.</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {files.map((f) => {
          const Icon = ICON[f.kind] ?? FileText;
          return (
            <li key={f.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <span className="block truncate">{f.name}</span>
                <FileChips f={f} />
              </div>
              <span className="shrink-0 text-xs text-faint">{f.kind === "LINK" ? "Enlace" : f.sizeBytes ? formatSize(f.sizeBytes) : ""}</span>
              {/* «Ver» abre o descarga el archivo (como siempre); «Vista previa», el visor de las alumnas. */}
              <a href={f.kind === "LINK" ? f.url ?? "#" : `/api/download/${f.id}`} className="shrink-0 text-xs font-semibold text-muted hover:text-ink">Ver</a>
              {PREVIEWABLE.has(f.kind) && (
                <a href={`/cuenta/archivos/${f.id}`} className="shrink-0 text-xs font-semibold text-muted hover:text-ink">
                  Vista previa
                </a>
              )}
              <form action={deleteFile}>
                <input type="hidden" name="id" value={f.id} />
                <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
              </form>
            </li>
          );
        })}
        {files.length === 0 && <li className="px-3.5 py-6 text-center text-sm text-muted">Todavía no hay archivos.</li>}
      </ul>
      <form action={addLinkFile} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="productId" value={productId} />
        <input name="name" required placeholder="Nombre del enlace (p. ej. Grabación en Vimeo)" className="input h-10 text-base sm:flex-1 sm:text-sm" />
        <input name="url" type="url" required placeholder="https://…" className="input h-10 text-base sm:flex-1 sm:text-sm" />
        <button className="btn btn-ghost btn-sm shrink-0"><Link2 className="h-4 w-4" /> Añadir enlace</button>
      </form>
    </section>
  );
}
