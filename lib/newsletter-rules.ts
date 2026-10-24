/**
 * Reglas de la newsletter, sin dependencias de servidor (las usan el panel, lib/newsletter.ts, el
 * envío y las pruebas unitarias: scripts/unit/newsletter.test.ts).
 */
import { z } from "zod";

export const SUBSCRIBER_STATUSES = ["PENDING", "CONFIRMED", "UNSUBSCRIBED", "BOUNCED", "COMPLAINED"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const SUBSCRIBER_SOURCES = ["FORM", "FREEBIE", "CHECKOUT", "SIGNUP", "PROFILE", "IMPORT", "MIGRATED", "MANUAL"] as const;
export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

export const STATUS_LABEL: Record<SubscriberStatus, string> = {
  PENDING: "Sin confirmar",
  CONFIRMED: "Confirmada",
  UNSUBSCRIBED: "Dada de baja",
  BOUNCED: "Rebotado",
  COMPLAINED: "Marcó como spam",
};

export const SOURCE_LABEL: Record<SubscriberSource, string> = {
  FORM: "Formulario de tu página",
  FREEBIE: "Contenido gratis",
  CHECKOUT: "Compra",
  SIGNUP: "Al crear su cuenta",
  PROFILE: "Desde su perfil",
  IMPORT: "Importada",
  MIGRATED: "Casilla de antes",
  MANUAL: "Añadida a mano",
};

export type UnsubscribeVia = "LINK" | "ONE_CLICK" | "PROFILE" | "OWNER" | "BOUNCE" | "COMPLAINT";

/** Solo a las confirmadas (doble opt-in): nunca a las pendientes, dadas de baja o con rebote/queja. */
export function canSend(status: string): boolean {
  return status === "CONFIRMED";
}

/**
 * Texto exacto que se guarda como prueba del consentimiento (RGPD art. 7.1) en cada alta desde un
 * formulario. Si cambia, cambia para las altas nuevas: las de antes conservan el suyo.
 */
export function newsletterConsentText(creatorName: string): string {
  return `Quiero recibir por email la newsletter de ${creatorName} (novedades, lecturas y ofertas). Puedo darme de baja cuando quiera con el enlace de cada email.`;
}

/** Texto de la casilla de las importaciones: lo declara la dueña, y queda guardado con cada fila. */
export const IMPORT_DECLARATION = "Confirmo que estas personas aceptaron recibir mi newsletter y puedo demostrarlo.";

// ── Segmentos ──

export type Segment = { kind: "all" } | { kind: "tag"; tag: string } | { kind: "product"; productId: string } | { kind: "member" };

const segmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("tag"), tag: z.string().trim().min(1).max(30) }),
  z.object({ kind: z.literal("product"), productId: z.string().min(1).max(40) }),
  z.object({ kind: z.literal("member") }),
]);

/** Segmento guardado (tolerante: lo que no se entiende es «todas»). */
export function parseSegment(raw: unknown): Segment {
  const r = segmentSchema.safeParse(raw);
  return r.success ? r.data : { kind: "all" };
}

