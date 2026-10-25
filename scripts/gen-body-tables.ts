/**
 * Genera lib/astro-tables.ts: la longitud de Quirón, Ceres, Palas, Juno, Vesta y Eris a partir de
 * tablas de JPL Horizons. Solo se usa para regenerarla; la aplicación nunca consulta Horizons.
 *
 *   for b in "2060:chiron:2d" "1:ceres:1d" "2:pallas:1d" "3:juno:1d" "4:vesta:1d" "136199:eris:7d"; do
 *     IFS=: read id name step <<< "$b"
 *     curl -sS "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='${id}%3B'&CENTER='500@399'\
 *   &EPHEM_TYPE=OBSERVER&START_TIME='2000-01-01'&STOP_TIME='2051-01-01'&STEP_SIZE='${step}'&QUANTITIES='31'\
 *   &MAKE_EPHEM=YES&OBJ_DATA=NO&CSV_FORMAT=YES" > "$DIR/$name.txt"
 *   done
 *   npx tsx scripts/gen-body-tables.ts "$DIR"
 *
 * Los asteroides se piden cada día y se guarda uno de cada dos (cada 2 días): interpolando, el
 * día del medio sale a menos de 0,0002° del de Horizons. Quirón va cada 2 días y Eris, cada 7.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** nombre → [archivo, días entre filas de Horizons, guardar 1 de cada N] */
const BODIES: Record<string, [string, number, number]> = {
  Chiron: ["chiron.txt", 2, 1],
  Ceres: ["ceres.txt", 1, 2],
  Pallas: ["pallas.txt", 1, 2],
  Juno: ["juno.txt", 1, 2],
  Vesta: ["vesta.txt", 1, 2],
  Eris: ["eris.txt", 7, 1],
};
const MONTHS = "JanFebMarAprMayJunJulAugSepOctNovDec";
/** «2000-Jan-01 00:00» → ISO. */
const iso = (s: string) =>
  new Date(`${s.trim().replace(/-(\w{3})-/, (_, m) => `-${String(MONTHS.indexOf(m) / 3 + 1).padStart(2, "0")}-`).replace(" ", "T")}:00Z`).toISOString();

const dir = process.argv[2];
const entries: string[] = [];
const notes: string[] = [];
for (const [name, [file, stepDays, every]] of Object.entries(BODIES)) {
  const src = readFileSync(path.join(dir, file), "utf8");
  const target = /Target body name: (.+?)\s{2,}/.exec(src)?.[1] ?? name;
  const body = src.slice(src.indexOf("$$SOE") + 5, src.indexOf("$$EOE"));
  const rows = body.trim().split("\n").map((l) => l.split(",").map((s) => s.trim())).filter((_, i) => i % every === 0);
  const lons = rows.map((r) => Math.round(Number(r[3]) * 1000));
  let out = "";
  for (let i = 1; i < lons.length; i++) {
    let d = lons[i] - lons[i - 1];
    if (d > 180000) d -= 360000;
    if (d < -180000) d += 360000;
    const v = d + 2048;
    if (v < 0 || v >= 4096) throw new Error(`${name}: salto demasiado grande en la fila ${i}`);
    out += ALPHABET[v >> 6] + ALPHABET[v & 63];
  }
  const start = iso(rows[0][0]);
  notes.push(` *   ${name.padEnd(7)} ${target}: cada ${stepDays * every} días, de ${start.slice(0, 10)} a ${iso(rows[rows.length - 1][0]).slice(0, 10)}`);
  entries.push(`  ${name}: { start: Date.parse("${start}"), stepDays: ${stepDays * every}, startLon: ${lons[0]}, deltas: "${out}" },`);
}
const file = `/**
 * Longitud eclíptica geocéntrica aparente de la fecha (zodiaco tropical), a las 00:00 UT, de cuerpos
 * que astronomy-engine no calcula. Generado el ${new Date().toISOString().slice(0, 10)} con scripts/gen-body-tables.ts desde JPL
 * Horizons (CENTER='500@399', QUANTITIES='31' = ObsEcLon; efemérides DE441 y las órbitas de JPL).
 * No editar a mano.
${notes.join("\n")}
 *
 * Formato: startLon en milésimas de grado y, por cada paso, la diferencia con el anterior en
 * milésimas de grado + 2048, en 2 caracteres de base 64 (BODY_TABLE_ALPHABET).
 */
export const BODY_TABLE_ALPHABET = "${ALPHABET}";

export type BodyTable = { start: number; stepDays: number; startLon: number; deltas: string };

export const BODY_TABLES = {
${entries.join("\n")}
} satisfies Record<string, BodyTable>;
`;
writeFileSync(path.join(__dirname, "..", "lib", "astro-tables.ts"), file);
console.log(`${Object.keys(BODIES).length} cuerpos, ${file.length} bytes`);
