"use client";
import { CalendarDays, Images, Loader2, Moon, Trash2, Upload } from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { ImageUpload } from "@/components/ui/image-upload";
import { UPLOAD_CANCELLED, uploadFile } from "@/components/ui/upload-client";
import { LinkInput, type LinkTarget } from "@/components/panel/blocks/link-input";
import { mediaKindFor, PORTAL_BODY_MAX, PORTAL_KIND_LABEL, PORTAL_KINDS, PORTAL_PHOTOS_MAX, PORTAL_SUMMARY_MAX, PORTAL_TITLE_MAX, type PortalKind } from "@/lib/portal-rules";
import { savePortalItem, type PortalActionState } from "./actions";

export type EditablePortalItem = {
  id: string | null;
  kind: PortalKind;
  title: string;
  summary: string;
  body: string;
  coverUrl: string | null;
  /** Lo que ya tiene (sin claves: solo el nombre y el tipo). */
  media: { name: string; kind: string }[];
  linkUrl: string;
  linkLabel: string;
  eventDate: string;
  eventTime: string;
  featured: boolean;
  status: "DRAFT" | "PUBLISHED";
};

type MediaEntry = { ref: string; name: string; kind: string };

const ACCEPT: Record<string, string> = {
  VIDEO: "video/mp4,video/quicktime,.mp4,.mov,.m4v",
  AUDIO: "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav",
  IMAGE: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
};

/**
 * Elemento del Portal de Noticias: tipo, textos, portada, archivo(s) privado(s), enlace (Zoom o la
 * oferta), fecha del directo, destacado y estado. Los archivos se suben como privados (purpose
 * «portal») y viajan al guardar como billetes firmados; los que ya tenía, por su posición.
 */
