import { Download, FileImage } from "lucide-react";
import { ZoomableImage } from "./zoomable-image";
import type { PlayerFile } from "./video-player";

/** Por encima de esto no se enseña en la página (un PNG enorme de Canva tumba Safari): solo descarga. */
const MAX_PREVIEW_BYTES = 40 * 1024 * 1024;

/**
 * Imagen privada (ficha de trabajo, lámina): se ve desde /api/stream/<id> (misma web, acceso
 * comprobado en cada petición) y se amplía al tocarla. «Descargar para imprimir» debajo.
 */
export function ImageViewer({ file }: { file: PlayerFile }) {
  const download = (
    <a href={`/api/download/${file.id}`} className="btn btn-outline btn-sm">
      <Download className="h-4 w-4" /> Descargar para imprimir
    </a>
  );
  if (file.sizeBytes && file.sizeBytes > MAX_PREVIEW_BYTES)
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center" data-image-viewer>
        <FileImage className="h-6 w-6 text-lavender-deep" />
        <p className="text-sm text-muted">Esta imagen es muy grande para verla aquí. Descárgala para verla o imprimirla.</p>
        {download}
      </div>
    );
  return (
    <div className="space-y-3" data-image-viewer>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <ZoomableImage src={`/api/stream/${file.id}`} alt={file.name} />
      </div>
      <div className="flex justify-center">{download}</div>
    </div>
  );
}
