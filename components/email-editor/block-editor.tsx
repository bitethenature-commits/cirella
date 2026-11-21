"use client";

import { Film, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { uploadFile } from "@/components/ui/upload-client";
import { capturePoster } from "@/components/ui/video-poster";
import { videoCoverFromImage, videoCoverFromLink } from "@/app/panel/newsletter/media-actions";
import {
  DEFAULT_HIGHLIGHT,
  EMAIL_TEXT_MAX,
  SOCIAL_NETWORK_LABEL,
  SOCIAL_NETWORKS,
  type Align,
  type Band,
  type EmailBlock,
  type EmailBlockType,
  type EmailStyle,
} from "@/lib/email-blocks";
import { RICH_IMAGE_ACCEPT } from "@/lib/file-types";
import { normalizeLinkInput } from "@/lib/rich-text-edit";
import { videoEmbed } from "@/lib/video-embed";
import { ColorField } from "./color-field";
import { FontSelect, Segmented } from "./style-panel";

/**
 * Los ajustes de un bloque del email (colores, tamaños, enlaces, fotos, vídeo…). Los usa el editor
 * escrito encima (components/email-editor/inline-email-editor.tsx): a la derecha en pantallas
 * anchas y en una ventana en el móvil. Nunca se escribe HTML: son datos (lib/email-blocks.ts).
 */
export function BlockSettings(p: { block: EmailBlock; style: EmailStyle; palette: string[]; videoUploads?: boolean; onChange: (b: EmailBlock) => void }) {
  return <BlockFields block={p.block} style={p.style} palette={p.palette} videoUploads={!!p.videoUploads} onChange={(patch) => p.onChange(clean({ ...p.block, ...patch }) as EmailBlock)} />;
}

/** Sin los campos opcionales vacíos (así «Por defecto» de un color lo quita de verdad). */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function LinkInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        id={id}
        className="input text-base sm:text-sm"
        type="text"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setError(null);
          onChange(e.target.value);
        }}
        onBlur={() => {
          if (!value.trim()) return;
          const r = normalizeLinkInput(value);
          if ("error" in r) setError(r.error);
          else onChange(r.href);
        }}
        aria-invalid={!!error}
      />
      {error && <p className="mt-1 text-xs text-rose" role="alert">{error}</p>}
    </div>
  );
}

