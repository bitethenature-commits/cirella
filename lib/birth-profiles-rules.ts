/**
 * Perfiles de nacimiento guardados («Mi energía», /cuenta/mi-energia): las relaciones, los textos de
 * consentimiento, la validación del formulario (Zod) y el paso de la fila de la BD al perfil que
 * calculan los modelos (lib/birth-profile.ts). Puro (sin BD): lo usan las acciones, la API de acceso,
 * los componentes y la semilla.
 *
 * Privacidad: un perfil es de la alumna que lo guarda (userId) en la web de la dueña (creatorId). Ni
 * la fecha ni el lugar viajan en una dirección: las páginas solo llevan el id (?perfil=…).
 */
import { z } from "zod";
import type { BirthProfile } from "./birth-profile";

export const BIRTH_RELATIONS = ["yo", "pareja", "hijo", "amiga", "clienta", "otro"] as const;
export type BirthRelation = (typeof BIRTH_RELATIONS)[number];

export const BIRTH_RELATION_LABEL: Record<BirthRelation, string> = {
  yo: "Yo",
  pareja: "Pareja",
  hijo: "Hijo/a",
  amiga: "Amiga",
  clienta: "Clienta",
  otro: "Otra persona",
};

/** Casilla al guardar los datos propios. */
export const OWN_CONSENT_TEXT = "Guardo estos datos para calcular cartas; puedes borrarlos cuando quieras.";
/** Casilla al guardar los datos de otra persona. */
export const OTHER_CONSENT_TEXT = "Tengo permiso de esta persona para guardar sus datos.";

/** Como mucho, tantas personas guardadas por alumna (de sobra para familia y amigas). */
export const BIRTH_PROFILES_MAX = 40;
export const BIRTH_NAME_MAX = 60;

export const BIRTH_DATE_MIN = "1900-01-01";
export const BIRTH_DATE_MAX = "2050-12-31";

/** Un perfil guardado tal como llega al navegador: el BirthProfile de los modelos más su id y relación. */
export interface SavedBirthProfile extends BirthProfile {
  id: string;
  relation: BirthRelation | null;
  isOwn: boolean;
}

export type BirthProfileRow = {
  id: string;
  name: string;
  relation: string | null;
  isOwn: boolean;
  birthDate: string;
  birthTime: string | null;
  placeName: string;
  placeDetail: string | null;
  lat: number;
  lon: number;
  tz: string;
};

export function asRelation(r: string | null | undefined): BirthRelation | null {
  return r && (BIRTH_RELATIONS as readonly string[]).includes(r) ? (r as BirthRelation) : null;
}

export function toSavedProfile(r: BirthProfileRow): SavedBirthProfile {
  return {
    id: r.id,
    name: r.name,
    relation: asRelation(r.relation),
    isOwn: r.isOwn,
    date: r.birthDate,
    time: r.birthTime,
    place: { name: r.placeName, detail: r.placeDetail ?? undefined, lat: r.lat, lon: r.lon, tz: r.tz },
  };
}

/** El propio primero; luego por nombre. */
export function sortProfiles<T extends { isOwn: boolean; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.isOwn === b.isOwn ? a.name.localeCompare(b.name, "es") : a.isOwn ? -1 : 1));
}

/** El perfil elegido por id (de la dirección) o, si no hay o no es suyo, el propio, o el primero. */
export function pickProfile<T extends { id: string; isOwn: boolean }>(list: T[], id: string | null | undefined): T | null {
  return (id ? list.find((p) => p.id === id) : undefined) ?? list.find((p) => p.isOwn) ?? list[0] ?? null;
}

const validDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Zona IANA que reconoce el sistema o un desfase fijo «UTC+01:00» (como lib/natal-chart.ts → isValidZone). */
export function isZoneLike(tz: string): boolean {
  if (/^(?:UTC|GMT)?\s*[+\-−]\s*\d{1,2}(?::?\d{2})?$/i.test(tz.trim()) || /^(?:UTC|GMT)$/i.test(tz.trim())) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Lo que mandan los formularios de «Mi energía» (y el de los modelos, si se marca «Guardar»). */
export const birthProfileInputSchema = z
  .object({
    id: z.string().max(40).optional(),
    name: z.string().trim().min(1, "Escribe un nombre para reconocer estos datos").max(BIRTH_NAME_MAX, `El nombre admite ${BIRTH_NAME_MAX} caracteres`),
    relation: z.enum(BIRTH_RELATIONS).nullable().default(null),
    isOwn: z.boolean().default(false),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Escribe la fecha de nacimiento")
      .refine((d) => d >= BIRTH_DATE_MIN && d <= BIRTH_DATE_MAX && validDate(d), "La fecha debe ser real y estar entre 1900 y 2050"),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora no es válida")
      .nullable(),
    place: z.object({
      name: z.string().trim().min(1, "Elige el lugar de nacimiento").max(120),
      detail: z.string().trim().max(160).optional(),
      lat: z.number().finite().min(-90).max(90),
      lon: z.number().finite().min(-180).max(180),
      tz: z.string().trim().min(1).max(64).refine(isZoneLike, "Esa zona horaria no se reconoce"),
    }),
    consent: z.literal(true, { errorMap: () => ({ message: "Marca la casilla para poder guardar los datos" }) }),
  })
  .transform((d) => ({ ...d, relation: d.isOwn ? ("yo" as const) : d.relation === "yo" ? null : d.relation }));
export type BirthProfileInput = z.input<typeof birthProfileInputSchema>;

/** Las columnas de la fila a partir de lo validado. */
export function profileColumns(d: z.output<typeof birthProfileInputSchema>) {
  return {
    name: d.name,
    relation: d.relation,
    isOwn: d.isOwn,
    birthDate: d.date,
    birthTime: d.time,
    placeName: d.place.name,
    placeDetail: d.place.detail || null,
    lat: d.place.lat,
    lon: d.place.lon,
    tz: d.place.tz,
  };
}

/** «14 de noviembre de 1988». */
export function longBirthDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** «14 nov 1988 · 07:45 · Sevilla» (o «hora desconocida»). */
export function profileSummary(p: Pick<BirthProfile, "date" | "time" | "place">): string {
  return `${longBirthDate(p.date)} · ${p.time ?? "hora desconocida"} · ${p.place.name}`;
}