export function PortalForm({ item, linkTargets, moonDates }: { item: EditablePortalItem; linkTargets: LinkTarget[]; moonDates: { label: string; date: string; time: string }[] }) {
  const [state, action, pending] = useActionState<PortalActionState, FormData>(savePortalItem, undefined);
  const [kind, setKind] = useState<PortalKind>(item.kind);
  const [cover, setCover] = useState(item.coverUrl);
  const [media, setMedia] = useState<MediaEntry[]>(item.media.map((m, i) => ({ ref: `keep:${i}`, name: m.name, kind: m.kind })));
  const [link, setLink] = useState(item.linkUrl);
  const [eventDate, setEventDate] = useState(item.eventDate);
  const [eventTime, setEventTime] = useState(item.eventTime);
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const fileKind = mediaKindFor(kind);
  const shown = media.filter((m) => m.kind === fileKind);
  const max = fileKind === "IMAGE" ? PORTAL_PHOTOS_MAX : 1;

  const onFiles = async (files: FileList) => {
    setUploadError(null);
    for (const file of Array.from(files).slice(0, max - shown.length)) {
      setUpload({ name: file.name, pct: 0 });
      try {
        const r = await uploadFile(file, { purpose: "portal", onProgress: (pct) => setUpload({ name: file.name, pct }) });
        if (!r.portal) throw new Error("No hemos podido subir el archivo");
        const p = r.portal;
        setMedia((cur) => (max === 1 ? [...cur.filter((m) => m.kind !== p.kind), { ref: p.token, name: p.name, kind: p.kind }] : [...cur, { ref: p.token, name: p.name, kind: p.kind }]));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No hemos podido subir el archivo";
        if (msg !== UPLOAD_CANCELLED) setUploadError(msg);
        break;
      }
    }
    setUpload(null);
    if (input.current) input.current.value = "";
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5"
    >
      <Flash ok={state?.ok} error={state?.error} />
      {item.id && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="coverUrl" value={cover ?? ""} />
      <input type="hidden" name="media" value={JSON.stringify(shown.map((m) => m.ref))} />
      <input type="hidden" name="linkUrl" value={link} />

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <p className="field-label">Tipo</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
            {PORTAL_KINDS.map((k) => (
              <label key={k} className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm ${kind === k ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {PORTAL_KIND_LABEL[k]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="portal-title">Título</label>
          <input id="portal-title" name="title" className="input" required maxLength={PORTAL_TITLE_MAX} defaultValue={item.title} placeholder="Ritual de luna nueva" />
        </div>
        <div>
          <label className="field-label" htmlFor="portal-summary">Texto corto <span className="font-normal text-muted">(se ve también bloqueado)</span></label>
          <input id="portal-summary" name="summary" className="input" maxLength={PORTAL_SUMMARY_MAX} defaultValue={item.summary} placeholder="Hasta el 15 de noviembre." />
        </div>
        <div>
          <label className="field-label" htmlFor="portal-body">Texto <span className="font-normal text-muted">(solo para suscriptoras)</span></label>
          <textarea id="portal-body" name="body" className="input" rows={4} maxLength={PORTAL_BODY_MAX} defaultValue={item.body} />
        </div>
      </section>

      {fileKind && (
        <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="portal-files">
          <h3 id="portal-files" className="font-semibold">{kind === "PHOTOS" ? `Fotos (hasta ${PORTAL_PHOTOS_MAX})` : kind === "VIDEO" ? "Vídeo" : "Audio"}</h3>
          <p className="text-xs text-muted">Privado: solo lo abre quien lo tiene desbloqueado. Nadie puede compartir el enlace.</p>
          {shown.length > 0 && (
            <ul className="space-y-1.5">
              {shown.map((m) => (
                <li key={m.ref} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                  {kind === "PHOTOS" ? <Images className="h-4 w-4 text-muted" /> : <Upload className="h-4 w-4 text-muted" />}
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <button type="button" onClick={() => setMedia((cur) => cur.filter((x) => x.ref !== m.ref))} className="text-muted hover:text-rose" aria-label={`Quitar ${m.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {upload ? (
            <p className="flex items-center gap-2 text-sm" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Subiendo «{upload.name}» · {upload.pct} %
            </p>
          ) : (
            shown.length < max && (
              <>
                <input ref={input} type="file" accept={ACCEPT[fileKind]} multiple={kind === "PHOTOS"} className="hidden" aria-label="Subir archivo del portal" onChange={(e) => e.target.files?.length && onFiles(e.target.files)} />
                <button type="button" onClick={() => input.current?.click()} className="btn btn-outline btn-sm">
                  <Upload className="h-4 w-4" /> {shown.length ? (kind === "PHOTOS" ? "Añadir fotos" : "Cambiar") : kind === "PHOTOS" ? "Subir fotos" : kind === "VIDEO" ? "Subir vídeo" : "Subir audio"}
                </button>
              </>
            )
          )}
          {uploadError && (
            <p role="alert" className="text-sm text-rose">
              {uploadError}
            </p>
          )}
        </section>
      )}

      {(kind === "LIVE" || kind === "EARLY_BIRD") && (
        <section className="card space-y-3 p-5 sm:p-6">
          <h3 className="font-semibold">{kind === "LIVE" ? "Directo" : "Oferta Early Bird"}</h3>
          {kind === "LIVE" ? (
            <>
              <div>
                <label className="field-label" htmlFor="portal-zoom">Enlace de Zoom</label>
                <input id="portal-zoom" className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://us02web.zoom.us/j/…" maxLength={600} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="portal-date">Día</label>
                  <input id="portal-date" name="eventDate" type="date" className="input h-11" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="portal-time">Hora (España)</label>
                  <input id="portal-time" name="eventTime" type="time" step={300} className="input h-11" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                </div>
              </div>
              {moonDates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-muted">
                    <CalendarDays className="h-3.5 w-3.5" /> Próximas lunas:
                  </span>
                  {moonDates.map((m) => (
                    <button key={m.date} type="button" className="btn btn-ghost btn-sm" onClick={() => { setEventDate(m.date); setEventTime(m.time); }}>
                      <Moon className="h-3.5 w-3.5" /> {m.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div>
              <p className="field-label">Producto u oferta</p>
              <LinkInput value={link} onChange={setLink} ariaLabel="Enlace de la oferta Early Bird" targets={linkTargets} className="input" />
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="portal-link-label">Texto del botón</label>
            <input id="portal-link-label" name="linkLabel" className="input" maxLength={40} defaultValue={item.linkLabel} placeholder={kind === "LIVE" ? "Entrar al directo" : "Ver la oferta"} />
          </div>
        </section>
      )}

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <p className="field-label">Portada <span className="font-normal text-muted">(se ve desenfocada con el candado)</span></p>
          <ImageUpload shape="wide" value={cover} onChange={setCover} label="Añadir portada" />
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="featured" defaultChecked={item.featured} className="h-4 w-4 accent-[#0E1024]" />
          Destacado: el grande de arriba en tu portada
        </label>
        <div>
          <label className="field-label" htmlFor="portal-status">Estado</label>
          <select id="portal-status" name="status" defaultValue={item.status} className="input">
            <option value="PUBLISHED">Publicado</option>
            <option value="DRAFT">Borrador (no se ve)</option>
          </select>
        </div>
      </section>

      <button type="submit" className="btn btn-primary" disabled={pending || !!upload}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {item.id ? "Guardar cambios" : "Guardar"}
      </button>
    </form>
  );
}
