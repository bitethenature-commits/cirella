/**
 * DAC7 / modelo 238 (Directiva UE 2021/514): Cirella, como plataforma, informa cada año a la
 * Agencia Tributaria de lo que cobra cada vendedora por «servicios personales» (por defecto, las
 * sesiones; configurable en /admin/reportes/dac7). Aquí solo hay lógica pura (sin BD):
 * agregados trimestrales, validación del IBAN y qué datos faltan. Lo que toca la BD está en
 * lib/dac7-data.ts. Pruebas: scripts/unit/dac7.test.ts.
 *
 * Criterios por defecto (a confirmar con la asesoría, ver docs/pagos-stripe.md):
 *   · contraprestación = importe NETO de la comisión de Cirella; las comisiones se informan aparte;
 *   · un reembolso resta en el trimestre en que ocurre (no cuenta como actividad);
 *   · los trimestres se cuentan en hora de España (Europe/Madrid).
 */

export const DAC7_TZ = "Europe/Madrid";
/** Tras la primera petición: recordatorios a los 20 y 40 días; a los 60 se pausan las ventas declarables. */
export const DAC7_REMINDER_EVERY_DAYS = 20;
export const DAC7_MAX_REMINDERS = 2;
export const DAC7_BLOCK_AFTER_DAYS = 60;

const DAY_MS = 86_400_000;

export type Dac7Row = {
  kind: "CHARGE" | "REFUND";
  at: Date;
  productType: string;
  amountCents: number;
  platformFeeCents: number;
  netCents: number;
};

export type Dac7Quarter = { considerationCents: number; feesCents: number; activities: number };

export type Dac7Aggregate = { quarters: [Dac7Quarter, Dac7Quarter, Dac7Quarter, Dac7Quarter]; total: Dac7Quarter };

function partsIn(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "numeric" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") };
}

