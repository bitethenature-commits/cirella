"use client";
import { ArrowUpRight, CalendarDays, Camera, FilePen, Headphones, Images, Loader2, Moon, Play, Send, Sparkles, Star, Trash2, Upload, Video } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Flash } from "@/components/ui/flash";
import { uploadImageInfo } from "@/components/ui/image-upload";
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

/** El tema de la web (lib/templates.ts) para que el editor se vea como la web. */
export type PortalTheme = { style: CSSProperties; card?: string; template?: string } | null;

type MediaEntry = { ref: string; name: string; kind: string };

const ACCEPT: Record<string, string> = {
  VIDEO: "video/mp4,video/quicktime,.mp4,.mov,.m4v",
  AUDIO: "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav",
  IMAGE: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
};
const KIND_ICON = { VIDEO: Video, AUDIO: Headphones, PHOTOS: Images, LIVE: CalendarDays, EARLY_BIRD: Sparkles } as const;

/** Lo que se escribe encima de la web: sin caja, con una línea dorada suave al pasar o escribir. */
const inline =
  "rounded-lg bg-transparent outline-none ring-1 ring-[color-mix(in_oklab,var(--c-gold)_14%,transparent)] transition placeholder:opacity-45 hover:ring-[color-mix(in_oklab,var(--c-gold)_40%,transparent)] focus:ring-[color-mix(in_oklab,var(--c-gold)_75%,transparent)]";

