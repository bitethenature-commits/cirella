import { FileText, Headphones, Image as ImageIcon, Paperclip, PlayCircle, Sparkles, Type } from "lucide-react";
import type { PartView } from "@/lib/lesson-parts";

/** Icono de cada parte de una lección (panel, reproductor y página pública). */
export const PART_ICON: Record<PartView, typeof FileText> = {
  VIDEO: PlayCircle,
  EMBED: PlayCircle,
  AUDIO: Headphones,
  PDF: FileText,
  IMAGE: ImageIcon,
  TEXT: Type,
  DOWNLOAD: Paperclip,
  BLOCK: Sparkles,
};