/** «Colores y letra»: las opciones de estilo de un bloque, plegadas para no llenar la pantalla. */
function More({ children, label = "Colores y letra" }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="group rounded-xl border border-line bg-paper/60 px-3 py-1">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted [&::-webkit-details-marker]:hidden">
        <Sparkles className="h-3.5 w-3.5" /> {label}
        <span className="ml-auto transition group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

function AlignPicker({ value, onChange, three = true }: { value: Align; onChange: (v: Align) => void; three?: boolean }) {
  const options: { v: Align; label: string }[] = [
    { v: "left", label: "Izquierda" },
    { v: "center", label: "Centrado" },
    ...(three ? [{ v: "right" as const, label: "Derecha" }] : []),
  ];
  return (
    <div className="inline-flex rounded-full bg-sand p-1 text-xs" role="group" aria-label="Alineación">
      {options.map((a) => (
        <button key={a.v} type="button" onClick={() => onChange(a.v)} className={`min-h-8 rounded-full px-3 py-1.5 font-medium ${value === a.v ? "bg-white shadow-soft" : "text-muted"}`} aria-pressed={value === a.v}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

type FieldProps<T extends EmailBlockType> = {
  block: Extract<EmailBlock, { t: T }>;
  style: EmailStyle;
  palette: string[];
  onChange: (patch: Partial<EmailBlock>) => void;
};

function BlockFields(p: { block: EmailBlock; style: EmailStyle; palette: string[]; videoUploads: boolean; onChange: (patch: Partial<EmailBlock>) => void }) {
  const { block: b, style, palette, onChange } = p;
  const fid = `blk-${b.id}`;
  switch (b.t) {
    case "title":
      return (
        <div className="space-y-2">
          <input id={fid} aria-label="Título" className="input text-base" maxLength={140} value={b.text} placeholder="Hola, {nombre}" onChange={(e) => onChange({ text: e.target.value })} />
          <AlignPicker value={b.align} onChange={(align) => onChange({ align })} />
          <More>
            <Segmented
              label="Tamaño"
              value={b.size ?? "m"}
              options={[
                { v: "s", label: "S" },
                { v: "m", label: "M" },
                { v: "l", label: "L" },
                { v: "xl", label: "XL" },
              ]}
              onChange={(size) => onChange({ size })}
            />
            <ColorField label="Color del título" value={b.color} fallback={style.heading} palette={palette} against={b.bg ?? style.content} large clearable onChange={(color) => onChange({ color })} />
            <ColorField label="Fondo del título" value={b.bg} fallback={style.content} palette={palette} clearable onChange={(bg) => onChange({ bg })} />
            <FontSelect label="Tipo de letra" value={b.font} allowDefault="El de los títulos" onChange={(font) => onChange({ font })} />
          </More>
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          <RichTextEditor ariaLabel="Texto" value={b.body} initialFormat="MD" onChange={(body) => onChange({ body })} maxLength={EMAIL_TEXT_MAX} tools="basic" headings highlight preview={false} rows={4} placeholder="Escribe aquí…" />
          <More>
            <AlignPicker value={b.align ?? "left"} onChange={(align) => onChange({ align })} />
            <Segmented
              label="Tamaño de la letra"
              value={b.size ?? "m"}
              options={[
                { v: "s", label: "Pequeña" },
                { v: "m", label: "Normal" },
                { v: "l", label: "Grande" },
              ]}
              onChange={(size) => onChange({ size: size === "m" ? undefined : size })}
            />
            <ColorField label="Color de la letra" value={b.color} fallback={style.text} palette={palette} against={b.band ?? style.content} clearable onChange={(color) => onChange({ color })} />
            <FontSelect label="Tipo de letra" value={b.font} allowDefault="La del texto" onChange={(font) => onChange({ font })} />
            <ColorField label="Color del resaltado" value={b.highlight} fallback={DEFAULT_HIGHLIGHT} palette={[DEFAULT_HIGHLIGHT, "#F9D9E3", "#DDF2E3", "#E4DEFA", ...palette]} against={b.color ?? style.text} clearable onChange={(highlight) => onChange({ highlight })} />
            <p className="text-xs text-muted">Para resaltar unas palabras, selecciónalas y pulsa «Resaltar» (o escríbelas entre ==así==).</p>
            <BandFields block={b} style={style} palette={palette} onChange={onChange} />
          </More>
        </div>
      );
    case "image":
      return <ImageFields block={b} style={style} palette={palette} onChange={onChange} />;
    case "button":
      return <ButtonFields block={b} style={style} palette={palette} onChange={onChange} />;
    case "divider":
      return (
        <div className="space-y-2">
          <Segmented
            label="Estilo"
            value={b.style ?? "line"}
            options={[
              { v: "line", label: "Línea" },
              { v: "dashed", label: "Discontinua" },
              { v: "stars", label: "✦✦✦" },
            ]}
            onChange={(s) => onChange({ style: s === "line" ? undefined : s })}
          />
          <ColorField label="Color del separador" value={b.color} fallback={b.style === "stars" ? style.accent : "#E9E2D3"} palette={palette} clearable onChange={(color) => onChange({ color })} />
        </div>
      );
    case "spacer":
      return (
        <select aria-label="Tamaño del espacio" className="input h-11 text-base sm:text-sm" value={b.size} onChange={(e) => onChange({ size: e.target.value as "s" | "m" | "l" })}>
          <option value="s">Pequeño</option>
          <option value="m">Mediano</option>
          <option value="l">Grande</option>
        </select>
      );
    case "hero":
      return <HeroFields block={b} style={style} palette={palette} onChange={onChange} />;
    case "spotlight":
      return <SpotlightFields block={b} style={style} palette={palette} onChange={onChange} />;
    case "video":
      return <VideoFields block={b} style={style} palette={palette} onChange={onChange} uploads={p.videoUploads} />;
    case "columns":
      return <ColumnsFields block={b} style={style} palette={palette} onChange={onChange} />;
    case "social":
      return <SocialFields block={b} style={style} palette={palette} onChange={onChange} />;
  }
}

/** Botón grande para subir una imagen del email (JPEG/PNG para que la vean todos los buzones). */
function ImagePicker({ value, onChange, label, testId, narrow, onUploaded }: { value: string; onChange: (url: string) => void; label: string; testId: string; narrow?: boolean; onUploaded?: (url: string) => Promise<string | null> }) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative grid min-h-28 w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-white text-sm text-muted hover:border-ink/30"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={`h-auto ${narrow ? "max-w-[320px]" : "w-full"}`} />
        ) : (
          <span className="flex flex-col items-center gap-1.5 py-6">
            <ImagePlus className="h-6 w-6" /> {label}
          </span>
        )}
        {pct !== null && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/80 text-xs font-medium text-ink" aria-live="polite">
            <Loader2 className="h-5 w-5 animate-spin" /> {pct < 100 ? `${pct} %` : "Optimizando…"}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={RICH_IMAGE_ACCEPT}
        className="hidden"
        aria-label={label}
        data-testid={testId}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setError(null);
          setPct(0);
          try {
            const r = await uploadFile(f, { purpose: "image", email: true, onProgress: (n) => setPct(n) });
            if (r.url) {
              const final = onUploaded ? await onUploaded(r.url) : r.url;
              if (final) onChange(final);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
          } finally {
            setPct(null);
          }
        }}
      />
      {error && <p className="text-xs text-rose" role="alert">{error}</p>}
    </div>
  );
}

function ImageFields({ block: b, style, palette, onChange }: FieldProps<"image">) {
  const fid = `blk-${b.id}`;
  return (
    <div className="space-y-2">
      <ImagePicker value={b.url} onChange={(url) => onChange({ url })} label="Imagen" testId={`${fid}-file`} narrow={b.width === "narrow"} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${fid}-alt`}>Qué se ve (texto alternativo)</label>
          <input id={`${fid}-alt`} className="input text-base sm:text-sm" maxLength={200} value={b.alt} placeholder="Luna llena sobre el mar" onChange={(e) => onChange({ alt: e.target.value })} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fid}-href`}>Enlace al pulsarla (opcional)</label>
          <LinkInput id={`${fid}-href`} value={b.href ?? ""} onChange={(href) => onChange({ href: href || undefined })} placeholder="/mi-curso o https://…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Ancho de la imagen" className="input h-11 text-base sm:text-sm" value={b.width} onChange={(e) => onChange({ width: e.target.value as "full" | "narrow" })}>
          <option value="full">Todo el ancho</option>
          <option value="narrow">Más pequeña, centrada</option>
        </select>
        <select aria-label="Esquinas de la imagen" className="input h-11 text-base sm:text-sm" value={b.radius ?? "l"} onChange={(e) => onChange({ radius: e.target.value === "l" ? undefined : (e.target.value as "none" | "s") })}>
          <option value="l">Esquinas redondeadas</option>
          <option value="s">Un poco redondeadas</option>
          <option value="none">Esquinas rectas</option>
        </select>
      </div>
      <More label="Fondo">
        <BandFields block={b} style={style} palette={palette} onChange={onChange} />
      </More>
    </div>
  );
}

function ButtonFields({ block: b, style, palette, onChange }: FieldProps<"button">) {
  const fid = `blk-${b.id}`;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${fid}-label`}>Texto del botón</label>
          <input id={`${fid}-label`} className="input text-base sm:text-sm" maxLength={40} value={b.label} placeholder="Reservar mi lectura" onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fid}-href`}>Enlace</label>
          <LinkInput id={`${fid}-href`} value={b.href} onChange={(href) => onChange({ href })} placeholder="/mi-curso o https://…" />
        </div>
      </div>
      <AlignPicker value={b.align} onChange={(align) => onChange({ align })} />
      <More label="Forma y colores">
        <Segmented
          label="Forma"
          value={b.style ?? "pill"}
          options={[
            { v: "pill", label: "Redondo" },
            { v: "filled", label: "Recto" },
            { v: "outline", label: "Solo borde" },
          ]}
          onChange={(s) => onChange({ style: s === "pill" ? undefined : s })}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={!!b.full} onChange={(e) => onChange({ full: e.target.checked || undefined })} /> Todo el ancho
        </label>
        <ColorField label="Color del botón" value={b.bg} fallback={style.accent} palette={palette} clearable onChange={(bg) => onChange({ bg })} />
        <BandFields block={b} style={style} palette={palette} onChange={onChange} label="Fondo detrás del botón" />
        <ColorField
          label="Color de la letra del botón"
          value={b.color}
          fallback={b.style === "outline" ? (b.bg ?? style.accent) : "#FFFFFF"}
          palette={palette}
          against={b.style === "outline" ? (b.band ?? style.content) : (b.bg ?? style.accent)}
          clearable
          onChange={(color) => onChange({ color })}
        />
      </More>
    </div>
  );
}

