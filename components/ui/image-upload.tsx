"use client";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", "image");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "No se pudo subir la imagen");
  return json.url as string;
}

/** Selector de imagen con vista previa. `shape="circle"` para avatares. */
export function ImageUpload({
  value,
  onChange,
  shape = "rect",
  label = "Subir imagen",
  className = "",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  shape?: "rect" | "circle" | "wide";
  label?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box =
    shape === "circle" ? "h-36 w-36 rounded-full" : shape === "wide" ? "aspect-[16/7] w-full rounded-2xl" : "aspect-[4/3] w-full rounded-2xl";
  return (
    <div className={className}>
      <div className={`relative ${shape === "circle" ? "mx-auto w-fit" : ""}`}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`${box} group relative grid place-items-center overflow-hidden border border-dashed border-line bg-white text-muted transition hover:border-ink/30`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm">
              <ImagePlus className="h-6 w-6" />
              {label}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-ink" />
            </span>
          )}
          {value && !busy && (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent py-2 text-center text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
              Cambiar
            </span>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full border border-line bg-white text-muted shadow-soft hover:text-ink"
            aria-label="Quitar imagen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setError(null);
          try {
            onChange(await uploadImage(f));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Error al subir");
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <p className="mt-2 text-center text-xs text-rose">{error}</p>}
    </div>
  );
}
