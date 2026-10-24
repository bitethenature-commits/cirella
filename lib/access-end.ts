/**
 * Fin de un acceso dado a mano (lib/free-access.ts → grantManualAccess): «Duración del acceso» del
 * panel. Puro y sin `server-only`: lo usan el formulario del panel (frase en directo), las acciones,
 * los emails y las pruebas unitarias.
 *
 * La dueña elige un último día (incluido) en SU zona horaria; el acceso termina a la medianoche
 * siguiente de esa zona (Access.expiresAt). Se comprueba en cada visita, así que termina a su hora
 * aunque el cron que lo marca y avisa (lib/access-expiry.ts) se retrase.
 */
import { addDaysToKey, dateKeyInTz, formatInTz, zonedTimeToUtc } from "./tz";

export const ACCESS_END_CHOICES = ["none", "1m", "3m", "6m", "1y", "date"] as const;
export type AccessEndChoice = (typeof ACCESS_END_CHOICES)[number];

export const ACCESS_END_LABEL: Record<AccessEndChoice, string> = {
  none: "Sin fecha de fin",
  "1m": "1 mes",
  "3m": "3 meses",
  "6m": "6 meses",
  "1y": "1 año",
  date: "Hasta un día concreto…",
};

/** El aviso «tu acceso termina pronto» sale estos días antes… */
export const REMIND_BEFORE_DAYS = 7;
/** …solo si el acceso duraba al menos esto (a un acceso de 10 días no se le avisa al tercero). */
export const MIN_GRANT_DAYS_FOR_REMINDER = 14;
const MAX_YEARS = 5;
const DAY = 86_400_000;

export function asAccessEndChoice(v: unknown): AccessEndChoice {
  return (ACCESS_END_CHOICES as readonly unknown[]).includes(v) ? (v as AccessEndChoice) : "none";
}

/** Suma meses a un día «AAAA-MM-DD» sin pasarse de mes (31 ene + 1 mes = 28 o 29 feb). */
export function addMonthsToKey(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

const validKey = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k) && new Date(`${k}T00:00:00Z`).toISOString().slice(0, 10) === k;

/**
 * Fin del acceso según lo elegido. Los plazos cuentan desde hoy (en su zona): «1 mes» el 17 oct
 * → último día el 17 nov. `until` es el instante en que deja de tener acceso (la medianoche tras el
 * último día); null = sin fecha de fin.
 */
export function accessEndFrom(i: {
  choice: AccessEndChoice;
  date?: string | null;
  now: Date;
  timeZone: string;
}): { ok: true; until: Date | null; lastDayKey: string | null } | { ok: false; error: string } {
  if (i.choice === "none") return { ok: true, until: null, lastDayKey: null };
  const today = dateKeyInTz(i.now, i.timeZone);
  let last: string;
  if (i.choice === "date") {
    const d = (i.date ?? "").trim();
    if (!validKey(d)) return { ok: false, error: "Elige el último día de acceso" };
    if (d < today) return { ok: false, error: "La fecha ya ha pasado" };
    if (d > addMonthsToKey(today, MAX_YEARS * 12)) return { ok: false, error: `Como mucho, ${MAX_YEARS} años` };
    last = d;
  } else {
    last = addMonthsToKey(today, { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[i.choice]);
  }
  return { ok: true, until: zonedTimeToUtc(addDaysToKey(last, 1), 0, i.timeZone), lastDayKey: last };
}

/** Último día con acceso (en su zona) de un acceso que termina en `expiresAt`. */
export function lastDayKey(expiresAt: Date, timeZone: string): string {
  return dateKeyInTz(new Date(expiresAt.getTime() - 1), timeZone);
}

/** «17 de noviembre» (y el año si no es el de ahora). */
export function lastDayText(expiresAt: Date, timeZone: string, now = new Date()): string {
  const last = new Date(expiresAt.getTime() - 1);
  const sameYear = formatInTz(last, timeZone, { year: "numeric" }) === formatInTz(now, timeZone, { year: "numeric" });
  return formatInTz(last, timeZone, { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}

/** «Hasta el 17 de noviembre» · «Terminó el 17 de noviembre» · null sin fecha. */
export function accessEndText(expiresAt: Date | null, timeZone: string, now = new Date()): string | null {
  if (!expiresAt) return null;
  return `${expiresAt > now ? "Hasta el" : "Terminó el"} ${lastDayText(expiresAt, timeZone, now)}`;
}

/** ¿Toca ya el aviso de «tu acceso termina pronto»? */
export function shouldRemindEnding(i: { expiresAt: Date; grantedAt: Date; now: Date }): boolean {
  const left = i.expiresAt.getTime() - i.now.getTime();
  return left > 0 && left <= REMIND_BEFORE_DAYS * DAY && i.expiresAt.getTime() - i.grantedAt.getTime() >= MIN_GRANT_DAYS_FOR_REMINDER * DAY;
}