/** Etiquetas: minúsculas, sin espacios raros, máx. 10 de 30 caracteres. */
export function normalizeTags(input: string | string[] | null | undefined): string[] {
  const list = Array.isArray(input) ? input : (input ?? "").split(/[,;|]/);
  const out: string[] = [];
  for (const raw of list) {
    const t = raw
      .normalize("NFC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, 30);
    if (t && !out.includes(t)) out.push(t);
    if (out.length === 10) break;
  }
  return out;
}

// ── Ritmo de envío ──

/**
 * Cuántos emails masivos pueden salir ahora: el límite diario menos la reserva para los
 * transaccionales y lo ya enviado en las últimas 24 h. cap 0 = sin límite.
 */
export function dailyBudget(o: { cap: number; reserve: number; sentLast24h: number }): number {
  if (o.cap <= 0) return Infinity;
  return Math.max(0, o.cap - Math.max(0, o.reserve) - o.sentLast24h);
}

/** Días que tardará en salir lo que queda con `perDay` al día (1 = hoy). */
export function etaDays(remaining: number, perDay: number): number {
  if (remaining <= 0) return 0;
  if (!Number.isFinite(perDay)) return 1;
  if (perDay <= 0) return Infinity;
  return Math.ceil(remaining / perDay);
}

// ── Importar CSV ──

export const IMPORT_MAX_ROWS = 5000;

export type ImportRow = { email: string; name?: string; consentAt: Date; tags: string[]; line: number };
export type ImportError = { line: number; reason: "email" | "consent_date" | "duplicate" | "too_many" };

const HEADER_ALIASES: Record<"email" | "name" | "consent" | "tags", string[]> = {
  email: ["email", "correo", "e-mail", "mail", "correo electronico", "email address"],
  name: ["nombre", "name", "first name", "nombre completo"],
  consent: ["fecha_consentimiento", "fecha consentimiento", "consentimiento", "consent_date", "consent date", "opt_in_date", "optin_date", "fecha_alta", "fecha alta", "subscribed", "subscribed_at", "date"],
  tags: ["etiquetas", "tags", "etiqueta", "grupos", "groups"],
};

const clean = (s: string) =>
  s
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** CSV (RFC 4180): comillas, comas o «;» dentro de comillas y saltos de línea en un campo. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** «2025-03-14», «2025-03-14T10:00:00Z», «14/03/2025» o «14-03-2025» → fecha; null si no lo es. */
export function parseConsentDate(v: string, now = new Date()): Date | null {
  const s = v.trim();
  let d: Date | null = null;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dmy) d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] ?? 12), Number(dmy[5] ?? 0)));
  else if (/^\d{4}-\d{2}-\d{2}/.test(s)) d = new Date(s.length === 10 ? `${s}T12:00:00Z` : s);
  if (!d || Number.isNaN(d.getTime())) return null;
  // Ni en el futuro ni de antes del RGPD (sin consentimiento demostrable).
  if (d.getTime() > now.getTime() + 86_400_000 || d.getUTCFullYear() < 2000) return null;
  return d;
}

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

/**
 * Lee el CSV de otra herramienta (MailerLite, Mailchimp, una hoja de cálculo). La fila de cabecera
 * dice qué es cada columna (email, nombre, fecha_consentimiento, etiquetas). Sin fecha de
 * consentimiento, la fila no se importa: no hay prueba de que aceptara.
 */
export function parseImportCsv(text: string, now = new Date()): { rows: ImportRow[]; errors: ImportError[]; missingColumns: ("email" | "consent")[] } {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map(clean);
  const col = (k: keyof typeof HEADER_ALIASES) => header.findIndex((h) => HEADER_ALIASES[k].includes(h));
  const ci = { email: col("email"), name: col("name"), consent: col("consent"), tags: col("tags") };
  const missingColumns = (["email", "consent"] as const).filter((k) => ci[k] < 0);
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  if (missingColumns.length) return { rows, errors, missingColumns };
  const seen = new Set<string>();
  const body = table.slice(1);
  if (body.length > IMPORT_MAX_ROWS) return { rows, errors: [{ line: IMPORT_MAX_ROWS + 2, reason: "too_many" }], missingColumns };
  body.forEach((r, i) => {
    const line = i + 2;
    const email = (r[ci.email] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) return void errors.push({ line, reason: "email" });
    const consentAt = parseConsentDate(r[ci.consent] ?? "", now);
    if (!consentAt) return void errors.push({ line, reason: "consent_date" });
    if (seen.has(email)) return void errors.push({ line, reason: "duplicate" });
    seen.add(email);
    const name = ci.name >= 0 ? (r[ci.name] ?? "").trim().slice(0, 80) : "";
    rows.push({ email, ...(name ? { name } : {}), consentAt, tags: ci.tags >= 0 ? normalizeTags(r[ci.tags] ?? "") : [], line });
  });
  return { rows, errors, missingColumns };
}

export const IMPORT_ERROR_LABEL: Record<ImportError["reason"], string> = {
  email: "email no válido",
  consent_date: "sin fecha de consentimiento",
  duplicate: "repetida en el archivo",
  too_many: `más de ${IMPORT_MAX_ROWS} filas: divide el archivo`,
};

/** «Se enviará a 1 persona» / «a 214 personas». */
export function peopleCount(n: number): string {
  return `${n.toLocaleString("es-ES")} ${n === 1 ? "persona" : "personas"}`;
}
