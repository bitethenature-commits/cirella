/**
 * Revisión 3 · subir un ZIP desde Windows (o un EPUB sin tipo) funciona de punta a punta.
 *   npx tsx --conditions=react-server scripts/revision-3-test.ts
 *
 *   · createUpload acepta «application/x-zip-compressed» y firma el PUT con el tipo canónico
 *     («application/zip»): las cabeceras que devuelve, la URL firmada del driver y el billete coinciden;
 *   · un archivo sin tipo («») llamado libro.epub se acepta como «application/epub+zip»;
 *   · completeUpload guarda ese tipo canónico en ProductFile.mimeType (y la extensión correcta en la clave);
 *   · un .exe sin tipo sigue rechazándose.
 * Sustituye el tenant por un doble en memoria y usa el driver local en una carpeta temporal:
 * no lee ni escribe en la BD ni en ./storage.
 */
import type { SingleUpload } from "../lib/uploads";
import "./load-env";
import { mkdtempSync, rmSync } from "node:fs";
import Module from "node:module";
import os from "node:os";
import path from "node:path";

const tmp = mkdtempSync(path.join(os.tmpdir(), "cirella-rev3-"));
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_DIR = tmp;

const req = Module.createRequire(__filename);
const root = path.join(__dirname, "..");
function stub(file: string, exports: Record<string, unknown>) {
  const id = path.resolve(root, file);
  req.cache[id] = { id, filename: id, loaded: true, exports } as unknown as NodeJS.Module;
}

const created: Record<string, unknown>[] = [];
stub("./lib/tenant.ts", {
  tenantDb: () => ({
    product: { findFirst: async () => ({ id: "p1" }) },
    productFile: {
      findFirst: async () => null,
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `f${created.length}`, ...data };
      },
    },
  }),
});

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { completeUpload, createUpload } = await import("../lib/uploads");
  const { storage, storageSecret, verifyToken } = await import("../lib/storage");
  const s = storage() as import("../lib/storage").LocalDriver;
  const putToken = (url: string) => s.verify(new URL(url, "http://x").searchParams.get("t"));

  try {
    for (const [name, sent, want, ext] of [
      ["pack.zip", "application/x-zip-compressed", "application/zip", ".zip"],
      ["libro.epub", "", "application/epub+zip", ".epub"],
      ["pista.wav", "audio/wave", "audio/wav", ".wav"],
    ] as const) {
      const body = Buffer.from(`contenido de ${name}`);
      const up = (await createUpload("c1", { purpose: "file", productId: "p1", name, contentType: sent, size: body.length })) as SingleUpload;
      const t = putToken(up.uploadUrl);
      const ticket = verifyToken<{ ct: string; k: string }>(up.ticket, storageSecret());
      check(`${name} (${sent || "sin tipo"}): las cabeceras del PUT llevan ${want}`, up.headers["Content-Type"] === want, up.headers);
      check(`${name}: la URL firmada exige ${want}`, t?.op === "put" && t.ct === want, t);
      check(`${name}: el billete guarda ${want} y la clave acaba en ${ext}`, ticket?.ct === want && ticket.k.endsWith(ext), ticket);
      await s.put(ticket!.k, body, { contentType: want });
      const done = await completeUpload("c1", up.ticket);
      const row = created.at(-1);
      check(`${name}: el ProductFile se crea con mimeType ${want}`, "file" in done && row?.mimeType === want && row?.name === name, row);
    }
    let rejected = false;
    try {
      await createUpload("c1", { purpose: "file", productId: "p1", name: "programa.exe", contentType: "", size: 10 });
    } catch (e) {
      rejected = /Formato no admitido/.test(e instanceof Error ? e.message : String(e));
    }
    check("un .exe sin tipo sigue rechazándose", rejected);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : "\nTodo correcto");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