function HeroFields({ block: b, style, palette, onChange }: FieldProps<"hero">) {
  const fid = `blk-${b.id}`;
  return (
    <div className="space-y-3">
      <ImagePicker value={b.image} onChange={(image) => onChange({ image })} label="Foto de fondo" testId={`${fid}-file`} />
      {b.image && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ image: "" })}>Quitar la foto (solo color)</button>
      )}
      <div>
        <label className="field-label" htmlFor={`${fid}-title`}>Título de la portada</label>
        <input id={`${fid}-title`} className="input text-base" maxLength={120} value={b.title} placeholder="Luna llena en Tauro" onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <label className="field-label" htmlFor={`${fid}-sub`}>Subtítulo</label>
        <input id={`${fid}-sub`} className="input text-base sm:text-sm" maxLength={240} value={b.subtitle} placeholder="Lo que trae y cómo aprovecharla" onChange={(e) => onChange({ subtitle: e.target.value })} />
      </div>
      {b.image && (
        <div>
          <label className="field-label" htmlFor={`${fid}-alt`}>Qué se ve en la foto (texto alternativo)</label>
          <input id={`${fid}-alt`} className="input text-base sm:text-sm" maxLength={200} value={b.alt} placeholder="El mar al atardecer" onChange={(e) => onChange({ alt: e.target.value })} />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${fid}-blabel`}>Botón de la portada (opcional)</label>
          <input id={`${fid}-blabel`} className="input text-base sm:text-sm" maxLength={40} value={b.buttonLabel ?? ""} placeholder="Reservar mi lectura" onChange={(e) => onChange({ buttonLabel: e.target.value || undefined })} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fid}-bhref`}>Enlace del botón de la portada</label>
          <LinkInput id={`${fid}-bhref`} value={b.buttonHref ?? ""} onChange={(v) => onChange({ buttonHref: v || undefined })} placeholder="/mi-curso o https://…" />
        </div>
      </div>
      <More label="Colores, tamaño y letra">
        <ColorField label="Color de la capa (y de reserva)" value={b.overlay} fallback={style.accent} palette={palette} onChange={(overlay) => onChange({ overlay: overlay ?? style.accent })} />
        {b.image && (
          <label className="block text-sm">
            <span className="field-label">Oscurecer la foto: {b.opacity} %</span>
            <input type="range" min={0} max={90} step={5} value={b.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="w-full" aria-label="Opacidad de la capa" />
          </label>
        )}
        <ColorField label="Color del texto de la portada" value={b.color} fallback="#FFFFFF" palette={palette} against={b.overlay} large onChange={(color) => onChange({ color: color ?? "#FFFFFF" })} />
        <Segmented
          label="Alto"
          value={b.height}
          options={[
            { v: "s", label: "Bajo" },
            { v: "m", label: "Medio" },
            { v: "l", label: "Alto" },
          ]}
          onChange={(height) => onChange({ height })}
        />
        <AlignPicker value={b.align} three={false} onChange={(align) => onChange({ align: align === "right" ? "center" : align })} />
        <FontSelect label="Tipo de letra del título" value={b.font} allowDefault="El de los títulos" onChange={(font) => onChange({ font })} />
        {b.buttonLabel && (
          <>
            <ColorField label="Color del botón de la portada" value={b.buttonBg} fallback={b.color} palette={palette} clearable onChange={(buttonBg) => onChange({ buttonBg })} />
            <ColorField label="Letra del botón de la portada" value={b.buttonColor} fallback={b.overlay} palette={palette} against={b.buttonBg ?? b.color} clearable onChange={(buttonColor) => onChange({ buttonColor })} />
          </>
        )}
        <p className="text-xs text-muted">Si un buzón no enseña la foto (Outlook a veces), sale el color de la capa: elige uno con el que se lea el texto.</p>
      </More>
    </div>
  );
}

