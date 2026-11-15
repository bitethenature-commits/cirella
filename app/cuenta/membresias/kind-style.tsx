import { CloudSun, ExternalLink, Feather, Flame, Flower2, GraduationCap, Headphones, Mic, Moon, Radio, Video, type LucideIcon } from "lucide-react";
import { isLivePostKind, isRecordedPost } from "@/lib/community-rules";
import { videoEmbed } from "@/lib/video-embed";

/**
 * Cada tipo de publicación de la comunidad, bien distinto a simple vista: su color, su icono y su nombre
 * (en singular para la etiqueta y en plural para los filtros del feed). Y el botón para entrar al Zoom
 * (o abrir el enlace) que se ve sin abrir la publicación. La ceremonia y la masterclass, pasada su fecha,
 * se marcan como grabación.
 */
export const KIND_STYLE: Record<string, { label: string; plural: string; color: string; light: string; soft: string; Icon: LucideIcon }> = {
  TEXT: { label: "Post", plural: "Posts", color: "#7C6FB0", light: "#C9BEF2", soft: "#7C6FB033", Icon: Feather },
  PODCAST: { label: "Podcast", plural: "Podcast", color: "#B0712E", light: "#F0BE7E", soft: "#B0712E33", Icon: Mic },
  MEDITACION: { label: "Meditación", plural: "Meditaciones", color: "#2F8A78", light: "#86DCC6", soft: "#2F8A7833", Icon: Flower2 },
  ASTROWEATHER: { label: "Astroweather", plural: "Astroweather", color: "#2E7FA6", light: "#8FD0F0", soft: "#2E7FA633", Icon: CloudSun },
  MASTERCLASS: { label: "Masterclass", plural: "Masterclases", color: "#C9492F", light: "#F59A83", soft: "#C9492F33", Icon: GraduationCap },
  CEREMONIA: { label: "Ceremonia", plural: "Ceremonias", color: "#9C3D6E", light: "#EE9CC6", soft: "#9C3D6E33", Icon: Flame },
  VIDEO: { label: "Vídeo", plural: "Vídeos", color: "#55607A", light: "#BCC5DA", soft: "#55607A33", Icon: Video },
  CIRCULO_LUNAR: { label: "Círculo de la luna", plural: "Círculos", color: "#2F3A6B", light: "#B7C1F5", soft: "#2F3A6B33", Icon: Moon },
  // Tipos antiguos (ya no se publican): se ven como los de ahora.
  AUDIO: { label: "Audio", plural: "Audios", color: "#B0712E", light: "#F0BE7E", soft: "#B0712E33", Icon: Headphones },
  EVENT: { label: "Sesión en directo", plural: "Sesiones en directo", color: "#C9492F", light: "#F59A83", soft: "#C9492F33", Icon: Radio },
};
export const kindStyle = (k: string) => KIND_STYLE[k] ?? KIND_STYLE.TEXT;

/** La etiqueta del tipo: icono en su círculo de color y el nombre (y «Grabada» si ya pasó el directo). */
export function KindBadge({ kind, big = false, post }: { kind: string; big?: boolean; post?: { kind: string; eventAt?: Date | null } }) {
  const s = kindStyle(kind);
  const recorded = post ? isRecordedPost(post) : false;
  return (
    <span className="kind-text inline-flex items-center gap-2 font-semibold" style={{ "--k-light": s.light, "--k-dark": s.color } as React.CSSProperties} data-kind-badge={kind}>
      <span className={`grid shrink-0 place-items-center rounded-full ${big ? "h-11 w-11" : "h-8 w-8"}`} style={{ background: `radial-gradient(circle at 35% 30%, ${s.color}66, ${s.color}22)`, boxShadow: `inset 0 0 0 1px ${s.light}55, 0 0 18px ${s.color}55` }}>
        <s.Icon className={big ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <span className={`uppercase tracking-[0.12em] ${big ? "text-[0.78rem]" : "text-[0.68rem]"}`}>{s.label}</span>
      {recorded && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-normal text-white ${big ? "text-xs" : "text-[0.66rem]"}`} style={{ background: s.color }} data-recorded>
          <Video className="h-3 w-3" /> Grabada
        </span>
      )}
    </span>
  );
}

/** ¿Tiene un enlace para entrar (Zoom, el podcast…) que conviene ver sin abrir la publicación? */
export function joinLink(p: { kind: string; mediaUrl?: string | null; eventAt?: Date | null }, now = new Date()) {
  if (!p.mediaUrl || !/^https:\/\//i.test(p.mediaUrl) || videoEmbed(p.mediaUrl)) return null;
  if (!isLivePostKind(p.kind) && p.kind !== "PODCAST") return null;
  // Un encuentro ya pasado (más de 4 horas) no enseña el botón de entrar: ya es una grabación.
  if (isRecordedPost(p, now) || (p.eventAt && p.eventAt.getTime() < now.getTime() - 4 * 3_600_000)) return null;
  const label = p.kind === "CEREMONIA" ? "Entrar a la ceremonia" : p.kind === "CIRCULO_LUNAR" ? "Entrar al círculo" : p.kind === "PODCAST" ? "Escuchar el podcast" : p.kind === "MASTERCLASS" ? "Entrar a la masterclass" : "Entrar a la sesión";
  return { href: p.mediaUrl, label };
}

export function JoinButton({ post, className = "" }: { post: { kind: string; mediaUrl?: string | null; eventAt?: Date | null }; className?: string }) {
  const j = joinLink(post);
  if (!j) return null;
  const s = kindStyle(post.kind);
  return (
    <a href={j.href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition hover:brightness-110 ${className}`} style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}bb)`, boxShadow: `0 0 0 1px ${s.light}88, 0 10px 30px -8px ${s.color}` }} data-join>
      <ExternalLink className="h-4 w-4" /> {j.label}
    </a>
  );
}
