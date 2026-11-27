/**
 * El perfil de nacimiento compartido por los cuatro modelos calculados (carta natal, bodygraph, Gene Keys y
 * ciclo lunar), y computeAll(): de un perfil a la carta natal, el Diseño Humano, las Gene Keys y la Luna
 * natal. Puro (sin React, sin red).
 */
import { computeChart, localToUtc, type Chart, type HouseSystem, type NodeKind, type UtcResolution } from "./natal-chart";
import { geneKeysProfile, humanDesignAt, type GeneKeysProfile, type HumanDesign } from "./human-design-calc";
import { natalMoon, type NatalMoon } from "./lunar-sky";

export interface BirthPlaceProfile {
  /** «Sevilla». */
  name: string;
  lat: number;
  /** Longitud este positiva (oeste negativa). */
  lon: number;
  /** Zona IANA («Europe/Madrid») o desfase fijo («UTC+01:00»). */
  tz: string;
  /** «Andalucía, España» (opcional). */
  detail?: string;
}

export interface BirthProfile {
  name: string;
  /** AAAA-MM-DD */
  date: string;
  /** HH:MM, o null si no se sabe la hora (se calcula a las 12:00 locales). */
  time: string | null;
  place: BirthPlaceProfile;
}

/** El formato de los formularios (components/models/chart-birth-form.tsx): `time` + `timeKnown`, `place.label`. */
export interface BirthFormData {
  name: string;
  date: string;
  time: string;
  timeKnown: boolean;
  place: { label: string; detail: string; lat: number; lon: number; tz: string };
}

export function profileToForm(p: BirthProfile): BirthFormData {
  return {
    name: p.name,
    date: p.date,
    time: p.time ?? "12:00",
    timeKnown: p.time !== null,
    place: { label: p.place.name, detail: p.place.detail ?? "", lat: p.place.lat, lon: p.place.lon, tz: p.place.tz },
  };
}

export function formToProfile(d: BirthFormData): BirthProfile {
  return {
    name: d.name,
    date: d.date,
    time: d.timeKnown ? d.time : null,
    place: { name: d.place.label, detail: d.place.detail, lat: d.place.lat, lon: d.place.lon, tz: d.place.tz },
  };
}

/** Hora local de nacimiento → instante UTC (sin hora: las 12:00 locales). */
export function profileUtc(p: BirthProfile): UtcResolution {
  const [year, month, day] = p.date.split("-").map(Number);
  const [hour, minute] = (p.time ?? "12:00").split(":").map(Number);
  return localToUtc({ year, month, day, hour, minute }, p.place.tz);
}

export interface ComputedProfile {
  profile: BirthProfile;
  utc: Date;
  timeKnown: boolean;
  chart: Chart;
  humanDesign: HumanDesign;
  geneKeys: GeneKeysProfile;
  natalMoon: NatalMoon;
}

export function computeAll(
  profile: BirthProfile,
  opts: { houseSystem?: HouseSystem; node?: NodeKind } = {},
): ComputedProfile {
  const utc = profileUtc(profile).utc;
  const timeKnown = profile.time !== null;
  const chart = computeChart({
    utc,
    timeKnown,
    lat: profile.place.lat,
    lon: profile.place.lon,
    // Signos enteros en toda la web (cada signo, una casa, desde el del Ascendente).
    houseSystem: opts.houseSystem ?? "whole",
    node: opts.node ?? "mean",
  });
  const humanDesign = humanDesignAt(utc);
  return {
    profile,
    utc,
    timeKnown,
    chart,
    humanDesign,
    geneKeys: geneKeysProfile(humanDesign),
    natalMoon: natalMoon({ date: profile.date, time: profile.time ?? "12:00", timeKnown, tz: profile.place.tz }),
  };
}
