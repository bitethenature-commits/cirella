/**
 * Genera lib/cities-data.ts (las ciudades para el lugar de nacimiento de la carta natal) a partir de
 * GeoNames. Solo se usa para regenerarla; la aplicación nunca consulta GeoNames.
 *
 *   curl -O https://download.geonames.org/export/dump/cities15000.zip && unzip cities15000.zip
 *   curl -O https://download.geonames.org/export/dump/admin1CodesASCII.txt
 *   npx tsx scripts/gen-cities.ts cities15000.txt admin1CodesASCII.txt
 *
 * Qué entra: todas las de España y de Latinoamérica (más de 15.000 habitantes), las de Europa de
 * más de 50.000, las de EE. UU. y Canadá de más de 150.000 y el resto del mundo de más de 400.000.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const LATAM = new Set("MX GT BZ HN SV NI CR PA CU DO PR CO VE EC PE BO CL AR UY PY GQ".split(" "));
const EUROPE = new Set(
  "AD AL AT BA BE BG BY CH CY CZ DE DK EE FI FO FR GB GI GR HR HU IE IM IS IT JE GG LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK".split(" "),
);
const [citiesFile, adminFile] = process.argv.slice(2);
const admin = new Map<string, string>();
for (const line of readFileSync(adminFile, "utf8").split("\n")) {
  const [code, name] = line.split("\t");
  if (code) admin.set(code, name);
}
type Row = { name: string; region: string; cc: string; lat: number; lon: number; tz: string; pop: number };
const rows: Row[] = [];
for (const line of readFileSync(citiesFile, "utf8").split("\n")) {
  const f = line.split("\t");
  if (f.length < 18) continue;
  const cc = f[8];
  const pop = Number(f[14]);
  const keep = cc === "ES" || LATAM.has(cc) || (cc === "BR" && pop >= 100_000) || (EUROPE.has(cc) && pop >= 50_000) || ((cc === "US" || cc === "CA") && pop >= 150_000) || pop >= 400_000;
  if (!keep) continue;
  rows.push({ name: f[1], region: admin.get(`${cc}.${f[10]}`) ?? "", cc, lat: Number(f[4]), lon: Number(f[5]), tz: f[17], pop });
}
rows.sort((a, b) => b.pop - a.pop);
const zones = [...new Set(rows.map((r) => r.tz))].sort();
const clean = (s: string) => s.replace(/[|\n]/g, " ");
const lines = rows.map((r) => [clean(r.name), clean(r.region), r.cc, r.lat.toFixed(3), r.lon.toFixed(3), zones.indexOf(r.tz), Math.round(r.pop / 1000)].join("|"));
const file = `/**
 * Ciudades para el lugar de nacimiento de la carta natal: nombre|región|país|lat|lon|zona|miles de habitantes,
 * de mayor a menor población. ${rows.length} ciudades.
 *
 * Fuente: GeoNames (cities15000 y admin1CodesASCII, https://www.geonames.org), licencia Creative
 * Commons Attribution 4.0 (CC BY 4.0). Generado el ${new Date().toISOString().slice(0, 10)} con scripts/gen-cities.ts.
 * No editar a mano.
 */
export const CITY_ZONES = ${JSON.stringify(zones)};
export const CITY_ROWS = ${JSON.stringify(lines.join("\n"))};
`;
writeFileSync(path.join(__dirname, "..", "lib", "cities-data.ts"), file);
console.log(`${rows.length} ciudades, ${zones.length} zonas, ${file.length} bytes`);
