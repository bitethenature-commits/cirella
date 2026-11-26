/**
 * «Portal de Noticias»: lo que la dueña publica gratis pero solo para quien está suscrita a su
 * newsletter Y tiene cuenta en la web (un vídeo, un audio, fotos, el enlace de un directo de Zoom o un
 * aviso Early Bird). Puro (sin BD): lo usan la página, el panel, la ruta de los archivos y las pruebas.
 *
 * Regla para desbloquear (unlockReason): la persona ha entrado en su cuenta (sesión completa del área
 * de alumnas, no la de un pedido) y su email es una suscriptora CONFIRMADA de la newsletter de la
 * dueña. La dueña lo ve todo siempre.
 *
 * Lo bloqueado (los archivos, el enlace de Zoom o de la oferta y el texto completo) nunca viaja al
 * navegador sin desbloquear: la página solo recibe lo que devuelve publicPortalItem.
 */
import { z } from "zod";
import { tzCity } from "./timezones";
import { formatInTz } from "./tz";

export const PORTAL_KINDS = ["VIDEO", "AUDIO", "PHOTOS", "LIVE", "EARLY_BIRD"] as const;
export type PortalKind = (typeof PORTAL_KINDS)[number];

export const PORTAL_KIND_LABEL: Record<PortalKind, string> = {
  VIDEO: "Vídeo",
  AUDIO: "Audio",
  PHOTOS: "Fotos",
  LIVE: "Directo · Zoom",
  EARLY_BIRD: "Early Bird",
};

/** Lo que pide el candado según el tipo («Suscríbete a mi newsletter para ver el vídeo»). */
export const PORTAL_LOCK_WHAT: Record<PortalKind, string> = {
  VIDEO: "ver el vídeo",
  AUDIO: "escuchar el audio",
  PHOTOS: "ver las fotos",
  LIVE: "recibir el enlace del directo",
  EARLY_BIRD: "acceder a la oferta",
};

export const PORTAL_TITLE_MAX = 120;
export const PORTAL_SUMMARY_MAX = 200;
export const PORTAL_BODY_MAX = 4000;
export const PORTAL_PHOTOS_MAX = 12;
/** En la portada: el destacado arriba y dos más pequeños debajo. */
export const PORTAL_ON_HOME = 3;

/** Archivo privado de un elemento (vídeo, audio o foto): nunca se envía su clave al navegador. */
export type PortalMedia = { key: string; kind: "VIDEO" | "AUDIO" | "IMAGE"; mime: string; name: string; sizeBytes: number; width?: number | null; height?: number | null; durationSec?: number | null };

export const portalMediaSchema = z.object({
  key: z.string().min(1).max(200),
  kind: z.enum(["VIDEO", "AUDIO", "IMAGE"]),
  mime: z.string().max(100),
  name: z.string().max(200),
  sizeBytes: z.number().nonnegative(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  durationSec: z.number().nullable().optional(),
});

/** Lee PortalItem.media sin fallar: lo que no vale se descarta. */
export function readPortalMedia(raw: unknown): PortalMedia[] {
  if (!Array.isArray(raw)) return [];
  const out: PortalMedia[] = [];
  for (const m of raw) {
    const r = portalMediaSchema.safeParse(m);
    if (r.success) out.push(r.data);
  }
  return out;
}

/** Tipo de archivo que admite cada tipo de elemento. */
export function mediaKindFor(kind: PortalKind): PortalMedia["kind"] | null {
  return kind === "VIDEO" ? "VIDEO" : kind === "AUDIO" ? "AUDIO" : kind === "PHOTOS" ? "IMAGE" : null;
}

export type PortalUnlockInput = {
  /** Usuaria con sesión completa (getCurrentUser), o null. */
  user: { id: string; email: string } | null;
  /** Estado de su suscripción a la newsletter de la dueña (null = no está). */
  subscriberStatus: string | null;
  /** Es la dueña de la web. */
  isOwner: boolean;
};

export type PortalUnlock = "owner" | "subscriber" | "login" | "subscribe";

/**
 * ¿Ve el portal desbloqueado? owner/subscriber = sí. login = está suscrita pero falta entrar (o no
 * sabemos quién es); subscribe = ha entrado pero no es suscriptora confirmada.
 */
export function unlockReason(i: PortalUnlockInput): PortalUnlock {
  if (i.isOwner) return "owner";
  if (!i.user) return "login";
  return i.subscriberStatus === "CONFIRMED" ? "subscriber" : "subscribe";
}

export function isUnlocked(i: PortalUnlockInput): boolean {
  const r = unlockReason(i);
  return r === "owner" || r === "subscriber";
}

export type PortalItemRow = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  body: string | null;
  coverUrl: string | null;
  media: unknown;
  linkUrl: string | null;
  linkLabel: string | null;
  eventAt: Date | null;
  featured: boolean;
  /** Cuándo se publicó (null en los de antes: createdAt). */
  publishedAt?: Date | null;
  createdAt?: Date;
};