const ICONS = ["✨", "🌕", "🌙", "☾", "★", "💜", "📅", "🎁", "🔮", "🌿"];

function SpotlightFields({ block: b, style, palette, onChange }: FieldProps<"spotlight">) {
  const fid = `blk-${b.id}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Icono">
        {ICONS.map((ic) => (
          <button key={ic} type="button" aria-pressed={b.icon === ic} onClick={() => onChange({ icon: ic })} className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${b.icon === ic ? "bg-white shadow-soft ring-1 ring-ink" : "hover:bg-sand"}`}>
            {ic}
          </button>
        ))}
        <button type="button" aria-pressed={!b.icon} onClick={() => onChange({ icon: "" })} className={`h-10 rounded-xl px-3 text-xs ${!b.icon ? "bg-white shadow-soft ring-1 ring-ink" : "text-muted hover:bg-sand"}`}>
          Sin icono
        </button>
      </div>
      <div>
        <label className="field-label" htmlFor={`${fid}-title`}>Título del destacado</label>
        <input id={`${fid}-title`} className="input text-base" maxLength={120} value={b.title} placeholder="Ritual de esta semana" onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <RichTextEditor ariaLabel="Texto del destacado" value={b.body} initialFormat="MD" onChange={(body) => onChange({ body })} maxLength={2000} tools="basic" preview={false} rows={3} placeholder="Lo que quieres que no se pierda…" />
      <Segmented
        label="Borde"
        value={b.border}
        options={[
          { v: "left", label: "Línea a la izquierda" },
          { v: "box", label: "Recuadro" },
          { v: "none", label: "Sin borde" },
        ]}
        onChange={(border) => onChange({ border })}
      />
      <More label="Colores">
        <ColorField label="Fondo del destacado" value={b.bg} fallback="#F4EFFC" palette={palette} onChange={(bg) => onChange({ bg: bg ?? "#F4EFFC" })} />
        <ColorField label="Color del borde y del título" value={b.accent} fallback="#6B58C4" palette={palette} against={b.bg} large onChange={(accent) => onChange({ accent: accent ?? "#6B58C4" })} />
        <ColorField label="Color del texto del destacado" value={b.color} fallback={style.text} palette={palette} against={b.bg} clearable onChange={(color) => onChange({ color })} />
      </More>
    </div>
  );
}

