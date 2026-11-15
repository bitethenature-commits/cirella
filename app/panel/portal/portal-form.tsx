"use client";
import { CalendarDays, Headphones, Images, Loader2, Moon, Sparkles, Trash2, Upload, Video } from "lucide-react";
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

  const [status, setStatus] = useState(item.status);
  const KIND_ICON = { VIDEO: Video, AUDIO: Headphones, PHOTOS: Images, LIVE: CalendarDays, EARLY_BIRD: Sparkles } as const;

  return (
    <form
      // Igual que el formulario de una actualidad (app/panel/publicaciones/post-form.tsx): título y texto,
      // el vídeo o audio, el botón, la imagen y el estado, en el mismo orden y con las mismas tarjetas.
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
      <input type="hidden" name="kind" value={kind} />

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <label className="field-label" htmlFor="portal-title">Título</label>
          <input id="portal-title" name="title" className="input" required maxLength={PORTAL_TITLE_MAX} defaultValue={item.title} placeholder="Ej.: Ritual de luna nueva" />
        </div>
        <div>
          <label className="field-label" htmlFor="portal-body">Texto <span className="font-normal text-muted">(solo para suscriptoras)</span></label>
          <textarea id="portal-body" name="body" className="input" rows={8} maxLength={PORTAL_BODY_MAX} defaultValue={item.body} />
        </div>
        <div>
          <label className="field-label" htmlFor="portal-summary">Extracto <span className="font-normal text-muted">(opcional)</span></label>
          <textarea id="portal-summary" name="summary" className="input" rows={2} maxLength={PORTAL_SUMMARY_MAX} defaultValue={item.summary} />
          <p className="field-hint">Se ve también con el candado, para que den ganas de suscribirse.</p>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="portal-files">
        <div>
          <h3 id="portal-files" className="font-semibold">Vídeo, audio o fotos</h3>
          <p className="text-xs text-muted">Privado: solo lo abre quien lo tiene desbloqueado. Nadie puede compartir el enlace.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Qué es">
          {PORTAL_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            const on = kind === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setKind(k)} className={`studio-pick flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-center transition ${on ? "is-on" : "border-line text-muted hover:text-ink"}`}>
                <Icon className="h-5 w-5" strokeWidth={1.4} />
                <span className="text-[0.72rem] font-semibold">{PORTAL_KIND_LABEL[k]}</span>
              </button>
            );
          })}
        </div>
        {fileKind && (
          <>
            {shown.length > 0 && (
              <ul className="space-y-1.5">
                {shown.map((m) => (
                  <li key={m.ref} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
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
                    <Upload className="h-4 w-4" /> {shown.length ? (kind === "PHOTOS" ? "Añadir fotos" : "Cambiar") : kind === "PHOTOS" ? `Subir fotos (hasta ${PORTAL_PHOTOS_MAX})` : kind === "VIDEO" ? "Subir vídeo" : "Subir audio"}
                  </button>
                </>
              )
            )}
            {uploadError && (
              <p role="alert" className="text-sm text-rose">
                {uploadError}
              </p>
            )}
          </>
        )}
        {kind === "LIVE" && (
          <div className="space-y-3">
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
          </div>
        )}
      </section>

      <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="portal-cta-title">
        <div>
          <h3 id="portal-cta-title" className="font-semibold">Botón <span className="font-normal text-muted">{kind === "LIVE" ? "(para entrar al directo)" : "(opcional)"}</span></h3>
          <p className="text-xs text-muted">{kind === "LIVE" ? "Lleva al enlace de Zoom de arriba." : "Lleva a un producto, una página o una web (por ejemplo, la oferta Early Bird)."}</p>
        </div>
        <div>
          <label className="field-label" htmlFor="portal-link-label">Texto del botón</label>
          <input id="portal-link-label" name="linkLabel" className="input" maxLength={40} defaultValue={item.linkLabel} placeholder={kind === "LIVE" ? "Entrar al directo" : "Ver la oferta"} />
        </div>
        {kind !== "LIVE" && (
          <div>
            <p className="field-label">Enlace del botón</p>
            <LinkInput value={link} onChange={setLink} ariaLabel="Enlace del botón" targets={linkTargets} className="input" />
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <p className="field-label">Imagen <span className="font-normal text-muted">(se ve desenfocada con el candado)</span></p>
          <ImageUpload shape="wide" value={cover} onChange={setCover} label="Añadir imagen" />
          <p className="field-hint">Horizontal. En el vídeo, es la portada antes de darle al play.</p>
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="featured" defaultChecked={item.featured} className="h-4 w-4" />
          Principal: sale en grande arriba, en tu portada y en el panel
        </label>
      </section>

      <section className="card p-5 sm:p-6">
        <p className="field-label">Estado</p>
        <input type="hidden" name="status" value={status} />
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["DRAFT", "Borrador", "Solo tú lo ves."],
              ["PUBLISHED", "Publicado", "Se ve en tu Portal de Noticias."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={`studio-pick flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${status === value ? "is-on" : "border-line"}`}>
              <input type="radio" checked={status === value} onChange={() => setStatus(value)} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <button type="submit" className="btn btn-primary" disabled={pending || !!upload}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {item.id ? "Guardar cambios" : status === "PUBLISHED" ? "Publicar" : "Guardar borrador"}
      </button>
    </form>
  );
}
