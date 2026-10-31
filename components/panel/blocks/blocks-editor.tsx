"use client";

import { ArrowDown, ArrowUp, Columns2, Eye, EyeOff, Film, Image as ImageIcon, Images, LayoutGrid, Loader2, Milestone, Orbit, Plus, Quote, Trash2, Type, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { uploadImageInfo } from "@/components/ui/image-upload";
import {
  BLOCK_LABEL,
  GALLERY_MAX,
  newBlock,
  type BlockKind,
  type CardsBlock,
  type ContentBlock,
  type GalleryBlock,
  type ImageBlock,
  type ModelBlock,
  type PageImage,
  type PhotoTextBlock,
  type QuoteBlock,
  type TextBlock,
  type TimelineBlock,
} from "@/lib/page-blocks";
import { LinkInput, type LinkTarget } from "./link-input";
import { ImageBlockFields } from "./image-block-fields";
import { VideoBlockFields } from "./video-block-fields";
import { CardsBlockFields, ModelBlockFields, PhotoTextBlockFields, QuoteBlockFields, TimelineBlockFields } from "./rich-block-fields";

/**
 * Editor de bloques compartido por «Mi página» (portada) y las páginas extra, pensado para el
 * iPhone: botones de 40–44 px, el selector de fotos se abre en el mismo toque que «Añadir imagen»
 * (iOS lo exige), subidas con progreso y aviso si se sale de la pantalla mientras suben.
 * Los cambios llegan como función (prev → next): una subida que acaba no pisa lo escrito mientras.
 */
export type BlocksUpdate = ContentBlock[] | ((prev: ContentBlock[]) => ContentBlock[]);

const ICON: Record<BlockKind, typeof Type> = { text: Type, image: ImageIcon, gallery: Images, video: Film, photoText: Columns2, cards: LayoutGrid, quote: Quote, timeline: Milestone, model: Orbit };
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const uid = () => Math.random().toString(36).slice(2, 10);

/** Aviso del navegador al salir de la pantalla con algo a medias (subidas o cambios sin guardar). */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

export function BlocksEditor({
  blocks,
  onChange,
  personal,
  linkTargets,
  bodyMax,
  max,
  onUploadingChange,
}: {
  blocks: ContentBlock[];
  onChange: (next: BlocksUpdate) => void;
  /** Web personal: también se pueden subir vídeos (en la plataforma, solo enlace). */
  personal: boolean;
  linkTargets: LinkTarget[];
  bodyMax: number;
  max: number;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [status, setStatusMap] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const addImage = useRef<HTMLInputElement>(null);
  const addGallery = useRef<HTMLInputElement>(null);
  const uploading = Object.keys(status).length > 0;
  useBeforeUnload(uploading);
  useEffect(() => onUploadingChange?.(uploading), [uploading, onUploadingChange]);

  const setStatus = (id: string, text: string | null) =>
    setStatusMap((m) => {
      const next = { ...m };
      if (text) next[id] = text;
      else delete next[id];
      return next;
    });
  const setError = (id: string, text: string | null) =>
    setErrors((m) => {
      const next = { ...m };
      if (text) next[id] = text;
      else delete next[id];
      return next;
    });
  const update = <B extends ContentBlock>(id: string, patch: (b: B) => B) => onChange((prev) => prev.map((b) => (b.id === id ? patch(b as B) : b)));
  const move = (i: number, dir: -1 | 1) =>
    onChange((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = [...prev];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const add = (kind: BlockKind) => {
    const b = newBlock(kind, uid());
    onChange((prev) => (prev.length >= max ? prev : [...prev, b]));
    return b.id;
  };
  const full = blocks.length >= max;

  /** Sube imágenes a una galería, de 2 en 2, hasta el máximo de la galería. */
  const uploadToGallery = async (id: string, files: File[], already: number) => {
    const room = Math.max(0, GALLERY_MAX - already);
    const list = files.slice(0, room);
    if (files.length > room) setError(id, `Máximo ${GALLERY_MAX} imágenes por galería: se han añadido las primeras`);
    else setError(id, null);
    let done = 0;
    const pct = new Map<number, number>();
    const report = () => {
      const avg = list.length ? Math.round([...pct.values()].reduce((a, b) => a + b, 0) / list.length) : 0;
      setStatus(id, `Subiendo ${Math.min(done + 1, list.length)} de ${list.length} · ${avg} %`);
    };
    let next = 0;
    const worker = async () => {
      for (;;) {
        const n = next++;
        if (n >= list.length) return;
        try {
          const img = await uploadImageInfo(list[n], {
            graphic: true,
            onProgress: (p) => {
              pct.set(n, p);
              report();
            },
          });
          const entry: PageImage = { src: img.url, alt: "", width: img.width, height: img.height };
          update<GalleryBlock>(id, (b) => ({ ...b, images: b.images.length >= GALLERY_MAX ? b.images : [...b.images, entry] }));
        } catch (e) {
          setError(id, e instanceof Error ? e.message : "No se pudo subir una imagen");
        } finally {
          pct.set(n, 100);
          done++;
          report();
        }
      }
    };
    report();
    await Promise.all([worker(), worker()]);
    setStatus(id, null);
  };

  return (
    // La barra de formato del texto se pega bajo las pestañas fijas del editor (no las tapa).
    <div className="space-y-3" style={{ ["--rte-sticky-top" as string]: "6.75rem" }}>
      {blocks.map((b, i) => {
        const Icon = ICON[b.kind];
        return (
          <div key={b.id} data-block-editor={b.kind} className={`space-y-3 rounded-xl border p-3 ${b.enabled ? "border-line bg-white" : "border-dashed border-line bg-paper"}`}>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
                <Icon className="h-4 w-4" /> {BLOCK_LABEL[b.kind]}
              </span>
              <button
                type="button"
                onClick={() => update(b.id, (x) => ({ ...x, enabled: !x.enabled }))}
                className={`ml-1 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-semibold ${b.enabled ? "bg-ink text-cream" : "bg-sand text-muted"}`}
              >
                {b.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {b.enabled ? "Visible" : "Oculto"}
              </button>
              <span className="flex-1" />
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20 sm:h-8 sm:w-8" aria-label="Subir bloque"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20 sm:h-8 sm:w-8" aria-label="Bajar bloque"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => onChange((prev) => prev.filter((x) => x.id !== b.id))} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose sm:h-8 sm:w-8" aria-label="Eliminar bloque"><Trash2 className="h-4 w-4" /></button>
            </div>

            {b.kind === "text" && <TextBlockFields block={b} bodyMax={bodyMax} linkTargets={linkTargets} onPatch={(p) => update<TextBlock>(b.id, (x) => ({ ...x, ...p }))} />}
            {b.kind === "image" && (
              <ImageBlockFields block={b} linkTargets={linkTargets} status={status[b.id]} onPatch={(p) => update<ImageBlock>(b.id, (x) => ({ ...x, ...p }))} onStatus={(t) => setStatus(b.id, t)} />
            )}
            {b.kind === "gallery" && (
              <GalleryBlockFields
                block={b}
                status={status[b.id]}
                onPatch={(p) => update<GalleryBlock>(b.id, (x) => ({ ...x, ...p }))}
                onFiles={(files) => void uploadToGallery(b.id, files, b.images.length)}
              />
            )}
            {b.kind === "video" && <VideoBlockFields block={b} personal={personal} onPatch={(p) => update(b.id, (x) => ({ ...x, ...p }) as ContentBlock)} onStatus={(t) => setStatus(b.id, t)} />}
            {b.kind === "photoText" && <PhotoTextBlockFields block={b} bodyMax={bodyMax} linkTargets={linkTargets} onUpdate={(fn) => update<PhotoTextBlock>(b.id, fn)} />}
            {b.kind === "cards" && <CardsBlockFields block={b} linkTargets={linkTargets} onUpdate={(fn) => update<CardsBlock>(b.id, fn)} />}
            {b.kind === "quote" && <QuoteBlockFields block={b} onUpdate={(fn) => update<QuoteBlock>(b.id, fn)} />}
            {b.kind === "timeline" && <TimelineBlockFields block={b} onUpdate={(fn) => update<TimelineBlock>(b.id, fn)} />}
            {b.kind === "model" && <ModelBlockFields block={b} onUpdate={(fn) => update<ModelBlock>(b.id, fn)} />}
            {errors[b.id] && <p className="text-xs text-rose" role="alert">{errors[b.id]}</p>}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={() => add("text")} disabled={full} className="btn btn-outline h-11 text-sm">
          <Plus className="h-4 w-4" /> Añadir bloque de texto
        </button>
        <button type="button" onClick={() => addImage.current?.click()} disabled={full} className="btn btn-outline h-11 text-sm">
          <ImageIcon className="h-4 w-4" /> Añadir imagen
        </button>
        <button type="button" onClick={() => addGallery.current?.click()} disabled={full} className="btn btn-outline h-11 text-sm">
          <Images className="h-4 w-4" /> Añadir galería
        </button>
        <button type="button" onClick={() => add("video")} disabled={full} className="btn btn-outline h-11 text-sm">
          <Film className="h-4 w-4" /> Añadir vídeo
        </button>
        <button type="button" onClick={() => add("photoText")} disabled={full} className="btn btn-outline h-11 text-sm">
          <Columns2 className="h-4 w-4" /> Añadir foto y texto
        </button>
        <button type="button" onClick={() => add("cards")} disabled={full} className="btn btn-outline h-11 text-sm">
          <LayoutGrid className="h-4 w-4" /> Añadir tarjetas
        </button>
        <button type="button" onClick={() => add("quote")} disabled={full} className="btn btn-outline h-11 text-sm">
          <Quote className="h-4 w-4" /> Añadir cita
        </button>
        <button type="button" onClick={() => add("timeline")} disabled={full} className="btn btn-outline h-11 text-sm">
          <Milestone className="h-4 w-4" /> Añadir trayectoria
        </button>
        <button type="button" onClick={() => add("model")} disabled={full} className="btn btn-outline col-span-2 h-11 text-sm">
          <Orbit className="h-4 w-4" /> Añadir modelo interactivo
        </button>
      </div>
      {full && <p className="text-xs text-muted">Máximo {max} bloques</p>}

      {/* Selectores de «Añadir imagen» y «Añadir galería»: el bloque nace con el archivo elegido. */}
      <input
        ref={addImage}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        aria-label="Elegir imagen"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const id = add("image");
          setStatus(id, "Subiendo · 0 %");
          try {
            const img = await uploadImageInfo(f, { graphic: true, onProgress: (p) => setStatus(id, p < 100 ? `Subiendo · ${p} %` : "Optimizando…") });
            update<ImageBlock>(id, (x) => ({ ...x, image: { src: img.url, alt: x.image?.alt ?? "", width: img.width, height: img.height } }));
            setError(id, null);
          } catch (err) {
            setError(id, err instanceof Error ? err.message : "No se pudo subir la imagen");
          } finally {
            setStatus(id, null);
          }
        }}
      />
      <input
        ref={addGallery}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        aria-label="Elegir imágenes"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          const id = add("gallery");
          void uploadToGallery(id, files, 0);
        }}
      />
    </div>
  );
}

function TextBlockFields({ block: b, bodyMax, linkTargets, onPatch }: { block: TextBlock; bodyMax: number; linkTargets: LinkTarget[]; onPatch: (p: Partial<TextBlock>) => void }) {
  return (
    <>
      <input
        className="input h-10 text-sm font-semibold"
        placeholder="Título (p. ej. Sobre mí)"
        aria-label="Título del bloque"
        value={b.title}
        maxLength={80}
        onChange={(e) => onPatch({ title: e.target.value })}
      />
      {/* Solo los bloques que se editan pasan a tener formato (los de antes se ven como siempre). */}
      <RichTextEditor
        ariaLabel="Texto del bloque"
        placeholder="Texto del bloque"
        value={b.body}
        initialFormat={b.format ?? null}
        onChange={(body) => onPatch({ body, format: "MD" })}
        maxLength={bodyMax}
        tools="basic"
        headings
        preview={false}
        tone="page"
        headingLevel={3}
        rows={5}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="input h-10 text-sm"
          placeholder="Texto del botón (opcional)"
          aria-label="Texto del botón"
          value={b.buttonLabel ?? ""}
          maxLength={40}
          onChange={(e) => onPatch({ buttonLabel: e.target.value })}
        />
        <LinkInput value={b.buttonUrl ?? ""} onChange={(v) => onPatch({ buttonUrl: v })} ariaLabel="Enlace del botón" targets={linkTargets} />
      </div>
    </>
  );
}

function GalleryBlockFields({ block: b, status, onPatch, onFiles }: { block: GalleryBlock; status?: string; onPatch: (p: Partial<GalleryBlock>) => void; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const setImages = (images: PageImage[]) => onPatch({ images });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= b.images.length) return;
    const a = [...b.images];
    [a[i], a[j]] = [a[j], a[i]];
    setImages(a);
  };
  return (
    <>
      <input className="input h-10 text-sm" placeholder="Título (opcional)" aria-label="Título de la galería" value={b.title} maxLength={80} onChange={(e) => onPatch({ title: e.target.value })} />
      <div className="inline-flex rounded-full bg-sand p-1 text-xs font-semibold" role="radiogroup" aria-label="Cómo se ve la galería">
        {(["carousel", "grid"] as const).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={b.layout === l} onClick={() => onPatch({ layout: l })} className={`h-8 rounded-full px-3 ${b.layout === l ? "bg-white text-ink shadow-soft" : "text-muted"}`}>
            {l === "carousel" ? "Carrusel" : "Cuadrícula"}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {b.images.map((img, i) => (
          <li key={`${img.src}-${i}`} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-sand object-contain" />
            <input
              className="input h-10 min-w-0 flex-1 text-sm"
              placeholder="Descripción de la imagen"
              aria-label="Descripción de la imagen"
              value={img.alt}
              maxLength={300}
              onChange={(e) => setImages(b.images.map((x, n) => (n === i ? { ...x, alt: e.target.value } : x)))}
            />
            <div className="flex shrink-0 flex-col sm:flex-row">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Subir imagen"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={i === b.images.length - 1} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Bajar imagen"><ArrowDown className="h-3.5 w-3.5" /></button>
            </div>
            <button type="button" onClick={() => setImages(b.images.filter((_, n) => n !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Quitar imagen"><X className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      {status ? (
        <p className="flex items-center gap-2 text-xs font-medium" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin" /> {status}</p>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={b.images.length >= GALLERY_MAX} className="btn btn-outline btn-sm h-10">
          <Plus className="h-4 w-4" /> Añadir imágenes
        </button>
      )}
      <p className="field-hint">Hasta {GALLERY_MAX} imágenes. PNG o JPG; desde Canva: Compartir › Descargar › PNG.</p>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        aria-label="Elegir imágenes de la galería"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
