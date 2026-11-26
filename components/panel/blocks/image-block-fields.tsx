"use client";
import { Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import type { ImageBlock } from "@/lib/page-blocks";
import { LinkInput, type LinkTarget } from "./link-input";
import { Tr } from "@/lib/i18n/client";

/** Bloque «Imagen»: el gráfico entero (contain), su descripción, pie, enlace y título opcionales. */
export function ImageBlockFields({
  block: b,
  linkTargets,
  status,
  onPatch,
}: {
  block: ImageBlock;
  linkTargets: LinkTarget[];
  status?: string;
  onPatch: (p: Partial<ImageBlock>) => void;
  onStatus?: (t: string | null) => void;
}) {
  return (
    <>
      {status ? (
        <p className="flex aspect-[4/3] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-xs font-medium" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin" /> <Tr s={status} />
        </p>
      ) : (
        <ImageUpload
          value={b.image?.src ?? null}
          onChange={(url) => !url && onPatch({ image: null })}
          onUploaded={(img) => onPatch({ image: { src: img.url, alt: b.image?.alt ?? "", caption: b.image?.caption, width: img.width, height: img.height } })}
          graphic
          fit="contain"
          label="Subir imagen"
        />
      )}
      <p className="field-hint"><Tr s={"PNG o JPG. Desde Canva: Compartir › Descargar › PNG."} /></p>
      {b.image && (
        <>
          <div>
            <label className="field-label"><Tr s={"Descripción de la imagen"} /></label>
            <textarea
              className="input text-sm"
              rows={2}
              aria-label="Descripción de la imagen"
              value={b.image.alt}
              maxLength={300}
              onChange={(e) => onPatch({ image: { ...b.image!, alt: e.target.value } })}
            />
            <p className="field-hint"><Tr s={"Escribe el texto que sale en la imagen: así lo leen Google y quien usa lector de pantalla."} /></p>
          </div>
          <input
            className="input h-10 text-sm"
            placeholder="Pie de foto (opcional)"
            aria-label="Pie de foto"
            value={b.image.caption ?? ""}
            maxLength={200}
            onChange={(e) => onPatch({ image: { ...b.image!, caption: e.target.value || undefined } })}
          />
        </>
      )}
      <LinkInput value={b.href ?? ""} onChange={(v) => onPatch({ href: v || undefined })} ariaLabel="Enlace al tocarla" placeholder="Enlace al tocarla (opcional)" targets={linkTargets} />
      <input className="input h-10 text-sm" placeholder="Título (opcional)" aria-label="Título de la imagen" value={b.title} maxLength={80} onChange={(e) => onPatch({ title: e.target.value })} />
    </>
  );
}
