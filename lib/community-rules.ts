/**
 * Reglas puras de la comunidad (publicaciones de una membresía, sus comentarios y sus «me gusta»).
 * Sin BD ni `server-only`: las usan el panel, el área de cliente, los emails y las pruebas unitarias.
 *
 *   · Una publicación es un borrador (DRAFT, solo la ve la dueña) o está publicada (PUBLISHED). Si su
 *     fecha de publicación es futura, está «programada»: nadie más la ve hasta esa hora, sin cron
 *     (visibleMemberPostWhere filtra por la hora de cada consulta).
 *   · El aviso por email sale una vez, cuando se hace visible (lib/community-notify.ts).
 *   · Los comentarios son texto plano con un solo nivel de respuestas.
 */
import { z } from "zod";
import { parseTextFormat } from "./rich-text";
import { dateKeyInTz, formatInTz, zonedParts, zonedTimeToUtc } from "./tz";

export const MEMBER_POST_KINDS = ["TEXT", "AUDIO", "VIDEO", "EVENT", "PODCAST", "CEREMONIA", "CIRCULO_LUNAR"] as const;
export type MemberPostKind = (typeof MEMBER_POST_KINDS)[number];
export const MEMBER_POST_KIND_LABEL: Record<MemberPostKind, string> = {
  TEXT: "Publicación",
  AUDIO: "Audio",
  VIDEO: "Vídeo",
  EVENT: "Directo / evento",
  PODCAST: "Podcast",
  CEREMONIA: "Ceremonia",
  CIRCULO_LUNAR: "Círculo de la luna",
};
/** Tipos que son un encuentro en directo con fecha (Post.eventAt): directo, ceremonia y círculo de la luna. */
export const LIVE_POST_KINDS: ReadonlySet<MemberPostKind> = new Set(["EVENT", "CEREMONIA", "CIRCULO_LUNAR"]);
export function isLivePostKind(kind: string): boolean {
  return LIVE_POST_KINDS.has(kind as MemberPostKind);
}

export const TITLE_MAX = 160;
export const BODY_MAX = 10_000;
export const ATTACHMENTS_MAX = 10;
export const COMMENT_MAX = 2000;
export const FEED_PAGE = 15;
/** Un aviso que no salió en estos días (el cron estuvo parado) ya no se envía: sería noticia vieja. */
export const NOTIFY_WINDOW_DAYS = 7;
const DAY = 86_400_000;

export const MEMBER_POST_WHEN = ["now", "schedule", "draft"] as const;
export type MemberPostWhen = (typeof MEMBER_POST_WHEN)[number];

const checkbox = z.preprocess((v) => v === "on" || v === "1" || v === "true" || v === true, z.boolean());

/**
 * Formulario del editor de publicaciones del panel. Se valida sobre Object.fromEntries(form) más
 * `attachmentIds` (form.getAll): ver parseMemberPostForm.
 */
export const memberPostFormSchema = z
  .object({
    id: z.string().max(40).optional().transform((v) => v || undefined),
    productId: z.string().min(1, "Membresía no encontrada").max(40),
    title: z.string().trim().min(2, "Escribe un título").max(TITLE_MAX, `El título admite ${TITLE_MAX} caracteres`),
    body: z.string().max(BODY_MAX, `El texto admite ${BODY_MAX.toLocaleString("es-ES")} caracteres`).default(""),
    bodyFormat: z.unknown().transform((v) => parseTextFormat(v === undefined ? undefined : v)),
    kind: z.enum(MEMBER_POST_KINDS).catch("TEXT"),
    mediaUrl: z
      .string()
      .trim()
      .max(500, "El enlace es demasiado largo")
      .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), "El enlace debe empezar por https://")
      .default(""),
    when: z.enum(MEMBER_POST_WHEN).catch("now"),
    at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Elige el día y la hora")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    // Directo, ceremonia o círculo de la luna: cuándo es (día y hora en la zona de la dueña).
    eventDate: z
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha del encuentro no es válida")
      .optional()
      .transform((v) => v || undefined),
    eventTime: z
      .string()
      .regex(/^(\d{2}:\d{2})?$/, "La hora del encuentro no es válida")
      .optional()
      .transform((v) => v || undefined),
    notify: checkbox,
    commentsOpen: checkbox,
    attachmentIds: z.array(z.string().min(1).max(40)).max(ATTACHMENTS_MAX, `Máximo ${ATTACHMENTS_MAX} archivos por publicación`).default([]),
  })
  .superRefine((d, ctx) => {
    if (!d.body.trim() && !d.attachmentIds.length && !d.mediaUrl) ctx.addIssue({ code: "custom", path: ["body"], message: "Escribe un texto o añade un archivo" });
    if (d.when === "schedule" && !d.at) ctx.addIssue({ code: "custom", path: ["at"], message: "Elige el día y la hora" });
    if (!!d.eventDate !== !!d.eventTime) ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Elige el día y la hora del encuentro" });
  });

