import { CloudSun, ExternalLink, Feather, Flame, Flower2, GraduationCap, Headphones, Mic, Moon, Radio, Video, type LucideIcon } from "lucide-react";
import { isLivePostKind, isRecordedPost } from "@/lib/community-rules";
import { videoEmbed } from "@/lib/video-embed";
import { Tr } from "@/lib/i18n/client";

/**
 * Cada tipo de publicación de la comunidad, bien distinto a simple vista: su color, su icono y su nombre
 * (en singular para la etiqueta y en plural para los filtros del feed). Y el botón para entrar al Zoom
 * (o abrir el enlace) que se ve sin abrir la publicación. La ceremonia y la masterclass, pasada su fecha,
 * se marcan como grabación.
 */
type KindLook = { label: string; plural: string; /** Su color de siempre (#RRGGBB). */ hex: string; lightHex: string; color: string; light: string; soft: string; Icon: LucideIcon };

/**
 * Los colores van con variables (--kind-TEXT, --kind-TEXT-l…) y su color de siempre detrás: la creadora puede
 * cambiarlos para todo lo de dentro en Mi página (lib/area-pieces.ts, areaDesignCss).
 */
const kind = (v: string, label: string, plural: string, hex: string, lightHex: string, Icon: LucideIcon): KindLook => ({
  label,
  plural,
  hex,
  lightHex,
  color: `var(--kind-${v}, ${hex})`,
  light: `var(--kind-${v}-l, ${lightHex})`,
  soft: `color-mix(in oklab, var(--kind-${v}, ${hex}) 20%, transparent)`,
  Icon,
});

export const KIND_STYLE: Record<string, KindLook> = {
  TEXT: kind("TEXT", "Post", "Posts", "#7C6FB0", "#C9BEF2", Feather),
  PODCAST: kind("PODCAST", "Podcast", "Podcast", "#B0712E", "#F0BE7E", Mic),
  MEDITACION: kind("MEDITACION", "Meditación", "Meditaciones", "#2F8A78", "#86DCC6", Flower2),
  ASTROWEATHER: kind("ASTROWEATHER", "Astroweather", "Astroweather", "#2E7FA6", "#8FD0F0", CloudSun),
  MASTERCLASS: kind("MASTERCLASS", "Masterclass", "Masterclases", "#C9492F", "#F59A83", GraduationCap),
  CEREMONIA: kind("CEREMONIA", "Ceremonia", "Ceremonias", "#9C3D6E", "#EE9CC6", Flame),
  VIDEO: kind("VIDEO", "Vídeo", "Vídeos", "#55607A", "#BCC5DA", Video),
  CIRCULO_LUNAR: kind("CIRCULO_LUNAR", "Círculo de la luna", "Círculos", "#2F3A6B", "#B7C1F5", Moon),
  // Tipos antiguos (ya no se publican): se ven como los de ahora.
  AUDIO: kind("AUDIO", "Audio", "Audios", "#B0712E", "#F0BE7E", Headphones),
  EVENT: kind("EVENT", "Sesión en directo", "Sesiones en directo", "#C9492F", "#F59A83", Radio),
};
export const kindStyle = (k: string) => KIND_STYLE[k] ?? KIND_STYLE.TEXT;

/** El tipo cuyo color lleva (los antiguos van con el de ahora): lo que se toca en el Canva para cambiarlo. */
export const kindBase = (k: string) => (k === "AUDIO" ? "PODCAST" : k === "EVENT" ? "MASTERCLASS" : KIND_STYLE[k] ? k : "TEXT");

/** Los colores para elegir el de un tipo: los de siempre de cada uno y algunos más. */
export const KIND_PALETTE: { hex: string; name: string }[] = [
  ...["TEXT", "PODCAST", "MEDITACION", "ASTROWEATHER", "MASTERCLASS", "CEREMONIA", "VIDEO", "CIRCULO_LUNAR"].map((k) => ({ hex: KIND_STYLE[k].hex, name: KIND_STYLE[k].label })),
  { hex: "#C8A86E", name: "Oro" },
  { hex: "#E2A99B", name: "Oro rosa" },
  { hex: "#6FCFCB", name: "Turquesa" },
  { hex: "#8E4A7E", name: "Ciruela" },
  { hex: "#4A6FD1", name: "Azul" },
  { hex: "#9CC3A0", name: "Salvia" },
];

