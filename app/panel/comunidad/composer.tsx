"use client";

import { ArrowDown, ArrowUp, Bell, CalendarClock, CalendarDays, ExternalLink, FileText, Flame, Feather, Headphones, ImagePlus, Loader2, Mic, PenLine, Pin, Plus, Send, Video, X, FilePen } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { MediaViewBase } from "@/components/media/media-view-base";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Flash } from "@/components/ui/flash";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { UPLOAD_CANCELLED, uploadFile } from "@/components/ui/upload-client";
import { MoonCircleArt } from "@/components/creator-page/moon-circle-art";
import { SpinningSolid } from "@/app/cuenta/spinning-solid";
import { postCover } from "@/app/cuenta/membresias/cover";
import { KindBadge, kindStyle } from "@/app/cuenta/membresias/kind-style";
import { postSky } from "@/app/cuenta/membresias/post-sky";
import { Ornament } from "@/app/cuenta/membresias/vip";
import { ATTACHMENTS_MAX, BODY_MAX, isLivePostKind, MEMBER_POST_KIND_LABEL, SUMMARY_MAX, TITLE_MAX, type MemberPostKind, type MemberPostWhen } from "@/lib/community-rules";
import { fileMarker, splitBody } from "@/lib/post-blocks";
import { richToPlain, truncateWords } from "@/lib/rich-text";
import { tzCity } from "@/lib/timezones";
import { saveStudioPost, type ComposerState } from "./actions";
import type { Attachment } from "./post-attachments";
import { WhenPicker } from "./when-picker";

export type ComposerPost = {
  id: string | null;
  /** Nivel (membresía) de la publicación. */
  productId: string;
  title: string;
  summary: string;
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

/** Tipos en el orden del compositor, con su icono. */
const KINDS: { kind: MemberPostKind; icon: typeof PenLine; label?: string }[] = [
  { kind: "TEXT", icon: Feather, label: "Post" },
  { kind: "PODCAST", icon: Mic },
  { kind: "MEDITACION", icon: Headphones },
  { kind: "ASTROWEATHER", icon: Video },
  { kind: "MASTERCLASS", icon: CalendarDays },
  { kind: "CEREMONIA", icon: Flame },
  { kind: "VIDEO", icon: Video },
];

const joinNames = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0] ?? "");
const LEVELS = ["I", "II", "III", "IV", "V"];

// ── Las partes de la publicación ──

type Block = { key: string; t: "text"; md: string } | { key: string; t: "photo"; url: string } | { key: string; t: "file"; file: Attachment };
type AddKind = "text" | "photo" | "AUDIO" | "VIDEO" | "PDF";
const IMAGE_LINE = /^!\[[^\]\n]*\]\(([^)\s]+)\)\s*$/;
let seq = 0;
const newKey = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

/** El texto guardado → partes: texto, fotos (líneas de imagen solas) y archivos en su sitio. */
function toBlocks(body: string, files: Attachment[]): Block[] {
  const byId = new Map(files.map((f) => [f.id, f]));
  const out: Block[] = [];
  for (const p of splitBody(body)) {
    if (p.t === "file") {
      const f = byId.get(p.id);
      if (f) {
        out.push({ key: newKey(), t: "file", file: f });
        byId.delete(p.id);
      }
      continue;
    }
    let buf: string[] = [];
    const flush = () => {
      const md = buf.join("\n").trim();
      if (md) out.push({ key: newKey(), t: "text", md });
      buf = [];
    };
    for (const line of p.text.split("\n")) {
      const m = line.trim().match(IMAGE_LINE);
      if (m) {
        flush();
        out.push({ key: newKey(), t: "photo", url: m[1] });
      } else buf.push(line);
    }
    flush();
  }
  // Los archivos de antes, sin sitio en el texto: al final.
  for (const f of byId.values()) out.push({ key: newKey(), t: "file", file: f });
  return out.length ? out : [{ key: newKey(), t: "text", md: "" }];
}

