/**
 * Datos para la lectura: lo que la dueña pide al reservar o comprar (datos de nacimiento y preguntas
 * suyas) y lo que contesta la clienta. Puro (zod), sin BD: lo usan el checkout, el panel, el área de
 * cliente y los emails. Se prueba en scripts/unit/lecturas.test.ts.
 *
 *   Product.intake (IntakeConfig)  { birth: off | optional | required, questions: [{ id, label, long, required }] }
 *   Order.intake   (IntakeAnswers) { v: 1, birth?: { date, time, timeUnknown, place }, answers: [{ id, label, value }] }
 *
 * Las respuestas guardan el texto de cada pregunta tal y como estaba: si la dueña la cambia después,
 * lo contestado sigue teniendo sentido. Todo se pinta como texto (nunca HTML).
 */
import { z } from "zod";

export const INTAKE_MAX_QUESTIONS = 8;
export const INTAKE_SHORT_MAX = 300;
export const INTAKE_LONG_MAX = 1000;

export type BirthMode = "off" | "optional" | "required";
export type IntakeQuestion = { id: string; label: string; long: boolean; required: boolean };
export type IntakeConfig = { birth: BirthMode; questions: IntakeQuestion[] };
export type BirthData = { date: string; time: string | null; timeUnknown: boolean; place: string };
export type IntakeAnswers = { v: 1; birth?: BirthData; answers: { id: string; label: string; value: string }[] };

export const EMPTY_INTAKE: IntakeConfig = { birth: "off", questions: [] };

const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{1,12}$/),
  label: z.string().trim().min(1).max(120),
  long: z.boolean().catch(false),
  required: z.boolean().catch(false),
});

/** Configuración tolerante: un JSON dañado nunca rompe una página (vale «no se pide nada»). */
export function readIntakeConfig(raw: unknown): IntakeConfig {
  if (!raw || typeof raw !== "object") return EMPTY_INTAKE;
  const r = raw as { birth?: unknown; questions?: unknown };
  const birth: BirthMode = r.birth === "optional" || r.birth === "required" ? r.birth : "off";
  const seen = new Set<string>();
  const questions: IntakeQuestion[] = [];
  for (const q of Array.isArray(r.questions) ? r.questions : []) {
    const p = questionSchema.safeParse(q);
    if (!p.success || seen.has(p.data.id)) continue;
    seen.add(p.data.id);
    questions.push(p.data);
    if (questions.length >= INTAKE_MAX_QUESTIONS) break;
  }
  return { birth, questions };
}

/** ¿Pide algo? */
export function intakeAsksAnything(cfg: IntakeConfig) {
  return cfg.birth !== "off" || cfg.questions.length > 0;
}

/**
 * El editor del panel manda la configuración como JSON. null = no se pide nada (se guarda vacío).
 */
export function parseIntakeConfigInput(json: string | null | undefined): { ok: true; value: IntakeConfig | null } | { ok: false; error: string } {
  if (!json || !json.trim()) return { ok: true, value: null };
  if (json.length > 4000) return { ok: false, error: "Demasiadas preguntas o demasiado largas" };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "No hemos podido leer las preguntas. Vuelve a intentarlo." };
  }
  const r = raw as { questions?: unknown };
  if (Array.isArray(r?.questions)) {
    if (r.questions.length > INTAKE_MAX_QUESTIONS) return { ok: false, error: `Como mucho ${INTAKE_MAX_QUESTIONS} preguntas` };
    if (r.questions.some((q) => !questionSchema.safeParse(q).success)) return { ok: false, error: "Escribe el texto de cada pregunta (máx. 120 caracteres)" };
  }
  const cfg = readIntakeConfig(raw);
  return { ok: true, value: intakeAsksAnything(cfg) ? cfg : null };
}