export type MemberPostForm = z.infer<typeof memberPostFormSchema>;

/** Lee el formulario del editor (FormData) con el esquema. */
export function parseMemberPostForm(form: FormData) {
  const raw: Record<string, unknown> = Object.fromEntries(form);
  raw.attachmentIds = form.getAll("attachmentIds").map(String).filter(Boolean);
  // Casillas sin marcar: no llegan en el formulario.
  raw.notify = form.get("notify") ?? false;
  raw.commentsOpen = form.get("commentsOpen") ?? false;
  return memberPostFormSchema.safeParse(raw);
}

// ── Cuándo se ve ──

export type MemberPostState = "DRAFT" | "SCHEDULED" | "PUBLISHED";
type Timed = { status: string; publishedAt: Date };

export function memberPostState(p: Timed, now = new Date()): MemberPostState {
  if (p.status !== "PUBLISHED") return "DRAFT";
  return p.publishedAt > now ? "SCHEDULED" : "PUBLISHED";
}

export function isMemberPostVisible(p: Timed, now = new Date()): boolean {
  return memberPostState(p, now) === "PUBLISHED";
}

/** Filtro de Prisma de las publicaciones que ven los miembros ahora mismo. */
export function visibleMemberPostWhere(now = new Date()) {
  return { status: "PUBLISHED" as const, publishedAt: { lte: now } };
}

/** Lo más lejos que se puede programar. */
const SCHEDULE_MAX_DAYS = 366;

/**
 * Estado y fecha que se guardan según «Cuándo» del editor:
 *   · now: se publica ya (una publicación que ya estaba publicada conserva su fecha);
 *   · schedule: a la hora elegida, en la zona de la dueña (no vale para una ya publicada);
 *   · draft: borrador (conserva la fecha que tuviera).
 */
