"use client";

import { CalendarDays, Eye, Flame, Headphones, ImagePlus, Loader2, Mic, Moon, PenLine, Pin, Video, X } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useCallback, useMemo, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Flash } from "@/components/ui/flash";
import { ImageUpload } from "@/components/ui/image-upload";
import { BODY_MAX, isLivePostKind, MEMBER_POST_KIND_LABEL, scheduleSentence, TITLE_MAX, type MemberPostKind, type MemberPostWhen } from "@/lib/community-rules";
import { tzCity } from "@/lib/timezones";
import { zonedTimeToUtc } from "@/lib/tz";
import { saveStudioPost, type ComposerState } from "./actions";
import { PostAttachments, type Attachment } from "./post-attachments";

export type ComposerPost = {
  id: string | null;
  /** Nivel (membresía) de la publicación. */
  productId: string;
  title: string;
  body: string;
  bodyFormat: string | null;
  kind: string;
  mediaUrl: string;
  /** La foto de portada (vacía: la primera del texto o una según el tipo). */
  imageUrl: string;
  state: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  /** datetime-local de la fecha guardada (programadas). */
  at: string;
  notify: boolean;
  commentsOpen: boolean;
  pinned: boolean;
  files: Attachment[];
  eventDate: string;
  eventTime: string;
};

export type ComposerTier = {
  id: string;
  title: string;
  emoji: string | null;
  /** Personas que la leerán: las de este nivel y las de los niveles de arriba (sin repetir). */
  readers: number;
  /** «Plena y Luna completa»: niveles de arriba que la heredan. */
  inheritedBy: string[];
};

/** Tipos en el orden del compositor, con su icono. «Fotos» es una publicación con imágenes. */
const KINDS: { kind: MemberPostKind; icon: typeof PenLine; label?: string }[] = [
  { kind: "TEXT", icon: PenLine, label: "Texto" },
  { kind: "PODCAST", icon: Mic },
  { kind: "MEDITACION", icon: Headphones },
  { kind: "ASTROWEATHER", icon: Video },
  { kind: "MASTERCLASS", icon: CalendarDays },
  { kind: "CEREMONIA", icon: Flame },
  { kind: "VIDEO", icon: Video },
  { kind: "CIRCULO_LUNAR", icon: Moon, label: "Círculo de luna" },
];

const WHEN_LABEL: Record<MemberPostWhen, string> = { now: "Publicar ahora", schedule: "Programar", draft: "Borrador" };

const joinNames = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0] ?? "");

/**
 * Compositor del estudio Comunidad, encima del Muro: escribe (texto con formato, fotos, audio, vídeo,
 * podcast, ceremonia o círculo de la luna con su fecha), elige el nivel, cuándo (ahora, programada o
 * borrador), si avisa por email y si va fijada arriba. Cerrado es una sola línea («Escribe algo…»).
 * También edita una publicación existente (?editar=<id>).
 */