/** Solo las sesiones y los productos digitales «Lo preparo yo» piden datos. */
export function asksIntake(type: string, deliveryMode: string, cfg: IntakeConfig): boolean {
  const kind = type === "SESSION" || (type === "DIGITAL" && deliveryMode === "PERSONAL");
  return kind && intakeAsksAnything(cfg);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function realDate(s: string) {
  const m = s.match(DATE_RE);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const str = (v: unknown) => (typeof v === "string" ? v : "").replace(/\r\n/g, "\n").trim();

export type IntakeParse = { ok: true; value: IntakeAnswers | null } | { ok: false; error: string; field: string };

/**
 * Lee el formulario (nombres intake.birthDate, intake.birthTime, intake.birthTimeUnknown,
 * intake.birthPlace, intake.q.<id>) según lo que pide el producto. null = no se pide nada o no ha
 * contestado nada opcional.
 */
export function parseIntakeAnswers(cfg: IntakeConfig, fields: Record<string, unknown>, now: Date = new Date()): IntakeParse {
  const out: IntakeAnswers = { v: 1, answers: [] };
  if (cfg.birth !== "off") {
    const date = str(fields["intake.birthDate"]);
    const timeUnknown = fields["intake.birthTimeUnknown"] === "on" || fields["intake.birthTimeUnknown"] === "true" || fields["intake.birthTimeUnknown"] === true;
    const time = str(fields["intake.birthTime"]);
    const place = str(fields["intake.birthPlace"]).replace(/\s+/g, " ");
    const any = !!(date || time || place);
    if (cfg.birth === "required" || any) {
      if (!date) return { ok: false, error: "Escribe tu fecha de nacimiento", field: "intake.birthDate" };
      const max = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);
      if (!realDate(date) || date < "1900-01-01" || date > max) return { ok: false, error: "Revisa tu fecha de nacimiento", field: "intake.birthDate" };
      if (!timeUnknown && !time) return { ok: false, error: "Escribe tu hora de nacimiento o marca «No sé la hora exacta»", field: "intake.birthTime" };
      if (!timeUnknown && !TIME_RE.test(time.slice(0, 5))) return { ok: false, error: "Revisa tu hora de nacimiento", field: "intake.birthTime" };
      if (place.length < 2) return { ok: false, error: "Escribe tu lugar de nacimiento", field: "intake.birthPlace" };
      if (place.length > 120) return { ok: false, error: "El lugar de nacimiento es demasiado largo", field: "intake.birthPlace" };
      out.birth = { date, time: timeUnknown ? null : time.slice(0, 5), timeUnknown, place };
    }
  }
  for (const q of cfg.questions) {
    const field = `intake.q.${q.id}`;
    const max = q.long ? INTAKE_LONG_MAX : INTAKE_SHORT_MAX;
    const value = str(fields[field]).slice(0, max);
    if (!value) {
      if (q.required) return { ok: false, error: `Contesta: «${q.label}»`, field };
      continue;
    }
    out.answers.push({ id: q.id, label: q.label, value: q.long ? value : value.replace(/\s+/g, " ") });
  }
  return { ok: true, value: out.birth || out.answers.length ? out : null };
}

const answersSchema = z.object({
  v: z.literal(1).catch(1),
  birth: z
    .object({
      date: z.string().regex(DATE_RE),
      time: z.string().regex(TIME_RE).nullable().catch(null),
      timeUnknown: z.boolean().catch(false),
      place: z.string().max(200),
    })
    .optional()
    .catch(undefined),
  answers: z.array(z.object({ id: z.string().max(20), label: z.string().max(200), value: z.string().max(INTAKE_LONG_MAX) })).catch([]),
});

/** Respuestas guardadas (tolerante: un JSON dañado vale «sin datos»). */
export function readIntakeAnswers(raw: unknown): IntakeAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const p = answersSchema.safeParse(raw);
  if (!p.success) return null;
  const a = p.data as IntakeAnswers;
  return a.birth || a.answers.length ? a : null;
}

/** ¿Falta algo obligatorio? (Para el aviso «Completa tus datos para la lectura».) */
export function intakeMissing(cfg: IntakeConfig, a: IntakeAnswers | null): boolean {
  if (cfg.birth === "required" && !a?.birth) return true;
  return cfg.questions.some((q) => q.required && !a?.answers.some((x) => x.id === q.id && x.value));
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «3 de marzo de 1991 · 06:40 · Valencia, España» o «… · hora desconocida · …». */
export function formatBirth(b: BirthData): string {
  const [y, m, d] = b.date.split("-").map(Number);
  const day = `${d} de ${MONTHS[m - 1] ?? ""} de ${y}`;
  return [day, b.timeUnknown || !b.time ? "hora desconocida" : b.time, b.place].join(" · ");
}

/** Filas para enseñar (panel, emails, área de cliente). */
export function intakeLines(a: IntakeAnswers): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (a.birth) {
    const [y, m, d] = a.birth.date.split("-").map(Number);
    lines.push({ label: "Fecha de nacimiento", value: `${d} de ${MONTHS[m - 1] ?? ""} de ${y}` });
    lines.push({ label: "Hora de nacimiento", value: a.birth.timeUnknown || !a.birth.time ? "No la sabe con exactitud" : a.birth.time });
    lines.push({ label: "Lugar de nacimiento", value: a.birth.place });
  }
  for (const x of a.answers) lines.push({ label: x.label, value: x.value });
  return lines;
}

/** Texto plano para «Copiar» (Solar Fire, Astro.com…). */
export function intakeAsText(a: IntakeAnswers): string {
  return intakeLines(a)
    .map((l) => `${l.label}: ${l.value}`)
    .join("\n");
}

/** Valores iniciales del formulario a partir de unas respuestas guardadas. */
export function intakeFormValues(a: IntakeAnswers | null): Record<string, string | boolean> {
  const v: Record<string, string | boolean> = {};
  if (a?.birth) {
    v["intake.birthDate"] = a.birth.date;
    v["intake.birthTime"] = a.birth.time ?? "";
    v["intake.birthTimeUnknown"] = a.birth.timeUnknown;
    v["intake.birthPlace"] = a.birth.place;
  }
  for (const x of a?.answers ?? []) v[`intake.q.${x.id}`] = x.value;
  return v;
}
