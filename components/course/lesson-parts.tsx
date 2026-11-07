import { Download, ExternalLink, Link2 } from "lucide-react";
import { MediaViewBase, type MediaFile } from "@/components/media/media-view-base";
import { VideoEmbed } from "@/components/media/video-embed";
import { RichContent } from "@/components/rich-text/rich-content";
import type { PartView } from "@/lib/lesson-parts";
import { videoEmbed } from "@/lib/video-embed";

export type PlayerPart = {
  id: string;
  view: PartView;
  body: string | null;
  bodyFormat: string | null;
  url: string | null;
  file: MediaFile | null;
  /** Tipo guardado (TEXT, FILE, EMBED o una parte de lección larga: lib/lesson-blocks.ts) y su contenido. */
  kind?: string;
  data?: unknown;
};

/** Fila «Descargar» bajo un audio o un PDF (para escucharlo sin conexión o imprimirlo). */
function DownloadRow({ fileId, name, label }: { fileId: string; name: string; label: string }) {
  return (
    <a href={`/api/download/${fileId}`} className="flex min-h-11 items-center gap-3 rounded-2xl border border-line px-4 py-2.5 text-sm transition hover:bg-sand">
      <Download className="h-4 w-4 shrink-0 text-lavender-deep" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 text-xs font-semibold text-muted">{label}</span>
    </a>
  );
}

/** Vídeo de arriba (a todo lo ancho en el iPhone): propio o de YouTube/Vimeo. */
export function LeadPart({ part, lessonTitle, poster, personal }: { part: PlayerPart; lessonTitle: string; poster: string | null; personal: boolean }) {
  if (part.view === "EMBED" && part.url) {
    if (videoEmbed(part.url)) return <VideoEmbed url={part.url} title={lessonTitle} />;
    return <OpenVideo url={part.url} />;
  }
  if (part.file) return <MediaViewBase file={part.file} title={lessonTitle} poster={poster} personal={personal} />;
  return null;
}

function OpenVideo({ url }: { url: string }) {
  if (!/^https?:\/\//i.test(url)) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
      <ExternalLink className="h-4 w-4" /> Abrir el vídeo
    </a>
  );
}

/**
 * Las partes de una lección en el orden que eligió la dueña. Cada archivo pasa por MediaViewBase
 * (/api/stream y /api/download comprueban el acceso en cada petición); el texto, por RichContent
 * (sin HTML). Nada de dangerouslySetInnerHTML. Puro (sin servidor): lo pinta el reproductor de
 * /cuenta/cursos y la vista previa del editor de lecciones del panel. `personal`: modo del sitio.
 */
export function LessonParts({ parts, lessonTitle, courseTitle, poster, personal }: { parts: PlayerPart[]; lessonTitle: string; courseTitle: string; poster: string | null; personal: boolean }) {
  return (
    <div className="space-y-6">
      {parts.map((p) => {
        const f = p.file;
        switch (p.view) {
          case "TEXT":
            return p.body ? (
              <RichContent
                key={p.id}
                text={p.body}
                format={p.bodyFormat}
                legacy="paragraphs"
                tone="account"
                headingLevel={3}
                className="space-y-4 text-[1.02rem] leading-relaxed text-ink/85"
              />
            ) : null;
          case "EMBED":
            return p.url ? (
              <div key={p.id} className={videoEmbed(p.url) ? "overflow-hidden rounded-3xl bg-black" : ""}>
                {videoEmbed(p.url) ? <VideoEmbed url={p.url} title={lessonTitle} /> : <OpenVideo url={p.url} />}
              </div>
            ) : null;
          case "VIDEO":
            return f ? (
              <div key={p.id} className="overflow-hidden rounded-3xl bg-black">
                <MediaViewBase personal={personal} file={f} title={lessonTitle} poster={poster} />
              </div>
            ) : null;
          case "AUDIO":
            return f ? (
              <div key={p.id} className="space-y-2">
                <div className="overflow-hidden rounded-3xl bg-ink px-4 py-5 text-cream">
                  <MediaViewBase personal={personal} file={f} title={`${lessonTitle} · ${courseTitle}`} artwork={poster} />
                </div>
                <DownloadRow fileId={f.id} name={f.name} label="Descargar audio" />
              </div>
            ) : null;
          case "PDF":
            return f ? (
              <div key={p.id} className="space-y-2">
                <MediaViewBase personal={personal} file={f} title={lessonTitle} />
                <DownloadRow fileId={f.id} name={f.name} label="Descargar PDF" />
              </div>
            ) : null;
          case "IMAGE":
            return f ? <MediaViewBase personal={personal} key={p.id} file={{ ...f, name: f.name.replace(/\.[a-z0-9]+$/i, "") || f.name }} title={lessonTitle} /> : null;
          case "DOWNLOAD":
            if (!f) return null;
            if (f.kind === "LINK")
              return (
                <a key={p.id} href={`/api/download/${f.id}`} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
                  <Link2 className="h-5 w-5 text-lavender-deep" />
                  <span className="flex-1 text-sm font-medium">{f.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir enlace
                  </span>
                </a>
              );
            return <MediaViewBase personal={personal} key={p.id} file={f} title={lessonTitle} />;
        }
      })}
    </div>
  );
}