function VideoFields({ block: b, style, palette, onChange, uploads }: FieldProps<"video"> & { uploads: boolean }) {
  const fid = `blk-${b.id}`;
  const [mode, setMode] = useState<"link" | "upload">(b.src ? "upload" : "link");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const lastLink = useRef(b.url);

  const coverFromLink = async (url: string) => {
    if (!videoEmbed(url) || lastLink.current === url) return;
    lastLink.current = url;
    setBusy("Preparando la portada…");
    setError(null);
    const r = await videoCoverFromLink(url);
    setBusy(null);
    if (r.ok) onChange({ cover: r.cover });
    else setError(r.error);
  };

  const withPlay = async (url: string) => {
    setBusy("Preparando la portada…");
    const r = await videoCoverFromImage(url);
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    return r.cover;
  };

  return (
    <div className="space-y-3">
      {uploads && (
        <Segmented
          label="El vídeo"
          value={mode}
          options={[
            { v: "link", label: "Enlace de YouTube o Vimeo" },
            { v: "upload", label: "Subir vídeo" },
          ]}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
        />
      )}
      {mode === "link" ? (
        <div>
          <label className="field-label" htmlFor={`${fid}-url`}>Enlace del vídeo</label>
          <input
            id={`${fid}-url`}
            className="input text-base sm:text-sm"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={b.url}
            placeholder="https://youtu.be/…"
            onChange={(e) => {
              setError(null);
              onChange({ url: e.target.value, src: "" });
            }}
            onBlur={() => {
              if (!b.url.trim()) return;
              if (!videoEmbed(b.url)) setError("Ese enlace no es de YouTube ni de Vimeo");
              else void coverFromLink(b.url);
            }}
          />
          <p className="mt-1 text-xs text-muted">Traemos su miniatura y le ponemos el ▶. Al pulsarla se abre el vídeo.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <button type="button" className="btn btn-outline w-full" disabled={!!busy} onClick={() => videoInput.current?.click()}>
            <Film className="h-4 w-4" /> {b.src ? "Cambiar el vídeo" : "Subir vídeo (MP4 o MOV)"}
          </button>
          {b.src && <p className="text-xs text-muted">Vídeo subido ✓. En el email sale su portada; al pulsarla se abre una página de tu web que lo reproduce.</p>}
          <input
            ref={videoInput}
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
            className="hidden"
            aria-label="Vídeo"
            data-testid={`${fid}-video`}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setError(null);
              setBusy("Subiendo el vídeo… 0 %");
              try {
                // El fotograma se saca mientras sube (en el móvil, del archivo local).
                const frame = capturePoster(f);
                const r = await uploadFile(f, { purpose: "video", onProgress: (n) => setBusy(`Subiendo el vídeo… ${n} %`) });
                if (!r.video) throw new Error("No se pudo subir el vídeo");
                onChange({ src: r.video.src, url: "" });
                const blob = await frame;
                if (blob && !b.cover) {
                  setBusy("Preparando la portada…");
                  const img = await uploadFile(new File([blob], "portada.jpg", { type: "image/jpeg" }), { purpose: "image", email: true });
                  const cover = img.url ? await withPlay(img.url) : null;
                  if (cover) onChange({ src: r.video.src, url: "", cover });
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo subir el vídeo");
              } finally {
                setBusy(null);
              }
            }}
          />
        </div>
      )}
      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy}
        </p>
      )}
      {error && <p className="text-xs text-rose" role="alert">{error}</p>}
      <div>
        <p className="field-label">Portada (con el ▶)</p>
        <ImagePicker value={b.cover} onChange={(cover) => onChange({ cover })} label="Portada del vídeo" testId={`${fid}-cover`} onUploaded={withPlay} />
        <p className="mt-1 text-xs text-muted">Pulsa para subir otra portada: le ponemos el ▶ encima.</p>
      </div>
      <div>
        <label className="field-label" htmlFor={`${fid}-title`}>Texto del enlace</label>
        <input id={`${fid}-title`} className="input text-base sm:text-sm" maxLength={120} value={b.title} placeholder="Ver el vídeo" onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <label className="field-label" htmlFor={`${fid}-caption`}>Nota debajo (opcional)</label>
        <input id={`${fid}-caption`} className="input text-base sm:text-sm" maxLength={200} value={b.caption ?? ""} placeholder="Dura 2 minutos" onChange={(e) => onChange({ caption: e.target.value || undefined })} />
      </div>
      <More label="Fondo">
        <BandFields block={b} style={style} palette={palette} onChange={onChange} />
      </More>
    </div>
  );
}

