/**
 * Genera public/assets/ciudades/ciudades-v1.json: las ciudades del buscador de lugar de nacimiento de la
 * carta natal (components/models/chart-model.tsx). Solo se usa para regenerarlo; la web nunca consulta
 * GeoNames: el navegador descarga el JSON (estático) cuando alguien abre «Calcular mi carta».
 *
 * Datos: GeoNames (https://www.geonames.org), licencia Creative Commons Attribution 4.0
 * (https://creativecommons.org/licenses/by/4.0/). La carta lo cita («Datos de ciudades: GeoNames»).
 *
 *   DIR=/tmp/geonames; mkdir -p $DIR && cd $DIR
 *   for f in cities15000.zip cities1000.zip admin1CodesASCII.txt countryInfo.txt alternateNamesV2.zip; do
 *     curl -sSO https://download.geonames.org/export/dump/$f; done
 *   unzip -o cities15000.zip; unzip -o cities1000.zip; unzip -o alternateNamesV2.zip alternateNamesV2.txt
 *   npx tsx scripts/gen-cities.ts $DIR
 *
 * Qué entra:
 *   · España: los núcleos de 1000 habitantes o más (cities1000), para que salgan los pueblos.
 *   · Europa y América (norte, centro y sur): 15 000 habitantes o más (cities15000).
 *   · El resto del mundo: 100 000 o más.
 *   Sin los barrios de una ciudad (PPLX) ni los lugares abandonados o históricos (PPLH, PPLQ, PPLW).
 * Nombres: el nombre en español de GeoNames si lo hay (Londres, Múnich, Nueva York) y el local como
 * segundo nombre de búsqueda (en España al revés: A Coruña, y La Coruña para buscar); la región (admin1), también en español si lo hay. El país se nombra en el
 * navegador (Intl.DisplayNames), no va en el archivo.
 *
 * Formato: { v, tz: [zonas IANA], countries: [ISO 3166], regions: [nombres], cities: [[nombre, otro
 * nombre o "", país, región (-1 = ninguna), lat, lon, zona]] }, de más a menos habitantes (el orden sirve
 * para ordenar lo que se encuentra), con lat/lon en centésimas de grado enteras (≈ 1 km: el ascendente
 * cambia menos de un minuto de arco).
 */
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const dir = process.argv[2];
if (!dir) throw new Error("Uso: npx tsx scripts/gen-cities.ts <carpeta con los archivos de GeoNames>");

const SKIP_FEATURES = new Set(["PPLX", "PPLH", "PPLQ", "PPLW"]);

const continent = new Map<string, string>();
for (const line of readFileSync(path.join(dir, "countryInfo.txt"), "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const f = line.split("\t");
  continent.set(f[0], f[8]);
}

type Row = { id: string; name: string; ascii: string; lat: number; lon: number; feature: string; cc: string; admin1: string; pop: number; tz: string };
const parse = (line: string): Row | null => {
  const f = line.split("\t");
  if (f.length < 18) return null;
  return { id: f[0], name: f[1], ascii: f[2], lat: Number(f[4]), lon: Number(f[5]), feature: f[7], cc: f[8], admin1: f[10], pop: Number(f[14]) || 0, tz: f[17] };
};

const rows = new Map<string, Row>();
const keep = (r: Row | null, minPop: (cc: string) => number) => {
  if (!r || !r.tz || SKIP_FEATURES.has(r.feature) || r.pop < minPop(r.cc)) return;
  rows.set(r.id, r);
};
const minPop = (cc: string) => {
  const c = continent.get(cc);
  return c === "EU" || c === "NA" || c === "SA" ? 15000 : 100000;
};
for (const line of readFileSync(path.join(dir, "cities15000.txt"), "utf8").split("\n")) keep(parse(line), minPop);
for (const line of readFileSync(path.join(dir, "cities1000.txt"), "utf8").split("\n")) {
  const r = parse(line);
  if (r?.cc === "ES") keep(r, () => 1000);
}

const admin1 = new Map<string, { name: string; id: string }>();
for (const line of readFileSync(path.join(dir, "admin1CodesASCII.txt"), "utf8").split("\n")) {
  const f = line.split("\t");
  if (f.length >= 4) admin1.set(f[0], { name: f[1], id: f[3] });
}

// Nombres en español (alternateNamesV2: id, geonameid, lengua, nombre, preferido, corto, coloquial, histórico).
async function spanishNames(ids: Set<string>) {
  const best = new Map<string, { name: string; score: number }>();
  const all = new Map<string, string[]>();
  const rl = createInterface({ input: createReadStream(path.join(dir, "alternateNamesV2.txt"), "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    const f = line.split("\t");
    if (f[2] !== "es" || !ids.has(f[1])) continue;
    if (f[6] === "1" || f[7] === "1") continue;
    const score = (f[4] === "1" ? 2 : 0) + (f[5] === "1" ? 0 : 1);
    all.set(f[1], [...(all.get(f[1]) ?? []), f[3]]);
    const cur = best.get(f[1]);
    if (!cur || score > cur.score) best.set(f[1], { name: f[3], score });
  }
  return { best: new Map([...best].map(([k, v]) => [k, v.name])), all };
}

async function main() {
  const adminIds = new Set([...admin1.values()].map((a) => a.id));
  const { best: es, all: esAll } = await spanishNames(new Set([...rows.keys(), ...adminIds]));

  const tz: string[] = [];
  const countries: string[] = [];
  const regions: string[] = [];
  const idx = (list: string[], v: string) => {
    let i = list.indexOf(v);
    if (i < 0) i = list.push(v) - 1;
    return i;
  };
  /** «Comunidad Autónoma de Andalucía» → «Andalucía», «Región de Toscana» → «Toscana». */
  const shortRegion = (s: string) => s.replace(/^(Comunidad Autónoma|Región|Provincia|Departamento)( de la| del| de)? /u, "");
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  const sorted = [...rows.values()].sort((a, b) => b.pop - a.pop);
  const cities = sorted.map((r) => {
    const local = r.name;
    const spanish = es.get(r.id);
    // En España, el nombre oficial (A Coruña, Lleida) y el castellano para buscar; fuera, el español.
    const name = r.cc === "ES" ? local : (spanish ?? local);
    // En España, el castellano aunque no sea el preferido (Lleida → Lérida, Girona → Gerona).
    const other = r.cc === "ES" ? (esAll.get(r.id) ?? []).find((n) => fold(n) !== fold(local)) : local;
    const alias = other && fold(other) !== fold(name) ? other : fold(r.ascii) !== fold(name) ? r.ascii : "";
    const a = admin1.get(`${r.cc}.${r.admin1}`);
    const region = a ? idx(regions, shortRegion(es.get(a.id) ?? a.name)) : -1;
    return [name, alias, idx(countries, r.cc), region, Math.round(r.lat * 100), Math.round(r.lon * 100), idx(tz, r.tz)];
  });

  const out = path.join(__dirname, "..", "public", "assets", "ciudades");
  mkdirSync(out, { recursive: true });
  const json = JSON.stringify({ v: 1, source: "GeoNames (geonames.org), CC BY 4.0", tz, countries, regions, cities });
  writeFileSync(path.join(out, "ciudades-v1.json"), json);
  console.log(`${cities.length} ciudades, ${countries.length} países, ${tz.length} zonas, ${json.length} bytes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