/** Lo que llega al navegador de un elemento. Bloqueado: sin archivos, enlace ni texto completo. */
export type PublicPortalItem = {
  id: string;
  kind: PortalKind;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  featured: boolean;
  /** «Mié 4 nov · 19:00 (hora de España)» de un directo. */
  eventLabel: string | null;
  locked: boolean;
  /** Cuándo se publicó (ISO), para el aviso de novedades de la portada. */
  publishedAt: string;
  /** Solo desbloqueado: */
  body: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  /** Direcciones de los archivos (/api/portal/<id>/<n>), que también comprueban el acceso. */
  media: { url: string; kind: PortalMedia["kind"]; name: string; width: number | null; height: number | null }[];
};

export function asPortalKind(k: string): PortalKind {
  return (PORTAL_KINDS as readonly string[]).includes(k) ? (k as PortalKind) : "VIDEO";
}

/** «España» para la hora peninsular; si no, la ciudad de la zona («Bogotá»). */
export function zonePlace(timeZone: string): string {
  return timeZone === "Europe/Madrid" ? "España" : tzCity(timeZone);
}

/** «Mié 4 nov · 19:00 (hora de España)»: fecha y hora de un directo o un círculo en la zona de la dueña. */
export function eventLabel(at: Date, timeZone: string): string {
  const day = formatInTz(at, timeZone, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
  const time = formatInTz(at, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time} (hora de ${zonePlace(timeZone)})`;
}

export function portalMediaUrl(itemId: string, index: number): string {
  return `/api/portal/${itemId}/${index}`;
}

/** El elemento tal y como puede verlo esta persona (nada bloqueado sale de aquí sin desbloquear). */
export function publicPortalItem(item: PortalItemRow, unlocked: boolean, timeZone: string): PublicPortalItem {
  const kind = asPortalKind(item.kind);
  const media = readPortalMedia(item.media);
  return {
    id: item.id,
    kind,
    title: item.title,
    summary: item.summary,
    coverUrl: item.coverUrl,
    featured: item.featured,
    eventLabel: item.eventAt ? eventLabel(item.eventAt, timeZone) : null,
    locked: !unlocked,
    publishedAt: (item.publishedAt ?? item.createdAt ?? new Date(0)).toISOString(),
    body: unlocked ? item.body : null,
    linkUrl: unlocked ? item.linkUrl : null,
    linkLabel: unlocked ? item.linkLabel : null,
    media: unlocked ? media.map((m, i) => ({ url: portalMediaUrl(item.id, i), kind: m.kind, name: m.name, width: m.width ?? null, height: m.height ?? null })) : [],
  };
}

/** Portada: el destacado (o el primero) arriba y los dos siguientes debajo. */
export function homePortalItems<T extends { featured: boolean }>(items: T[]): { main: T | null; rest: T[] } {
  if (!items.length) return { main: null, rest: [] };
  const main = items.find((i) => i.featured) ?? items[0];
  return { main, rest: items.filter((i) => i !== main).slice(0, PORTAL_ON_HOME - 1) };
}

const https = z
  .string()
  .trim()
  .max(600, "El enlace es demasiado largo")
  .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v) || /^\/[^\s/][^\s]*$/.test(v), "El enlace debe empezar por https:// (o ser una página de tu web, como /courses)")
  .default("");

/** Formulario del panel. `media` llega como JSON con los billetes firmados de los archivos subidos. */
export const portalFormSchema = z
  .object({
    id: z.string().max(40).optional().transform((v) => v || undefined),
    kind: z.enum(PORTAL_KINDS, { error: "Elige el tipo" }),
    title: z.string().trim().min(2, "Escribe un título").max(PORTAL_TITLE_MAX, `El título admite ${PORTAL_TITLE_MAX} caracteres`),
    summary: z.string().trim().max(PORTAL_SUMMARY_MAX, `El texto corto admite ${PORTAL_SUMMARY_MAX} caracteres`).default(""),
    body: z.string().trim().max(PORTAL_BODY_MAX, `El texto admite ${PORTAL_BODY_MAX} caracteres`).default(""),
    coverUrl: z.string().max(500).default(""),
    linkUrl: https,
    linkLabel: z.string().trim().max(40, "El texto del botón admite 40 caracteres").default(""),
    eventDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha no es válida").default(""),
    eventTime: z.string().regex(/^(\d{2}:\d{2})?$/, "La hora no es válida").default(""),
    featured: z.preprocess((v) => v === "on" || v === "1" || v === true, z.boolean()).default(false),
    status: z.enum(["DRAFT", "PUBLISHED"]).catch("DRAFT"),
    media: z.string().max(20_000).default("[]"),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "LIVE") {
      if (!d.linkUrl) ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Pega el enlace de Zoom del directo" });
      if (!d.eventDate || !d.eventTime) ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Elige el día y la hora del directo" });
    }
    if (d.kind === "EARLY_BIRD" && !d.linkUrl) ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Elige el producto o la oferta del Early Bird" });
  });
export type PortalForm = z.infer<typeof portalFormSchema>;
