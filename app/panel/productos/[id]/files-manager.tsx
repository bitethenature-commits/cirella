"use client";
import { FileText, Headphones, Link2, Loader2, Trash2, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addLinkFile, deleteFile } from "../actions";

type F = { id: string; name: string; kind: string; sizeBytes: number | null; url: string | null };
const ICON: Record<string, typeof FileText> = { PDF: FileText, AUDIO: Headphones, VIDEO: Video, LINK: Link2 };

export function FilesManager({ productId, files, title, hint }: { productId: string; files: F[]; title: string; hint: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const upload = async (list: FileList) => {
    setBusy(true);
    setError(null);
    for (const file of Array.from(list)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "file");
      fd.append("productId", productId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Error al subir");
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-outline btn-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir archivos
        </button>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} accept=".pdf,.mp3,.m4a,.wav,.mp4,.jpg,.png,.epub,.zip" />
      </div>
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {files.map((f) => {
          const Icon = ICON[f.kind] ?? FileText;
          return (
            <li key={f.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-faint">{f.kind === "LINK" ? "Enlace" : f.sizeBytes ? `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB` : ""}</span>
              <a href={f.kind === "LINK" ? f.url ?? "#" : `/api/download/${f.id}`} className="shrink-0 text-xs font-semibold text-muted hover:text-ink">Ver</a>
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
        <input name="name" placeholder="Nombre del enlace (p. ej. Grabación en Vimeo)" className="input h-10 text-sm sm:flex-1" />
        <input name="url" type="url" placeholder="https://…" className="input h-10 text-sm sm:flex-1" />
        <button className="btn btn-ghost btn-sm shrink-0"><Link2 className="h-4 w-4" /> Añadir enlace</button>
      </form>
    </section>
  );
}
