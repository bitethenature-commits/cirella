import Link from "next/link";
import { BookOpen, Download, ExternalLink, Eye, FileText, Headphones, Image as ImageIcon, Video } from "lucide-react";
import type { ReactNode } from "react";
import { MediaView } from "@/components/media/media-view";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

/**
 * Las partes de una lectura (o de cualquier compra con archivos) como tarjetas de la web: primero lo que se
 * escucha o se ve (la introducción en audio, un vídeo), con su reproductor dentro; después las guías y los
 * documentos, con «Ver» y «Descargar». `back` se pasa al visor para que su «Volver» regrese aquí.
 */
type FileLike = {
  id: string;
  name: string;
  kind: string;
  url?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSec?: number | null;
  videoCodec?: string | null;
  width?: number | null;
  height?: number | null;
};

const VIEWABLE = new Set(["PDF", "IMAGE"]);
const nice = (name: string) => name.replace(/\.[a-z0-9]{2,4}$/i, "");
const size = (b?: number | null) => (!b ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const mins = (s?: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");

const META: Record<string, { icon: ReactNode; eyebrow: string; hint: string }> = {
  AUDIO: { icon: <Headphones className="h-5 w-5" />, eyebrow: "Escúchala", hint: "Ponte cómoda, con calma: es la voz que acompaña tu lectura." },
  VIDEO: { icon: <Video className="h-5 w-5" />, eyebrow: "Mírala", hint: "Tu lectura en vídeo." },
  PDF: { icon: <BookOpen className="h-5 w-5" />, eyebrow: "Léela", hint: "La guía escrita, para volver a ella cuando quieras." },
  IMAGE: { icon: <ImageIcon className="h-5 w-5" />, eyebrow: "Tu imagen", hint: "Para guardarla y mirarla." },
  LINK: { icon: <ExternalLink className="h-5 w-5" />, eyebrow: "Enlace", hint: "Se abre en otra pestaña." },
};

export async function ReadingFiles({ files, title, artwork, back, linkHref }: { files: FileLike[]; title: string; artwork?: string | null; back: string; linkHref?: (f: FileLike) => string }) {
  const t = await getT();
  const media = files.filter((f) => f.kind === "AUDIO" || f.kind === "VIDEO");
  const rest = files.filter((f) => f.kind !== "AUDIO" && f.kind !== "VIDEO");
  let step = 0;
  return (
    <div className="space-y-4" data-reading-files>
      {media.map((f) => {
        step++;
        const m = META[f.kind];
        return (
          <article key={f.id} className="overflow-hidden rounded-[1.5rem] ring-1 ring-gold/30" style={{ background: "radial-gradient(circle at 20% 0%, #2a2552 0%, #17153a 55%, #100e26 100%)" }}>
            <div className="flex items-start gap-3.5 px-5 pt-5 sm:px-6">
              <Step n={step} />
              <div className="min-w-0 flex-1">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold">
                  <Tr s={m.eyebrow} />
                  {mins(f.durationSec) && ` · ${mins(f.durationSec)}`}
                </p>
                <h3 className="display mt-0.5 text-[1.5rem] leading-tight text-[#f6f1e7]">{nice(f.name)}</h3>
                <p className="mt-1 text-sm text-[rgb(246_241_231/.65)]"><Tr s={m.hint} /></p>
              </div>
            </div>
            <div className="py-4">
              <MediaView file={f as never} title={`${f.name} · ${title}`} artwork={artwork} poster={artwork} />
            </div>
            <div className="flex justify-end border-t border-[rgb(255_255_255/.08)] px-5 py-3 sm:px-6">
              <a href={`/api/download/${f.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(246_241_231/.75)] hover:text-gold">
                <Download className="h-3.5 w-3.5" />{" "}<Tr s={"Descargar"} />{" "}{size(f.sizeBytes) && `· ${size(f.sizeBytes)}`}
              </a>
            </div>
          </article>
        );
      })}
      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((f) => {
            step++;
            const m = META[f.kind] ?? { icon: <FileText className="h-5 w-5" />, eyebrow: "Archivo", hint: "" };
            const link = f.kind === "LINK";
            return (
              <article key={f.id} className="card group flex flex-col p-5 ring-1 ring-gold/20 transition hover:ring-gold/50">
                <div className="flex items-start gap-3.5">
                  <Step n={step} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold"><Tr s={m.eyebrow} /></p>
                    <h3 className="display mt-0.5 text-[1.35rem] leading-tight [overflow-wrap:anywhere]">{nice(f.name)}</h3>
                    {m.hint && <p className="mt-1 text-sm text-muted"><Tr s={m.hint} /></p>}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 pt-1">
                  {link ? (
                    <a href={linkHref ? linkHref(f) : (f.url ?? "#")} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                      <ExternalLink className="h-3.5 w-3.5" />{" "}<Tr s={"Abrir"} /></a>
                  ) : (
                    <>
                      {VIEWABLE.has(f.kind) && (
                        <Link href={`/area/files/${f.id}?volver=${encodeURIComponent(back)}`} className="btn btn-primary btn-sm">
                          <Eye className="h-3.5 w-3.5" /> {f.kind === "PDF" ? t("Abrir la guía") : t("Ver")}
                        </Link>
                      )}
                      <a href={`/api/download/${f.id}`} className="btn btn-ghost btn-sm">
                        <Download className="h-3.5 w-3.5" />{" "}<Tr s={"Descargar"} /></a>
                      {size(f.sizeBytes) && <span className="ml-auto text-xs text-muted">{size(f.sizeBytes)}</span>}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** El número de cada parte, en un círculo dorado. */
function Step({ n }: { n: number }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 font-[Georgia,serif] text-[1.05rem] text-gold ring-1 ring-gold/40">{n}</span>;
}