export function resolveMemberPostTiming(i: {
  when: MemberPostWhen;
  at?: string | null;
  current: Timed | null;
  timeZone: string;
  now?: Date;
}): { ok: true; status: "DRAFT" | "PUBLISHED"; publishedAt: Date } | { ok: false; error: string } {
  const now = i.now ?? new Date();
  const live = i.current ? memberPostState(i.current, now) === "PUBLISHED" : false;
  if (i.when === "draft") return { ok: true, status: "DRAFT", publishedAt: i.current?.publishedAt ?? now };
  if (i.when === "now") return { ok: true, status: "PUBLISHED", publishedAt: live ? i.current!.publishedAt : now };
  if (live) return { ok: false, error: "Ya está publicada: no se puede programar otra vez." };
  const m = (i.at ?? "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return { ok: false, error: "Elige el día y la hora" };
  const [, key, hh, mm] = m;
  const minutes = Number(hh) * 60 + Number(mm);
  if (Number(hh) > 23 || Number(mm) > 59 || Number.isNaN(new Date(`${key}T00:00:00Z`).getTime())) return { ok: false, error: "Elige el día y la hora" };
  const at = zonedTimeToUtc(key, minutes, i.timeZone);
  if (at.getTime() - now.getTime() < 60_000) return { ok: false, error: "Elige una hora futura o «Publicar ahora»." };
  if (at.getTime() - now.getTime() > SCHEDULE_MAX_DAYS * DAY) return { ok: false, error: "Como mucho se puede programar con un año de antelación." };
  return { ok: true, status: "PUBLISHED", publishedAt: at };
}

/** ¿Toca avisar ya por email de esta publicación? */
export function needsNotification(p: Timed & { notify: boolean; notifiedAt: Date | null }, now = new Date()): boolean {
  return (
    p.status === "PUBLISHED" &&
    p.notify &&
    !p.notifiedAt &&
    p.publishedAt.getTime() <= now.getTime() &&
    p.publishedAt.getTime() > now.getTime() - NOTIFY_WINDOW_DAYS * DAY
  );
}

/** «Avisar por email» solo se puede cambiar mientras la publicación no se ha hecho visible. */
export function notifyEditable(current: Timed | null, now = new Date()): boolean {
  return !current || memberPostState(current, now) !== "PUBLISHED";
}

/** «jue 23 oct, 9:00» en la zona de la dueña. */
export function scheduleLabel(d: Date, timeZone: string): string {
  const day = formatInTz(d, timeZone, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
  return `${day}, ${formatInTz(d, timeZone, { hour: "numeric", minute: "2-digit", hourCycle: "h23" })}`;
}

/** «jueves 23 de octubre a las 9:00» (frase del editor y del mensaje al programar). */
export function scheduleSentence(d: Date, timeZone: string): string {
  const day = formatInTz(d, timeZone, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  return `${day} a las ${formatInTz(d, timeZone, { hour: "numeric", minute: "2-digit", hourCycle: "h23" })}`;
}

/** Valor de un <input type="datetime-local"> para una fecha en la zona de la dueña. */
export function datetimeLocalValue(d: Date, timeZone: string): string {
  const z = zonedParts(d, timeZone);
  return `${dateKeyInTz(d, timeZone)}T${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}

// ── Comentarios ──

/**
 * Nombre que ven las demás personas de la comunidad: el nombre y la inicial del primer apellido
 * («Laura Martínez García» → «Laura M.»). Nunca el email: si el nombre lo parece, «Miembro».
 */
export function publicMemberName(name: string | null | undefined): string {
  const clean = (name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean || clean.includes("@")) return "Miembro";
  const words = clean.split(/\s+/);
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase("es-ES") + w.slice(1);
  const first = cap(words[0]).slice(0, 24);
  const initial = words[1] ? `${words[1].charAt(0).toLocaleUpperCase("es-ES")}.` : "";
  return initial ? `${first} ${initial}` : first;
}

/** Texto de un comentario tal y como se guarda: sin caracteres de control, sin líneas en blanco de más. */
export function cleanCommentBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // Controles y marcas de dirección o de ancho cero (permiten disfrazar un texto).
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, COMMENT_MAX);
}

/** Quién puede borrar un comentario: quien lo escribió o la dueña de la comunidad. */
export function canDeleteComment(c: { userId: string; creatorId: string }, actor: { userId: string; ownerOfCreatorId?: string | null }): "author" | "owner" | null {
  if (actor.ownerOfCreatorId && actor.ownerOfCreatorId === c.creatorId) return "owner";
  if (actor.userId === c.userId) return "author";
  return null;
}

// ── Adjuntos ──

const KIND_SUMMARY: Record<string, { icon: string; one: string; many: string }> = {
  AUDIO: { icon: "🎧", one: "Audio", many: "audios" },
  VIDEO: { icon: "🎬", one: "Vídeo", many: "vídeos" },
  PDF: { icon: "📄", one: "PDF", many: "PDF" },
  IMAGE: { icon: "🖼️", one: "Imagen", many: "imágenes" },
  OTHER: { icon: "📎", one: "Archivo", many: "archivos" },
};

const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

/** «🎧 Audio · 14 min · 📄 PDF» (o «🖼️ 3 imágenes»): una línea por tipo, en el orden de la publicación. */
export function attachmentSummary(files: { kind: string; durationSec?: number | null }[]): string {
  const order: string[] = [];
  const groups = new Map<string, { count: number; sec: number }>();
  for (const f of files) {
    const k = KIND_SUMMARY[f.kind] ? f.kind : "OTHER";
    if (!groups.has(k)) {
      order.push(k);
      groups.set(k, { count: 0, sec: 0 });
    }
    const g = groups.get(k)!;
    g.count++;
    g.sec += f.durationSec ?? 0;
  }
  return order
    .map((k) => {
      const g = groups.get(k)!;
      const s = KIND_SUMMARY[k];
      const label = g.count === 1 ? s.one : `${g.count} ${s.many}`;
      return `${s.icon} ${label}${g.sec > 0 && (k === "AUDIO" || k === "VIDEO") ? ` · ${minutes(g.sec)}` : ""}`;
    })
    .join(" · ");
}

/** «Incluye: 1 audio (14 min) y 1 PDF» para el email del aviso (sin emojis). */
export function attachmentSentence(files: { kind: string; durationSec?: number | null }[]): string {
  if (!files.length) return "";
  const parts: string[] = [];
  const by = new Map<string, { count: number; sec: number }>();
  for (const f of files) {
    const k = KIND_SUMMARY[f.kind] ? f.kind : "OTHER";
    const g = by.get(k) ?? { count: 0, sec: 0 };
    g.count++;
    g.sec += f.durationSec ?? 0;
    by.set(k, g);
  }
  for (const [k, g] of by) {
    const s = KIND_SUMMARY[k];
    const noun = g.count === 1 ? s.one.toLowerCase().replace("pdf", "PDF") : s.many;
    parts.push(`${g.count} ${noun}${g.sec > 0 && (k === "AUDIO" || k === "VIDEO") ? ` (${minutes(g.sec)})` : ""}`);
  }
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}` : parts[0];
  return `Incluye: ${list}`;
}