export function quarterOf(d: Date, tz = DAC7_TZ): 1 | 2 | 3 | 4 {
  return (Math.floor((partsIn(d, tz).month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

export function yearOf(d: Date, tz = DAC7_TZ) {
  return partsIn(d, tz).year;
}

const emptyQuarter = (): Dac7Quarter => ({ considerationCents: 0, feesCents: 0, activities: 0 });

export function aggregateDac7(rows: Dac7Row[], year: number, reportableTypes: string[], tz = DAC7_TZ): Dac7Aggregate {
  const quarters: Dac7Aggregate["quarters"] = [emptyQuarter(), emptyQuarter(), emptyQuarter(), emptyQuarter()];
  for (const r of rows) {
    if (!reportableTypes.includes(r.productType) || yearOf(r.at, tz) !== year) continue;
    const q = quarters[quarterOf(r.at, tz) - 1];
    if (r.kind === "CHARGE") {
      q.considerationCents += r.netCents;
      q.feesCents += r.platformFeeCents;
      q.activities += 1;
    } else {
      // El libro guarda los reembolsos en negativo; aquí da igual el signo con que lleguen.
      q.considerationCents -= Math.abs(r.netCents);
      q.feesCents -= Math.abs(r.platformFeeCents);
    }
  }
  const total = quarters.reduce(
    (t, q) => ({ considerationCents: t.considerationCents + q.considerationCents, feesCents: t.feesCents + q.feesCents, activities: t.activities + q.activities }),
    emptyQuarter(),
  );
  return { quarters, total };
}

// ── IBAN ──

/** Longitud por país de los IBAN más habituales; el resto se acepta entre 15 y 34 caracteres. */
const IBAN_LENGTH: Record<string, number> = {
  ES: 24, AD: 24, PT: 25, FR: 27, IT: 27, DE: 22, IE: 22, GB: 22, NL: 18, BE: 16, AT: 20, LU: 20, CH: 21, MC: 27,
};

export function normalizeIban(s: string): string {
  return s.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIban(s: string): boolean {
  const iban = normalizeIban(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTH[iban.slice(0, 2)];
  if (expected ? iban.length !== expected : iban.length < 15 || iban.length > 34) return false;
  // ISO 13616: mover los 4 primeros al final, letras → números (A=10…Z=35) y resto de dividir entre 97 = 1.
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rest = 0;
  for (let i = 0; i < digits.length; i += 7) rest = Number(String(rest) + digits.slice(i, i + 7)) % 97;
  return rest === 1;
}

/** «ES91 •••• •••• 1332»: el IBAN nunca se muestra completo. */
export function maskIban(s: string): string {
  const iban = normalizeIban(s);
  if (iban.length < 8) return "••••";
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

// ── Datos de la vendedora ──

/** Lo que DAC7 pide de cada vendedora. La identidad legal es la de la página de datos legales. */
export type Dac7CreatorFields = {
  legalEntityType: string;
  legalName: string | null;
  legalTaxId: string | null;
  legalAddress: string | null;
  legalPostalCode: string | null;
  legalCity: string | null;
  legalCountry: string | null;
  birthDate: Date | null;
  iban: string | null;
  dac7ConfirmedAt: Date | null;
};

/** Datos que faltan, en español y en el orden del formulario. Vacío = completos. */
export function dac7Missing(c: Dac7CreatorFields): string[] {
  const missing: string[] = [];
  if (!c.legalName?.trim()) missing.push("nombre legal");
  if (!c.legalTaxId?.trim()) missing.push("NIF");
  if (c.legalEntityType !== "COMPANY" && !c.birthDate) missing.push("fecha de nacimiento");
  if (!c.legalAddress?.trim() || !c.legalPostalCode?.trim() || !c.legalCity?.trim()) missing.push("dirección");
  if (!c.legalCountry?.trim()) missing.push("país");
  if (!c.iban || !isValidIban(c.iban)) missing.push("IBAN");
  if (!c.dac7ConfirmedAt) missing.push("confirmación de tus datos");
  return missing;
}

/**
 * Pausa legal: si a los 60 días de pedirlos, y tras dos recordatorios, siguen faltando datos, se
 * pausan las ventas de productos declarables (la ley permite retener los cobros; aquí se elige
 * pausar las ventas nuevas, que es reversible al momento).
 */
export function isDac7Blocked(c: { dac7RequestedAt: Date | null; dac7RemindersSent: number }, missing: string[], now = new Date()): boolean {
  if (!missing.length || !c.dac7RequestedAt) return false;
  return c.dac7RemindersSent >= DAC7_MAX_REMINDERS && now.getTime() - c.dac7RequestedAt.getTime() >= DAC7_BLOCK_AFTER_DAYS * DAY_MS;
}

/** Fecha límite que se comunica en los emails: la de la pausa. */
export function dac7Deadline(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DAC7_BLOCK_AFTER_DAYS * DAY_MS);
}

/** ¿Toca el siguiente recordatorio? (cada 20 días desde la petición o el último, como mucho dos) */
export function dac7ReminderDue(c: { dac7RequestedAt: Date | null; dac7RemindersSent: number; dac7LastReminderAt: Date | null }, now = new Date()): boolean {
  if (!c.dac7RequestedAt || c.dac7RemindersSent >= DAC7_MAX_REMINDERS) return false;
  const last = c.dac7LastReminderAt ?? c.dac7RequestedAt;
  return now.getTime() - last.getTime() >= DAC7_REMINDER_EVERY_DAYS * DAY_MS;
}

// ── Exportación (CSV para la asesoría, con los campos del modelo 238) ──

/** Provincia a partir de los dos primeros dígitos del código postal español. */
const ES_PROVINCES = [
  "Álava", "Albacete", "Alicante", "Almería", "Ávila", "Badajoz", "Illes Balears", "Barcelona", "Burgos", "Cáceres",
  "Cádiz", "Castellón", "Ciudad Real", "Córdoba", "A Coruña", "Cuenca", "Girona", "Granada", "Guadalajara", "Gipuzkoa",
  "Huelva", "Huesca", "Jaén", "León", "Lleida", "La Rioja", "Lugo", "Madrid", "Málaga", "Murcia",
  "Navarra", "Ourense", "Asturias", "Palencia", "Las Palmas", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife", "Cantabria", "Segovia",
  "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia", "Valladolid", "Bizkaia", "Zamora", "Zaragoza",
  "Ceuta", "Melilla",
];

export function provinceOf(postalCode: string | null, country: string | null): string {
  if ((country ?? "ES") !== "ES" || !postalCode || !/^\d{5}$/.test(postalCode.trim())) return "";
  return ES_PROVINCES[Number(postalCode.trim().slice(0, 2)) - 1] ?? "";
}

export const DAC7_CSV_HEADER = [
  "usuario", "nombre_legal", "forma_juridica", "nif", "pais_nif", "fecha_nacimiento", "direccion", "codigo_postal", "ciudad", "provincia", "pais", "iban",
  ...[1, 2, 3, 4].flatMap((q) => [`t${q}_contraprestacion_eur`, `t${q}_actividades`, `t${q}_comisiones_eur`]),
  "total_contraprestacion_eur", "total_actividades", "total_comisiones_eur", "datos_completos", "faltan",
];

const euros = (cents: number) => (cents / 100).toFixed(2);

/** Una fila del CSV de DAC7 (mismo orden que DAC7_CSV_HEADER). */
export function dac7CsvRow(c: Dac7CreatorFields & { username: string }, missing: string[], agg: Dac7Aggregate): string[] {
  const q = (x: Dac7Quarter) => [euros(x.considerationCents), String(x.activities), euros(x.feesCents)];
  return [
    c.username,
    c.legalName ?? "",
    c.legalEntityType === "COMPANY" ? "entidad" : "persona_fisica",
    c.legalTaxId ?? "",
    c.legalCountry ?? "",
    c.birthDate ? c.birthDate.toISOString().slice(0, 10) : "",
    c.legalAddress ?? "",
    c.legalPostalCode ?? "",
    c.legalCity ?? "",
    provinceOf(c.legalPostalCode, c.legalCountry),
    c.legalCountry ?? "",
    c.iban ? normalizeIban(c.iban) : "",
    ...agg.quarters.flatMap(q),
    ...q(agg.total),
    missing.length ? "no" : "si",
    missing.join("; "),
  ];
}

/**
 * CSV con comillas cuando hace falta (los nombres pueden llevar comas o comillas). Un texto que
 * empieza por = + - @ se prefija con ' para que la hoja de cálculo no lo ejecute como fórmula.
 */
export function toCsv(rows: string[][]): string {
  const cell = (raw: string) => {
    const v = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
