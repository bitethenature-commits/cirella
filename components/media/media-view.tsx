import { Download, FileText } from "lucide-react";
import { deliveryFor } from "@/lib/file-types";
import { isPersonalMode } from "@/lib/site-mode";
import { AudioPlayer } from "./audio-player";
import { VideoPlayer, type PlayerFile } from "./video-player";

export type MediaFile = PlayerFile & { kind: string };

/**
 * Único punto de entrada para enseñar un archivo privado (cursos, productos digitales, comunidad,
 * página): elige el visor y cómo se entrega (lib/file-types.ts → deliveryFor):
 *   VIDEO → VideoPlayer (URL firmada) · AUDIO → AudioPlayer (/api/stream en la web personal, firmada
 *   en la plataforma) · PDF → PdfViewer · IMAGE → ImageViewer · el resto → tarjeta de descarga.
 * Componente de servidor (decide el modo); los visores son de cliente.
 */
export function MediaView({ file, title, poster, artwork }: { file: MediaFile; title: string; poster?: string | null; artwork?: string | null }) {
  const delivery = deliveryFor(file.kind, isPersonalMode());
  if (file.kind === "VIDEO") return <VideoPlayer file={file} poster={poster} title={title} />;
  if (file.kind === "AUDIO")
    return delivery === "stream" ? (
      <AudioPlayer file={file} src={`/api/stream/${file.id}`} delivery="stream" title={title} artwork={artwork} />
    ) : (
      <AudioPlayer file={file} src={`/api/download/${file.id}?inline=1`} delivery="signed" title={title} artwork={artwork} />
    );
  return (
    <a href={`/api/download/${file.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
      <FileText className="h-5 w-5 text-lavender-deep" />
      <span className="flex-1 text-sm font-medium">{file.name}</span>
      <span className="flex items-center gap-1 text-xs text-muted">
        <Download className="h-3.5 w-3.5" /> Descargar
      </span>
    </a>
  );
}
