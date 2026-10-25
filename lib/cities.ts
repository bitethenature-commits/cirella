/**
 * Buscador de ciudades para el lugar de nacimiento (sin servicios de fuera): la lista de GeoNames de
 * lib/cities-data.ts, sin tildes ni mayúsculas, por el principio del nombre o de una de sus palabras,
 * y los nombres en español de las grandes ciudades del mundo («Londres», «Nueva York»).
 * Solo en el servidor (la lista pesa ~340 KB): lo usa la acción de buscar de la carta natal.
 */
import { CITY_ROWS, CITY_ZONES } from "./cities-data";

export type City = { name: string; region: string; country: string; cc: string; lat: number; lon: number; timezone: string; label: string };

/** Nombre en español → el de GeoNames. */
const ALIASES: Record<string, string> = {
  londres: "London",
  "nueva york": "New York City",
  paris: "Paris",
  roma: "Rome",
  milan: "Milan",
  florencia: "Florence",
  venecia: "Venice",
  napoles: "Naples",
  turin: "Turin",
  genova: "Genoa",
  munich: "Munich",
  colonia: "Cologne",
  francfort: "Frankfurt am Main",
  hamburgo: "Hamburg",
  berlin: "Berlin",
  viena: "Vienna",
  praga: "Prague",
  varsovia: "Warsaw",
  cracovia: "Kraków",
  bruselas: "Brussels",
  amberes: "Antwerpen",
  amsterdam: "Amsterdam",
  "la haya": "The Hague",
  ginebra: "Geneva",
  zurich: "Zürich",
  basilea: "Basel",
  lisboa: "Lisbon",
  oporto: "Porto",
  moscu: "Moscow",
  "san petersburgo": "Saint Petersburg",
  estocolmo: "Stockholm",
  copenhague: "Copenhagen",
  atenas: "Athens",
  estambul: "Istanbul",
  dublin: "Dublin",
  edimburgo: "Edinburgh",
  bucarest: "Bucharest",
  marsella: "Marseille",
  burdeos: "Bordeaux",
  tolosa: "Toulouse",
  niza: "Nice",
  "el cairo": "Cairo",
  pekin: "Beijing",
  tokio: "Tokyo",
  sidney: "Sydney",
  "ciudad del cabo": "Cape Town",
  "nueva delhi": "New Delhi",
  "los angeles": "Los Angeles",
  filadelfia: "Philadelphia",
  "nueva orleans": "New Orleans",
  "ciudad de mexico": "Mexico City",
  "sao paulo": "São Paulo",
  "rio de janeiro": "Rio de Janeiro",
  "san juan": "San Juan",
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Row = { name: string; key: string; region: string; cc: string; lat: number; lon: number; tz: string; pop: number };
let rows: Row[] | null = null;
function load(): Row[] {
  if (rows) return rows;
  rows = CITY_ROWS.split("\n").map((l) => {
    const [name, region, cc, lat, lon, tz, pop] = l.split("|");
    return { name, key: norm(name), region, cc, lat: Number(lat), lon: Number(lon), tz: CITY_ZONES[Number(tz)], pop: Number(pop) };
  });
  return rows;
}

let countries: Intl.DisplayNames | null = null;
export function countryName(cc: string) {
  try {
    countries ??= new Intl.DisplayNames(["es"], { type: "region" });
    return countries.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

function toCity(r: Row): City {
  const country = countryName(r.cc);
  const label = [r.name, r.region && r.region !== r.name ? r.region : null, country].filter(Boolean).join(", ");
  return { name: r.name, region: r.region, country, cc: r.cc, lat: r.lat, lon: r.lon, timezone: r.tz, label };
}

/** Hasta `limit` ciudades que empiezan por lo escrito (o tienen una palabra que empieza así), las más pobladas antes. */
export function searchCities(query: string, limit = 8): City[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const all = load();
  const aliasTargets = new Set(Object.entries(ALIASES).filter(([k]) => k.startsWith(q)).map(([, v]) => norm(v)));
  const scored: { r: Row; score: number }[] = [];
  for (const r of all) {
    let score = -1;
    if (aliasTargets.has(r.key)) score = 3;
    else if (r.key === q) score = 2;
    else if (r.key.startsWith(q)) score = 1;
    else if (r.key.includes(` ${q}`)) score = 0;
    // La web es española: a igual nombre, antes la de España.
    if (score >= 0) scored.push({ r, score: score === 2 && r.cc === "ES" ? 2.5 : score });
  }
  // Las filas ya van de más a menos habitantes: a igual puntuación se queda ese orden.
  scored.sort((a, b) => b.score - a.score);
  const out: City[] = [];
  for (const s of scored) {
    const c = toCity(s.r);
    // GeoNames tiene alguna ciudad dos veces (el municipio y el núcleo): basta una.
    if (!out.some((o) => o.label === c.label)) out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