/** Un color con transparencia (hh: como el final de un #RRGGBBAA): vale también con variables. */
export const ka = (c: string, hh: string) => `color-mix(in oklab, ${c} ${Math.round((parseInt(hh, 16) / 255) * 100)}%, transparent)`;

/** La etiqueta del tipo: icono en su círculo de color y el nombre (y «Grabada» si ya pasó el directo). */
export function KindBadge({ kind, big = false, post }: { kind: string; big?: boolean; post?: { kind: string; eventAt?: Date | null } }) {
  const s = kindStyle(kind);
  const recorded = post ? isRecordedPost(post) : false;
  return (
    <span className="kind-text inline-flex items-center gap-2 font-semibold" style={{ "--k-light": s.light, "--k-dark": s.color } as React.CSSProperties} data-kind-badge={kind} data-area-kind={kindBase(kind)}>
      <span className={`grid shrink-0 place-items-center rounded-full ${big ? "h-11 w-11" : "h-8 w-8"}`} style={{ background: `radial-gradient(circle at 35% 30%, ${ka(s.color, "66")}, ${ka(s.color, "22")})`, boxShadow: `inset 0 0 0 1px ${ka(s.light, "55")}, 0 0 18px ${ka(s.color, "55")}` }}>
        <s.Icon className={big ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <span className={`uppercase tracking-[0.12em] ${big ? "text-[0.78rem]" : "text-[0.68rem]"}`}><Tr s={s.label} /></span>
      {recorded && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-normal text-white ${big ? "text-xs" : "text-[0.66rem]"}`} style={{ background: s.color }} data-recorded>
          <Video className="h-3 w-3" />{" "}<Tr s={"Grabada"} /></span>
      )}
    </span>
  );
}

/** ¿Tiene un enlace para entrar (Zoom, el podcast…) que conviene ver sin abrir la publicación? */
export function joinLink(p: { kind: string; mediaUrl?: string | null; eventAt?: Date | null; joinLabel?: string | null }, now = new Date()) {
  if (!p.mediaUrl || !/^https:\/\//i.test(p.mediaUrl) || videoEmbed(p.mediaUrl)) return null;
  if (!isLivePostKind(p.kind) && p.kind !== "PODCAST") return null;
  // Un encuentro ya pasado (más de 4 horas) no enseña el botón de entrar: ya es una grabación.
  if (isRecordedPost(p, now) || (p.eventAt && p.eventAt.getTime() < now.getTime() - 4 * 3_600_000)) return null;
  const label = p.kind === "CEREMONIA" ? "Entrar a la ceremonia" : p.kind === "CIRCULO_LUNAR" ? p.joinLabel || "Enlace a Zoom" : p.kind === "PODCAST" ? "Escuchar el podcast" : p.kind === "MASTERCLASS" ? "Entrar a la masterclass" : "Entrar a la sesión";
  return { href: p.mediaUrl, label };
}

export function JoinButton({ post, className = "" }: { post: { kind: string; mediaUrl?: string | null; eventAt?: Date | null; joinLabel?: string | null }; className?: string }) {
  const j = joinLink(post);
  if (!j) return null;
  const s = kindStyle(post.kind);
  return (
    <a href={j.href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition hover:brightness-110 ${className}`} style={{ background: `linear-gradient(135deg, ${s.color}, ${ka(s.color, "bb")})`, boxShadow: `0 0 0 1px ${ka(s.light, "88")}, 0 10px 30px -8px ${s.color}` }} data-join>
      <ExternalLink className="h-4 w-4" /> <Tr s={j.label} />
    </a>
  );
}