function ColumnsFields({ block: b, style, palette, onChange }: FieldProps<"columns">) {
  const fid = `blk-${b.id}`;
  return (
    <div className="space-y-3">
      <ImagePicker value={b.image} onChange={(image) => onChange({ image })} label="Imagen de la columna" testId={`${fid}-file`} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${fid}-alt`}>Qué se ve en la imagen</label>
          <input id={`${fid}-alt`} className="input text-base sm:text-sm" maxLength={200} value={b.alt} onChange={(e) => onChange({ alt: e.target.value })} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fid}-href`}>Enlace de la imagen (opcional)</label>
          <LinkInput id={`${fid}-href`} value={b.href ?? ""} onChange={(href) => onChange({ href: href || undefined })} placeholder="/mi-curso o https://…" />
        </div>
      </div>
      <Segmented
        label="La imagen va"
        value={b.side}
        options={[
          { v: "left", label: "A la izquierda" },
          { v: "right", label: "A la derecha" },
        ]}
        onChange={(side) => onChange({ side })}
      />
      <div>
        <label className="field-label" htmlFor={`${fid}-title`}>Título de la columna</label>
        <input id={`${fid}-title`} className="input text-base sm:text-sm" maxLength={120} value={b.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <RichTextEditor ariaLabel="Texto de la columna" value={b.body} initialFormat="MD" onChange={(body) => onChange({ body })} maxLength={2000} tools="basic" preview={false} rows={3} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${fid}-blabel`}>Botón (opcional)</label>
          <input id={`${fid}-blabel`} className="input text-base sm:text-sm" maxLength={40} value={b.buttonLabel ?? ""} onChange={(e) => onChange({ buttonLabel: e.target.value || undefined })} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fid}-bhref`}>Enlace del botón de la columna</label>
          <LinkInput id={`${fid}-bhref`} value={b.buttonHref ?? ""} onChange={(v) => onChange({ buttonHref: v || undefined })} placeholder="/mi-curso o https://…" />
        </div>
      </div>
      <p className="text-xs text-muted">En el móvil, la imagen y el texto se ponen uno encima del otro.</p>
      <More label="Fondo">
        <BandFields block={b} style={style} palette={palette} onChange={onChange} />
      </More>
    </div>
  );
}

