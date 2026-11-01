/**
 * Lista de ciudades de GeoNames (public/assets/ciudades/ciudades-v1.json, generada con scripts/gen-cities.ts;
 * licencia CC BY 4.0, https://www.geonames.org): se descarga una vez, al abrir un buscador, y se busca en el
 * navegador. La usan el formulario de nacimiento (chart-birth-form.tsx) y la salida y puesta de la Luna
 * (lunar-model.tsx). Sin dependencias pesadas.
 */

export interface Place {
  /** «Sevilla». */
  label: string;
  /** «Andalucía, España» o «Coordenadas». */
  detail: string;
  lat: number;
  /** Este positiva. */
  lon: number;
  /** Zona IANA («Europe/Madrid») o desfase fijo («UTC+01:00»). */
  tz: string;
}

/* -------------------------------------------------------------------------- *
 *  Ciudades
 * -------------------------------------------------------------------------- */

const CITIES_URL = "/assets/ciudades/ciudades-v1.json";

export type CityRow = [name: string, alias: string, country: number, region: number, lat: number, lon: number, tz: number];
export interface CityFile {
  v: number;
  tz: string[];
  countries: string[];
  regions: string[];
  cities: CityRow[];
}
export interface CityIndex {
  file: CityFile;
  folded: string[];
  foldedAlias: string[];
  foldedCountry: string[];
  countryName: string[];
}

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

let regionNames: Intl.DisplayNames | null | undefined;
export function countryName(cc: string) {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["es"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

let loading: Promise<CityIndex> | null = null;
export function loadCities(): Promise<CityIndex> {
  if (!loading) {
    loading = fetch(CITIES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<CityFile>;
      })
      .then((file) => {
        const countryNames = file.countries.map(countryName);
        return {
          file,
          folded: file.cities.map((c) => fold(c[0])),
          foldedAlias: file.cities.map((c) => fold(c[1])),
          foldedCountry: countryNames.map(fold),
          countryName: countryNames,
        };
      });
    loading.catch(() => (loading = null));
  }
  return loading;
}

export function toPlace(index: CityIndex, i: number): Place {
  const [name, , c, r, lat, lon, tz] = index.file.cities[i];
  const region = r >= 0 ? index.file.regions[r] : "";
  const country = index.countryName[c];
  return {
    label: name,
    detail: [region && region !== name ? region : "", country].filter(Boolean).join(", "),
    lat: lat / 100,
    lon: lon / 100,
    tz: index.file.tz[tz],
  };
}

/** Busca por el principio del nombre (o de una de sus palabras); «sevilla, colombia» filtra por país o región. */
export function searchCities(index: CityIndex, query: string, limit = 8): number[] {
  const [namePart, wherePart] = query.split(",").map(fold);
  if (!namePart || namePart.length < 2) return [];
  const starts: number[] = [];
  const words: number[] = [];
  const { cities, regions } = index.file;
  for (let i = 0; i < cities.length && starts.length < limit; i++) {
    const n = index.folded[i];
    const a = index.foldedAlias[i];
    const head = n.startsWith(namePart) || a.startsWith(namePart);
    const word = !head && (n.includes(` ${namePart}`) || a.includes(` ${namePart}`));
    if (!head && !word) continue;
    if (wherePart) {
      const c = cities[i];
      const region = c[3] >= 0 ? fold(regions[c[3]]) : "";
      if (!index.foldedCountry[c[2]].startsWith(wherePart) && !region.startsWith(wherePart) && index.file.countries[c[2]].toLowerCase() !== wherePart) continue;
    }
    if (head) starts.push(i);
    else if (words.length < limit) words.push(i);
  }
  return [...starts, ...words].slice(0, limit);
}
