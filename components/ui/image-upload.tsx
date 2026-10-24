"use client";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile } from "./upload-client";

/** Sube una imagen (se optimiza en el servidor) y devuelve su URL /media/…. */
export async function uploadImage(file: File, onProgress?: (pct: number) => void): Promise<string> {
  return (await uploadImageInfo(file, { onProgress })).url;
}

/** Como uploadImage, con las medidas de la imagen guardada. `graphic`: perfil para gráficos de Canva. */
export async function uploadImageInfo(file: File, o: { graphic?: boolean; onProgress?: (pct: number) => void; signal?: AbortSignal } = {}): Promise<{ url: string; width: number; height: number }> {
  const r = await uploadFile(file, { purpose: "image", graphic: o.graphic, onProgress: o.onProgress, signal: o.signal });
  if (!r.url) throw new Error("No se pudo subir la imagen");
  return { url: r.url, width: r.width ?? 0, height: r.height ?? 0 };
}

/**
 * Selector de imagen con vista previa. `shape="circle"` para avatares. `graphic`: perfil para gráficos
 * (más alto y nítido); `fit="contain"` enseña la imagen entera; `onUploaded` recibe también las medidas.
 */
export function ImageUpload({
  value,
  onChange,
  shape = "rect",
  label = "Subir imagen",
  className = "",
  graphic = false,
  fit = "cover",
  onUploaded,
  inputRef,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  shape?: "rect" | "circle" | "wide";
  label?: string;
  className?: string;
  graphic?: boolean;
  fit?: "cover" | "contain";
  onUploaded?: (img: { url: string; width: number; height: number }) => void;
  /** Para abrir el selector desde fuera (en el mismo toque que «Añadir imagen», como pide iOS). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const ownInput = useRef<HTMLInputElement>(null);
  const input = inputRef ?? ownInput;
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
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
            <img src={value} alt="" className={`absolute inset-0 h-full w-full ${fit === "contain" ? "bg-sand object-contain" : "object-cover"}`} />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm">
              <ImagePlus className="h-6 w-6" />
              {label}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/75 text-xs font-medium text-ink" aria-live="polite">
              <Loader2 className="h-6 w-6 animate-spin" />
              {pct < 100 ? `${pct} %` : "Optimizando…"}
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
          setPct(0);
          setError(null);
          try {
            const img = await uploadImageInfo(f, { graphic, onProgress: setPct });
            if (onUploaded) onUploaded(img);
            else onChange(img.url);
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