export function Composer({
  post,
  tiers,
  timeZone,
  minAt,
  limitsLabel,
  moonDates,
  notifiedNote,
  ownerName,
  startOpen,
}: {
  post: ComposerPost;
  tiers: ComposerTier[];
  timeZone: string;
  minAt: string;
  limitsLabel: string;
  /** Próximas lunas nueva y llena (lib/moon-dates.ts → lib/astro-calendar.ts). */
  moonDates: { label: string; title: string; date: string; time: string }[];
  notifiedNote: string | null;
  ownerName: string;
  startOpen: boolean;
}) {
  const [state, action, pending] = useActionState<ComposerState, FormData>(saveStudioPost, undefined);
  const editing = !!post.id;
  const live = post.state === "PUBLISHED";
  const [open, setOpen] = useState(startOpen || editing);
  const [tierId, setTierId] = useState(post.productId);
  const [kind, setKind] = useState(post.kind);
  const [when, setWhen] = useState<MemberPostWhen>(post.state === "DRAFT" ? (editing ? "draft" : "now") : post.state === "SCHEDULED" ? "schedule" : "now");
  const [at, setAt] = useState(post.at);
  const [title, setTitle] = useState(post.title);
  const [cover, setCover] = useState<string | null>(post.imageUrl || null);
  const [eventDate, setEventDate] = useState(post.eventDate);
  const [eventTime, setEventTime] = useState(post.eventTime);
  const [uploading, setUploading] = useState(false);
  // El primer archivo sugiere el tipo: un audio, podcast; un vídeo, vídeo.
  const onFirstMedia = useCallback((k: "AUDIO" | "VIDEO") => setKind((cur) => (cur === "TEXT" ? (k === "AUDIO" ? "PODCAST" : "VIDEO") : cur)), []);
  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];

  const sentence = useMemo(() => {
    const m = at.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
    if (!m) return null;
    const d = zonedTimeToUtc(m[1], Number(m[2]) * 60 + Number(m[3]), timeZone);
    return `Se publicará el ${scheduleSentence(d, timeZone)} (hora de ${tzCity(timeZone)}). Hasta entonces, nadie más la ve.`;
  }, [at, timeZone]);

  const options: MemberPostWhen[] = live ? ["now", "draft"] : ["now", "schedule", "draft"];
  const whenLabel = (w: MemberPostWhen) => (live && w === "now" ? "Publicada" : live && w === "draft" ? "Pasar a borrador" : WHEN_LABEL[w]);
  const primary = live ? (when === "draft" ? "Pasar a borrador" : "Guardar cambios") : when === "schedule" ? "Programar" : when === "draft" ? "Guardar borrador" : "Publicar";

  if (!open)
    return (
      <section className="card p-4 sm:p-5" id="publicar" aria-label="Nueva publicación">
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 text-left text-muted transition hover:border-ink/30">
          <PenLine className="h-4 w-4 shrink-0" /> Escribe algo para tu comunidad, {ownerName}…
        </button>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[{ kind: "TEXT" as MemberPostKind, icon: ImagePlus, label: "Fotos" }, ...KINDS.slice(1)].map((k) => (
            <button
              key={k.label ?? k.kind}
              type="button"
              onClick={() => {
                setKind(k.kind);
                setOpen(true);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink/80 hover:border-ink/30"
            >
              <k.icon className="h-3.5 w-3.5" /> {k.label ?? MEMBER_POST_KIND_LABEL[k.kind]}
            </button>
          ))}
        </div>
      </section>
    );

  return (
    <form
      id="publicar"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="card scroll-mt-24 space-y-5 p-4 sm:p-6"
      aria-label={editing ? "Editar publicación" : "Nueva publicación"}
      data-composer
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{editing ? "Editar publicación" : "Nueva publicación"}</h2>
        {editing ? (
          <Link href="/panel/comunidad" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-sand" aria-label="Cerrar sin guardar">
            <X className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-sand" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Flash error={state?.error} />
      {post.id && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="pinnedField" value="1" />

      <fieldset>
        <legend className="field-label">Tipo</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
          {KINDS.map((k) => (
            <label key={k.kind} className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${kind === k.kind ? "border-ink bg-ink text-cream" : "border-line bg-white text-ink/80 hover:border-ink/30"}`}>
              <input type="radio" name="kind" value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} className="sr-only" />
              <k.icon className="h-3.5 w-3.5" /> {k.label ?? MEMBER_POST_KIND_LABEL[k.kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="field-label">Foto de portada <span className="font-normal text-muted">(opcional)</span></p>
        <input type="hidden" name="imageUrl" value={cover ?? ""} />
        <ImageUpload value={cover} onChange={setCover} shape="wide" label="Subir foto de portada" />
        <p className="field-hint">Sale a la izquierda en la tarjeta y arriba al abrirla. Sin foto, se usa la primera del texto o una según el tipo.</p>
      </div>

      <div>
        <label className="field-label" htmlFor="post-title">Título</label>
        <input id="post-title" name="title" required minLength={2} maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} className="input h-11 text-base" placeholder="P. ej. Meditación de luna llena" />
      </div>

      {isLivePostKind(kind) && (
        <div className="space-y-2 rounded-2xl border border-line bg-paper p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarDays className="h-4 w-4" /> Cuándo es {kind === "CIRCULO_LUNAR" ? "el círculo" : kind === "CEREMONIA" ? "la ceremonia" : kind === "MASTERCLASS" ? "la masterclass" : "el directo"}{" "}
            <span className="font-normal text-muted">(hora de {tzCity(timeZone)})</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="eventDate" type="date" aria-label="Día del encuentro" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input h-11" />
            <input name="eventTime" type="time" step={300} aria-label="Hora del encuentro" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="input h-11" />
          </div>
          {(kind === "MASTERCLASS" || kind === "CEREMONIA") && (
            <p className="text-xs text-muted">
              {kind === "MASTERCLASS" ? "Si es solo un vídeo, deja la fecha vacía. " : ""}Pasada la fecha, se verá como grabación: añade el vídeo aquí cuando lo tengas.
            </p>
          )}
          {kind === "CIRCULO_LUNAR" && moonDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Próximas lunas:</span>
              {moonDates.map((m) => (
                <button
                  key={m.date}
                  type="button"
                  className={`btn btn-sm ${eventDate === m.date ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => {
                    setEventDate(m.date);
                    setEventTime(m.time);
                    if (!title.trim()) setTitle(`Círculo de ${m.title.toLowerCase()}`);
                  }}
                >
                  <Moon className="h-3.5 w-3.5" /> {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <span className="field-label">Texto</span>
        <RichTextEditor
          name="body"
          ariaLabel="Texto de la publicación"
          formatName="bodyFormat"
          defaultValue={post.body}
          initialFormat={post.bodyFormat ?? "MD"}
          maxLength={BODY_MAX}
          tools="full"
          images
          tone="account"
          headingLevel={3}
          legacy="preline"
          rows={5}
          placeholder="Escribe para tu comunidad…"
        />
      </div>

      <div className="space-y-3">
        <span className="field-label">Fotos, audio, vídeo y archivos</span>
        <PostAttachments productId={tierId} initial={post.files} limitsLabel={limitsLabel} onFirstMedia={onFirstMedia} onBusy={setUploading} quickPick />
        <div>
          <label className="field-label" htmlFor="post-link">Enlace (opcional)</label>
          <input id="post-link" name="mediaUrl" type="url" defaultValue={post.mediaUrl} className="input h-11 text-base" placeholder="https://… (Zoom, YouTube, Spotify…)" />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-paper p-4">
        <fieldset>
          <legend className="text-sm font-semibold">Para quién</legend>
          <div role="radiogroup" aria-label="Nivel" className="mt-2 grid gap-1 rounded-2xl bg-sand/70 p-1" style={{ gridTemplateColumns: `repeat(${Math.max(tiers.length, 1)}, minmax(0, 1fr))` }}>
            {tiers.map((t) => (
              <label key={t.id} className={`flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-xl px-2 text-center text-sm font-semibold transition ${tierId === t.id ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                <input type="radio" name="productId" value={t.id} checked={tierId === t.id} onChange={() => setTierId(t.id)} className="sr-only" />
                {t.emoji && <span aria-hidden>{t.emoji}</span>} {t.title}
              </label>
            ))}
          </div>
          {tier && (
            <p className="mt-1.5 text-xs text-muted" data-tier-hint>
              La verán quienes estén en {joinNames([tier.title, ...tier.inheritedBy])} · {tier.readers} {tier.readers === 1 ? "persona" : "personas"} ahora.
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Cuándo</legend>
          {live && <p className="mt-1 text-xs text-muted">Ya la ven tus miembros.</p>}
          <div role="radiogroup" aria-label="Cuándo" className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-sand/70 p-1">
            {options.map((w) => (
              <label key={w} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm font-semibold transition ${when === w ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                <input type="radio" name="when" value={w} checked={when === w} onChange={() => setWhen(w)} className="sr-only" />
                {whenLabel(w)}
              </label>
            ))}
          </div>
          {when === "schedule" && (
            <div className="mt-3">
              <label className="field-label" htmlFor="post-at">Día y hora</label>
              <input id="post-at" name="at" type="datetime-local" required min={minAt} value={at} onChange={(e) => setAt(e.target.value)} className="input h-11 text-base sm:max-w-xs" />
              {sentence && <p className="mt-1.5 text-sm text-muted">{sentence}</p>}
            </div>
          )}
        </fieldset>

        <div className="grid gap-2 sm:grid-cols-3">
          <Toggle name="notify" defaultChecked={post.notify} disabled={live} title="Avisar por email" hint={notifiedNote ?? (live ? "Ya está publicada: no se vuelve a avisar." : when === "schedule" ? "Sale cuando se publique." : "Sale al publicarla.")} />
          {live && post.notify && <input type="hidden" name="notify" value="on" />}
          <Toggle name="pinned" defaultChecked={post.pinned} title="Fijar arriba" hint="Sale la primera del feed." icon={<Pin className="h-3.5 w-3.5" />} />
          <Toggle name="commentsOpen" defaultChecked={post.commentsOpen} title="Comentarios" hint="Tus miembros pueden comentar." />
        </div>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper/95 p-2.5 shadow-lift backdrop-blur">
          <button type="submit" className="btn btn-primary h-12 flex-1 sm:flex-none sm:px-8" disabled={pending || uploading}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {uploading ? "Esperando a la subida…" : primary}
          </button>
          {post.id && (
            <Link href={`/cuenta/membresias/${post.productId}/${post.id}`} className="btn btn-outline h-12">
              <Eye className="h-4 w-4" /> Vista previa
            </Link>
          )}
          <span className="text-xs text-muted">{tier ? `En ${tier.title}` : ""}{when === "schedule" && at ? " · programada" : when === "draft" ? " · borrador" : ""}</span>
        </div>
      </div>
    </form>
  );
}

function Toggle({ name, defaultChecked, disabled, title, hint, icon }: { name: string; defaultChecked: boolean; disabled?: boolean; title: string; hint: string; icon?: React.ReactNode }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-white p-3 text-sm ${disabled ? "opacity-70" : ""}`}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0E1024]" />
      <span>
        <span className="flex items-center gap-1 font-semibold">{icon} {title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
