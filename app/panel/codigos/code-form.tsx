"use client";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { ImageUpload, uploadImageInfo } from "@/components/ui/image-upload";
import { CODE_BRAND_MAX, CODE_CODE_MAX, CODE_DESCRIPTION_MAX, CODE_PHOTOS_MAX, CODE_REC_TEXT_MAX, CODE_RECS_MAX, CODE_URL_MAX, type CodePhoto, type CodeRecommendation } from "@/lib/discount-codes";
import { saveDiscountCode, saveDiscountCodeInline, type CodeActionState } from "./actions";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export type EditableCode = {
  id: string | null;
  brand: string;
  code: string;
  description: string;
  url: string;
  imageUrl: string | null;
  /** Fotos de lo que recomienda de la marca. */
  images: CodePhoto[];
  /** «Recomendaciones»: la lista de lo que recomienda de la marca, con su enlace opcional. */
  recommendations: CodeRecommendation[];
  /** «AAAA-MM-DD» (último día en que vale) o vacío. */
  expiresOn: string;
  active: boolean;
};

/** Formulario de un código de descuento: crear (sin id) o editar. */
export function CodeForm({ code, onSaved }: { code: EditableCode; /** En el Canva: se guarda sin salir de la web (`created`: era nuevo). */ onSaved?: (created: boolean) => void }) {
  const [state, action, pending] = useActionState<CodeActionState, FormData>(async (prev, fd) => {
    if (!onSaved) return saveDiscountCode(prev, fd);
    const r = await saveDiscountCodeInline(prev, fd);
    if (r?.ok) onSaved(!!r.created);
    return r;
  }, undefined);
  const [image, setImage] = useState(code.imageUrl);
  const [photos, setPhotos] = useState<CodePhoto[]>(code.images);
  const [recs, setRecs] = useState<{ text: string; url: string }[]>(code.recommendations.map((r) => ({ text: r.text, url: r.url ?? "" })));
  const [uploading, setUploading] = useState(false);
  return (
    <form
      // onSubmit en lugar de action={}: así un error de validación no borra lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5"
    >
      <Flash ok={state?.ok} error={state?.error} />
      {code.id && <input type="hidden" name="id" value={code.id} />}
      <input type="hidden" name="imageUrl" value={image ?? ""} />
      <input type="hidden" name="images" value={JSON.stringify(photos)} />
      <input type="hidden" name="recommendations" value={JSON.stringify(recs)} />

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="code-brand">Marca</label>
            <input id="code-brand" name="brand" className="input" required maxLength={CODE_BRAND_MAX} defaultValue={code.brand} placeholder="Ej.: Velas Alba" />
          </div>
          <div>
            <label className="field-label" htmlFor="code-code">Código</label>
            <input
              id="code-code"
              name="code"
              className="input font-mono tracking-wider"
              required
              maxLength={CODE_CODE_MAX}
              defaultValue={code.code}
              placeholder="ANA15"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="field-hint">Tal cual lo dio la marca (sin espacios).</p>
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="code-description">Descripción corta <span className="font-normal text-muted">(opcional)</span></label>
          <input id="code-description" name="description" className="input" maxLength={CODE_DESCRIPTION_MAX} defaultValue={code.description} placeholder="Ej.: 15 % en velas de soja para tus rituales" />
        </div>
        <div>
          <label className="field-label" htmlFor="code-url">Enlace a la tienda</label>
          <input id="code-url" name="url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" className="input" required maxLength={CODE_URL_MAX} defaultValue={code.url} placeholder="https://…" />
          <p className="field-hint">Es el botón «Ir a la tienda». Si la marca te dio un enlace de afiliada, pégalo aquí.</p>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          <div>
            <p className="field-label">Logo <span className="font-normal text-muted">(opcional)</span></p>
            <ImageUpload shape="circle" value={image} onChange={setImage} label="Logo" />
          </div>
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="code-expires">Válido hasta <span className="font-normal text-muted">(opcional)</span></label>
              <input id="code-expires" name="expiresOn" type="date" className="input" defaultValue={code.expiresOn} />
              <p className="field-hint">Al día siguiente deja de verse en tu página. Vacío = no caduca.</p>
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name="active" defaultChecked={code.active} className="h-4 w-4 accent-[#0E1024]" />
              Visible en mi página
            </label>
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <div>
          <p className="field-label">Recomendaciones <span className="font-normal text-muted">(opcional)</span></p>
          <p className="field-hint">Lo que recomiendas de esta marca. Salen en una lista al pulsar «Ver más» en tu página; si pegas el enlace del producto, cada una lleva a su producto.</p>
        </div>
        <CodeRecsField recs={recs} onChange={setRecs} />
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <div>
          <p className="field-label">Fotos de lo que te gusta de esta marca <span className="font-normal text-muted">(opcional)</span></p>
          <p className="field-hint">Se ven al desplegar el código en tu página. Describe cada foto (para quien no puede verla).</p>
        </div>
        <CodePhotosField photos={photos} onChange={setPhotos} onUploading={setUploading} />
      </section>

      <button type="submit" className="btn btn-primary" disabled={pending || uploading} aria-busy={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {code.id ? "Guardar cambios" : "Añadir código"}
      </button>
    </form>
  );
}

type RecRow = { text: string; url: string };

/** Recomendaciones del código: añadir filas (texto y enlace opcional), ordenarlas y quitarlas. */
function CodeRecsField({ recs, onChange }: { recs: RecRow[]; onChange: (f: (prev: RecRow[]) => RecRow[]) => void }) {
  const move = (i: number, dir: -1 | 1) =>
    onChange((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = [...prev];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const edit = (i: number, patch: Partial<RecRow>) => onChange((prev) => prev.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-3">
      {recs.length > 0 && (
        <ul className="space-y-3">
          {recs.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input
                  className="input h-10 text-sm"
                  placeholder="Ej.: Vela de lavanda para luna llena"
                  aria-label={`Recomendación ${i + 1}`}
                  value={r.text}
                  maxLength={CODE_REC_TEXT_MAX}
                  onChange={(e) => edit(i, { text: e.target.value })}
                />
                <input
                  className="input h-10 text-sm"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Enlace al producto (opcional) https://…"
                  aria-label={`Enlace de la recomendación ${i + 1}`}
                  value={r.url}
                  maxLength={CODE_URL_MAX}
                  onChange={(e) => edit(i, { url: e.target.value })}
                />
              </div>
              <div className="flex shrink-0 flex-col sm:flex-row">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Subir recomendación"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={i === recs.length - 1} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Bajar recomendación"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <button type="button" onClick={() => onChange((prev) => prev.filter((_, n) => n !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Quitar recomendación"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => onChange((prev) => [...prev, { text: "", url: "" }])} disabled={recs.length >= CODE_RECS_MAX} className="btn btn-outline btn-sm h-10">
        <Plus className="h-4 w-4" /> Añadir recomendación
      </button>
      <p className="field-hint">Hasta {CODE_RECS_MAX} recomendaciones.</p>
    </div>
  );
}

/** Fotos del código: subir varias (de 2 en 2), su descripción, el orden y quitar. */
function CodePhotosField({ photos, onChange, onUploading }: { photos: CodePhoto[]; onChange: (f: (prev: CodePhoto[]) => CodePhoto[]) => void; onUploading: (v: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (f: (prev: CodePhoto[]) => CodePhoto[]) => onChange(f);
  const move = (i: number, dir: -1 | 1) =>
    set((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = [...prev];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });

  const upload = async (files: File[]) => {
    const room = Math.max(0, CODE_PHOTOS_MAX - photos.length);
    const list = files.slice(0, room);
    setError(files.length > room ? `Como mucho ${CODE_PHOTOS_MAX} fotos: se han añadido las primeras` : null);
    if (!list.length) return;
    onUploading(true);
    let next = 0;
    let done = 0;
    setStatus(`Subiendo 1 de ${list.length}…`);
    const worker = async () => {
      for (;;) {
        const n = next++;
        if (n >= list.length) return;
        try {
          const img = await uploadImageInfo(list[n]);
          set((prev) => (prev.length >= CODE_PHOTOS_MAX ? prev : [...prev, { src: img.url, alt: "", width: img.width, height: img.height }]));
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo subir una foto");
        } finally {
          done++;
          setStatus(done < list.length ? `Subiendo ${done + 1} de ${list.length}…` : null);
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setStatus(null);
    onUploading(false);
  };

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <ul className="space-y-2">
          {photos.map((p, i) => (
            <li key={`${p.src}-${i}`} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-sand object-cover" />
              <input
                className="input h-10 min-w-0 flex-1 text-sm"
                placeholder="Descripción de la foto"
                aria-label={`Descripción de la foto ${i + 1}`}
                value={p.alt}
                maxLength={300}
                onChange={(e) => set((prev) => prev.map((x, n) => (n === i ? { ...x, alt: e.target.value } : x)))}
              />
              <div className="flex shrink-0 flex-col sm:flex-row">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Subir foto"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={i === photos.length - 1} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Bajar foto"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <button type="button" onClick={() => set((prev) => prev.filter((_, n) => n !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Quitar foto"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {status ? (
        <p className="flex items-center gap-2 text-xs font-medium" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin" /> {status}</p>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={photos.length >= CODE_PHOTOS_MAX} className="btn btn-outline btn-sm h-10">
          <Plus className="h-4 w-4" /> Añadir fotos
        </button>
      )}
      {error && <p role="alert" className="text-xs font-medium text-rose">{error}</p>}
      <p className="field-hint">Hasta {CODE_PHOTOS_MAX} fotos. PNG, JPG o WebP.</p>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void upload(files);
        }}
      />
    </div>
  );
}
