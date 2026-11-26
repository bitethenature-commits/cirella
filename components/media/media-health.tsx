import { videoWeight } from "@/lib/file-types";
import { useT, Tr } from "@/lib/i18n/client";

/**
 * Datos y avisos de un vídeo o audio subido (Materiales del curso y editor de lecciones): duración,
 * «Vertical», «HEVC» (formato del iPhone) y «Muy pesado para el móvil», cada aviso con cómo
 * arreglarlo en palabras de la dueña. Sirve en servidor y en cliente (sin estado).
 */
export type HealthFile = {
  kind: string;
  sizeBytes?: number | null;
  durationSec?: number | null;
  videoCodec?: string | null;
  width?: number | null;
  height?: number | null;
};

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

/** «23 min» (o «45 s» si no llega al minuto). */
export function formatDuration(sec: number) {
  return sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`;
}

/** Aviso que se despliega con su explicación (sin tecnicismos salvo la palabra HEVC). */
function Chip({ label, tone = "neutral", help }: { label: string; tone?: "neutral" | "warn"; help?: string }) {
  const cls = tone === "warn" ? "border-[#ecdcb8] bg-[#fbf5e8] text-[#7a5a1c]" : "border-line bg-sand/60 text-muted";
  if (!help) return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${cls}`}><Tr s={label} /></span>;
  return (
    <details className="group">
      <summary className={`inline-flex cursor-pointer list-none rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${cls}`}><Tr s={label} /></summary>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted"><Tr s={help} /></p>
    </details>
  );
}

export const HEVC_HELP =
  "Se ve en iPhone, iPad y Mac; puede no verse en algunos navegadores. Para que se vea en todas partes: expórtalo con InShot (MP4) o activa Ajustes › Cámara › Formatos › Más compatible.";
export const HEAVY_HELP = "Expórtalo en 1080p (o 720p) con InShot: tus alumnas lo verán sin cortes con datos.";

/** Chips de un vídeo o audio; nada para el resto. */
export function MediaHealth({ file, duration = true }: { file: HealthFile; duration?: boolean }) {
  const t = useT();
  if (file.kind !== "VIDEO" && file.kind !== "AUDIO") return null;
  const chips = [];
  if (duration && file.durationSec) chips.push(<Chip key="d" label={formatDuration(file.durationSec)} />);
  if (file.kind === "VIDEO" && file.width && file.height && file.height > file.width) chips.push(<Chip key="v" label={t("Vertical")} />);
  if (file.videoCodec === "HEVC") chips.push(<Chip key="h" label={t("HEVC")} tone="warn" help={HEVC_HELP} />);
  if (file.kind === "VIDEO" && videoWeight(file.sizeBytes, file.durationSec) === "heavy")
    chips.push(<Chip key="p" label={t("Muy pesado para el móvil")} tone="warn" help={HEAVY_HELP} />);
  return chips.length ? <div className="flex flex-wrap items-start gap-1.5 pt-1">{chips}</div> : null;
}
