/**
 * Genera lib/astro-chiron-table.ts (la longitud de Quirón) a partir de una tabla de JPL Horizons.
 * Solo se usa para regenerarla; la aplicación nunca consulta Horizons.
 *
 *   curl -sS "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='2060%3B'&CENTER='500@399'&EPHEM_TYPE=OBSERVER\
 *     &START_TIME='2000-01-01'&STOP_TIME='2051-01-01'&STEP_SIZE='2d'&QUANTITIES='31'&MAKE_EPHEM=YES&OBJ_DATA=NO&CSV_FORMAT=YES" > chiron.txt
 *   npx tsx scripts/gen-chiron-table.ts chiron.txt
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const src = readFileSync(process.argv[2], "utf8");
const body = src.slice(src.indexOf("$$SOE") + 5, src.indexOf("$$EOE"));
const rows = body.trim().split("\n").map((l) => l.split(",").map((s) => s.trim()));
const first = rows[0][0];
const lons = rows.map((r) => Math.round(Number(r[3]) * 1000));
let out = "";
for (let i = 1; i < lons.length; i++) {
  let d = lons[i] - lons[i - 1];
  if (d > 180000) d -= 360000;
  if (d < -180000) d += 360000;
  const v = d + 2048;
  if (v < 0 || v >= 4096) throw new Error(`salto demasiado grande en la fila ${i}`);
  out += ALPHABET[v >> 6] + ALPHABET[v & 63];
}
/** «2000-Jan-01 00:00» → ISO. */
const iso = (s: string) =>
  new Date(`${s.trim().replace(/-(\w{3})-/, (_, m) => `-${String("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m) / 3 + 1).padStart(2, "0")}-`).replace(" ", "T")}:00Z`).toISOString();
const startIso = iso(first);
const file = `/**
 * Quirón (2060 Chiron): longitud eclíptica geocéntrica aparente de la fecha (zodiaco tropical), cada
 * 2 días a las 00:00 UT, de ${startIso.slice(0, 10)} a ${iso(rows[rows.length - 1][0]).slice(0, 10)}.
 * Generado el ${new Date().toISOString().slice(0, 10)} con scripts/gen-chiron-table.ts desde JPL Horizons
 * (COMMAND='2060;', CENTER='500@399', QUANTITIES='31' = ObsEcLon, STEP_SIZE='2d'; efemérides DE441).
 * No editar a mano.
 *
 * Formato: CHIRON_START_LON en milésimas de grado y, por cada paso, la diferencia con el anterior en
 * milésimas de grado + 2048, en 2 caracteres de base 64 (${ALPHABET.slice(0, 4)}…${ALPHABET.slice(-2)}).
 */
export const CHIRON_START = Date.parse("${startIso}");
export const CHIRON_STEP_DAYS = 2;
export const CHIRON_START_LON = ${lons[0]};
export const CHIRON_ALPHABET = "${ALPHABET}";
export const CHIRON_DELTAS =
  "${out}";
`;
writeFileSync(path.join(__dirname, "..", "lib", "astro-chiron-table.ts"), file);
console.log(`${lons.length} filas, ${out.length} caracteres`);
