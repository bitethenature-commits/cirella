import { Download, FileText } from "lucide-react";
import { deliveryFor } from "@/lib/file-types";
import { AudioPlayer } from "./audio-player";
import { ImageViewer } from "./image-viewer";
import { PdfViewer } from "./pdf-viewer";
import { VideoPlayer, type PlayerFile } from "./video-player";
import { Tr } from "@/lib/i18n/client";

export type MediaFile = PlayerFile & { kind: string };

/**
 * Visor de un archivo privado sin leer la configuración del servidor: `personal` dice si es la web
 * personal (cómo se entrega el audio). Sirve también en el navegador (vista previa de una lección en
 * el estudio de cursos). En las páginas de servidor se usa MediaView (media-view.tsx).
 *
 * Único punto de entrada para enseñar un archivo privado (cursos, productos digitales, comunidad,
 * página): elige el visor y cómo se entrega (lib/file-types.ts → deliveryFor):
 *   VIDEO → VideoPlayer (URL firmada) · AUDIO → AudioPlayer (/api/stream en la web personal, firmada
 *   en la plataforma) · PDF → PdfViewer · IMAGE → ImageViewer · el resto → tarjeta de descarga.
 */
export function MediaViewBase({ file, title, poster, artwork, personal }: { file: MediaFile; title: string; poster?: string | null; artwork?: string | null; personal: boolean }) {
  const delivery = deliveryFor(file.kind, personal);
  if (file.kind === "VIDEO") return <VideoPlayer file={file} poster={poster} title={title} />;
  if (file.kind === "AUDIO")
    return delivery === "stream" ? (
      <AudioPlayer file={file} src={`/api/stream/${file.id}`} delivery="stream" title={title} artwork={artwork} />
    ) : (
      <AudioPlayer file={file} src={`/api/download/${file.id}?inline=1`} delivery="signed" title={title} artwork={artwork} />
    );
  if (file.kind === "PDF") return <PdfViewer fileId={file.id} name={file.name} />;
  if (file.kind === "IMAGE") return <ImageViewer file={file} />;
  return (
    <a href={`/api/download/${file.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
      <FileText className="h-5 w-5 text-lavender-deep" />
      <span className="flex-1 text-sm font-medium">{file.name}</span>
      <span className="flex items-center gap-1 text-xs text-muted">
        <Download className="h-3.5 w-3.5" />{" "}<Tr s={"Descargar"} /></span>
    </a>
  );
}