const toBody = (blocks: Block[]) =>
  blocks
    .map((b) => (b.t === "text" ? b.md.trim() : b.t === "photo" ? `![](${b.url})` : fileMarker(b.file.id)))
    .filter(Boolean)
    .join("\n\n");

const ACCEPT: Record<Exclude<AddKind, "text" | "photo">, string> = {
  AUDIO: ".m4a,.mp3,.wav,audio/mp4,audio/x-m4a,audio/mpeg,audio/wav",
  VIDEO: ".mp4,.m4v,.mov,video/mp4,video/quicktime",
  PDF: ".pdf,application/pdf",
};

/**
 * Compositor del estudio Comunidad («Publicar y programar», y para editar desde el Muro). No es un
 * formulario: es la publicación tal como la ve una alumna en su área. Arriba, la membresía; luego la
 * tarjeta del muro y la publicación abierta, hecha por partes en el orden que quieras (texto, fotos,
 * audio, vídeo, PDF); después, aviso por email y fijar; y abajo del todo, cuándo sale.
 */
export function Composer({
  post,
  tiers,
  timeZone,
  minAt,
  moonDates,
  notifiedNote,
  personal,
  closeHref = "/panel/comunidad",
}: {
  post: ComposerPost;
  tiers: ComposerTier[];
  timeZone: string;
  minAt: string;
  /** Próximas lunas nueva y llena (lib/moon-dates.ts → lib/astro-calendar.ts). */
  moonDates: { label: string; title: string; date: string; time: string }[];
  notifiedNote: string | null;
  /** Web personal: cómo se entregan los audios (components/media/media-view-base.tsx). */
  personal: boolean;
  closeHref?: string;
}) {
  const [state, action, pending] = useActionState<ComposerState, FormData>(saveStudioPost, undefined);
  const editing = !!post.id;
  const live = post.state === "PUBLISHED";
  const [tierId, setTierId] = useState(post.productId);
  const [kind, setKind] = useState(post.kind);
  const [when, setWhen] = useState<MemberPostWhen>(post.state === "SCHEDULED" ? "schedule" : post.state === "DRAFT" && editing ? "draft" : "now");
  const [at, setAt] = useState(post.at);
  const [title, setTitle] = useState(post.title);
  const [summary, setSummary] = useState(post.summary);
  const [cover, setCover] = useState<string | null>(post.imageUrl || null);
  const [eventDate, setEventDate] = useState(post.eventDate);
  const [eventTime, setEventTime] = useState(post.eventTime);
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(post.body, post.files));
  const [addAt, setAddAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<{ label: string; pct: number } | null>(null);
  const [coverUpload, setCoverUpload] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const partInput = useRef<HTMLInputElement>(null);
  const pendingAdd = useRef<{ kind: Exclude<AddKind, "text">; at: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];

  const body = toBody(blocks);
  const fileCount = blocks.filter((b) => b.t === "file").length;
  const s = kindStyle(kind);
  const liveKind = isLivePostKind(kind);
  const eventAt = liveKind && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? new Date(`${eventDate}T${/^\d{2}:\d{2}$/.test(eventTime) ? eventTime : "12:00"}:00Z`) : null;
  const sky = postSky({ kind, eventAt });
  const shownCover = postCover({ kind, imageUrl: cover, body });
  const autoExcerpt = truncateWords(richToPlain(body, "MD"), 220);
  const scheduled = when === "schedule" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at);
  // La fecha de la publicación: la programada o hoy.
  const pubKey = scheduled ? at.slice(0, 10) : minAt.slice(0, 10);
  const pubDate = new Date(`${pubKey}T12:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { ...o, timeZone: "UTC" }).format(pubDate);
  const eventLine = eventDate ? `${new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${eventDate}T12:00:00Z`))}${eventTime ? `, ${eventTime}` : ""} (hora de ${tzCity(timeZone)})` : null;
  const uploading = !!busy || coverUpload !== null;

  const setAtBlock = (key: string, patch: Partial<Block>) => setBlocks((l) => l.map((b) => (b.key === key ? ({ ...b, ...patch } as Block) : b)));
  const move = (i: number, d: -1 | 1) =>
    setBlocks((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const insert = (i: number, b: Block) => setBlocks((l) => [...l.slice(0, i), b, ...l.slice(i)]);

  const add = (k: AddKind, i: number) => {
    setAddAt(null);
    setError(null);
    if (k === "text") return insert(i, { key: newKey(), t: "text", md: "" });
    if (k !== "photo" && fileCount >= ATTACHMENTS_MAX) return setError(`Máximo ${ATTACHMENTS_MAX} archivos por publicación.`);
    pendingAdd.current = { kind: k, at: i };
    if (!partInput.current) return;
    partInput.current.accept = k === "photo" ? "image/jpeg,image/png,image/webp,image/gif" : ACCEPT[k];
    partInput.current.click();
  };

  const onPart = async (file: File) => {
    const p = pendingAdd.current;
    if (!p) return;
    pendingAdd.current = null;
    setBusy({ label: file.name, pct: 0 });
    try {
      if (p.kind === "photo") {
        const img = await uploadImageInfo(file, { onProgress: (pct) => setBusy({ label: file.name, pct }) });
        insert(p.at, { key: newKey(), t: "photo", url: img.url });
      } else {
        const ctrl = new AbortController();
        abort.current = ctrl;
        const r = await uploadFile(file, { purpose: "file", productId: tierId, signal: ctrl.signal, onProgress: (pct) => setBusy({ label: file.name, pct }) });
        if (r.file) {
          const f = r.file;
          insert(p.at, { key: newKey(), t: "file", file: f });
          // El primer audio o vídeo sugiere el tipo.
          if (f.kind === "AUDIO" || f.kind === "VIDEO") setKind((cur) => (cur === "TEXT" ? (f.kind === "AUDIO" ? "PODCAST" : "VIDEO") : cur));
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al subir";
      setError(msg === UPLOAD_CANCELLED ? "Subida cancelada." : `«${file.name}»: ${msg}`);
    } finally {
      abort.current = null;
      setBusy(null);
    }
  };

  const onCover = async (f: File) => {
    setCoverUpload(0);
    setError(null);
    try {
      setCover((await uploadImageInfo(f, { onProgress: setCoverUpload })).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido subir la foto");
    } finally {
      setCoverUpload(null);
    }
  };
  const pickCover = () => coverInput.current?.click();
  const coverBusy = coverUpload !== null && (
    <span className="absolute inset-0 z-[4] grid place-items-center bg-black/60 text-sm text-white">
      <span className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> {coverUpload < 100 ? `${coverUpload} %` : "Optimizando…"}
      </span>
    </span>
  );
  const coverHover = (
    <span className="absolute inset-0 z-[3] grid place-items-center bg-black/0 text-white opacity-0 transition group-hover/cover:bg-black/40 group-hover/cover:opacity-100">
      <span className="flex flex-col items-center gap-1 text-sm font-semibold">
        <ImagePlus className="h-6 w-6" /> {cover ? "Cambiar la foto" : "Poner tu foto"}
      </span>
    </span>
  );
  const inline = "rounded-lg bg-transparent outline-none ring-1 ring-gold/15 transition placeholder:text-muted/60 hover:ring-gold/40 focus:ring-gold/80";

  /** «+ Añadir aquí»: texto, foto, audio, vídeo o PDF en ese sitio. */
  const addBar = (i: number, always = false) =>
    addAt === i || always ? (
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gold/30 bg-white/[.02] p-2.5">
        {(
          [
            ["text", "Texto", PenLine],
            ["photo", "Foto", ImagePlus],
            ["AUDIO", "Audio", Headphones],
            ["VIDEO", "Vídeo", Video],
            ["PDF", "PDF", FileText],
          ] as const
        ).map(([k, label, Icon]) => (
          <button key={k} type="button" disabled={uploading} onClick={() => add(k, i)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gold/30 px-3.5 text-sm font-semibold text-[#f0d9a4] transition hover:border-gold/70 hover:bg-gold/10 disabled:opacity-40">
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
        {!always && (
          <button type="button" onClick={() => setAddAt(null)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white/5" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    ) : (
      <div className="group/add relative flex h-6 items-center justify-center">
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-gold/0 to-transparent transition group-hover/add:via-gold/40" />
        <button type="button" onClick={() => setAddAt(i)} className="relative grid h-7 w-7 place-items-center rounded-full border border-gold/25 bg-[#0d0c22] text-gold/70 opacity-40 transition hover:opacity-100 group-hover/add:opacity-100" aria-label="Añadir algo aquí">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );

  const tools = (i: number, label: string) => (
    <span className="absolute right-2 top-2 z-10 flex gap-1 rounded-full bg-[#0d0c22]/85 p-1 opacity-0 shadow-lg ring-1 ring-gold/25 backdrop-blur transition group-hover/block:opacity-100 group-focus-within/block:opacity-100">
      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-full text-[#f0d9a4] hover:bg-white/10 disabled:opacity-25" aria-label={`Subir ${label}`}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="grid h-8 w-8 place-items-center rounded-full text-[#f0d9a4] hover:bg-white/10 disabled:opacity-25" aria-label={`Bajar ${label}`}>
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setBlocks((l) => l.filter((_, k) => k !== i))} className="grid h-8 w-8 place-items-center rounded-full text-[#f0d9a4] hover:bg-white/10 hover:text-rose" aria-label={`Quitar ${label}`}>
        <X className="h-4 w-4" />
      </button>
    </span>
  );

  const submitLabel = live
    ? when === "draft"
      ? "Pasar a borrador"
      : "Guardar los cambios"
    : when === "schedule"
      ? scheduled
        ? "Programarla"
        : "Elige el día y la hora"
      : when === "draft"
        ? "Guardar el borrador"
        : "Publicar ahora";

  return (
    <form
      id="publicar"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="scroll-mt-24 space-y-8"
      aria-label={editing ? "Editar publicación" : "Nueva publicación"}
      data-composer
    >
      {post.id && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="pinnedField" value="1" />
      <input type="hidden" name="productId" value={tierId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="imageUrl" value={cover ?? ""} />
      <input type="hidden" name="body" value={body} />
      <input type="hidden" name="bodyFormat" value="MD" />
      <input type="hidden" name="when" value={when} />
      {/* Los comentarios están siempre abiertos. */}
      <input type="hidden" name="commentsOpen" value="on" />
      {blocks.flatMap((b) => (b.t === "file" ? [<input key={b.key} type="hidden" name="attachmentIds" value={b.file.id} />] : []))}
      <input
        ref={coverInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-label="Subir la foto de portada"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onCover(f);
        }}
      />
      <input
        ref={partInput}
        type="file"
        className="hidden"
        aria-label="Subir a la publicación"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPart(f);
        }}
      />

      {editing && (
        <div className="flex items-center justify-between gap-3">
          <p className="display text-[1.5rem] leading-tight">Editar «{post.title}»</p>
          <Link href={closeHref} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gold/30 px-4 text-sm font-semibold text-muted hover:text-ink">
            <X className="h-4 w-4" /> Cerrar sin guardar
          </Link>
        </div>
      )}

      {/* 1 · Para qué membresía. */}
      <section aria-labelledby="c-tier">
        <p id="c-tier" className="mb-3 text-center text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold">✦ ¿Para qué membresía? ✦</p>
        <div className="com-tiers is-picker" role="radiogroup" aria-labelledby="c-tier">
          {tiers.map((t, i) => (
            <button key={t.id} type="button" role="radio" aria-checked={tierId === t.id} onClick={() => setTierId(t.id)} className={`com-tier ${tierId === t.id ? "is-picked" : ""}`}>
              <SpinningSolid level={i} offset={i * 1.3} speed={tierId === t.id ? 0.5 : 0.15} className="h-10 w-10" />
              <span className="com-tier-name">{t.title}</span>
              <span className="com-tier-meta">Nivel {LEVELS[i] ?? i + 1}</span>
            </button>
          ))}
        </div>
        {tier && (
          <p className="mt-2 text-center text-xs text-muted" data-tier-hint>
            La verán quienes estén en {joinNames([tier.title, ...tier.inheritedBy])} · {tier.readers} {tier.readers === 1 ? "persona" : "personas"} ahora.
          </p>
        )}
      </section>

      {/* 2 · La publicación, como la ve una alumna. */}
      <section className="acc-root acc-preview space-y-5 rounded-[2rem] p-3 sm:p-6" aria-label="La publicación">
        {/* El tipo de publicación: todos a la vista, encima de la tarjeta. */}
        <div role="radiogroup" aria-label="Tipo de publicación" className="flex flex-wrap justify-center gap-2">
          {KINDS.map((k) => {
            const ks = kindStyle(k.kind);
            const on = kind === k.kind;
            return (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k.kind)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition"
                style={
                  on
                    ? { color: "#fff", borderColor: ks.light, background: `linear-gradient(135deg, ${ks.color}, ${ks.color}aa)`, boxShadow: `0 0 0 1px ${ks.light}66, 0 0 24px -6px ${ks.color}` }
                    : { color: ks.light, borderColor: `${ks.light}40`, background: "rgb(255 255 255 / .02)" }
                }
              >
                <ks.Icon className="h-4 w-4" /> {k.label ?? MEMBER_POST_KIND_LABEL[k.kind]}
              </button>
            );
          })}
        </div>
        <p className="pt-2 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold">✦ En el muro ✦</p>
        <div
          className="vip-glass vip-post relative rounded-[1.6rem] p-4 sm:p-6"
          style={{ backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${s.color}2e, transparent 55%), linear-gradient(160deg, rgb(36 31 78 / .78), rgb(18 16 44 / .86))` }}
          data-kind={kind}
        >
          <span aria-hidden className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.light}aa, transparent)` }} />
          <div className="flex gap-4 sm:gap-6">
            {sky ? (
              <div className="post-cover relative w-24 shrink-0 self-stretch overflow-hidden rounded-[1.1rem] sm:w-44" style={{ minHeight: "9rem" }}>
                <MoonCircleArt sky={sky} compact />
              </div>
            ) : (
              <button type="button" onClick={pickCover} className="post-cover group/cover relative w-24 shrink-0 self-stretch overflow-hidden rounded-[1.1rem] sm:w-44" style={{ minHeight: "9rem" }} aria-label={cover ? "Cambiar la foto" : "Poner tu foto"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shownCover.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 55%, ${s.color}55)` }} />
                {coverHover}
                {coverBusy}
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <KindBadge kind={kind} />
                  {tier && <span className="post-tier rounded-full px-2.5 py-0.5 font-semibold">{tier.title}</span>}
                </p>
                <span className="flex shrink-0 flex-col items-center rounded-2xl border border-gold/35 bg-[rgb(13_12_34_/_.55)] px-3 py-1.5 text-center leading-none">
                  <span className="font-serif text-[1.7rem] text-gold">{fmt({ day: "numeric" })}</span>
                  <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/80">{fmt({ month: "short" }).replace(".", "")}</span>
                </span>
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={TITLE_MAX} placeholder="El título" aria-label="Título" className={`display post-title mt-3 w-full px-1 text-[1.75rem] leading-[1.1] sm:text-[1.95rem] ${inline}`} />
              {eventLine && (
                <p className="kind-text mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold" style={{ background: s.soft, "--k-light": s.light, "--k-dark": s.color } as React.CSSProperties}>
                  <CalendarDays className="h-4 w-4" /> {eventLine}
                </p>
              )}
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={SUMMARY_MAX}
                rows={2}
                placeholder={autoExcerpt || "Escribe aquí la frase que se lee en el muro…"}
                aria-label="La frase de la tarjeta"
                className={`mt-3 block w-full resize-none px-1 font-serif text-[1.08rem] leading-relaxed text-ink/75 [field-sizing:content] ${inline}`}
              />
            </div>
          </div>
        </div>

        <p className="pt-4 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold">✦ Al abrirla ✦</p>
        <article>
          <div className="relative overflow-hidden rounded-[2rem]" style={{ boxShadow: `0 0 0 1px ${s.light}33, 0 40px 80px -40px ${s.color}` }}>
            {sky ? (
              <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
                <MoonCircleArt sky={sky} />
              </div>
            ) : (
              <button type="button" onClick={pickCover} className="group/cover relative block w-full" aria-label={cover ? "Cambiar la foto" : "Poner tu foto"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shownCover.src} alt="" className="block aspect-[4/3] w-full object-cover" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0d0c22]" />
                {coverHover}
                {coverBusy}
              </button>
            )}
            {cover && !sky && (
              <button type="button" onClick={() => setCover(null)} className="absolute right-3 top-3 z-[5] inline-flex min-h-9 items-center gap-1 rounded-full bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur hover:bg-black/75">
                <X className="h-3.5 w-3.5" /> Quitar la foto
              </button>
            )}
          </div>
          {sky && <p className="mt-2 text-center text-xs text-muted">El círculo de la luna lleva su luna y su signo en lugar de foto (según su fecha).</p>}
          <header className="vip-hero relative isolate mx-3 -mt-16 rounded-[2rem] px-6 py-9 text-center sm:mx-8 sm:-mt-24 sm:px-10 sm:py-12" style={{ backgroundImage: `radial-gradient(90% 80% at 50% 0%, ${s.color}40, transparent 65%), linear-gradient(180deg, rgb(30 26 66 / .85), rgb(13 12 34 / .92))` }}>
            <div className="flex justify-center"><KindBadge kind={kind} big /></div>
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.24em] text-muted">{fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <textarea value={title} onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))} maxLength={TITLE_MAX} rows={1} placeholder="El título" aria-label="Título" className={`vip-gold display mx-auto mt-3 block w-full max-w-2xl resize-none px-2 text-center text-[2.3rem] leading-[1.05] [field-sizing:content] sm:text-[3rem] ${inline}`} />
          </header>

          {liveKind && (
            <div className="mt-6 space-y-2 rounded-2xl p-3" style={{ background: s.soft }}>
              <p className="kind-text flex items-center gap-1.5 text-sm font-semibold" style={{ "--k-light": s.light, "--k-dark": s.color } as React.CSSProperties}>
                <CalendarDays className="h-4 w-4" /> Cuándo es {kind === "CEREMONIA" ? "la ceremonia" : kind === "MASTERCLASS" ? "la masterclass" : "el directo"}{" "}
                <span className="font-normal text-muted">(hora de {tzCity(timeZone)})</span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="eventDate" type="date" aria-label="Día del encuentro" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input h-11 [color-scheme:dark]" />
                <input name="eventTime" type="time" step={300} aria-label="Hora del encuentro" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="input h-11 [color-scheme:dark]" />
              </div>
              {(kind === "MASTERCLASS" || kind === "CEREMONIA") && (
                <p className="text-xs text-muted">
                  {kind === "MASTERCLASS" ? "Si es solo un vídeo, deja la fecha vacía. " : ""}Pasada la fecha, se verá como grabación: añade el vídeo cuando lo tengas.
                </p>
              )}
            </div>
          )}

          {/* El enlace (Zoom, YouTube, Spotify…): sale como el botón de la publicación. */}
          <label className="mt-6 flex min-h-11 w-full items-center gap-2 rounded-full px-4 text-sm font-semibold text-white sm:w-fit sm:min-w-[24rem]" style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}bb)`, boxShadow: `0 0 0 1px ${s.light}88, 0 10px 30px -8px ${s.color}` }}>
            <ExternalLink className="h-4 w-4 shrink-0" />
            <input name="mediaUrl" type="url" defaultValue={post.mediaUrl} aria-label="Enlace (opcional)" placeholder="Enlace (opcional): Zoom, YouTube, Spotify…" className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-white/60" />
          </label>

          {/* Las partes, en el orden que quieras. */}
          <div className="mt-8 space-y-1">
            {blocks.map((b, i) => (
              <div key={b.key}>
                {addBar(i)}
                <div className="group/block relative">
                  {b.t === "text" && (
                    <div className="vip-article">
                      {tools(i, "este texto")}
                      <RichTextEditor
                        ariaLabel="Texto"
                        defaultValue={b.md}
                        initialFormat="MD"
                        maxLength={BODY_MAX}
                        tools="full"
                        images={false}
                        tone="account"
                        headingLevel={3}
                        legacy="preline"
                        rows={4}
                        placeholder="Escribe…"
                        onChange={(v) => setAtBlock(b.key, { md: v })}
                      />
                    </div>
                  )}
                  {b.t === "photo" && (
                    <figure className="relative">
                      {tools(i, "esta foto")}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.url} alt="" className="my-4 w-full rounded-[1.6rem]" />
                      {!cover && shownCover.fromBody && shownCover.src === b.url && (
                        <figcaption className="-mt-2 text-center text-xs text-muted">Como no has puesto foto arriba, esta sale de portada (y no se repite aquí).</figcaption>
                      )}
                    </figure>
                  )}
                  {b.t === "file" && (
                    <div className={`relative ${b.file.kind === "VIDEO" ? "overflow-hidden rounded-3xl bg-black" : b.file.kind === "AUDIO" ? "py-2" : ""}`}>
                      {tools(i, b.file.name)}
                      <MediaViewBase file={b.file} title={title || "Publicación"} personal={personal} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="rounded-2xl border border-gold/30 bg-white/[.03] p-3" aria-live="polite">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold" />
                  <p className="min-w-0 flex-1 truncate text-sm text-muted">
                    Subiendo «{busy.label}» · {busy.pct} %
                  </p>
                  {abort.current && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => abort.current?.abort()}>
                      Cancelar
                    </button>
                  )}
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gradient-to-r from-[#c9a45f] to-[#f7e5b8] transition-[width]" style={{ width: `${busy.pct}%` }} />
                </div>
              </div>
            )}
            <div className="pt-3">{addBar(blocks.length, true)}</div>
            {error && (
              <p className="text-center text-sm text-rose" role="alert">
                {error}
              </p>
            )}
          </div>
          <Ornament className="mt-10" />
        </article>
      </section>

      {/* 3 · Antes de publicar. */}
      <section className="rounded-[2rem] border border-gold/30 bg-[#0b0a1c] p-5 shadow-[0_40px_80px_-40px_rgb(0_0_0/.9)] sm:p-7" aria-labelledby="c-more">
        <p id="c-more" className="text-center text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold">✦ Antes de publicar ✦</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <GoldToggle name="notify" defaultChecked={post.notify} disabled={live} icon={<Bell className="h-4 w-4" />} title="Avisar por email" hint={notifiedNote ?? (live ? "Ya está publicada: no se vuelve a avisar." : "Les llega un email cuando sale.")} />
          {live && post.notify && <input type="hidden" name="notify" value="on" />}
          <GoldToggle name="pinned" defaultChecked={post.pinned} icon={<Pin className="h-4 w-4" />} title="Fijar arriba" hint="Sale la primera del muro." />
        </div>
      </section>

      {/* 4 · Abajo del todo: cuándo sale. */}
      <section className="rounded-[2rem] border border-gold/40 bg-gradient-to-b from-[#14112e] to-[#0b0a1c] p-5 shadow-[0_0_60px_-20px_rgb(212_181_122/.35)] sm:p-7" aria-labelledby="c-when">
        <p id="c-when" className="text-center text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold">✦ ¿Cuándo sale? ✦</p>
        {live && <p className="mt-1 text-center text-xs text-muted">Ya la ven tus miembros.</p>}
        <div className={`mt-5 grid gap-3 ${live ? "sm:grid-cols-2" : "sm:grid-cols-3"}`} role="radiogroup" aria-labelledby="c-when">
          {(live
            ? ([
                ["now", "Publicada", "Se queda como está", Send],
                ["draft", "Pasar a borrador", "Deja de verse", FilePen],
              ] as const)
            : ([
                ["now", "Publicar ahora", "La ven en cuanto guardes", Send],
                ["schedule", "Programar", "Elige el día y la hora", CalendarClock],
                ["draft", "Borrador", "Solo la ves tú", FilePen],
              ] as const)
          ).map(([w, label, hint, Icon]) => {
            const on = when === w;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setWhen(w)}
                className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-[1.4rem] border px-4 py-4 text-center transition ${
                  on ? "border-[#e9cc8e] bg-[radial-gradient(90%_90%_at_50%_0%,rgb(233_204_142/.2),transparent_70%)] text-[#f7e5b8] shadow-[inset_0_0_0_4px_#0d0b22,inset_0_0_0_5px_rgb(233_204_142/.45),0_0_40px_-12px_rgb(233_204_142/.7)]" : "border-gold/20 text-[#cfc8e4] hover:border-gold/50"
                }`}
              >
                <Icon className={`h-5 w-5 ${on ? "text-[#f0d9a4]" : "text-gold/70"}`} />
                <span className={`display text-[1.3rem] leading-none ${on ? "italic" : ""}`}>{label}</span>
                <span className="text-xs text-[#a7a2c2]">{hint}</span>
              </button>
            );
          })}
        </div>

        {when === "schedule" && (
          <div className="mt-6">
            <WhenPicker name="at" value={at} onChange={setAt} minAt={minAt} moonDates={moonDates} cityLabel={tzCity(timeZone)} />
          </div>
        )}

        <div className="mt-6 space-y-3">
          <Flash error={state?.error} />
          <button
            type="submit"
            disabled={pending || uploading || (when === "schedule" && !scheduled)}
            className="portal-cta mx-auto flex min-h-14 w-full max-w-sm items-center justify-center gap-2 rounded-full px-8 text-base font-semibold disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {uploading ? "Esperando a la subida…" : submitLabel}
          </button>
          <p className="text-center text-xs text-[#a7a2c2]">{tier ? `En ${tier.title}` : ""}</p>
        </div>
      </section>
    </form>
  );
}

/** Una casilla en negro y oro: el título, su explicación y el interruptor. */
function GoldToggle({ name, defaultChecked, disabled, title, hint, icon }: { name: string; defaultChecked: boolean; disabled?: boolean; title: string; hint: string; icon: React.ReactNode }) {
  return (
    <label className={`group flex min-h-16 cursor-pointer items-center gap-3 rounded-[1.3rem] border border-gold/25 bg-white/[.02] px-4 py-3 transition hover:border-gold/50 has-[:checked]:border-gold/70 has-[:checked]:bg-gold/[.07] ${disabled ? "opacity-60" : ""}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/40 text-[#f0d9a4]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[#f1ebdf]">{title}</span>
        <span className="block text-xs text-[#a7a2c2]">{hint}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="peer sr-only" />
      <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-white/10 ring-1 ring-gold/30 transition after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-[#a7a2c2] after:transition peer-checked:bg-gradient-to-r peer-checked:from-[#c9a45f] peer-checked:to-[#f0d9a4] peer-checked:after:translate-x-5 peer-checked:after:bg-[#2a1e0c]" />
    </label>
  );
}