/** Un texto que crece con lo escrito. */
function Grow({ name, value, onChange, className = "", placeholder, maxLength, label, required }: { name: string; value: string; onChange: (v: string) => void; className?: string; placeholder?: string; maxLength?: number; label: string; required?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      name={name}
      rows={1}
      value={value}
      required={required}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full resize-none overflow-hidden px-2 py-1 ${inline} ${className}`}
    />
  );
}

/**
 * Elemento del Portal de Noticias escrito sobre la propia web: arriba, qué es (vídeo, audio, fotos,
 * directo o Early Bird); debajo, su tarjeta tal y como la ven las suscriptoras, con la portada, el
 * archivo, el título, el extracto, el texto y el botón escritos encima. Al final, «Principal» y si se
 * publica o se queda en borrador. Los archivos se suben como privados (purpose «portal») y viajan al
 * guardar como billetes firmados; los que ya tenía, por su posición.
 */
export function PortalForm({ item, linkTargets, moonDates, theme = null }: { item: EditablePortalItem; linkTargets: LinkTarget[]; moonDates: { label: string; date: string; time: string }[]; theme?: PortalTheme }) {
  const [state, action, pending] = useActionState<PortalActionState, FormData>(savePortalItem, undefined);
  const [kind, setKind] = useState<PortalKind>(item.kind);
  const [title, setTitle] = useState(item.title);
  const [summary, setSummary] = useState(item.summary);
  const [body, setBody] = useState(item.body);
  const [linkLabel, setLinkLabel] = useState(item.linkLabel);
  const [cover, setCover] = useState(item.coverUrl);
  const [coverPct, setCoverPct] = useState<number | null>(null);
  const [media, setMedia] = useState<MediaEntry[]>(item.media.map((m, i) => ({ ref: `keep:${i}`, name: m.name, kind: m.kind })));
  const [link, setLink] = useState(item.linkUrl);
  const [eventDate, setEventDate] = useState(item.eventDate);
  const [eventTime, setEventTime] = useState(item.eventTime);
  const [featured, setFeatured] = useState(item.featured);
  const [status, setStatus] = useState(item.status);
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const fileKind = mediaKindFor(kind);
  const shown = media.filter((m) => m.kind === fileKind);
  const max = fileKind === "IMAGE" ? PORTAL_PHOTOS_MAX : 1;
  const Icon = KIND_ICON[kind];

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

  const onCover = async (file: File) => {
    setUploadError(null);
    setCoverPct(0);
    try {
      const img = await uploadImageInfo(file, { onProgress: setCoverPct });
      setCover(img.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setCoverPct(null);
      if (coverInput.current) coverInput.current.value = "";
    }
  };

  const pickFile = () => input.current?.click();
  const pickCover = () => coverInput.current?.click();
  const fileLabel = kind === "PHOTOS" ? (shown.length ? "Añadir fotos" : `Subir fotos (hasta ${PORTAL_PHOTOS_MAX})`) : shown.length ? "Cambiar" : kind === "VIDEO" ? "Subir vídeo" : "Subir audio";

  /** La portada de la tarjeta: se toca para subirla o cambiarla. */
  const coverArea = (ratio: string, overlay?: ReactNode) => (
    <div className={`cp-photo-bubble cp-photo-in relative ${ratio} w-[calc(100%-1.7rem)] overflow-hidden`}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 40%, #000), color-mix(in oklab, var(--c-gold) 30%, #000))" }} />
      )}
      {overlay}
      <button type="button" onClick={pickCover} className="absolute bottom-3 right-3 z-[2] inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
        {coverPct != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        {coverPct != null ? `${coverPct} %` : cover ? "Cambiar portada" : "Poner portada"}
      </button>
      {cover && coverPct == null && (
        <button type="button" onClick={() => setCover(null)} className="absolute bottom-3 left-3 z-[2] grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur" aria-label="Quitar portada">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  /** El archivo privado (vídeo o audio) o las fotos: lo subido y el botón para subir. */
  const fileRow = (
    <div className="space-y-2">
      {shown.map((m) => (
        <div key={m.ref} className="cp-line flex items-center gap-2 rounded-xl border px-3 py-2 text-[0.88rem]">
          {kind === "PHOTOS" ? <Images className="cp-gold h-4 w-4" /> : kind === "AUDIO" ? <Headphones className="cp-gold h-4 w-4" /> : <Play className="cp-gold h-4 w-4" />}
          <span className="min-w-0 flex-1 truncate">{m.name}</span>
          <button type="button" onClick={() => setMedia((cur) => cur.filter((x) => x.ref !== m.ref))} className="cp-muted hover:text-rose-400" aria-label={`Quitar ${m.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {upload ? (
        <p className="cp-muted flex items-center gap-2 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Subiendo «{upload.name}» · {upload.pct} %
        </p>
      ) : (
        shown.length < max && (
          <button type="button" onClick={pickFile} className="cp-btn-ghost">
            <Upload className="h-4 w-4" /> {fileLabel}
          </button>
        )
      )}
      <p className="cp-faint text-[0.75rem]">Privado: solo lo abre quien lo tiene desbloqueado. Nadie puede compartir el enlace.</p>
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-6"
    >
      <Flash ok={state?.ok} error={state?.error} />
      {item.id && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="coverUrl" value={cover ?? ""} />
      <input type="hidden" name="media" value={JSON.stringify(shown.map((m) => m.ref))} />
      <input type="hidden" name="linkUrl" value={link} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="status" value={status} />
      {featured && <input type="hidden" name="featured" value="on" />}
      <input ref={input} type="file" accept={fileKind ? ACCEPT[fileKind] : undefined} multiple={kind === "PHOTOS"} className="hidden" aria-label="Subir archivo del portal" onChange={(e) => e.target.files?.length && onFiles(e.target.files)} />
      <input ref={coverInput} type="file" accept={ACCEPT.IMAGE} className="hidden" aria-label="Subir portada" onChange={(e) => e.target.files?.[0] && onCover(e.target.files[0])} />

      {/* La web: el tipo arriba y la tarjeta tal y como la ven las suscriptoras, escrita encima. */}
      <div className="cp !min-h-0 rounded-[2rem] px-4 py-6 sm:px-8 sm:py-8" style={theme?.style} data-card={theme?.card} data-template={theme?.template}>
        <p className="cp-eyebrow text-center">Así se ve en tu Portal de Noticias · escribe encima</p>

        <div className="mt-4 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Qué es">
          {PORTAL_KINDS.map((k) => {
            const KIcon = KIND_ICON[k];
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition"
                style={
                  on
                    ? { borderColor: "var(--c-gold)", background: "color-mix(in oklab, var(--c-gold) 18%, transparent)", color: "var(--c-gold)" }
                    : { borderColor: "color-mix(in oklab, var(--c-gold) 28%, transparent)", color: "var(--c-muted)" }
                }
              >
                <KIcon className="h-4 w-4" /> {PORTAL_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>

        <article className="cp-card mx-auto mt-6 max-w-2xl overflow-hidden" data-portal-item="editor">
          {/* Arriba de la tarjeta: lo que se ve primero */}
          {kind === "VIDEO" ? (
            <div className="relative aspect-video w-full bg-black">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
                <span className="grid h-16 w-16 place-items-center rounded-full border border-white/50 bg-black/40">
                  <Play className="h-7 w-7" />
                </span>
                {shown[0] ? <p className="max-w-full truncate text-sm">{shown[0].name}</p> : <p className="text-sm opacity-80">Aquí va el vídeo</p>}
                {upload ? (
                  <p className="flex items-center gap-2 text-sm" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" /> {upload.pct} %
                  </p>
                ) : (
                  <button type="button" onClick={pickFile} className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black">
                    <Upload className="h-4 w-4" /> {fileLabel}
                  </button>
                )}
              </div>
              <button type="button" onClick={pickCover} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                {coverPct != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {coverPct != null ? `${coverPct} %` : cover ? "Cambiar portada" : "Portada antes del play"}
              </button>
            </div>
          ) : kind === "PHOTOS" ? (
            <div className="p-[0.85rem] pb-0">
              <div className={`grid gap-2 ${shown.length > 1 ? "grid-cols-2" : ""}`}>
                {shown.map((m) => (
                  <div key={m.ref} className="cp-photo-bubble relative grid aspect-[4/3] place-items-center p-3 text-center" style={{ background: "color-mix(in oklab, var(--c-gold) 8%, transparent)" }}>
                    <Images className="cp-gold h-6 w-6" />
                    <span className="cp-muted mt-1 line-clamp-2 text-[0.75rem]">{m.name}</span>
                    <button type="button" onClick={() => setMedia((cur) => cur.filter((x) => x.ref !== m.ref))} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white" aria-label={`Quitar ${m.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {shown.length < max && (
                  <button type="button" onClick={pickFile} disabled={!!upload} className="cp-line cp-muted flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border border-dashed text-sm">
                    {upload ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    {upload ? `${upload.pct} %` : fileLabel}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-[0.85rem]">{coverArea("aspect-[4/3] mx-auto")}</div>
          )}

          <div className="p-5 sm:p-6">
            <span className="cp-tag" data-tone={kind === "LIVE" ? "accent" : undefined}>
              <Icon className="h-3 w-3" /> {PORTAL_KIND_LABEL[kind]}
            </span>
            <h3 className="cp-display mt-2 text-[1.9rem] leading-tight">
              <Grow name="title" value={title} onChange={setTitle} required maxLength={PORTAL_TITLE_MAX} placeholder="Título (p. ej. Ritual de luna nueva)" label="Título" />
            </h3>

            {kind === "LIVE" && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[0.9rem]">
                  <CalendarDays className="cp-gold h-4 w-4" />
                  <input name="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} aria-label="Día" className={`cp-muted h-9 px-2 [color-scheme:dark] ${inline}`} />
                  <input name="eventTime" type="time" step={300} value={eventTime} onChange={(e) => setEventTime(e.target.value)} aria-label="Hora (España)" className={`cp-muted h-9 px-2 [color-scheme:dark] ${inline}`} />
                  <span className="cp-faint text-xs">hora de España</span>
                </div>
                {moonDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {moonDates.map((m) => (
                      <button
                        key={m.date}
                        type="button"
                        onClick={() => {
                          setEventDate(m.date);
                          setEventTime(m.time);
                        }}
                        className="cp-line inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.75rem]"
                      >
                        <Moon className="cp-gold h-3 w-3" /> {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Grow name="summary" value={summary} onChange={setSummary} maxLength={PORTAL_SUMMARY_MAX} placeholder="Extracto: se ve también con el candado, para que den ganas de suscribirse (opcional)" label="Extracto" className="cp-muted mt-2 text-[0.92rem] leading-relaxed" />

            {kind === "AUDIO" && <div className="mt-4">{fileRow}</div>}
            {kind === "VIDEO" && <p className="cp-faint mt-2 text-[0.75rem]">El vídeo es privado: solo lo abre quien lo tiene desbloqueado.</p>}
            {kind === "PHOTOS" && <p className="cp-faint mt-2 text-[0.75rem]">Las fotos son privadas: solo las ve quien lo tiene desbloqueado. La portada sale en la lista y desenfocada con el candado: <button type="button" onClick={pickCover} className="underline underline-offset-2">{cover ? "cambiarla" : "ponerla"}</button>.</p>}

            <Grow name="body" value={body} onChange={setBody} maxLength={PORTAL_BODY_MAX} placeholder="El texto (solo para suscriptoras)" label="Texto" className="mt-3 min-h-24 text-[0.95rem] leading-relaxed" />

            {/* El botón tal y como sale; adónde lleva, debajo */}
            <div className="mt-5 space-y-2">
              <span className="cp-btn !cursor-text">
                <input
                  name="linkLabel"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  maxLength={40}
                  placeholder={kind === "LIVE" ? "Entrar al directo" : "Texto del botón (opcional)"}
                  aria-label="Texto del botón"
                  className="w-48 bg-transparent text-inherit outline-none placeholder:text-current placeholder:opacity-60"
                />
                <ArrowUpRight className="h-4 w-4" />
              </span>
              {kind === "LIVE" ? (
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Enlace de Zoom: https://us02web.zoom.us/j/…" maxLength={600} aria-label="Enlace de Zoom" className={`cp-muted block w-full px-2 py-1.5 text-[0.85rem] ${inline}`} />
              ) : (
                <div className="max-w-md rounded-xl bg-white/95 p-2 text-ink">
                  <p className="mb-1 px-1 text-[0.7rem] font-semibold text-muted">Adónde lleva el botón (opcional)</p>
                  <LinkInput value={link} onChange={setLink} ariaLabel="Enlace del botón" targets={linkTargets} className="input" />
                </div>
              )}
            </div>
          </div>
        </article>
        {uploadError && (
          <p role="alert" className="mt-3 text-center text-sm text-rose-400">
            {uploadError}
          </p>
        )}
      </div>

      {/* Antes de publicar */}
      <section className="rounded-[2rem] border border-gold/40 bg-gradient-to-b from-[#14112e] to-[#0b0a1c] p-5 shadow-[0_0_60px_-20px_rgb(212_181_122/.35)] sm:p-7">
        <p className="text-center text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold">✦ Antes de publicar ✦</p>
        <button
          type="button"
          aria-pressed={featured}
          onClick={() => setFeatured((f) => !f)}
          className={`mt-5 flex w-full items-center gap-3 rounded-[1.3rem] border px-4 py-3 text-left transition ${featured ? "border-gold/70 bg-gold/[.07]" : "border-gold/25 hover:border-gold/50"}`}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/40 text-[#f0d9a4]">
            <Star className={`h-4 w-4 ${featured ? "fill-current" : ""}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[#f1ebdf]">Principal</span>
            <span className="block text-xs text-[#a7a2c2]">Sale en grande arriba, en tu portada y en el panel.</span>
          </span>
          <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${featured ? "bg-gold" : "bg-white/15"}`}>
            <span className={`block h-5 w-5 rounded-full bg-white transition ${featured ? "translate-x-5" : ""}`} />
          </span>
        </button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Estado">
          {(
            [
              ["PUBLISHED", "Publicado", "Se ve en tu Portal de Noticias.", Send],
              ["DRAFT", "Borrador", "Solo tú lo ves.", FilePen],
            ] as const
          ).map(([value, label, hint, SIcon]) => {
            const on = status === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStatus(value)}
                className={`flex flex-col items-center gap-2 rounded-[1.4rem] border px-4 py-5 text-center transition ${on ? "border-[#e9cc8e] bg-gold/[.12] shadow-[0_0_30px_-10px_rgb(212_181_122/.6)]" : "border-gold/25 hover:border-gold/50"}`}
              >
                <SIcon className={`h-6 w-6 ${on ? "text-gold" : "text-[#a7a2c2]"}`} />
                <span className={`display text-[1.35rem] leading-none ${on ? "text-[#f7e5b8]" : "text-[#f1ebdf]"}`}>{label}</span>
                <span className="text-xs text-[#a7a2c2]">{hint}</span>
              </button>
            );
          })}
        </div>
        <button type="submit" className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c9a35f] via-[#e9cc8e] to-[#c9a35f] text-base font-semibold text-[#14112e] shadow-[0_10px_40px_-10px_rgb(212_181_122/.7)] disabled:opacity-60" disabled={pending || !!upload || coverPct != null}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {item.id ? "Guardar cambios" : status === "PUBLISHED" ? "Publicar" : "Guardar borrador"}
        </button>
      </section>
    </form>
  );
}
