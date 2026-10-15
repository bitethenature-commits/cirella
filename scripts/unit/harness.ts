/**
 * Mini-arnés de pruebas unitarias (sin dependencias).
 *
 * Cada archivo scripts/unit/<tema>.test.ts registra sus casos con `test()` al importarse;
 * scripts/unit-tests.ts (`npm run test:unit`) los importa todos y los ejecuta en orden.
 *
 *   import { eq, test } from "./harness";
 *   test("parseMoneyToCents admite coma decimal", () => eq(parseMoneyToCents("49,90"), 4990));
 */
import { deepStrictEqual } from "node:assert/strict";

type Case = { name: string; file: string; fn: () => unknown | Promise<unknown> };

const cases: Case[] = [];
let currentFile = "";

/** Registra un caso. Falla si lanza una excepción (o si su promesa se rechaza). */
export function test(name: string, fn: () => unknown | Promise<unknown>) {
  cases.push({ name, file: currentFile, fn });
}

/** Igualdad profunda y estricta (primitivos, arrays, objetos, fechas…). */
export function eq<T>(got: T, want: T, message?: string) {
  try {
    deepStrictEqual(got, want);
  } catch {
    throw new Error(`${message ? `${message}: ` : ""}${show(got)} (esperado ${show(want)})`);
  }
}

export function ok(condition: unknown, message = "se esperaba una condición verdadera"): asserts condition {
  if (!condition) throw new Error(message);
}

/** El código debe lanzar una excepción; con `match`, su mensaje debe encajar. */
export async function throws(fn: () => unknown | Promise<unknown>, match?: RegExp) {
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (match && !match.test(msg)) throw new Error(`lanzó «${msg}», que no encaja con ${match}`);
    return;
  }
  throw new Error("se esperaba una excepción");
}

function show(v: unknown) {
  if (typeof v === "string") return JSON.stringify(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Marca el archivo al que pertenecen los casos que se registren a continuación. */
export function setCurrentFile(file: string) {
  currentFile = file;
}

/** Ejecuta todos los casos registrados; devuelve el número de fallos. */
export async function runAll() {
  let failures = 0;
  let lastFile: string | null = null;
  for (const c of cases) {
    if (c.file !== lastFile) {
      if (c.file) console.log(`\n· ${c.file}`);
      lastFile = c.file;
    }
    try {
      await c.fn();
      console.log(`✓ ${c.name}`);
    } catch (e) {
      failures++;
      console.log(`✗ ${c.name} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(failures ? `\n${failures} de ${cases.length} pruebas fallidas` : `\nLas ${cases.length} pruebas unitarias pasan ✓`);
  return failures;
}
