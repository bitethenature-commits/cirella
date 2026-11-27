import { isPersonalMode } from "@/lib/site-mode";
import { MediaViewBase, type MediaFile } from "./media-view-base";

export type { MediaFile };

/**
 * Único punto de entrada para enseñar un archivo privado en una página de servidor (cursos,
 * productos digitales, comunidad, página): decide el modo del sitio y pinta MediaViewBase
 * (media-view-base.tsx: elige el visor y cómo se entrega cada archivo).
 */
export function MediaView(props: { file: MediaFile; title: string; poster?: string | null; artwork?: string | null }) {
  return <MediaViewBase {...props} personal={isPersonalMode()} />;
}