function SocialFields({ block: b, style, palette, onChange }: FieldProps<"social">) {
  const fid = `blk-${b.id}`;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {SOCIAL_NETWORKS.map((n) => (
          <div key={n}>
            <label className="field-label" htmlFor={`${fid}-${n}`}>{SOCIAL_NETWORK_LABEL[n]}</label>
            <input
              id={`${fid}-${n}`}
              className="input text-base sm:text-sm"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={300}
              value={b.links[n] ?? ""}
              placeholder={n === "email" ? "hola@tuweb.com" : n === "web" ? "tuweb.com" : "@tuusuario o enlace"}
              onChange={(e) => onChange({ links: { ...b.links, [n]: e.target.value || undefined } })}
            />
          </div>
        ))}
      </div>
      <AlignPicker value={b.align} onChange={(align) => onChange({ align })} />
      <ColorField label="Color de los enlaces" value={b.color} fallback={style.accent} palette={palette} against={b.band ?? style.content} clearable onChange={(color) => onChange({ color })} />
      <More label="Fondo">
        <BandFields block={b} style={style} palette={palette} onChange={onChange} />
      </More>
    </div>
  );
}

/**
 * «Fondo» de un bloque (franja de color de todo el ancho, con margen interior y esquinas). Mientras no
 * se elige color, el margen y las esquinas no salen.
 */
function BandFields({ block: b, style, palette, onChange, label = "Fondo del bloque" }: { block: Extract<EmailBlock, Band>; style: EmailStyle; palette: string[]; onChange: (patch: Partial<EmailBlock>) => void; label?: string }) {
  return (
    <div className="space-y-2" data-testid="band-fields">
      <ColorField label={label} value={b.band} fallback={style.content} palette={palette} clearable onChange={(band) => onChange(band ? { band } : { band: undefined, bandPad: undefined, bandRound: undefined })} />
      {b.band && (
        <>
          <Segmented
            label="Margen del fondo"
            value={b.bandPad ?? "m"}
            options={[
              { v: "s", label: "S" },
              { v: "m", label: "M" },
              { v: "l", label: "L" },
            ]}
            onChange={(bandPad) => onChange({ bandPad: bandPad === "m" ? undefined : bandPad })}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={!!b.bandRound} onChange={(e) => onChange({ bandRound: e.target.checked || undefined })} /> Esquinas redondeadas
          </label>
        </>
      )}
    </div>
  );
}
